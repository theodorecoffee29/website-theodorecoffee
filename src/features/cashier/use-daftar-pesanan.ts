// File ini: semua logika layar Cashier (/cashier).
//
// Hook useDaftarPesanan mengurus:
//   1. Memuat daftar pesanan hari ini dari server.
//   2. Memuat ulang otomatis setiap 3 detik (polling).
//   3. Mendeteksi pesanan baru dan memberi tahu lewat spanduk teks + judul tab
//      browser (tanpa suara).
//   4. Mengonfirmasi pesanan (dengan metode bayar) dan membatalkan pesanan.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/cashier/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilDaftarPesanan,
  batalkanPesanan,
  kirimLogErrorKeServer,
  konfirmasiPesanan,
  type HasilApi,
  type MetodeBayar,
  type PeringatanStokApi,
  type PesananCashier,
} from "./api";
import {
  STATUS_ANTREAN,
  STATUS_DIBATALKAN,
  STATUS_DIKERJAKAN,
  STATUS_MENUNGGU,
  STATUS_SELESAI,
  kelompokkanPesanan,
  labelAsalPesanan,
  metodeBayarValid,
  type PesananRingkas,
} from "./kelompok-order";
import {
  cariPesananBaru,
  hitungPesananMenunggu,
  teksSpandukBaru,
} from "./pesanan-baru";
import { teksCashier } from "./teks";
import { jamWib } from "./waktu-wib";

// Berapa milidetik satu jeda polling. docs/api-contract.md bagian 5 menetapkan
// layar Cashier memanggil list_orders setiap 3 detik.
export const INTERVAL_POLLING_MS = 3000;

// Berapa kali polling gagal berturut-turut sebelum satu log error dikirim ke
// server. Tujuannya supaya log error tidak dibanjiri kalau internet memang
// sedang putus.
const BATASAN_GAGAL_BERURUTAN = 3;

// Satu pesanan yang sudah disiapkan untuk tampilan: semua teks dan angka sudah
// diubah ke bentuk yang enak dibaca, supaya komponen tampilan tidak melakukan
// perhitungan apa pun.
export type PesananTampil = {
  orderId: string;
  nomorAntrean: number;
  nama: string;
  // "Online" atau "Kasir".
  labelAsal: string;
  // Jam dibuat dalam WIB, mis. "09.15".
  jamDibuat: string;
  // Jam kejadian dalam WIB (untuk order manual yang diinput belakangan, ini bisa
  // lebih lama dari jamDibuat). Kosong kalau waktunya tidak terbaca.
  jamKejadian: string;
  // true kalau pesanan ini diinput dari catatan kertas (waktu manual). Cashier
  // perlu tahu ini supaya tidak bingung kenapa jamnya berbeda.
  waktuManual: boolean;
  items: {
    nama: string;
    jumlah: number;
    catatan: string | null;
    harga: number;
    subtotal: number;
  }[];
  total: number;
  // Teks status untuk Cashier (bukan teks customer).
  teksStatus: string;
  // Metode bayar kalau pesanan sudah dikonfirmasi, kalau tidak kosong.
  metodeBayarTampil: string | null;
  status: string;
};

// Keadaan layar Cashier yang diteruskan ke komponen tampilan.
export type KeadaanCashier = {
  // Tiga kelompok pesanan, sudah terurut.
  menunggu: PesananTampil[];
  dikerjakan: PesananTampil[];
  selesai: PesananTampil[];
  // Jumlah pesanan yang menunggu konfirmasi (untuk judul tab).
  jumlahMenunggu: number;
  // Teks spanduk pesanan baru, atau null kalau tidak ada yang baru.
  spandukBaru: string | null;
  // Peringatan stok setelah konfirmasi (bukan error).
  peringatanStok: PeringatanStokApi[];
  // True saat masih memuat daftar untuk pertama kali.
  memuat: boolean;
  // True saat polling gagal. Daftar yang sudah tampil tetap dipertahankan.
  gagalMuat: boolean;
  // Pesan aksi terakhir (sukses/gagal/info), atau null.
  pesan: string | null;
  // Id pesanan yang sedang diproses (konfirmasi atau batal), atau null.
  sedangAksi: string | null;
  // Id pesanan yang popup pembatalannya sedang terbuka, atau null.
  dialogBatalUntuk: string | null;
  // Metode bayar yang dipilih untuk tiap pesanan, disimpan berdasarkan id
  // pesanan. Kenapa bukan satu nilai untuk semua: biasanya ada beberapa pesanan
  // menunggu sekaligus, dan tiap pesanan punya pembayaran sendiri. Kalau
  // metodenya disimpan sekali untuk semua, memilih QRIS di satu pesanan akan
  // ikut mengaktifkan tombol Konfirmasi di pesanan lain.
  metodeDipilih: Record<string, MetodeBayar>;
  // Aksi yang dipanggil komponen tampilan.
  pilihMetodeBayar: (orderId: string, metode: MetodeBayar) => void;
  konfirmasi: (orderId: string) => void;
  bukaDialogBatal: (orderId: string) => void;
  tutupDialogBatal: () => void;
  sudahKonfirmasiBatal: () => void;
  tutupSpanduk: () => void;
  tutupPeringatanStok: () => void;
  // Muat ulang daftar pesanan sekali saja. Dipanggil setelah order manual
  // berhasil disimpan, supaya pesanan baru langsung terlihat tanpa menunggu
  // jeda polling.
  segarkanDaftar: () => void;
};

/**
 * Mengurus seluruh logika layar Cashier.
 *
 * Output: KeadaanCashier yang diteruskan ke komponen tampilan.
 *
 * Cara kerja polling:
 *   - Muat sekali di awal.
 *   - Setelah itu ulangi setiap 3 detik, sampai halaman ditutup.
 *   - Kalau gagal, daftar yang sudah tampil TIDAK dihapus. Cashier masih bisa
 *     mengonfirmasi atau membatalkan pesanan yang sudah tampil, dan pesan kecil
 *     "gagal memuat, mencoba lagi" muncul.
 *
 * Kenapa polling tidak berhenti seperti di halaman status customer: halaman
 * Cashier tidak punya status akhir. Order baru bisa datang kapan saja, dan
 * order yang tadi masih diantre bisa dibatalkan Cashier lain. Jadi poll terus
 * sampai halaman ditutup (docs/api-contract.md bagian 5).
 */
export function useDaftarPesanan(): KeadaanCashier {
  // Daftar mentah dari server, dipakai untuk deteksi pesanan baru.
  const [daftar, setDaftar] = useState<PesananCashier[]>([]);
  const [jumlahMenunggu, setJumlahMenunggu] = useState(0);
  const [spandukBaru, setSpandukBaru] = useState<string | null>(null);
  const [peringatanStok, setPeringatanStok] = useState<PeringatanStokApi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sedangAksi, setSedangAksi] = useState<string | null>(null);
  const [dialogBatalUntuk, setDialogBatalUntuk] = useState<string | null>(null);
  const [metodeDipilih, setMetodeDipilih] = useState<
    Record<string, MetodeBayar>
  >({});

  // Daftar terakhir yang sudah tampil. Disimpan di ref (bukan state) supaya
  // bisa dibaca tanpa menyebabkan render ulang, dan selalu berisi nilai
  // terbaru saat polling berjalan.
  const daftarSebelumnyaRef = useRef<PesananCashier[]>([]);
  // True kalau daftar pernah termuat. Menentukan apakah hasil polling ini
  // dianggap "pemuatan pertama" (yang tidak memicu notifikasi).
  const sudahPernahMuatRef = useRef(false);
  // Penghitung kegagalan polling berturut-turut.
  const jumlahGagalRef = useRef(0);
  // Flag supaya proses berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);

  /**
   * Mencatat kegagalan polling berulang dan mengirim satu log error ke server
   * setelah cukup banyak kegagalan.
   *
   * Input: pesan singkat yang menjelaskan kegagalannya.
   * Output: void.
   *
   * Kenapa pakai ambang batas: kalau internet sedang putus, polling gagal
   * setiap 3 detik. Kalau setiap kegagalan dilaporkan, tabel error_logs akan
   * penuh dalam satu menit. Jadi hanya dilaporkan sekali setelah 3 kali gagal
   * berturut-turut.
   */
  function catatGagalBerturut(pesanGagal: string): void {
    jumlahGagalRef.current += 1;

    if (jumlahGagalRef.current === BATASAN_GAGAL_BERURUTAN) {
      void kirimLogErrorKeServer(
        "gagal_muat_status",
        pesanGagal +
          " (gagal " +
          jumlahGagalRef.current +
          " kali berturut-turut)",
      );
    }
  }

  /**
   * Memuat daftar pesanan satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   *
   * Fungsi ini dipakai untuk muat pertama, untuk polling, dan untuk memuat ulang
   * setelah aksi (konfirmasi atau batal) selesai.
   */
  const muatDaftar = useCallback(async () => {
    const hasil = await ambilDaftarPesanan();

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Gagal: JANGAN hapus daftar yang sudah tampil. Cashier masih perlu
      // melihat order yang sudah ada supaya bisa tetap bekerja.
      setGagalMuat(true);
      catatGagalBerturut("Daftar pesanan gagal dimuat: " + hasil.error.type);
      return;
    }

    // Berhasil: pesan gagal hilang.
    setGagalMuat(false);
    jumlahGagalRef.current = 0;

    // Cari pesanan baru. Perbandingan dilakukan terhadap daftar SEBELUMnya.
    // Pemuatan pertama tidak memicu notifikasi.
    const pesananBaru = cariPesananBaru(
      daftarSebelumnyaRef.current,
      hasil.data.orders,
      sudahPernahMuatRef.current,
    );

    // Perbarui penanda "sudah pernah memuat" dan daftar sebelumnya.
    daftarSebelumnyaRef.current = hasil.data.orders;
    sudahPernahMuatRef.current = true;

    setDaftar(hasil.data.orders);
    setJumlahMenunggu(hitungPesananMenunggu(hasil.data.orders));

    // Tampilkan spanduk kalau ada pesanan baru.
    const teksSpanduk = teksSpandukBaru(pesananBaru, {
      satu: teksCashier.notifikasi.spandukSatu,
      banyak: teksCashier.notifikasi.spandukBanyak,
    });
    if (teksSpanduk !== null) {
      setSpandukBaru(teksSpanduk);
    }
  }, []);

  // Muat daftar pertama kali saat halaman dibuka.
  //
  // Panggilan pertama sengaja dijadwalkan lewat setTimeout 0, bukan langsung
  // dipanggil. Alasannya: muatDaftar() mengubah state, dan mengubah state
  // langsung di dalam badan efek bisa memicu render berulang. Dengan
  // menundanya satu tick, render pertama selesai dulu baru data dimuat.
  useEffect(() => {
    berhentiRef.current = false;

    const langsungMuat = setTimeout(() => {
      void muatDaftar();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatDaftar]);

  // Polling: ulangi setiap 3 detik selama halaman terbuka.
  useEffect(() => {
    const timer = setInterval(() => {
      // Kalau halaman sudah ditinggalkan, berhenti.
      if (berhentiRef.current) {
        return;
      }

      void muatDaftar();
    }, INTERVAL_POLLING_MS);

    // Hapus interval saat komponen dilepas (pindah halaman atau keluar).
    return () => {
      clearInterval(timer);
    };
  }, [muatDaftar]);

  /**
   * Memilih metode bayar untuk satu pesanan.
   *
   * Input: id pesanan dan metode yang dipilih Cashier.
   * Output: void. Menyimpan pilihan berdasarkan id pesanan, supaya tiap pesanan
   *         punya pilihan sendiri.
   */
  function pilihMetodeBayar(orderId: string, metode: MetodeBayar): void {
    setMetodeDipilih((sebelumnya) => ({ ...sebelumnya, [orderId]: metode }));
  }

  /**
   * Mengonfirmasi satu pesanan dengan metode bayar yang dipilih.
   *
   * Input: id pesanan yang akan dikonfirmasi.
   * Output: void.
   *
   * Cara kerja:
   *   1. Tolak kalau metode bayar belum dipilih. Tombolnya juga sudah
   *      dinonaktifkan di tampilan, jadi ini pengaman kedua.
   *   2. Panggil POST /api/cashier/orders/[id]/confirm.
   *   3. Kalau ORDER_STATUS_CHANGED (Cashier lain sudah lebih dulu), tampilkan
   *      pesannya lalu muat ulang daftar (docs/order-flow.md bagian 5).
   *   4. Kalau berhasil dan ada stockWarnings, tampilkan peringatan stok.
   *      Peringatan BUKAN error: konfirmasi tetap sukses.
   *   5. Kalau gagal lain, tampilkan pesan ramah dan laporkan ke server.
   */
  async function konfirmasi(orderId: string): Promise<void> {
    // Metode bayar dibaca dari daftar pilihan milik pesanan ini saja.
    const metode = metodeDipilih[orderId] ?? null;

    // Pengaman: tidak ada konfirmasi tanpa metode bayar yang valid.
    if (!metodeBayarValid(metode)) {
      return;
    }

    setSedangAksi(orderId);
    setPesan(null);
    setPeringatanStok([]);

    const hasil = await konfirmasiPesanan(orderId, metode);

    setSedangAksi(null);
    // Pilihan metode untuk pesanan ini sudah tidak dipakai lagi.
    setMetodeDipilih((sebelumnya) => {
      const baru = { ...sebelumnya };
      delete baru[orderId];
      return baru;
    });

    // Kalau halaman sudah ditinggalkan, tidak perlu perbarui tampilan.
    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Status sudah berubah: beri tahu, lalu muat ulang supaya tampilan sesuai
      // keadaan terbaru.
      if (hasil.error.type === "ORDER_STATUS_CHANGED") {
        setPesan(teksCashier.pesan.statusSudahBerubah);
        await muatDaftar();
        return;
      }

      // Gagal lain: pesan ramah, plus kode ERR-xxxx kalau ada.
      setPesan(pesanUntukKegagalan(hasil));
      void kirimLogErrorKeServer(
        "gagal_konfirmasi",
        "Gagal konfirmasi order: " +
          hasil.error.type +
          " " +
          hasil.error.message,
        orderId,
      );
      return;
    }

    // Berhasil. Peringatan stok hanya tampilan; kalau tidak ada, tidak perlu
    // menampilkan apa pun.
    //
    // Periksa dengan ? dan || supaya tidak error kalau server ternyata tidak
    // mengirim stockWarnings sama sekali (mis. versi lama).
    if (hasil.data.stockWarnings && hasil.data.stockWarnings.length > 0) {
      setPeringatanStok(hasil.data.stockWarnings);
    }

    // Muat ulang supaya pesanan pindah dari kelompok Menunggu ke Antrean.
    await muatDaftar();
  }

  /**
   * Membuka popup konfirmasi pembatalan.
   *
   * Input: id pesanan yang akan dibatalkan.
   * Output: void.
   */
  function bukaDialogBatal(orderId: string): void {
    setDialogBatalUntuk(orderId);
    setPesan(null);
  }

  /**
   * Menutup popup pembatalan tanpa membatalkan apa pun (pilihan "Tidak").
   *
   * Output: void.
   */
  function tutupDialogBatal(): void {
    setDialogBatalUntuk(null);
  }

  /**
   * Membatalkan pesanan setelah Cashier memilih "Ya".
   *
   * Output: void.
   *
   * Cara kerja:
   *   1. Panggil POST /api/cashier/orders/[id]/cancel.
   *   2. Kalau ORDER_STATUS_CHANGED (mis. Barista sudah menekan Mulai), tampilkan
   *      pesannya lalu muat ulang daftar.
   *   3. Kalau berhasil, muat ulang supaya pesanan pindah ke kelompok Selesai.
   */
  async function sudahKonfirmasiBatal(): Promise<void> {
    const orderId = dialogBatalUntuk;

    // Tidak ada popup yang terbuka: tidak ada yang perlu dibatalkan.
    if (orderId === null) {
      return;
    }

    setDialogBatalUntuk(null);
    setSedangAksi(orderId);
    setPesan(null);

    const hasil = await batalkanPesanan(orderId);

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      if (hasil.error.type === "ORDER_STATUS_CHANGED") {
        setPesan(teksCashier.pesan.statusSudahBerubah);
        await muatDaftar();
        return;
      }

      setPesan(pesanUntukKegagalan(hasil));
      void kirimLogErrorKeServer(
        "gagal_aksi_staf",
        "Gagal batalkan order: " + hasil.error.type + " " + hasil.error.message,
        orderId,
      );
      return;
    }

    // Berhasil: muat ulang supaya pesanan pindah ke kelompok Selesai.
    await muatDaftar();
  }

  /** Menutup spanduk pesanan baru. Output: void. */
  function tutupSpanduk(): void {
    setSpandukBaru(null);
  }

  /** Menutup peringatan stok. Output: void. */
  function tutupPeringatanStok(): void {
    setPeringatanStok([]);
  }

  /**
   * Memuat ulang daftar pesanan sekali saja.
   *
   * Output: void.
   *
   * Dipanggil setelah order manual berhasil disimpan, supaya pesanan baru itu
   * langsung terlihat tanpa harus menunggu jeda polling 3 detik.
   */
  function segarkanDaftar(): void {
    void muatDaftar();
  }

  // Kelompokkan pesanan. Pengelompokan hanya butuh field ringkas, tapi kita
  // tetap menyimpan pesanan UTUH per kelompok supaya item, total, dan pembayaran
  // tidak ikut hilang saat dipetakan ke bentuk tampilan.
  const kelompokRingkas = kelompokkanPesanan(daftar.map(kePesananRingkas));

  // Pasangkan lagi setiap pesanan ringkas dengan pesanan aslinya, supaya data
  // lengkapnya (items, total, payment) tetap ada.
  const mencariAsli = (ringkas: PesananRingkas): PesananCashier => {
    const asli = daftar.find((satu) => satu.orderId === ringkas.orderId);
    // Kalau tidak ketemu (seharusnya tidak terjadi), pakai pesanan ringkas
    // sendiri supaya tampilan tidak error.
    return asli ?? kePesananCashier(ringkas);
  };

  return {
    menunggu: kelompokRingkas.menunggu.map((satu) =>
      siapkanUntukTampil(satu, mencariAsli(satu)),
    ),
    dikerjakan: kelompokRingkas.dikerjakan.map((satu) =>
      siapkanUntukTampil(satu, mencariAsli(satu)),
    ),
    selesai: kelompokRingkas.selesai.map((satu) =>
      siapkanUntukTampil(satu, mencariAsli(satu)),
    ),
    jumlahMenunggu: jumlahMenunggu,
    spandukBaru: spandukBaru,
    peringatanStok: peringatanStok,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    sedangAksi: sedangAksi,
    dialogBatalUntuk: dialogBatalUntuk,
    metodeDipilih: metodeDipilih,
    pilihMetodeBayar: pilihMetodeBayar,
    konfirmasi: (orderId: string) => {
      void konfirmasi(orderId);
    },
    bukaDialogBatal: bukaDialogBatal,
    tutupDialogBatal: tutupDialogBatal,
    sudahKonfirmasiBatal: () => {
      void sudahKonfirmasiBatal();
    },
    tutupSpanduk: tutupSpanduk,
    tutupPeringatanStok: tutupPeringatanStok,
    segarkanDaftar: segarkanDaftar,
  };
}

/**
 * Mengubah hasil pemanggilan API jadi pesan yang enak dibaca Cashier.
 *
 * Input: hasil yang gagal.
 * Output: pesan. Kalau ada kode ERR-xxxx, kode itu ikut ditampilkan supaya
 *         Admin bisa mencarinya di error_logs (docs/api-contract.md bagian 6).
 */
function pesanUntukKegagalan(hasil: HasilApi<unknown>): string {
  if (hasil.berhasil) {
    return "";
  }

  if (hasil.error.code) {
    return teksCashier.pesan.aksiGagalDenganKode.replace(
      "{kode}",
      hasil.error.code,
    );
  }

  // Pesan dari server lebih spesifik, jadi dipakai kalau ada. Kalau kosong,
  // pakai pesan umum.
  return hasil.error.message || teksCashier.pesan.aksiGagal;
}

/**
 * Mengubah pesanan dari server menjadi bentuk ringkas untuk pengelompokan.
 *
 * Input: satu pesanan dari server.
 * Output: PesananRingkas (hanya field yang dipakai pengelompokan).
 *
 * Kenapa dikecilkan: kelompokkanPesanan hanya perlu tahu status, nomor antrean,
 * dan waktu dibuat. Field lain (items, total) tidak dipakai untuk mengelompokkan.
 */
function kePesananRingkas(pesanan: PesananCashier): PesananRingkas {
  return {
    orderId: pesanan.orderId,
    queueNumber: pesanan.queueNumber,
    customerName: pesanan.customerName,
    source: pesanan.source,
    status: pesanan.status,
    createdAt: pesanan.createdAt,
  };
}

/**
 * Mengubah pesanan ringkas kembali menjadi bentuk pesanan lengkap.
 *
 * Dipakai kalau pesanan aslinya tidak ditemukan di daftar (seharusnya tidak
 * terjadi, tapi lebih baik tampilannya tidak error).
 */
function kePesananCashier(ringkas: PesananRingkas): PesananCashier {
  return {
    orderId: ringkas.orderId,
    queueNumber: ringkas.queueNumber,
    queueDate: "",
    customerName: ringkas.customerName,
    source: ringkas.source,
    status: ringkas.status,
    total: 0,
    createdAt: ringkas.createdAt,
    occurredAt: ringkas.createdAt,
    isManualTime: false,
    confirmedAt: null,
    items: [],
    payment: null,
  };
}

/**
 * Mengubah pesanan menjadi bentuk yang siap ditampilkan.
 *
 * Input: pesanan ringkas (untuk urutan) dan pesanan lengkap (untuk isinya).
 * Output: PesananTampil, dengan semua teks dan angka sudah rapi.
 *
 * Kenapa file ini yang mengubah: komponen tampilan tidak boleh melakukan
 * perhitungan atau pemetaan teks. Semua "keputusan tampilan" (label asal
 * pesanan, jam WIB, teks status, metode bayar) dikumpulkan di sini supaya mudah
 * diubah di Fase 7 tanpa menyentuh komponen.
 */
function siapkanUntukTampil(
  ringkas: PesananRingkas,
  lengkap: PesananCashier,
): PesananTampil {
  return {
    orderId: lengkap.orderId,
    nomorAntrean: lengkap.queueNumber,
    nama: lengkap.customerName,
    labelAsal: labelAsalPesanan(lengkap.source),
    // createdAt dijamin bisa dibaca oleh kelompokkanPesanan (waktu yang rusak
    // diurutkan ke akhir, tidak dibuang). Kalau ternyata tidak terbaca, jamWib
    // mengembalikan string kosong supaya tidak tampil "Invalid Date".
    jamDibuat: jamWib(lengkap.createdAt),
    // Waktu kejadian. Untuk order manual yang diinput belakangan, ini yang perlu
    // dilihat Cashier, bukan jamDibuat.
    jamKejadian: jamWib(lengkap.occurredAt),
    waktuManual: lengkap.isManualTime,
    items: lengkap.items.map((satuItem) => ({
      nama: satuItem.name,
      jumlah: satuItem.qty,
      catatan: satuItem.note,
      harga: satuItem.price,
      subtotal: satuItem.subtotal,
    })),
    total: lengkap.total,
    teksStatus: teksStatusUntukCashier(lengkap.status),
    metodeBayarTampil: metodeBayarUntukTampil(lengkap),
    status: lengkap.status,
  };
}

/**
 * Mengubah metode bayar pada pesanan menjadi teks yang tampil.
 *
 * Output: "QRIS", "Tunai", atau null kalau pesanan belum dibayar.
 *
 * Pembayaran yang sudah di-void (pesanan antrean yang dibatalkan) tetap
 * ditampilkan dengan keterangan dibatalkan, supaya Cashier tahu pembayarannya
 * sudah dibatalkan.
 */
function metodeBayarUntukTampil(pesanan: PesananCashier): string | null {
  if (pesanan.payment === null) {
    return null;
  }

  const namaMetode =
    pesanan.payment.method === "qris"
      ? teksCashier.metodeBayar.qris
      : teksCashier.metodeBayar.tunai;

  return pesanan.payment.voided ? namaMetode + " (dibatalkan)" : namaMetode;
}

/**
 * Mengubah status internal menjadi teks yang tampil di layar Cashier.
 *
 * Input: status dari server.
 * Output: teks yang tampil.
 *
 * Cashier butuh lebih banyak detail daripada customer, jadi setiap status punya
 * teks sendiri (docs/order-flow.md bagian 1). Tidak memakai teksStatus dari
 * customer karena "antrean" dan "dikerjakan" tampil berbeda di sini.
 */
function teksStatusUntukCashier(status: string): string {
  switch (status) {
    case STATUS_MENUNGGU:
      return "Menunggu konfirmasi";
    case STATUS_ANTREAN:
      return "Antrean";
    case STATUS_DIKERJAKAN:
      return "Dikerjakan";
    case STATUS_SELESAI:
      return "Selesai";
    case STATUS_DIBATALKAN:
      return "Dibatalkan";
    default:
      return "Status tidak diketahui";
  }
}
