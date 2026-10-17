// File ini: logika bagian "Riwayat" di halaman Laporan.
//
// Hook useRiwayatLaporan mengurus:
//   1. Memuat daftar Riwayat dari /api/reports saat halaman dibuka.
//   2. Menyimpan catatan kalau penyimpanan cadangan laporan yang lewat gagal
//      (field catchUpFailed dari server).
//
// TIDAK ADA POLLING di bagian ini. Alasannya: Riwayat hanya berubah saat pergantian
// hari, yaitu ketika satu laporan baru disimpan otomatis oleh pg_cron
// (docs/api-contract.md bagian 4c). Memuat ulang berkala tidak memberi informasi
// baru, hanya membebani server.
//
// CATATAN SOAL "MEMUAT...": permintaan pertama untuk daftar ini menjalankan
// penyimpanan cadangan (save_missing_reports) lebih dulu, jadi bisa agak lama.
// Karena itu layar menampilkan "Memuat..." selama menunggu dan BUKAN halaman
// kosong.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/laporan/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatLaporan,
  kirimLogErrorKeServer,
  pesanGagalMuat,
  type RiwayatTampil,
} from "./api";

// Keadaan bagian "Riwayat" yang diteruskan ke komponen tampilan.
export type KeadaanRiwayatLaporan = {
  // Daftar baris Riwayat, terbaru dulu. Kosong kalau belum ada laporan.
  daftar: RiwayatTampil[];
  // true selama permintaan pertama.
  memuat: boolean;
  // true kalau pemuatan gagal dan belum ada data yang bisa ditampilkan.
  gagalMuat: boolean;
  // Pesan ramah untuk ditampilkan, atau null kalau tidak ada masalah.
  pesan: string | null;
  // true kalau daftar sudah termuat tapi ada hari yang gagal disimpan, sehingga
  // daftar ini mungkin belum lengkap.
  catchUpGagal: boolean;
  // Muat ulang sekali, dipakai tombol "Coba lagi".
  muatUlang: () => void;
};

/**
 * Mengurus pemuatan daftar Riwayat.
 *
 * Output: KeadaanRiwayatLaporan yang diteruskan ke komponen tampilan.
 */
export function useRiwayatLaporan(): KeadaanRiwayatLaporan {
  const [daftar, setDaftar] = useState<RiwayatTampil[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [catchUpGagal, setCatchUpGagal] = useState(false);

  // Flag supaya proses berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);
  // Jumlah baris yang sudah pernah termuat, disimpan di ref (bukan dibaca dari
  // state) supaya fungsi muat() tidak perlu dibuat ulang setiap daftar berubah.
  // Kalau muat() bergantung pada daftar, efek pemuatan akan ikut berulang.
  const jumlahBarisRef = useRef(0);

  /**
   * Memuat daftar Riwayat satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   */
  const muat = useCallback(async () => {
    const hasil = await ambilRiwayatLaporan();

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Daftar yang sudah tampil TIDAK dihapus. Laporan yang sudah pernah
      // terlihat tetap berguna walau pemuatan berikutnya gagal.
      if (jumlahBarisRef.current === 0) {
        setGagalMuat(true);
        setPesan(pesanGagalMuat(hasil.error));

        // Kegagalan memuat halaman ini dilaporkan sekali supaya Admin bisa
        // mencarinya di error_logs (docs/logging.md bagian 5 dan 7).
        void kirimLogErrorKeServer(
          "gagal_muat_status",
          "Daftar Riwayat gagal dimuat: " + hasil.error.type,
        );
      } else {
        setCatchUpGagal(true);
      }
      return;
    }

    // Berhasil.
    jumlahBarisRef.current = hasil.data.reports.length;

    setDaftar(hasil.data.reports);
    setGagalMuat(false);
    setPesan(null);
    setCatchUpGagal(hasil.data.catchUpGagal);
  }, []);

  // Muat sekali saat halaman dibuka.
  useEffect(() => {
    berhentiRef.current = false;

    // Pemanggilan pertama dijadwalkan lewat setTimeout 0 supaya tidak mengubah
    // state langsung di dalam badan efek.
    const langsungMuat = setTimeout(() => {
      void muat();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muat]);

  return {
    daftar: daftar,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    catchUpGagal: catchUpGagal,
    muatUlang: () => {
      void muat();
    },
  };
}
