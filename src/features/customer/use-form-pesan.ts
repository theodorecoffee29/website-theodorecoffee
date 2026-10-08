// File ini: logika form pesan customer.
//
// Hook ini mengurus isi form, pemuatan menu, validasi, total perkiraan, dan
// pengiriman pesanan.
//
// Mengikuti aturan di AGENTS.md: logika ada di src/features/, sementara
// komponen tampilan di src/components/ hanya menerima props.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ambilMenu,
  kirimLogErrorKeServer,
  kirimPesanan,
  type MenuItem,
} from "./api";
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
  // Daftar menu dari server.
  menu: MenuItem[];
  // Satu baris pesanan per menu (qty dan catatan berupa teks dari isian).
  barisPesanan: BarisPesanan[];
  // Nama customer.
  customerName: string;
  // Total perkiraan. HANYA untuk ditampilkan (server yang menghitung sebenarnya).
  total: number;
  // True kalau tombol kirim boleh ditekan.
  tombolKirimAktif: boolean;
  // True selama pesanan sedang dikirim (tombol dinonaktifkan).
  sedangMengirim: boolean;
  // True ketika menu belum selesai dimuat.
  memuatMenu: boolean;
  // Pesan umum di atas form, atau null.
  pesanError: string | null;
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
 *   1. Menu diambil dari /api/menu sekali saat form dibuka.
 *   2. Setiap menu punya baris pesanan sendiri (jumlah dan satu catatan).
 *   3. Tombol kirim aktif kalau nama valid dan ada minimal satu item.
 *   4. Saat dikirim, idempotencyKey dibuat SEKALI lalu DIPAKAI ULANG kalau
 *      pengiriman gagal dan pengguna mencoba lagi. Ini yang mencegah klik
 *      ganda membuat dua order (docs/api-contract.md bagian 4).
 */
export function useFormPesan(): KeadaanFormPesan {
  // Router Next.js dipakai untuk berpindah halaman setelah pesanan berhasil
  // dibuat (menggantikan window.location.href supaya navigasi ikut di-handle
  // oleh Next.js).
  const router = useRouter();

  const [muatanMenu, setMuatanMenu] = useState<{
    sedangMuat: boolean;
    daftarMenu: MenuItem[];
  }>({ sedangMuat: true, daftarMenu: [] });
  const [isiBaris, setIsiBaris] = useState<
    Record<string, { qty: string; note: string }>
  >({});
  const [customerName, setCustomerName] = useState("");
  const [sedangMengirim, setSedangMengirim] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // idempotencyKey dibuat satu kali per percobaan memesan, lalu DIPAKAI ULANG
  // pada percobaan berikutnya. Dipakai useRef supaya nilainya bertahan antar
  // render tanpa memicu render ulang.
  const idempotencyKeyRef = useRef<string | null>(null);

  // Muat menu sekali saja saat form dibuka.
  useEffect(() => {
    let masihJalan = true;

    // Nama fungsi ini sengaja dibuat berbeda dari state "muatanMenu" di atas,
    // supaya tidak saling menutupi (shadowing) dan lebih mudah dibaca.
    async function ambilDaftarMenu() {
      const hasil = await ambilMenu();

      if (!masihJalan) {
        return;
      }

      if (hasil.berhasil) {
        setMuatanMenu({ sedangMuat: false, daftarMenu: hasil.data });
      } else {
        // Gagal memuat menu: tandai selesai memuat dan tampilkan pesan. Menu
        // dikosongkan; server tetap akan menolak kalau pesanan dikirim.
        setMuatanMenu({ sedangMuat: false, daftarMenu: [] });
        setPesanError(hasil.error.message);
      }
    }

    void ambilDaftarMenu();

    return () => {
      masihJalan = false;
    };
  }, []);

  // Susun baris pesanan: satu baris per menu, memakai isian yang sudah ada
  // kalau menu itu pernah diisi.
  const barisPesanan = useMemo<BarisPesanan[]>(
    () =>
      muatanMenu.daftarMenu.map((satuMenu) => {
        const isiLama = isiBaris[satuMenu.id];
        return {
          menuItemId: satuMenu.id,
          qty: isiLama?.qty ?? "",
          note: isiLama?.note ?? "",
        };
      }),
    [muatanMenu.daftarMenu, isiBaris],
  );

  // Total perkiraan, hanya untuk tampilan.
  const total = hitungTotal(
    barisPesanan,
    muatanMenu.daftarMenu.map((satuMenu) => ({
      id: satuMenu.id,
      price: satuMenu.price,
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

  // Tombol kirim aktif kalau nama valid, tidak ada masalah item, dan ada
  // minimal satu menu yang dipilih.
  const tombolKirimAktif =
    !sedangMengirim &&
    pesanItem === null &&
    bolehKirim(customerName, barisPesanan, {
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

    // Pakai idempotencyKey yang sudah ada, atau buat baru kalau ini percobaan
    // pertama. Karena dipakai ulang, klik ganda atau kirim ulang setelah gagal
    // tidak mungkin membuat dua order.
    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = buatUuid();
    }

    const hasil = await kirimPesanan({
      customerName: customerName.trim(),
      items: menjadiItemSiapKirim(barisPesanan),
      idempotencyKey: idempotencyKeyRef.current,
    });

    if (!hasil.berhasil) {
      setSedangMengirim(false);

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

      // idempotencyKey SENGAJA tidak dihapus: percobaan berikutnya memakai kunci
      // yang sama, jadi tidak mungkin ada dua order dari satu percobaan.
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

      // idempotencyKey dipertahankan supaya coba ulang tidak membuat duplikat.
      return;
    }

    // Simpan id order DAN nama customer di localStorage supaya halaman
    // awal bisa menawarkannya lagi dan halaman status bisa menampilkan nama.
    // (get_order_status tidak mengirim nama, lihat penyimpan-order.ts)
    tambahOrderAktif(hasil.data.orderId, customerName.trim());
    router.push("/status/" + hasil.data.orderId);
  }

  return {
    menu: muatanMenu.daftarMenu,
    barisPesanan: barisPesanan,
    customerName: customerName,
    total: total,
    tombolKirimAktif: tombolKirimAktif,
    sedangMengirim: sedangMengirim,
    memuatMenu: muatanMenu.sedangMuat,
    pesanError: pesanError,
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
