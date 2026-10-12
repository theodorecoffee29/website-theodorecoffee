// File ini: hook yang mengurus data panel "Sisa stok" untuk Cashier maupun
// Barista.
//
// Hook ini sengaja dipakai kedua area supaya keduanya memakai polling dan
// penanganan kegagalan yang sama. Yang membedakan keduanya hanya Interval polling
// (Cashier 5 detik, Barista 10 detik), dan itu dikirim sebagai parameter.
//
// Cara kerja polling:
//   - Muat sekali di awal.
//   - Setelah itu ulangi setiap intervalMs, sampai halaman ditutup.
//   - Kalau gagal, data yang sudah tampil TIDAK dihapus. Cashier/Barista masih
//     perlu melihat sisa stok terakhir supaya tahu kira-kira bahan masih ada.
//     Yang muncul hanya pesan kecil (docs/api-contract.md bagian 5).
//
// Kenapa polling tidak pernah berhenti di sini: stok berubah setiap kali ada
// konfirmasi order, jadi tidak ada keadaan akhir yang perlu ditunggu.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilSisaStok,
  kirimLogErrorKeServer,
  type BahanSisaStok,
  type MenuSisaStok,
} from "./api";

// Berapa kali polling gagal berturut-turut sebelum satu log error dikirim ke
// server, supaya log error tidak dibanjiri ketika internet sedang putus.
const BATASAN_GAGAL_BERURUTAN = 3;

// Keadaan panel sisa stok yang diteruskan ke komponen tampilan.
export type KeadaanSisaStok = {
  // Daftar menu aktif beserta sisa porsinya.
  menus: MenuSisaStok[];
  // Daftar bahan beserta sisa stoknya.
  ingredients: BahanSisaStok[];
  // True saat panel belum pernah termuat (menampilkan pesan "memuat").
  memuat: boolean;
  // True saat pemuatan terakhir gagal. Data yang sudah tampil tetap ada.
  gagalMuat: boolean;
  // Muat ulang sekali saja. Dipanggil setelah aksi yang mengubah stok
  // (mis. konfirmasi atau pembatalan pesanan).
  muatUlang: () => void;
};

/**
 * Mengurus pemuatan dan polling data sisa stok.
 *
 * Input: intervalMs (jeda polling dalam milidetik, diberikan oleh area pemakai).
 * Output: KeadaanSisaStok.
 */
export function useSisaStok(intervalMs: number): KeadaanSisaStok {
  const [menus, setMenus] = useState<MenuSisaStok[]>([]);
  const [ingredients, setIngredients] = useState<BahanSisaStok[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);

  // Penghitung kegagalan polling berturut-turut.
  const jumlahGagalRef = useRef(0);
  // Flag supaya proses berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);

  /**
   * Mencatat kegagalan berulang dan mengirim satu log error ke server setelah
   * cukup banyak kegagalan berturut-turut.
   *
   * Input: pesan singkat yang menjelaskan kegagalannya.
   * Output: void.
   *
   * Kenapa pakai ambang batas: kalau internet sedang putus, polling gagal
   * setiap beberapa detik. Kalau setiap kegagalan dilaporkan, tabel error_logs
   * akan penuh dalam satu menit.
   *
   * Fungsi ini ditulis SEBELUM muat() yang memakainya, karena aturan lint
   * react-hooks melarang memakai fungsi yang deklarasinya belum dilewati.
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
   * Memuat data sisa stok satu kali.
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan.
   */
  const muat = useCallback(async () => {
    const hasil = await ambilSisaStok();

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Gagal: JANGAN hapus data yang sudah tampil.
      setGagalMuat(true);
      catatGagalBerturut("Sisa stok gagal dimuat: " + hasil.error.type);
      return;
    }

    // Berhasil: pesan gagal hilang dan penghitung direset.
    setGagalMuat(false);
    jumlahGagalRef.current = 0;

    setMenus(hasil.data.menus);
    setIngredients(hasil.data.ingredients);
  }, []);

  // Muat pertama kali saat halaman dibuka.
  //
  // Pemanggilan pertama sengaja dijadwalkan lewat setTimeout 0, bukan langsung
  // dipanggil: muat() mengubah state, dan mengubah state langsung di dalam
  // badan efek bisa memicu render berulang.
  useEffect(() => {
    berhentiRef.current = false;

    const langsungMuat = setTimeout(() => {
      void muat();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muat]);

  // Polling: ulangi selama halaman terbuka.
  useEffect(() => {
    const timer = setInterval(() => {
      if (berhentiRef.current) {
        return;
      }
      void muat();
    }, intervalMs);

    // Hapus interval saat komponen dilepas (pindah halaman atau keluar).
    return () => {
      clearInterval(timer);
    };
  }, [muat, intervalMs]);

  return {
    menus: menus,
    ingredients: ingredients,
    memuat: memuat,
    gagalMuat: gagalMuat,
    muatUlang: () => {
      void muat();
    },
  };
}
