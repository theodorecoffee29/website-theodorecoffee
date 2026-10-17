// File ini: komponen tampilan halaman detail satu laporan tersimpan
// (/cashier/laporan/[id] dan /admin/laporan/[id]).
//
// Halaman ini memakai komponen IsiLaporan yang sama dengan bagian "Hari ini", jadi
// isi laporan yang tampil persis sama di kedua tempat (AGENTS.md: logika di
// src/features/, komponen di src/components/).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).

import Link from "next/link";
import type { KeadaanLaporanDetail } from "@/features/laporan/use-laporan-detail";
import { teksLaporan } from "@/features/laporan/teks";
import { IsiLaporan } from "./isi-laporan";

// Props layar detail laporan.
export type PropsLayarDetailLaporan = {
  // Keadaan halaman dari hook useLaporanDetail.
  keadaan: KeadaanLaporanDetail;
  // Nama akun yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
  // Alamat halaman daftar Riwayat, dipakai untuk tautan kembali.
  pathRiwayat: string;
};

/**
 * Menampilkan halaman detail satu laporan tersimpan.
 *
 * Input: keadaan hook, nama akun, aksi keluar, dan path Riwayat.
 * Output: elemen React.
 */
export function LayarDetailLaporan({
  keadaan,
  namaAkun,
  keluar,
  pathRiwayat,
}: PropsLayarDetailLaporan) {
  const teks = teksLaporan.detail;

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="cetak-sembunyi flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksLaporan.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              Masuk sebagai {namaAkun}.{" "}
              <Link href={pathRiwayat} className="underline">
                {teks.kembaliKeRiwayat}
              </Link>
            </p>
          </div>

          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksLaporan.tombol.keluar}
          </button>
        </header>

        {keadaan.memuat ? (
          <p className="text-sm">{teksLaporan.pesan.memuat}</p>
        ) : null}

        {/* Laporan tidak ditemukan: pesan ramah dan tautan kembali ke daftar.
            Ini BUKAN error, jadi tidak ada tombol "Coba lagi" yang tidak akan
            pernah berhasil. */}
        {keadaan.tidakDitemukan ? (
          <section className="cetak-sembunyi rounded border border-gray-300 bg-white p-4">
            <h2 className="text-base font-semibold">
              {teks.tidakDitemukanJudul}
            </h2>
            <p className="mt-1 text-sm text-gray-700">{keadaan.pesan}</p>
            <Link
              href={pathRiwayat}
              className="mt-3 inline-block underline text-sm"
            >
              {teks.kembaliKeRiwayat}
            </Link>
          </section>
        ) : null}

        {keadaan.gagalMuat ? (
          <div className="cetak-sembunyi rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <p role="alert" className="text-sm text-amber-800">
              {keadaan.pesan ?? teksLaporan.pesan.gagalMuat}
            </p>
            <button
              type="button"
              onClick={keadaan.muatUlang}
              className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
            >
              {teksLaporan.tombol.cobaLagi}
            </button>
          </div>
        ) : null}

        {keadaan.isi !== null ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  {keadaan.isi.ringkasan.tanggalTeks}
                </h2>
                {/* Kapan laporan ini disimpan. Laporan yang sudah tersimpan tidak
                    berubah lagi, jadi waktu ini penting untuk jejak pengambilannya. */}
                <p className="text-sm text-gray-600">
                  {teks.teksDisimpanPada.replace(
                    "{waktu}",
                    keadaan.disimpanTeks,
                  )}
                </p>
              </div>

              {/* Judul dan waktu pencetakan: hanya muncul di kertas. */}
              <p className="cetak-hanya text-sm">
                <span className="font-semibold">{keadaan.judulCetak}</span>
                {keadaan.waktuCetak !== "" ? (
                  <span className="ml-2">{keadaan.waktuCetak}</span>
                ) : null}
              </p>

              <button
                type="button"
                onClick={keadaan.cetak}
                className="cetak-sembunyi rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {teksLaporan.tombol.cetak}
              </button>
            </div>

            <IsiLaporan isi={keadaan.isi} />
          </>
        ) : null}
      </div>
    </main>
  );
}
