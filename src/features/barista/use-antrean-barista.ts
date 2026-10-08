// File ini: semua logika layar Barista (/barista).
//
// Hook useAntreanBarista mengurus:
//   1. Memuat antrean dari server.
//   2. Memuat ulang otomatis setiap 3 detik (polling).
//   3. Mendeteksi pesanan baru dan memberi tahu lewat spanduk teks + judul tab
//      browser (tanpa suara).
//   4. Tombol Mulai (status antrean) dan Selesai (status dikerjakan).
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/barista/ hanya menerima props.
//
// CATATAN PENTING soal beberapa Barista sekaligus: halaman ini TIDAK memakai
// penyimpanan lokal apa pun untuk mengunci aksi (tidak ada localStorage, tidak
// ada flag "saya sedang menangani"). Kalau memakai penyimpanan lokal, Barista
// kedua yang membuka halaman di laptop berbeda tidak akan melihat kunci itu, dan
// aksinya bisa bentrok. Penentuan pemenang sepenuhnya diserahkan ke server: saat
// tombol ditekan, server memeriksa status terbaru, dan hanya satu yang berhasil
// (docs/order-flow.md bagian 5).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilAntrean,
  kirimLogErrorKeServer,
  mulaiPesanan,
  selesaikanPesanan,
  type HasilApi,
  type PesananAntrean,
} from "./api";
import { kelompokkanAntrean, teksStatusBarista } from "./antrean-barista";
import {
  cariPesananBaru,
  hitungBaruMasuk,
  teksSpandukBaru,
} from "./pesanan-baru";
import { siapkanUntukTampil } from "./siapkan-tampil";
import { teksBarista } from "./teks";
import type { PesananUntukTampil } from "./siapkan-tampil";

// Berapa milidetik satu jeda polling. docs/api-contract.md bagian 5 menetapkan
// layar Barista memanggil get_barista_queue setiap 3 detik.
export const INTERVAL_POLLING_MS = 3000;

// Berapa kali polling gagal berturut-turut sebelum satu log error dikirim ke
// server, supaya log error tidak dibanjiri ketika internet sedang putus.
const BATASAN_GAGAL_BERURUTAN = 3;

// Keadaan layar Barista yang diteruskan ke komponen tampilan.
export type KeadaanBarista = {
  // Dua kelompok, masing-masing tetap berurut dari server.
  dikerjakan: PesananUntukTampil[];
  baruMasuk: PesananUntukTampil[];
  // Jumlah pesanan Baru masuk (untuk judul tab).
  jumlahBaruMasuk: number;
  // Teks spanduk pesanan baru, atau null kalau tidak ada yang baru.
  spandukBaru: string | null;
  // True saat masih memuat antrean untuk pertama kali.
  memuat: boolean;
  // True saat polling gagal. Antrean yang sudah tampil tetap dipertahankan.
  gagalMuat: boolean;
  // Pesan aksi terakhir (sukses/gagal/info), atau null.
  pesan: string | null;
  // Id pesanan yang sedang diproses (Mulai atau Selesai), atau null.
  sedangAksi: string | null;
  // Aksi yang dipanggil komponen tampilan.
  mulai: (orderId: string) => void;
  selesaikan: (orderId: string) => void;
  tutupSpanduk: () => void;
};

/**
 * Mengurus seluruh logika layar Barista.
 *
 * Output: KeadaanBarista yang diteruskan ke komponen tampilan.
 *
 * Cara kerja polling:
 *   - Muat sekali di awal.
 *   - Setelah itu ulangi setiap 3 detik, sampai halaman ditutup.
 *   - Kalau gagal, antrean yang sudah tampil TIDAK dihapus, dan pesan kecil
 *     "gagal memuat, mencoba lagi" muncul.
 *
 * Kenapa polling tidak berhenti seperti halaman status customer: halaman Barista
 * tidak punya status akhir yang perlu ditunggu. Pesanan baru bisa masuk kapan
 * saja, dan pesanan bisa dibatalkan Cashier kapan saja. Jadi poll terus sampai
 * halaman ditutup (docs/api-contract.md bagian 5).
 */
export function useAntreanBarista(): KeadaanBarista {
  // Antrean mentah dari server.
  const [antrean, setAntrean] = useState<PesananAntrean[]>([]);
  const [jumlahBaruMasuk, setJumlahBaruMasuk] = useState(0);
  const [spandukBaru, setSpandukBaru] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sedangAksi, setSedangAksi] = useState<string | null>(null);

  // Antrean terakhir yang sudah tampil. Disimpan di ref (bukan state) supaya
  // bisa dibaca tanpa menyebabkan render ulang, dan selalu berisi nilai
  // terbaru saat polling berjalan.
  const antreanSebelumnyaRef = useRef<PesananAntrean[]>([]);
  // PENANDA KHUSUS untuk membedakan "pemuatan pertama" dari "daftar kosong".
  //
  // Kenapa perlu penanda sendiri: kalau polling sempat gagal, daftar sebelumnya
  // bisa kosong sementara halamannya sudah terbuka lama. Kalau "pemuatan pertama"
  // disimpulkan dari daftar kosong, semua pesanan akan dianggap baru begitu
  // koneksi pulih, dan spanduk akan menyala terus. Karena itu penandanya
  // disimpan terpisah, bukan disimpulkan dari isi daftar.
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
   * Memuat antrean satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   *
   * Dipakai untuk muat pertama, untuk polling, dan untuk memuat ulang setelah
   * tombol Mulai atau Selesai ditekan.
   */
  const muatAntrean = useCallback(async () => {
    const hasil = await ambilAntrean();

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Gagal: JANGAN hapus antrean yang sudah tampil. Barista masih perlu
      // melihat pesanan yang sudah ada supaya bisa tetap mengerjakan.
      setGagalMuat(true);
      catatGagalBerturut("Antrean barista gagal dimuat: " + hasil.error.type);
      return;
    }

    // Berhasil: pesan gagal hilang dan penghitung kegagalan di-nol-kan.
    setGagalMuat(false);
    jumlahGagalRef.current = 0;

    // Cari pesanan baru. Perbandingan dilakukan terhadap antrean SEBELUMNYA.
    // Pemuatan pertama tidak memicu spanduk (lihat sudahPernahMuatRef).
    const pesananBaru = cariPesananBaru(
      antreanSebelumnyaRef.current,
      hasil.data.orders,
      sudahPernahMuatRef.current,
    );

    // Perbarui penanda "sudah pernah memuat" dan antrean sebelumnya.
    antreanSebelumnyaRef.current = hasil.data.orders;
    sudahPernahMuatRef.current = true;

    // Perhatikan: antrean dipakai UTUH apa adanya. Tidak ada pengurutan ulang di
    // klien, karena urutan server (waktu konfirmasi paling awal) yang benar.
    setAntrean(hasil.data.orders);
    setJumlahBaruMasuk(hitungBaruMasuk(hasil.data.orders));

    // Tampilkan spanduk kalau ada pesanan baru.
    const teksSpanduk = teksSpandukBaru(pesananBaru, {
      satu: teksBarista.notifikasi.spandukSatu,
      banyak: teksBarista.notifikasi.spandukBanyak,
    });
    if (teksSpanduk !== null) {
      setSpandukBaru(teksSpanduk);
    }
  }, []);

  // Muat antrean pertama kali saat halaman dibuka.
  //
  // Panggilan pertama sengaja dijadwalkan lewat setTimeout 0, bukan langsung
  // dipanggil. Alasannya: muatAntrean() mengubah state, dan mengubah state
  // langsung di dalam badan efek bisa memicu render berulang. Dengan
  // menundanya satu tick, render pertama selesai dulu baru data dimuat.
  useEffect(() => {
    berhentiRef.current = false;

    const langsungMuat = setTimeout(() => {
      void muatAntrean();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatAntrean]);

  // Polling: ulangi setiap 3 detik selama halaman terbuka.
  useEffect(() => {
    const timer = setInterval(() => {
      // Kalau halaman sudah ditinggalkan, berhenti.
      if (berhentiRef.current) {
        return;
      }

      void muatAntrean();
    }, INTERVAL_POLLING_MS);

    // Hapus interval saat komponen dilepas (pindah halaman atau keluar).
    return () => {
      clearInterval(timer);
    };
  }, [muatAntrean]);

  /**
   * Menjalankan satu aksi Barista (Mulai atau Selesai).
   *
   * Input: id pesanan, dan nama aksi ("mulai" atau "selesaikan") supaya pesan
   *        log dan pemanggilan API-nya jelas.
   * Output: void.
   *
   * Cara kerja:
   *   1. Panggil endpoint yang sesuai (start atau finish).
   *   2. Kalau ORDER_STATUS_CHANGED (mis. Barista lain sudah menekan lebih dulu,
   *      atau Cashier membatalkan pesanan), tampilkan pesannya lalu muat ulang
   *      antrean (docs/order-flow.md bagian 5).
   *   3. Kalau gagal lain, tampilkan pesan ramah dan laporkan ke server.
   *   4. Kalau berhasil, muat ulang antrean supaya tampilan sesuai keadaan
   *      terbaru (mis. setelah Selesai, pesanan hilang dari daftar).
   *
   * Catatan: tidak ada pengecekan status di sini. Server yang menentukan
   * pemenangnya, supaya beberapa Barista bisa menekan bersamaan dengan aman.
   */
  async function jalankanAksi(
    orderId: string,
    aksi: "mulai" | "selesaikan",
  ): Promise<void> {
    setSedangAksi(orderId);
    setPesan(null);

    const hasil =
      aksi === "mulai"
        ? await mulaiPesanan(orderId)
        : await selesaikanPesanan(orderId);

    setSedangAksi(null);

    // Kalau halaman sudah ditinggalkan, tidak perlu perbarui tampilan.
    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Status sudah berubah: beri tahu, lalu muat ulang supaya tampilan
      // sesuai keadaan terbaru.
      if (hasil.error.type === "ORDER_STATUS_CHANGED") {
        setPesan(teksBarista.pesan.statusSudahBerubah);
        await muatAntrean();
        return;
      }

      // Gagal lain: pesan ramah, plus kode ERR-xxxx kalau ada.
      setPesan(pesanUntukKegagalan(hasil));
      void kirimLogErrorKeServer(
        "gagal_aksi_staf",
        "Gagal " +
          aksi +
          " order: " +
          hasil.error.type +
          " " +
          hasil.error.message,
        orderId,
      );
      return;
    }

    // Berhasil: muat ulang. Untuk Selesai, pesanan tidak akan ada lagi di
    // antrean, jadi otomatis hilang dari daftar.
    await muatAntrean();
  }

  /** Tekan Mulai: status antrean -> dikerjakan. Output: void. */
  function mulai(orderId: string): void {
    void jalankanAksi(orderId, "mulai");
  }

  /** Tekan Selesai: status dikerjakan -> selesai. Output: void. */
  function selesaikan(orderId: string): void {
    void jalankanAksi(orderId, "selesaikan");
  }

  /** Menutup spanduk pesanan baru. Output: void. */
  function tutupSpanduk(): void {
    setSpandukBaru(null);
  }

  // Bagi antrean menjadi dua kelompok (tanpa mengurutkan ulang), lalu siapkan
  // untuk tampilan. Perhatikan siapkanUntukTampil tidak pernah mengirim harga.
  const kelompok = kelompokkanAntrean(antrean);
  const untukTampil = siapkanUntukTampil(
    kelompok.dikerjakan,
    teksStatusBarista,
  );
  const baruMasukTampil = siapkanUntukTampil(
    kelompok.baruMasuk,
    teksStatusBarista,
  );

  return {
    dikerjakan: untukTampil,
    baruMasuk: baruMasukTampil,
    jumlahBaruMasuk: jumlahBaruMasuk,
    spandukBaru: spandukBaru,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    sedangAksi: sedangAksi,
    mulai: mulai,
    selesaikan: selesaikan,
    tutupSpanduk: tutupSpanduk,
  };
}

/**
 * Mengubah hasil pemanggilan API jadi pesan yang enak dibaca Barista.
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
    return teksBarista.pesan.aksiGagalDenganKode.replace(
      "{kode}",
      hasil.error.code,
    );
  }

  // Pesan dari server lebih spesifik, jadi dipakai kalau ada.
  return hasil.error.message || teksBarista.pesan.aksiGagal;
}
