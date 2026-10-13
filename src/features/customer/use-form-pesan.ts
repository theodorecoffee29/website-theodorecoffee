// File ini: logika form pesan customer.
//
// Hook ini mengurus isi form, pemuatan menu (termasuk muat ulang otomatis),
// validasi, total perkiraan, dan pengiriman pesanan.
//
// Mengikuti aturan di AGENTS.md: logika ada di src/features/, sementara
// komponen tampilan di src/components/ hanya menerima props.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ambilMenu,
  kirimLogErrorKeServer,
  kirimPesanan,
  type MenuItem,
} from "./api";
import {
  barisTidakTersediaTerpilih,
  susunBarisPesanan,
  sidikJariPesanan,
  type BarisPesananTampil,
  type IsiBaris,
} from "./daftar-menu";
import { POLLING_MENU_MS } from "./polling";
import { tambahOrderAktif } from "./penyimpan-order";
import { apakahUuidValid } from "@/lib/uuid";
import {
  bolehKirim,
  hitungTotal,
  menjadiItemSiapKirim,
  validasiCatatan,
  validasiNama,
  validasiQty,
  type BarisPesanan,
} from "./validasi-form";
import { teksCustomer } from "./teks";

// Keadaan form yang diteruskan ke komponen tampilan.
export type KeadaanFormPesan = {
  // Baris menu yang ditampilkan: satu baris per menu, lengkap dengan isian
  // pengguna dan penanda ketersediaannya.
  barisPesanan: BarisPesananTampil[];
  // Nama customer.
  customerName: string;
  // Total perkiraan. HANYA untuk ditampilkan (server yang menghitung sebenarnya).
  total: number;
  // True kalau tombol kirim boleh ditekan.
  tombolKirimAktif: boolean;
  // True selama pesanan sedang dikirim (tombol dinonaktifkan).
  sedangMengirim: boolean;
  // True ketika menu belum selesai dimuat untuk pertama kali.
  memuatMenu: boolean;
  // Pesan umum di atas form (mis. gagal kirim), atau null.
  pesanError: string | null;
  // Pesan kecil soal muat ulang daftar menu (gagal, atau menu tidak tersedia),
  // atau null. Tidak menghapus apa pun yang sudah tampil.
  pesanMenu: string | null;
  // Pesan khusus nama, untuk memberitahu di sebelah isian nama.
  pesanNama: string | null;
  // Pesan khusus item (jumlah atau catatan), atau null.
  pesanItem: string | null;
  // Aksi yang dipanggil komponen tampilan.
  ubahNama: (nilai: string) => void;
  ubahQty: (menuItemId: string, nilai: string) => void;
  ubahCatatan: (menuItemId: string, nilai: string) => void;
  kirimPesananSekarang: () => void;
};

/**
 * Mengurus form pesan: isi, pemuatan menu, validasi, total, dan pengiriman.
 *
 * Output: KeadaanFormPesan yang diteruskan ke komponen tampilan.
 *
 * Cara kerja:
 *   1. Menu diambil dari /api/menu saat form dibuka, lalu dimuat ulang otomatis
 *      setiap 30 detik selama tab terlihat (docs/api-contract.md bagian 5).
 *   2. Setiap menu punya baris pesanan sendiri (jumlah dan satu catatan).
 *      Saat menu dimuat ulang, isian yang sudah diketik TIDAK dihapus
 *      (lihat daftar-menu.ts).
 *   3. Tombol kirim aktif kalau nama valid, ada minimal satu item, dan tidak
 *      ada menu terpilih yang sudah tidak tersedia.
 *   4. Saat dikirim, idempotencyKey dipakai ulang kalau isi pesanan sama
 *      persis dengan percobaan sebelumnya, dan dibuat baru kalau isi pesanan
 *      berubah. Ini mencegah klik ganda membuat dua order dengan isi berbeda
 *      (docs/api-contract.md bagian 4).
 */
export function useFormPesan(): KeadaanFormPesan {
  // Router Next.js dipakai untuk berpindah halaman setelah pesanan berhasil
  // dibuat (menggantikan window.location.href supaya navigasi ikut di-handle
  // oleh Next.js).
  const router = useRouter();

  const [daftarMenu, setDaftarMenu] = useState<MenuItem[]>([]);
  const [sedangMuatAwal, setSedangMuatAwal] = useState(true);
  const [isiBaris, setIsiBaris] = useState<IsiBaris>({});
  const [customerName, setCustomerName] = useState("");
  const [sedangMengirim, setSedangMengirim] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);
  const [pesanMenu, setPesanMenu] = useState<string | null>(null);

  // Kunci anti-ganda (idempotencyKey) beserta sidik jari isi pesanan saat kunci
  // itu dibuat. Dipakai useRef supaya bertahan antar render tanpa memicu
  // render ulang.
  const kunciRef = useRef<{ sidikJari: string; key: string } | null>(null);
  // Flag supaya pemuatan menu yang masih berjalan tidak menimpa keadaan baru
  // setelah halaman ditutup.
  const berhentiRef = useRef(false);
  // Cegah dua pemuatan menu berjalan bersamaan (mis. interval 30 detik
  // bersamaan dengan pemuatan ulang karena tab baru terlihat).
  const sedangMemuatMenuRef = useRef(false);

  /**
   * Mengambil daftar menu dari server lalu menempelkan isian pengguna yang
   * sudah ada.
   *
   * Output: Promise<void>. Hasilnya disimpan ke state, bukan dikembalikan.
   *
   * Kenapa gagal tidak menghapus daftar yang sudah tampil: daftar menu adalah
   * data yang sedang dipakai pengguna untuk memilih. Kalau tiba-tiba hilang
   * karena koneksi putus, pesan yang sudah diketik ikut hilang. Jadi yang
   * gagal hanya menampilkan pesan kecil, dan percobaan berikutnya (30 detik
   * kemudian) mengulangi sendiri.
   */
  const muatMenu = useCallback(
    async (muatAwal: boolean): Promise<void> => {
    if (sedangMemuatMenuRef.current) {
      return;
    }
    sedangMemuatMenuRef.current = true;

    const hasil = await ambilMenu();

    sedangMemuatMenuRef.current = false;

    if (berhentiRef.current) {
      return;
    }

    setSedangMuatAwal(false);

    if (!hasil.berhasil) {
      // Pemuatan pertama gagal: belum ada daftar untuk ditampilkan, jadi
      // pesan yang lebih jelas ditampilkan lewat pesanError.
      if (muatAwal) {
        setPesanError(hasil.error.message);
      } else {
        setPesanMenu(teksCustomer.formPesan.pesanGagalMuatUlang);
      }
      return;
    }

    // Berhasil: daftar baru akan digabung dengan isian pengguna di dalam
    // susunBarisPesanan (dipanggil di bawah lewat useMemo).
    setDaftarMenu(hasil.data);
    setPesanMenu(null);
    },
    [],
  );

  // Pemuatan menu: sekali di awal, lalu setiap 30 detik selama tab terlihat.
  // Efek ini hanya hidup selama form pesan tampil, karena hook ini hanya
  // dipasang di halaman yang sedang menampilkan form.
  useEffect(() => {
    berhentiRef.current = false;

    // Muat pertama kali (ditunda satu tick supaya render pertama selesai dulu).
    const langsungMuat = setTimeout(() => {
      void muatMenu(true);
    }, 0);

    // Timer pemuatan ulang. Disimpan di variabel supaya bisa dihentikan saat
    // tab disembunyikan.
    let timer: ReturnType<typeof setInterval> | null = null;

    /**
     * Menjalankan pemuatan ulang berkala.
     * Output: void.
     */
    function mulaiTimer(): void {
      berhentiTimer();
      timer = setInterval(() => {
        void muatMenu(false);
      }, POLLING_MENU_MS);
    }

    /**
     * Menghentikan pemuatan ulang berkala.
     * Output: void.
     */
    function berhentiTimer(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    /**
     * Bereaksi ketika tab browser dibuka atau ditutup.
     *
     * Output: void.
     *
     * Cara kerja:
     *   - Tab disembunyikan: timer dihentikan supaya tidak ada permintaan sia-sia
     *     dari tab yang tidak terlihat (docs/api-contract.md bagian 5).
     *   - Tab terlihat lagi: timer dinyalakan dari awal, dan daftar menu
     *     dimuat ulang SEKALI supaya isian pengguna langsung sesuai keadaan
     *     terbaru.
     */
    function saatVisibilitasBerubah(): void {
      if (document.visibilityState === "visible") {
        mulaiTimer();
        void muatMenu(false);
      } else {
        berhentiTimer();
      }
    }

    if (document.visibilityState === "visible") {
      mulaiTimer();
    }

    document.addEventListener("visibilitychange", saatVisibilitasBerubah);

    return () => {
      clearTimeout(langsungMuat);
      berhentiTimer();
      document.removeEventListener("visibilitychange", saatVisibilitasBerubah);
      berhentiRef.current = true;
    };
  }, [muatMenu]);

  // Susun baris pesanan: daftar menu terbaru digabung dengan isian pengguna.
  // Gabungan ini yang menjaga isian tetap ada saat menu dimuat ulang.
  const barisPesanan = useMemo<BarisPesananTampil[]>(
    () => susunBarisPesanan(daftarMenu, isiBaris),
    [daftarMenu, isiBaris],
  );

  // Total perkiraan, hanya untuk tampilan. Menu yang tidak ada lagi di daftar
  // tidak ikut dihitung karena harganya sudah tidak diketahui.
  const total = hitungTotal(
    barisPesanan.map((satuBaris) => ({
      menuItemId: satuBaris.menuItemId,
      qty: satuBaris.qty,
      note: satuBaris.note,
    })),
    barisPesanan
      .filter((satuBaris) => satuBaris.harga !== null)
      .map((satuBaris) => ({
        id: satuBaris.menuItemId,
        price: satuBaris.harga as number,
      })),
  );

  // Validasi nama (untuk pesan dan tanda di sebelah isian nama).
  const hasilNama = validasiNama(customerName, {
    wajib: teksCustomer.formPesan.pesanNamaWajib,
    maks: teksCustomer.formPesan.pesanNamaMaks,
  });

  // Validasi jumlah dan catatan tiap baris.
  let pesanItem: string | null = null;
  for (const satuBaris of barisPesanan) {
    const cekQty = validasiQty(
      satuBaris.qty,
      teksCustomer.formPesan.labelJumlahBenar,
    );
    if (!cekQty.valid) {
      pesanItem = cekQty.pesan;
      break;
    }

    const cekCatatan = validasiCatatan(
      satuBaris.note,
      teksCustomer.formPesan.labelCatatanMaks,
    );
    if (!cekCatatan.valid) {
      pesanItem = cekCatatan.pesan;
      break;
    }
  }

  // Baris yang dipilih tapi menunya sudah tidak tersedia (Habis atau
  // dinonaktifkan). Server akan menolak pesanan seperti ini, jadi tombol kirim
  // harus mati sampai pengguna membersihkan barisnya.
  const barisTidakTersedia = barisTidakTersediaTerpilih(barisPesanan);

  // Peringatan kecil di atas daftar menu. Hanya tampil kalau memang ada baris
  // yang bermasalah, supaya pesan tidak membingungkan.
  const pesanMenuTidakTersedia =
    barisTidakTersedia.length > 0
      ? teksCustomer.formPesan.pesanMenuTidakTersedia
      : null;

  // Gabungkan pesan kecil: peringatan menu tidak tersedia lebih penting
  // daripada pesan gagal muat ulang.
  const pesanMenuTampil = pesanMenuTidakTersedia ?? pesanMenu;

  // Tombol kirim aktif kalau nama valid, tidak ada masalah item, ada minimal
  // satu menu yang dipilih, dan tidak ada baris terpilih yang menunya sudah
  // tidak tersedia.
  const tombolKirimAktif =
    !sedangMengirim &&
    pesanItem === null &&
    barisTidakTersedia.length === 0 &&
    bolehKirim(customerName, barisPesanan as BarisPesanan[], {
      nama: {
        wajib: teksCustomer.formPesan.pesanNamaWajib,
        maks: teksCustomer.formPesan.pesanNamaMaks,
      },
      item: teksCustomer.formPesan.pesanBelumAdaItem,
    });

  /**
   * Mengubah isian jumlah (qty) satu menu.
   * Input: id menu dan nilai baru. Output: void (memperbarui state).
   */
  function ubahQty(menuItemId: string, nilai: string): void {
    setIsiBaris((isiLama) => {
      const isiBarisSekarang = isiLama[menuItemId] ?? { qty: "", note: "" };
      return { ...isiLama, [menuItemId]: { ...isiBarisSekarang, qty: nilai } };
    });
  }

  /**
   * Mengubah isian catatan satu menu.
   * Input: id menu dan nilai baru. Output: void.
   */
  function ubahCatatan(menuItemId: string, nilai: string): void {
    setIsiBaris((isiLama) => {
      const isiBarisSekarang = isiLama[menuItemId] ?? { qty: "", note: "" };
      return { ...isiLama, [menuItemId]: { ...isiBarisSekarang, note: nilai } };
    });
  }

  /**
   * Mengirim pesanan ke server.
   * Output: void. Kalau berhasil, halaman berpindah ke status pesanan.
   */
  async function kirim(): Promise<void> {
    // Kalau tombol tidak aktif, jangan kirim apa pun.
    if (!tombolKirimAktif) {
      return;
    }

    setPesanError(null);
    setSedangMengirim(true);

    // Kunci anti-ganda hanya boleh dipakai ulang kalau isi pesanan sama
    // persis dengan percobaan sebelumnya. Kalau isi berubah, kunci baru dibuat,
    // supaya satu kunci tidak pernah mewakili dua pesanan berbeda.
    const sidikJari = sidikJariPesanan(customerName, barisPesanan);
    if (kunciRef.current === null || kunciRef.current.sidikJari !== sidikJari) {
      kunciRef.current = { sidikJari: sidikJari, key: buatUuid() };
    }

    const hasil = await kirimPesanan({
      customerName: customerName.trim(),
      items: menjadiItemSiapKirim(barisPesanan as BarisPesanan[]),
      idempotencyKey: kunciRef.current.key,
    });

    if (!hasil.berhasil) {
      setSedangMengirim(false);

      // MENU_UNAVAILABLE: menu yang dipilih sudah Habis atau dinonaktifkan
      // setelah daftar terakhir dimuat. Tampilkan pesan ramah, muat ulang
      // daftar menu, dan pertahankan isian pengguna (baris yang bermasalah
      // akan ditandai "Tidak tersedia").
      if (hasil.error.type === "MENU_UNAVAILABLE") {
        setPesanError(teksCustomer.formPesan.pesanMenuHabis);
        void muatMenu(false);
        return;
      }

      // Kalau server memberi kode ERR-xxxx, tampilkan juga supaya bisa dibaca
      // ke Admin kalau ada masalah.
      if (hasil.error.code) {
        setPesanError(
          teksCustomer.formPesan.pesanGagalKirimDenganKode.replace(
            "{kode}",
            hasil.error.code,
          ),
        );
      } else {
        setPesanError(
          hasil.error.message || teksCustomer.formPesan.pesanGagalKirim,
        );
      }

      // Laporkan ke server (gagal kirim order adalah jenis error yang diizinkan
      // di docs/logging.md bagian 7).
      void kirimLogErrorKeServer(
        "gagal_kirim_order",
        "Gagal kirim order: " + hasil.error.type + " " + hasil.error.message,
      );

      // Kunci SENGAJA tidak dihapus: percobaan berikutnya memakai kunci yang
      // sama selama isi pesanan tidak berubah, jadi tidak mungkin ada dua order
      // dari satu percobaan.
      return;
    }

    // Berhasil. Sebelum menyimpan atau memakai id order, pastikan bentuknya
    // uuid yang valid. Kalau tidak (mis. server mengirim data rusak), jangan
    // disimpan dan jangan dibuka; tampilkan error biasa supaya pengguna bisa
    // mencoba lagi.
    if (!apakahUuidValid(hasil.data.orderId)) {
      setSedangMengirim(false);
      setPesanError(teksCustomer.formPesan.pesanGagalKirim);

      // Laporkan ke server supaya Admin tahu ada bug di balasan /api/orders.
      void kirimLogErrorKeServer(
        "gagal_kirim_order",
        "Server mengirim orderId yang bukan uuid: " +
          String(hasil.data.orderId),
      );

      // Kunci dipertahankan supaya coba ulang tidak membuat duplikat.
      return;
    }

    // Simpan id order DAN nama customer di localStorage supaya halaman
    // awal bisa menawarkannya lagi dan halaman status bisa menampilkan nama.
    // (get_order_status tidak mengirim nama, lihat penyimpan-order.ts)
    tambahOrderAktif(hasil.data.orderId, customerName.trim());
    router.push("/status/" + hasil.data.orderId);
  }

  return {
    barisPesanan: barisPesanan,
    customerName: customerName,
    total: total,
    tombolKirimAktif: tombolKirimAktif,
    sedangMengirim: sedangMengirim,
    memuatMenu: sedangMuatAwal,
    pesanError: pesanError,
    pesanMenu: pesanMenuTampil,
    pesanNama: hasilNama.valid ? null : hasilNama.pesan,
    pesanItem: pesanItem,
    ubahNama: setCustomerName,
    ubahQty: ubahQty,
    ubahCatatan: ubahCatatan,
    kirimPesananSekarang: () => {
      void kirim();
    },
  };
}

/**
 * Membuat uuid untuk idempotencyKey.
 *
 * Memakai crypto.randomUUID() yang ada di browser modern. Kalau tidak tersedia,
 * dipakai cara sederhana sebagai cadangan supaya halaman tetap bisa mengirim.
 * Kunci ini hanya perlu unik per percobaan memesan, bukan mengikuti standar
 * tertentu, jadi bentuk sederhana sudah cukup.
 */
function buatUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (huruf) => {
    const angkaAcak = (Math.random() * 16) | 0;
    const nilai = huruf === "x" ? angkaAcak : (angkaAcak & 0x3) | 0x8;
    return nilai.toString(16);
  });
}