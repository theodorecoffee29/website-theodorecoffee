// File ini: mengarahkan pengguna ke halaman status bila ada tepat satu order
// aktif.
//
// Kenapa dipisah ke hook sendiri: halaman beranda harus tetap bisa menampilkan
// daftar kalau ada LEBIH dari satu order aktif. Arahkan hanya kalau TEPAT satu,
// supaya tidak memaksa pengguna memilih saat hanya ada satu pilihan anyway.
//
// File ini MURNI dari sisi keputusan (hanya memutuskan), dan memakai
// window.location.href untuk berpindah halaman (bukan redirect() dari
// next/navigation, karena yang ini dipanggil dari Client Component).

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TampilanBeranda } from "./use-order-aktif";

/**
 * Mengarahkan ke halaman status kalau ada tepat satu order aktif.
 *
 * Input: keadaan beranda dari hook useOrderAktif.
 * Output: void. Sisi efeknya: kalau syaratnya terpenuhi, halaman berpindah.
 *
 // Cara kerja: begitu keadaan berubah menjadi "daftar" dengan isinya tepat satu,
// useEffect memindahkan browser ke /status/<id>. Efek ini dibersihkan otomatis
// oleh React saat komponen dilepas.
 */
export function useOrderAktifRedirect(tampilan: TampilanBeranda): void {
  // Router Next.js dipakai untuk berpindah halaman, bukan
  // window.location.href, supaya navigasi Next.js tetap bekerja.
  const router = useRouter();

  useEffect(() => {
    // Arahkan hanya kalau keadaan "daftar" dengan tepat satu order.
    if (tampilan.keadaan !== "daftar") {
      return;
    }

    if (tampilan.orderAktif.length === 1) {
      // Satu order aktif: langsung buka statusnya.
      router.push("/status/" + tampilan.orderAktif[0].orderId);
    }
    // Kalau lebih dari satu, biarkan halaman menampilkan daftarnya.
  }, [tampilan, router]);
}
