// File ini: pembungkus layar Cashier yang berjalan di browser.
//
// Kenapa perlu: useDaftarPesanan memakai useState, useEffect, dan polling, jadi
// hanya bisa jalan di browser. Halaman src/app/cashier/page.tsx berjalan di
// server (karena perlu membaca sesi), jadi halaman itu tidak bisa langsung
// memakai hook. File ini menjadi jembatan: dipanggil dari halaman server, lalu
// merakit hook dan komponen tampilan di sisi browser.
//
// Komponen ini juga mengurus judul tab browser, karena itu juga hanya bisa
// dilakukan di browser.

"use client";

import { useEffect } from "react";
import { LayarCashier } from "./layar-cashier";
import { useDaftarPesanan } from "@/features/cashier/use-daftar-pesanan";
import { useFormOrderManual } from "@/features/cashier/use-form-manual";
import { POLLING_SISA_STOK_MS } from "@/features/cashier/polling";
import { useSisaStok } from "@/features/stok/use-sisa-stok";
import { teksCashier } from "@/features/cashier/teks";

// Props dari halaman server.
type PropsLayarCashierClient = {
  // Nama akun Cashier yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar. Server Action boleh dikirim sebagai prop ke
  // komponen browser.
  keluar: () => void;
};

/**
 * Merakit seluruh layar Cashier di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarCashierClient({
  namaAkun,
  keluar,
}: PropsLayarCashierClient) {
  // Panel sisa stok. Dimuat lebih dulu supaya petunjuk sisa porsi di tiap item
  // pesanan sudah ada saat daftar pesanan pertama tampil. Jeda pollingnya 5 detik
  // (src/features/cashier/polling.ts).
  const sisaStok = useSisaStok(POLLING_SISA_STOK_MS);

  const keadaan = useDaftarPesanan(sisaStok.menus);

  // Form order manual. Setelah pesanan manual berhasil disimpan, daftar pesanan
  // dimuat ulang supaya pesanan baru itu langsung terlihat di bawah form.
  const formManual = useFormOrderManual(keadaan.segarkanDaftar);

  // Judul tab browser: menampilkan jumlah pesanan yang menunggu konfirmasi,
  // supaya Cashier tahu ada pesanan baru bahkan tanpa melihat layar
  // (mis. sedang membantu customer di meja sebelah).
  //
  // Judul hanya diubah kalau jumlahnya berubah, supaya tidak menulis judul
  // berulang tiap 3 detik.
  useEffect(() => {
    document.title =
      keadaan.jumlahMenunggu > 0
        ? teksCashier.order.judulTabDenganJumlah.replace(
            "{jumlah}",
            String(keadaan.jumlahMenunggu),
          )
        : teksCashier.order.judulTabTanpaJumlah;

    // Kembalikan judul semula saat halaman ditinggalkan.
    return () => {
      document.title = "";
    };
  }, [keadaan.jumlahMenunggu]);

  return (
    <LayarCashier
      keadaan={keadaan}
      formManual={formManual}
      sisaStok={sisaStok}
      // Daftar menu sisa stok dipakai untuk mencocokkan sisa porsi di tiap item
      // pesanan dan di tiap menu form pesanan manual.
      menuStok={sisaStok.menus}
      namaAkun={namaAkun}
      keluar={keluar}
    />
  );
}
