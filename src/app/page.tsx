// File ini: halaman awal customer ("/"). Ini tujuan customer setelah memindai
// QR code booth.
//
// File halaman sengaja TIPIS (sesuai aturan di AGENTS.md bagian "Tampilan"):
// halaman hanya merakit hook dari src/features/ dan komponen dari
// src/components/, tanpa logika maupun panggilan API langsung.
//
// Halaman ini menampilkan isi dari browser (localStorage) dan memanggil API,
// jadi harus berjalan di sisi browser.

"use client";

import {
  DaftarOrderAktif,
  FormPesan,
  KerangkaCustomer,
  PesanMemuat,
} from "@/components/customer/beranda-customer";
import { useFormPesan } from "@/features/customer/use-form-pesan";
import { useOrderAktif } from "@/features/customer/use-order-aktif";
import { useOrderAktifRedirect } from "@/features/customer/use-order-aktif-redirect";
import { teksCustomer } from "@/features/customer/teks";

export default function HalamanBerandaCustomer() {
  // Hook 1: cek apakah ada order aktif di HP ini.
  const tampilanBeranda = useOrderAktif();

  // Hook 2: kalau ada tepat satu order aktif, arahkan ke halaman statusnya.
  useOrderAktifRedirect(tampilanBeranda);

  // Hook 3: logika form pesan (dipakai kalau tidak ada order aktif).
  const formPesan = useFormPesan();

  return (
    <KerangkaCustomer judul={teksCustomer.judulAplikasi}>
      <p className="text-sm text-gray-600">{teksCustomer.subjudulBeranda}</p>

      {/* Belum selesai membaca order aktif: tampilkan pesan memuat. */}
      {tampilanBeranda.keadaan === "memuat" ? <PesanMemuat /> : null}

      {/* Ada satu atau lebih order aktif: tampilkan daftar untuk dipilih.
          Kalau hanya satu, hook redirect di atas sudah mengalihkan ke status. */}
      {tampilanBeranda.keadaan === "daftar" ? (
        <DaftarOrderAktif orderAktif={tampilanBeranda.orderAktif} />
      ) : null}

      {/* Tidak ada order aktif: tampilkan form pesan. */}
      {tampilanBeranda.keadaan === "form" ? <FormPesan {...formPesan} /> : null}
    </KerangkaCustomer>
  );
}
