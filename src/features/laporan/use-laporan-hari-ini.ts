// File ini: logika bagian "Hari ini" di halaman Laporan.
//
// Hook useLaporanHariIni mengurus:
//   1. Memuat laporan hari ini dari /api/reports/today.
//   2. Memuat ulang otomatis tiap POLLING_LAPORAN_HARI_INI_MS (10 detik), tapi
//      HANYA selama tab browser terlihat.
//   3. Memuat ulang sekali saat tab kembali terlihat, supaya angka langsung sesuai
//      keadaan terbaru.
//   4. Menerjemahkan isi laporan menjadi bentuk siap tampil.
//   5. Menangani tombol Cetak.
//
// CARA KERJA POLLING (pola yang sama dipakai
// src/features/customer/use-form-pesan.ts):
//   - Tab disembunyikan: interval DIMATIKAN. Tidak ada gunanya meminta laporan
//     dari tab yang tidak dilihat, dan internet di lokasi acara sering putus
//     (docs/prd.md bagian 10).
//   - Tab terlihat lagi: interval dinyalakan dari awal dan laporan dimuat ulang
//     SEKALI.
//   - Komponen dilepas (pindah halaman): interval dihapus dan pembaruan state
//     berikutnya diabaikan.
//
// KENAPA DATA YANG SUDAH TAMPIL TIDAK DIHAPUS SAAT GAGAL: Cashier sedang
// membandingkan angka di layar dengan uang di laci. Kalau polling gagal lalu
// layarnya kosong, dia tidak punya apa-apa untuk dicocokkan. Jadi yang muncul
// hanya pesan kecil, angka terakhir tetap di layar.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/laporan/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilLaporanHariIni,
  catatLaporanHariIniDicetak,
  kirimLogErrorKeServer,
  pesanGagalMuat,
} from "./api";
import {
  judulCetak,
  kalimatWaktuCetak,
  type IsiLaporanTampil,
} from "./isi-laporan";
import { POLLING_LAPORAN_HARI_INI_MS } from "./polling";

// Berapa kali polling gagal berturut-turut sebelum satu log error dikirim ke
// server, supaya log error tidak dibanjiri ketika internet sedang putus.
// Pola yang sama dipakai src/features/stok/use-sisa-stok.ts.
const BATASAN_GAGAL_BERURUTAN = 3;

// Keadaan bagian "Hari ini" yang diteruskan ke komponen tampilan.
export type KeadaanLaporanHariIni = {
  // Isi laporan yang sudah siap tampil, atau null kalau belum pernah termuat.
  isi: IsiLaporanTampil | null;
  // true selama permintaan pertama (belum ada data sama sekali).
  memuat: boolean;
  // true kalau pemuatan gagal dan belum ada data yang bisa ditampilkan. Kalau
  // sudah ada data, yang muncul cuma pesan pollingGagal.
  gagalMuat: boolean;
  // Pesan ramah untuk ditampilkan, atau null kalau tidak ada masalah.
  pesan: string | null;
  // true kalau polling gagal padahal data lama masih di layar.
  pollingGagal: boolean;
  // Muat ulang sekali, dipakai tombol "Coba lagi".
  muatUlang: () => void;
  // Panggil window.print() lalu catat bahwa laporan ini dicetak.
  cetak: () => void;
  // Judul cetak, misal "Theodore Coffee - Laporan 11 Oktober 2026".
  judulCetak: string;
  // Kalimat waktu pencetakan, misal "Dicetak pada 11 Oktober 2026, 22.05".
  // String kosong sebelum tombol Cetak ditekan.
  waktuCetak: string;
  // Tanggal laporan dalam format database ("2026-10-11"), dipakai saat mencatat
  // pencetakan.
  tanggal: string;
};

/**
 * Mengurus pemuatan dan polling laporan hari ini.
 *
 * Output: KeadaanLaporanHariIni yang diteruskan ke komponen tampilan.
 */
export function useLaporanHariIni(): KeadaanLaporanHariIni {
  const [isi, setIsi] = useState<IsiLaporanTampil | null>(null);
  const [tanggal, setTanggal] = useState<string>("");
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pollingGagal, setPollingGagal] = useState(false);
  const [waktuCetak, setWaktuCetak] = useState("");

  // Penghitung kegagalan polling berturut-turut.
  const jumlahGagalRef = useRef(0);
  // Flag supaya proses berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);
  // Laporan terakhir, disimpan di ref (bukan state) supaya muat() bisa
  // membacanya tanpa harus dibuat ulang setiap kali isi berubah. Kalau muat()
  // bergantung pada isi, interval polling ikut dibuat ulang terus-menerus.
  const isiRef = useRef<IsiLaporanTampil | null>(null);
  // Tanggal laporan terakhir, dipakai saat mencatat pencetakan.
  const tanggalRef = useRef<string>("");

  /**
   * Menghitung dan mengirim satu log error setelah cukup banyak kegagalan
   * polling berturut-turut.
   *
   * Input: tipe error dari server, untuk pesan log.
   * Output: void.
   *
   * Kenapa pakai ambang batas: kalau internet sedang putus, polling gagal
   * setiap beberapa detik. Kalau setiap kegagalan dilaporkan, tabel error_logs
   * akan penuh dalam satu menit.
   *
   * Fungsi ini ditulis SEBELUM muat() yang memakainya, karena aturan lint
   * react-hooks melarang memakai fungsi yang deklarasinya belum dilewati.
   */
  function catatGagalBerturut(tipeError: string): void {
    jumlahGagalRef.current += 1;

    if (jumlahGagalRef.current === BATASAN_GAGAL_BERURUTAN) {
      void kirimLogErrorKeServer(
        "gagal_muat_status",
        "Laporan hari ini gagal dimuat: " +
          tipeError +
          " (gagal " +
          jumlahGagalRef.current +
          " kali berturut-turut)",
      );
    }
  }

  /**
   * Memuat laporan hari ini satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   */
  const muat = useCallback(async () => {
    const hasil = await ambilLaporanHariIni();

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun. Tanpa ini,
    // respons yang datang belakangan bisa menimpa state halaman yang lain.
    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Data yang sudah tampil TIDAK dihapus (lihat catatan di atas).
      if (isiRef.current === null) {
        // Belum pernah termuat sama sekali: tampilkan pesan error penuh dengan
        // tombol "Coba lagi".
        setMemuat(false);
        setGagalMuat(true);
        setPollingGagal(false);
        setPesan(pesanGagalMuat(hasil.error));
      } else {
        // Sudah pernah termuat: cukup pesan kecil, tanpa menghapus angka.
        setPollingGagal(true);
        catatGagalBerturut(hasil.error.type);
      }
      return;
    }

    // Berhasil. Semua pesan hilang dan penghitung direset.
    isiRef.current = hasil.data.isi;
    tanggalRef.current = hasil.data.tanggal;

    setIsi(hasil.data.isi);
    setTanggal(hasil.data.tanggal);
    setMemuat(false);
    setGagalMuat(false);
    setPollingGagal(false);
    setPesan(null);
    jumlahGagalRef.current = 0;
  }, []);

  // Muat pertama kali, lalu atur polling mengikuti visibilitas tab.
  useEffect(() => {
    berhentiRef.current = false;

    // Pemanggilan pertama sengaja dijadwalkan lewat setTimeout 0, bukan langsung
    // dipanggil: muat() mengubah state, dan mengubah state langsung di dalam
    // badan efek bisa memicu render berulang.
    const langsungMuat = setTimeout(() => {
      void muat();
    }, 0);

    // Holder interval polling. Disimpan di luar fungsi supaya bisa dihentikan
    // dan dinyalakan lagi dari penanganan perubahan visibilitas.
    let timer: ReturnType<typeof setInterval> | null = null;

    /**
     * Menyalakan interval polling kalau tab sedang terlihat.
     *
     * Output: void.
     */
    function nyalakanTimer(): void {
      // Sudah menyala, atau tab sedang disembunyikan: tidak ada yang perlu
      // dilakukan.
      if (timer !== null || document.visibilityState !== "visible") {
        return;
      }

      timer = setInterval(() => {
        if (berhentiRef.current) {
          return;
        }
        void muat();
      }, POLLING_LAPORAN_HARI_INI_MS);
    }

    /**
     * Mematikan interval polling.
     *
     * Output: void.
     */
    function matikanTimer(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    /**
     * Bereaksi ketika tab browser dibuka atau ditutup.
     *
     * Output: void.
     */
    function saatVisibilitasBerubah(): void {
      if (document.visibilityState === "visible") {
        nyalakanTimer();
        // Muat ulang SEKALI supaya angka di layar langsung yang terbaru, bukan
        // angka yang tertinggal selama tab disembunyikan.
        void muat();
      } else {
        matikanTimer();
      }
    }

    nyalakanTimer();
    document.addEventListener("visibilitychange", saatVisibilitasBerubah);

    return () => {
      clearTimeout(langsungMuat);
      matikanTimer();
      document.removeEventListener("visibilitychange", saatVisibilitasBerubah);
      berhentiRef.current = true;
    };
  }, [muat]);

  /**
   * Mencetak laporan hari ini.
   *
   * Output: void.
   *
   * URUTAN PANGGILAN PENTING: window.print() DIPANGGIL DULU, dan pencatatan ke
   * server dilakukan tanpa ditunggu. Alasannya: yang dicetak adalah laporan untuk
   * dicocokkan dengan uang, bukan catatan log. Kalau pencatatan dilakukan lebih
   * dulu lalu server sedang lambat, Cashier menunggu tanpa ada gunanya. Dan kalau
   * pencatatan gagal, cetakannya tetap sudah jadi
   * (docs/logging.md bagian 6 poin 4).
   */
  const cetak = useCallback(() => {
    // Waktu pencetakan dicatat di layar supaya ikut tercetak di kertas.
    setWaktuCetak(kalimatWaktuCetak(Date.now()));

    // Panggil cetak lebih dulu, tanpa menunggu server sama sekali.
    window.print();

    // Tidak ditunggu (tidak pakai await): hasilnya hanya jejak di log.
    void catatLaporanHariIniDicetak(tanggalRef.current);
  }, []);

  return {
    isi: isi,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    pollingGagal: pollingGagal,
    muatUlang: () => {
      void muat();
    },
    cetak: cetak,
    judulCetak: judulCetak(tanggal),
    waktuCetak: waktuCetak,
    tanggal: tanggal,
  };
}
