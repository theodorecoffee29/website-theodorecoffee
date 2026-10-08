// File ini: logika form order manual di halaman Cashier.
//
// Hook useFormOrderManual mengurus:
//   1. Memuat daftar menu dari /api/menu (menu Habis tidak bisa dipilih).
//   2. Menyimpan isian form: nama, jumlah, dan catatan tiap menu.
//   3. Menghitung total untuk ditampilkan (angka asli dihitung server).
//   4. Membuka dan menutup dialog ringkasan.
//   5. Mengirim order manual ke /api/cashier/orders dengan idempotencyKey yang
//      dibuat satu kali per percobaan.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/cashier/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilMenu,
  kirimLogErrorKeServer,
  kirimOrderManual,
  type ItemMenu,
  type MetodeBayar,
  type PeringatanStokApi,
} from "./api";
import {
  bolehSimpan,
  hitungTotal,
  menjadiItemSiapKirim,
  type BarisForm,
} from "./form-manual";
import { teksCashier } from "./teks";
import { cekWaktuManual, waktuIsoDariJamMenit } from "./waktu-manual";

// Keadaan form order manual yang diteruskan ke komponen tampilan.
export type KeadaanFormManual = {
  // Daftar menu, supaya komponen tinggal menampilkannya.
  menu: ItemMenu[];
  // Isian jumlah dan catatan per menu, dengan kunci menuItemId.
  baris: Record<string, BarisForm>;
  // Nama customer yang diketik.
  customerName: string;
  // Metode bayar yang dipilih, atau null kalau belum memilih (tidak ada nilai
  // bawaan).
  paymentMethod: MetodeBayar | null;
  // True kalau kotak centang waktu manual dicentang.
  pakaiWaktuManual: boolean;
  // Isian jam dan menit (dari dropdown 0-23 dan 0-59).
  jam: string;
  menit: string;
  // Waktu ISO hasil konversi jam dan menit, atau null kalau belum lengkap.
  waktuIso: string | null;
  // Pesan error waktu manual, atau null kalau waktunya tidak masalah.
  pesanWaktuManual: string | null;
  // Total perkiraan untuk ditampilkan. Angka sebenarnya dihitung server.
  total: number;
  // True saat tombol "Periksa dan simpan" boleh ditekan.
  tombolSimpanAktif: boolean;
  // True saat masih memuat daftar menu.
  memuatMenu: boolean;
  // True saat sedang mengirim pesanan ke server.
  sedangMengirim: boolean;
  // True saat dialog ringkasan sedang terbuka.
  dialogRingkasTerbuka: boolean;
  // Ringkasan yang tampil di dialog: item yang sudah dipilih.
  ringkasan: {
    customerName: string;
    // menuItemId ikut disertakan supaya komponen tampilan bisa memakai
    // orderId-nya sebagai kunci daftar (key unik untuk tiap baris).
    items: {
      menuItemId: string;
      nama: string;
      jumlah: number;
      catatan: string | null;
    }[];
    total: number;
    metodeBayar: string | null;
    // Jam kejadian WIB kalau waktu manual dipakai.
    jamManual: string | null;
  };
  // Pesan sukses atau error terakhir, atau null.
  pesan: string | null;
  // Peringatan stok setelah berhasil (bukan error).
  peringatanStok: PeringatanStokApi[];
  // Aksi yang dipanggil komponen tampilan.
  ubahNama: (nama: string) => void;
  ubahQty: (menuItemId: string, qty: string) => void;
  ubahCatatan: (menuItemId: string, note: string) => void;
  pilihMetodeBayar: (metode: MetodeBayar) => void;
  ubahWaktuManual: (dipakai: boolean) => void;
  ubahJam: (jam: string) => void;
  ubahMenit: (menit: string) => void;
  bukaDialogRingkas: () => void;
  tutupDialogRingkas: () => void;
  simpanPesanan: () => void;
  tutupPesan: () => void;
  tutupPeringatanStok: () => void;
  muatUlangMenu: () => void;
};

/**
 * Mengurus logika form order manual.
 *
 * Output: KeadaanFormManual yang diteruskan ke komponen tampilan.
 *
 * Cara kerja idempotencyKey (anti-klik-ganda):
 *   - Kalau belum ada percobaan, buat satu kunci baru.
 *   - Kalau pengiriman gagal lalu Cashier mencoba lagi, kunci yang SAMA dipakai
 *     lagi. Jadi kalau pengiriman pertama sebenarnya sampai server tapi
 *     responsnya hilang, percobaan kedua tidak akan membuat order kedua:
 *     server melihat kunci yang sama dan mengembalikan order yang pertama
 *     (docs/api-contract.md bagian 4, create_order/create_manual_order).
 *   - Kunci baru dibuat lagi setelah order BERHASIL disimpan.
 */
export function useFormOrderManual(
  // Dipanggil setelah order manual berhasil disimpan, supaya layar Cashier
  // bisa langsung memuat ulang daftar pesanan.
  onBerhasilSimpan: () => void,
): KeadaanFormManual {
  const [menu, setMenu] = useState<ItemMenu[]>([]);
  const [baris, setBaris] = useState<Record<string, BarisForm>>({});
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<MetodeBayar | null>(null);
  const [pakaiWaktuManual, setPakaiWaktuManual] = useState(false);
  const [jam, setJam] = useState("");
  const [menit, setMenit] = useState("");
  const [memuatMenu, setMemuatMenu] = useState(true);
  const [sedangMengirim, setSedangMengirim] = useState(false);
  const [dialogRingkasTerbuka, setDialogRingkasTerbuka] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [peringatanStok, setPeringatanStok] = useState<PeringatanStokApi[]>([]);

  // Kunci idempotensi untuk satu percobaan. Disimpan di ref supaya tidak hilang
  // saat komponen render ulang, dan tidak ikut memicu render.
  const idempotencyKeyRef = useRef<string | null>(null);

  // Flag supaya pemanggilan yang tertunda tidak mengubah state setelah halaman
  // ditinggalkan.
  const berhentiRef = useRef(false);

  /**
   * Memuat daftar menu sekali.
   *
   * Output: void. Hasilnya disimpan ke state.
   *
   * Dipakai saat halaman dibuka, dan lagi kalau Cashier menekan muat ulang
   * (mis. setelah diberi tahu ada menu yang habis).
   */
  const muatMenu = useCallback(async () => {
    const hasil = await ambilMenu();

    if (berhentiRef.current) {
      return;
    }

    setMemuatMenu(false);

    if (!hasil.berhasil) {
      // Gagal memuat menu: pesan ditampilkan, tapi form tetap bisa dipakai.
      // Cashier masih bisa melihat pesan error dan mencoba muat ulang.
      setPesan(teksCashier.formManual.gagalMuatMenu);
      void kirimLogErrorKeServer(
        "gagal_muat_status",
        "Gagal memuat menu untuk form order manual: " +
          hasil.error.type +
          " " +
          hasil.error.message,
      );
      return;
    }

    setMenu(hasil.data);

    // Bikin baris form untuk setiap menu yang tersedia. Menu yang "Habis" tetap
    // dapat baris (qty-nya 0), supaya tidak muncul "tidak ada" saat di-scroll.
    const barisBaru: Record<string, BarisForm> = {};
    for (const satuMenu of hasil.data) {
      barisBaru[satuMenu.id] = { menuItemId: satuMenu.id, qty: "", note: "" };
    }
    // Pertahankan isian yang sudah diketik Cashier (mis. saat muat ulang menu).
    setBaris((sebelumnya) => {
      const gabung: Record<string, BarisForm> = { ...barisBaru };
      for (const satuMenu of hasil.data) {
        if (sebelumnya[satuMenu.id]) {
          gabung[satuMenu.id] = sebelumnya[satuMenu.id];
        }
      }
      return gabung;
    });
  }, []);

  // Muat menu pertama kali saat form dibuka.
  //
  // Pemanggilan ditunda satu tick supaya render pertama selesai dulu (pola yang
  // sama seperti use-daftar-pesanan.ts).
  useEffect(() => {
    berhentiRef.current = false;
    const langsungMuat = setTimeout(() => {
      void muatMenu();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatMenu]);

  /**
   * Mengubah isian jumlah satu menu.
   *
   * Input: id menu dan nilai baru.
   * Output: void (memperbarui state).
   */
  function ubahQty(menuItemId: string, qty: string): void {
    setBaris((sebelumnya) => {
      const barisSekarang = sebelumnya[menuItemId] ?? {
        menuItemId: menuItemId,
        qty: "",
        note: "",
      };
      return {
        ...sebelumnya,
        [menuItemId]: { ...barisSekarang, qty: qty },
      };
    });
  }

  /**
   * Mengubah isian catatan satu menu.
   *
   * Input: id menu dan nilai baru.
   * Output: void (memperbarui state).
   */
  function ubahCatatan(menuItemId: string, note: string): void {
    setBaris((sebelumnya) => {
      const barisSekarang = sebelumnya[menuItemId] ?? {
        menuItemId: menuItemId,
        qty: "",
        note: "",
      };
      return {
        ...sebelumnya,
        [menuItemId]: { ...barisSekarang, note: note },
      };
    });
  }

  /**
   * Mengubah status kotak centang waktu manual.
   *
   * Input: true kalau dicentang, false kalau tidak.
   * Output: void.
   *
   * Saat dilepas, isian jam dan menit dikosongkan supaya tidak ada sisa
   * waktu lama yang ikut terkirim.
   */
  function ubahWaktuManual(dipakai: boolean): void {
    setPakaiWaktuManual(dipakai);
    if (!dipakai) {
      setJam("");
      setMenit("");
    }
  }

  /**
   * Membuka dialog ringkasan.
   *
   * Output: void.
   */
  function bukaDialogRingkas(): void {
    setDialogRingkasTerbuka(true);
  }

  /**
   * Menutup dialog ringkasan tanpa menyimpan (tombol Kembali).
   *
   * Output: void. Isi form TIDAK dikosongkan, jadi Cashier bisa memperbaiki
   *         isian tanpa mengetik ulang.
   */
  function tutupDialogRingkas(): void {
    setDialogRingkasTerbuka(false);
  }

  /**
   * Mengirim order manual ke server.
   *
   * Output: void.
   *
   * Alur:
   *   1. Pastikan ada idempotencyKey. Kalau belum ada (percobaan pertama),
   *      buat satu. Kalau sudah ada (percobaan ulang), pakai yang sama.
   *   2. Kirim ke /api/cashier/orders.
   *   3. Kalau berhasil: tampilkan nomor antrean, kosongkan form, segarkan
   *      daftar pesanan, dan tampilkan peringatan stok kalau ada.
   *   4. Kalau MENU_UNAVAILABLE: tampilkan "Ada menu yang habis", muat ulang menu
   *      (soalnya status Habis bisa berubah), dan JANGAN kosongkan form.
   *   5. Gagal lain: pesan ramah plus kode ERR-xxxx kalau ada, dan laporkan ke
   *      server.
   */
  async function simpanPesanan(): Promise<void> {
    setPesan(null);
    setPeringatanStok([]);
    setSedangMengirim(true);

    // Kunci idempotensi: dibuat satu kali per percobaan, lalu dipakai ulang
    // kalau percobaan berikutnya.
    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = buatUuid();
    }

    // Waktu manual: hanya kirim kalau dicentang DAN waktunya valid.
    // Kalau tidak valid, tombol sudah nonaktif (bolehSimpan), jadi ini
    // pengaman kedua.
    const waktuIsoFinal = pakaiWaktuManual ? waktuIso : null;

    // Pengaman kedua: jangan pernah mengirim tanpa metode bayar yang valid.
    //
    // Kenapa TIDAK memakai nilai bawaan seperti "tunai": Cashier wajib memilih
    // sendiri metode pembayarannya (docs/api-contract.md bagian 2), dan
    // mengarang nilai di sini akan berarti pesanan disimpan dengan metode yang
    // tidak pernah dipilih Cashier. Lebih baik gagal dan tampilkan pesan.
    //
    // Tombol Simpan sudah nonaktif kalau metode belum dipilih (bolehSimpan),
    // jadi kasus ini hanya mungkin kalau ada bug. Tetap dijaga supaya server
    // tidak pernah menerima pesanan dengan metode yang tidak dipilih.
    if (paymentMethod === null) {
      setSedangMengirim(false);
      setPesan(teksCashier.formManual.pesanGagalSimpan);
      return;
    }

    const hasil = await kirimOrderManual({
      customerName: customerName.trim(),
      items: menjadiItemSiapKirim(Object.values(baris)),
      paymentMethod: paymentMethod,
      idempotencyKey: idempotencyKeyRef.current,
      ...(waktuIsoFinal ? { occurredAt: waktuIsoFinal } : {}),
    });

    setSedangMengirim(false);

    if (berhentiRef.current) {
      return;
    }

    // Dialog ditutup baik berhasil maupun gagal, supaya Cashier kembali ke
    // form dan bisa memperbaiki.
    setDialogRingkasTerbuka(false);

    if (!hasil.berhasil) {
      // Ada menu yang bahannya habis. Ini bukan kegagalan sistem: menu yang
      // tadinya tersedia bisa saja sudah habis. Muat ulang menu supaya
      // Cashier melihat status terbaru, dan form TIDAK dikosongkan supaya
      // tidak hilang pesanan yang sudah diketik.
      if (hasil.error.type === "MENU_UNAVAILABLE") {
        setPesan(teksCashier.formManual.pesanMenuHabis);
        void muatMenu();
        return;
      }

      // Gagal lain: pesan ramah. Kalau ada kode ERR-xxxx, tampilkan juga supaya
      // bisa dicari di error_logs.
      if (hasil.error.code) {
        setPesan(
          teksCashier.formManual.pesanGagalSimpanDenganKode.replace(
            "{kode}",
            hasil.error.code,
          ),
        );
      } else {
        setPesan(
          hasil.error.message || teksCashier.formManual.pesanGagalSimpan,
        );
      }

      void kirimLogErrorKeServer(
        // gagal_kirim_order hanya untuk customer; dari Cashier yang gagal
        // adalah aksi staf (docs/logging.md bagian 7).
        "gagal_aksi_staf",
        "Gagal simpan order manual: " +
          hasil.error.type +
          " " +
          hasil.error.message,
      );
      return;
    }

    // Berhasil. Kunci idempotensi yang lama sudah terpakai; percobaan berikutnya
    // (untuk order berikutnya) harus memakai kunci baru, kalau tidak server
    // akan mengembalikan order yang sama.
    idempotencyKeyRef.current = null;

    // Tampilkan nomor antrean supaya Cashier bisa memanggil customer.
    setPesan(
      teksCashier.formManual.pesanBerhasil.replace(
        "{nomor}",
        String(hasil.data.queueNumber),
      ),
    );

    // Peringatan stok: BUKAN error. Order tetap berhasil, Cashier hanya diberi
    // tahu bahan mana yang kurang.
    if (hasil.data.stockWarnings && hasil.data.stockWarnings.length > 0) {
      setPeringatanStok(hasil.data.stockWarnings);
    }

    // Kosongkan form, tapi JANGAN kosongkan menu (menu masih dipakai untuk
    // pesanan berikutnya).
    setCustomerName("");
    setBaris({});
    setPaymentMethod(null);
    setPakaiWaktuManual(false);
    setJam("");
    setMenit("");

    // Minta layar Cashier memuat ulang daftar pesanan supaya order baru ini
    // langsung terlihat.
    onBerhasilSimpan();
  }

  /** Menutup pesan sukses/error. Output: void. */
  function tutupPesan(): void {
    setPesan(null);
  }

  /** Menutup peringatan stok. Output: void. */
  function tutupPeringatanStok(): void {
    setPeringatanStok([]);
  }

  /** Memuat ulang daftar menu. Output: void. */
  function muatUlangMenu(): void {
    setMemuatMenu(true);
    void muatMenu();
  }

  // ---------------------------------------------------------------------
  // Keberhasilan di bawah ini dihitung dari state, bukan disimpan terpisah,
  // supaya tidak bisa tidak sinkron dengan isian form.
  // ---------------------------------------------------------------------

  // Daftar baris yang punya item terpilih (qty lebih dari 0), dengan nama menu
  // dan catatan, untuk ditampilkan di dialog ringkasan.
  const itemTerpilih = menjadiItemSiapKirim(Object.values(baris)).map(
    (satuItem) => {
      // Cari nama menu untuk ditampilkan.
      const menuDipilih = menu.find((satu) => satu.id === satuItem.menuItemId);
      return {
        menuItemId: satuItem.menuItemId,
        // Kalau menu tidak ada lagi (mis. dinonaktifkan), pakai teks cadangan
        // supaya tampilan tidak error.
        nama: menuDipilih?.name ?? "Menu tidak ditemukan",
        jumlah: satuItem.qty,
        catatan: satuItem.note ?? null,
      };
    },
  );

  // Total perkiraan. Angka ini HANYA untuk tampilan; server yang menghitung
  // harga sebenarnya.
  const total = hitungTotal(
    Object.values(baris),
    menu.map((satu) => ({ id: satu.id, price: satu.price })),
  );

  // Waktu manual: ubah jam dan menit jadi waktu ISO, lalu cek aturannya.
  // Kalau kotak centang tidak dicentang, waktuIso = null (tidak ada waktu
  // manual yang dikirim).
  const waktuIso = pakaiWaktuManual
    ? waktuIsoDariJamMenit(Number(jam), Number(menit))
    : null;

  const pesanWaktuManual = pakaiWaktuManual ? cekWaktuManual(waktuIso) : null;

  // Tombol Simpan hanya aktif kalau semua isian benar, ada minimal satu item,
  // metode bayar dipilih, dan (kalau dipakai) waktu manual tidak melanggar
  // aturan.
  const tombolSimpanAktif = bolehSimpan(
    customerName,
    Object.values(baris),
    paymentMethod,
    {
      nama: {
        wajib: teksCashier.formManual.pesanNamaWajib,
        maks: teksCashier.formManual.pesanNamaMaks,
      },
      qtyMaks: teksCashier.formManual.pesanJumlahMaks,
      catatanMaks: teksCashier.formManual.pesanCatatanMaks,
      jumlahBarisMaks: teksCashier.formManual.pesanJumlahBarisMaks,
    },
    pesanWaktuManual,
  );

  // Ringkasan untuk dialog. Metode bayar ditampilkan memakai teks yang sama
  // dengan form.
  const ringkasan = {
    customerName: customerName.trim(),
    items: itemTerpilih,
    total: total,
    metodeBayar:
      paymentMethod === "qris"
        ? teksCashier.metodeBayar.qris
        : paymentMethod === "tunai"
          ? teksCashier.metodeBayar.tunai
          : null,
    // Jam kejadian WIB kalau waktu manual dipakai.
    jamManual: waktuIso !== null ? waktuIso.slice(11, 16) : null,
  };

  return {
    menu: menu,
    baris: baris,
    customerName: customerName,
    paymentMethod: paymentMethod,
    pakaiWaktuManual: pakaiWaktuManual,
    jam: jam,
    menit: menit,
    waktuIso: waktuIso,
    pesanWaktuManual: pesanWaktuManual,
    total: total,
    tombolSimpanAktif: tombolSimpanAktif,
    memuatMenu: memuatMenu,
    sedangMengirim: sedangMengirim,
    dialogRingkasTerbuka: dialogRingkasTerbuka,
    ringkasan: ringkasan,
    pesan: pesan,
    peringatanStok: peringatanStok,
    ubahNama: setCustomerName,
    ubahQty: ubahQty,
    ubahCatatan: ubahCatatan,
    pilihMetodeBayar: setPaymentMethod,
    ubahWaktuManual: ubahWaktuManual,
    ubahJam: setJam,
    ubahMenit: setMenit,
    bukaDialogRingkas: bukaDialogRingkas,
    tutupDialogRingkas: tutupDialogRingkas,
    simpanPesanan: () => {
      void simpanPesanan();
    },
    tutupPesan: tutupPesan,
    tutupPeringatanStok: tutupPeringatanStok,
    muatUlangMenu: muatUlangMenu,
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
