// File ini: logika halaman detail satu laporan tersimpan
// (/cashier/laporan/[id] dan /admin/laporan/[id]).
//
// Hook useLaporanDetail mengurus:
//   1. Memuat isi satu laporan dari /api/reports/[id].
//   2. Membedakan "laporan tidak ditemukan" dari kegagalan memuat, supaya yang
//      salah id-nya mendapat pesan ramah, bukan pesan error teknis.
//   3. Menangani tombol Cetak.
//
// TIDAK ADA POLLING di halaman ini. Laporan yang sudah tersimpan tidak berubah lagi
// selamanya (docs/api-contract.md bagian 4c), jadi tidak ada yang perlu dimuat
// ulang. Halaman ini juga tidak menampilkan bagian "Hari ini", karena laporan
// hari ini tidak punya id.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/laporan/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilLaporanDetail,
  catatLaporanDicetak,
  kirimLogErrorKeServer,
  pesanGagalMuat,
} from "./api";
import {
  judulCetak,
  kalimatWaktuCetak,
  type IsiLaporanTampil,
} from "./isi-laporan";
import { tanggalJamWib } from "./waktu";
import { teksLaporan } from "./teks";

// Keadaan halaman detail yang diteruskan ke komponen tampilan.
export type KeadaanLaporanDetail = {
  // Isi laporan yang sudah siap tampil, atau null kalau belum termuat atau
  // tidak ditemukan.
  isi: IsiLaporanTampil | null;
  // true selama permintaan pertama.
  memuat: boolean;
  // true kalau pemuatan gagal. null kalau tidak ada masalah.
  gagalMuat: boolean;
  // true kalau id-nya memang tidak ada di Riwayat.
  //
  // Kenapa dibedakan dari gagalMuat: "laporan tidak ditemukan" bukan kegagalan.
  // Yang perlu ditampilkan cuma "Laporan ini tidak ada" dan tautan kembali ke
  // daftar, bukan kotak error dengan tombol "Coba lagi" yang tidak akan pernah
  // berhasil.
  tidakDitemukan: boolean;
  // Pesan ramah untuk ditampilkan, atau null kalau tidak ada masalah.
  pesan: string | null;
  // Muat ulang sekali, dipakai tombol "Coba lagi".
  muatUlang: () => void;
  // Panggil window.print() lalu catat bahwa laporan ini dicetak.
  cetak: () => void;
  // Judul cetak, misal "Theodore Coffee - Laporan 11 Oktober 2026".
  judulCetak: string;
  // Kalimat waktu pencetakan, misal "Dicetak pada 11 Oktober 2026, 22.05".
  waktuCetak: string;
  // Kalimat "Disimpan pada 11 Oktober 2026, 00.05", atau string kosong.
  disimpanTeks: string;
};

/**
 * Mengurus pemuatan satu laporan tersimpan.
 *
 * Input: id laporan dari parameter halaman.
 * Output: KeadaanLaporanDetail yang diteruskan ke komponen tampilan.
 */
export function useLaporanDetail(reportId: string): KeadaanLaporanDetail {
  const [isi, setIsi] = useState<IsiLaporanTampil | null>(null);
  const [tanggal, setTanggal] = useState<string>("");
  const [disimpan, setDisimpan] = useState<string>("");
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [tidakDitemukan, setTidakDitemukan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [waktuCetak, setWaktuCetak] = useState("");

  // Flag supaya proses berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);
  // Id laporan terakhir yang termuat, dipakai saat mencatat pencetakan.
  const idRef = useRef<string>(reportId);

  /**
   * Memuat isi satu laporan satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   */
  const muat = useCallback(async () => {
    const hasil = await ambilLaporanDetail(reportId);

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // VALIDATION_FAILED di endpoint ini berarti id-nya tidak ada di Riwayat
      // (lihat catatan di api.ts). Itu bukan kegagalan sistem, jadi tidak
      // dilaporkan ke error_logs.
      if (hasil.error.type === "VALIDATION_FAILED") {
        setTidakDitemukan(true);
        setGagalMuat(false);
        setPesan(teksLaporan.detail.tidakDitemukanPesan);
        return;
      }

      setGagalMuat(true);
      setPesan(pesanGagalMuat(hasil.error));

      // Kegagalan memuat halaman ini dilaporkan supaya Admin bisa mencarinya di
      // error_logs, beserta kode ERR-xxxx yang tampil di layar.
      void kirimLogErrorKeServer(
        "gagal_muat_status",
        "Isi laporan gagal dimuat: " + hasil.error.type,
      );
      return;
    }

    // Berhasil.
    idRef.current = reportId;
    setIsi(hasil.data.isi);
    setTanggal(hasil.data.tanggal);
    setDisimpan(hasil.data.disimpan);
    setGagalMuat(false);
    setTidakDitemukan(false);
    setPesan(null);
  }, [reportId]);

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

  /**
   * Mencetak laporan tersimpan ini.
   *
   * Output: void.
   *
   * URUTAN PANGGILAN PENTING: window.print() dipanggil lebih dulu dan pencatatan
   * ke server tidak ditunggu. Kalau server sedang lambat, Cashier tidak boleh
   * menunggu laporan yang sudah dia cuma buka untuk dicetak
   * (docs/logging.md bagian 6 poin 4).
   */
  const cetak = useCallback(() => {
    setWaktuCetak(kalimatWaktuCetak(Date.now()));

    // Panggil cetak lebih dulu, tanpa menunggu server sama sekali.
    window.print();

    // Tidak ditunggu: hasilnya hanya jejak di log.
    void catatLaporanDicetak(idRef.current);
  }, []);

  return {
    isi: isi,
    memuat: memuat,
    gagalMuat: gagalMuat,
    tidakDitemukan: tidakDitemukan,
    pesan: pesan,
    muatUlang: () => {
      void muat();
    },
    cetak: cetak,
    judulCetak: judulCetak(tanggal),
    waktuCetak: waktuCetak,
    disimpanTeks: disimpan === "" ? "" : tanggalJamWib(disimpan),
  };
}
