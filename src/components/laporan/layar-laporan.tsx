// File ini: komponen tampilan halaman Laporan (/cashier/laporan dan
// /admin/laporan).
//
// Isinya DUA BAGIAN yang disusun berurutan ke bawah: "Hari ini" lalu "Riwayat".
// Kenapa bukan tab: dua bagian yang selalu tampil lebih sederhana dan tidak
// perlu state tab yang bisa membingungkan (AGENTS.md bagian "Tampilan": jangan
// membuat keputusan desain sendiri).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API
// (semua logika ada di src/features/laporan/).
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).

import Link from "next/link";
import type { RiwayatTampil } from "@/features/laporan/api";
import type { KeadaanLaporanHariIni } from "@/features/laporan/use-laporan-hari-ini";
import type { KeadaanRiwayatLaporan } from "@/features/laporan/use-riwayat-laporan";
import { teksLaporan } from "@/features/laporan/teks";
import { IsiLaporan } from "./isi-laporan";

// Props layar laporan.
export type PropsLayarLaporan = {
  // Keadaan bagian "Hari ini" dari hook useLaporanHariIni.
  hariIni: KeadaanLaporanHariIni;
  // Keadaan bagian "Riwayat" dari hook useRiwayatLaporan.
  riwayat: KeadaanRiwayatLaporan;
  // Nama akun yang sedang login, untuk menampilkan di header.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
  // Alamat halaman daftar Riwayat untuk area ini, misal "/cashier/laporan".
  // Setiap baris Riwayat menuju ke halaman detail di alamat ini.
  pathRiwayat: string;
};

/**
 * Menampilkan halaman Laporan lengkap: bagian "Hari ini" dan bagian "Riwayat".
 *
 * Input: keadaan kedua hook, nama akun, aksi keluar, dan path Riwayat.
 * Output: elemen React.
 */
export function LayarLaporan({
  hariIni,
  riwayat,
  namaAkun,
  keluar,
  pathRiwayat,
}: PropsLayarLaporan) {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <HeaderLaporan namaAkun={namaAkun} keluar={keluar} />

        <BagianHariIni keadaan={hariIni} />

        <BagianRiwayat keadaan={riwayat} pathRiwayat={pathRiwayat} />
      </div>
    </main>
  );
}

/**
 * Header halaman: judul, nama akun, dan tombol Keluar.
 *
 * Tombol Keluar diberi kelas cetak-sembunyi supaya tidak ikut tercetak.
 */
function HeaderLaporan({
  namaAkun,
  keluar,
}: {
  namaAkun: string;
  keluar: () => void;
}) {
  return (
    <header className="cetak-sembunyi flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
      <div>
        <h1 className="text-xl font-bold">{teksLaporan.judulHalaman}</h1>
        <p className="text-sm text-gray-600">
          {teksLaporan.subjudulHalaman} Masuk sebagai {namaAkun}.
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
  );
}

/**
 * Bagian "Hari ini": laporan live + tombol Cetak.
 *
 * Tombol Cetak diberi kelas cetak-sembunyi (tidak ikut tercetak) dan judul cetak
 * disembunyikan di layar (cetak-hanya) supaya hanya muncul di kertas.
 */
function BagianHariIni({ keadaan }: { keadaan: KeadaanLaporanHariIni }) {
  const teks = teksLaporan;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{teks.bagian.hariIni}</h2>

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
          disabled={keadaan.isi === null}
          className="cetak-sembunyi rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        >
          {teks.tombol.cetak}
        </button>
      </div>

      {/* Catatan bahwa laporan ini belum disimpan, jadi angkanya masih berubah. */}
      <p className="text-sm text-gray-600">{teks.keteranganHariIni}</p>

      {keadaan.memuat ? <p className="text-sm">{teks.pesan.memuat}</p> : null}

      {/* Polling gagal tapi angka lama masih di layar: pesan kecil saja, data TIDAK
          dihapus (Cashier masih membandingkannya dengan uang di laci). */}
      {keadaan.pollingGagal ? (
        <p role="status" className="text-sm text-amber-700">
          {teks.pesan.gagalPolling}
        </p>
      ) : null}

      {keadaan.gagalMuat ? (
        <KotakGagal pesan={keadaan.pesan} muatUlang={keadaan.muatUlang} />
      ) : null}

      {keadaan.isi !== null ? <IsiLaporan isi={keadaan.isi} /> : null}
    </section>
  );
}

/**
 * Bagian "Riwayat": daftar laporan yang sudah tersimpan.
 *
 * Tiap baris adalah tautan ke halaman detail laporan itu.
 *
 * SELURUH bagian ini diberi kelas cetak-sembunyi: tombol Cetak ada di bagian "Hari
 * ini", dan yang dicetak dari halaman ini harus HANYA isi laporan hari ini. Kalau
 * daftar Riwayat ikut tercetak, salinan yang dibawa pulang jadi dua lapis dan
 * mudah tertukar. Untuk mencetak laporan tersimpan, Cashier membuka halaman
 * detailnya lalu menekan Cetak di sana.
 */
function BagianRiwayat({
  keadaan,
  pathRiwayat,
}: {
  keadaan: KeadaanRiwayatLaporan;
  pathRiwayat: string;
}) {
  return (
    <section className="cetak-sembunyi space-y-2">
      <h2 className="text-lg font-semibold">{teksLaporan.bagian.riwayat}</h2>

      {keadaan.memuat ? (
        <p className="text-sm">{teksLaporan.pesan.memuat}</p>
      ) : null}

      {keadaan.gagalMuat ? (
        <KotakGagal pesan={keadaan.pesan} muatUlang={keadaan.muatUlang} />
      ) : null}

      {/* Daftar sudah termuat tapi ada hari yang gagal disimpan: beri tahu
          Cashier supaya dia tahu daftar ini mungkin belum lengkap. */}
      {keadaan.catchUpGagal ? (
        <p role="status" className="text-sm text-amber-700">
          {teksLaporan.pesan.riwayatBelumLengkap}
        </p>
      ) : null}

      {keadaan.daftar.length === 0 && !keadaan.memuat && !keadaan.gagalMuat ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksLaporan.pesan.riwayatKosong}
        </p>
      ) : null}

      {keadaan.daftar.length > 0 ? (
        <DaftarRiwayat daftar={keadaan.daftar} pathRiwayat={pathRiwayat} />
      ) : null}
    </section>
  );
}

/**
 * Daftar baris Riwayat: tanggal, waktu disimpan, jumlah order, total penjualan.
 *
 * Tiap baris adalah tautan ke halaman detail laporan itu.
 */
function DaftarRiwayat({
  daftar,
  pathRiwayat,
}: {
  daftar: RiwayatTampil[];
  pathRiwayat: string;
}) {
  const kolom = teksLaporan.riwayat.kolom;

  return (
    <div className="overflow-x-auto rounded border border-gray-300 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-300 bg-gray-100 text-left">
          <tr>
            <th scope="col" className="px-2 py-2 font-semibold">
              {kolom.tanggal}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {kolom.waktuDisimpan}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {kolom.orderTerhitung}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {kolom.totalPenjualan}
            </th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((satu) => (
            <tr key={satu.reportId} className="border-b border-gray-100">
              <td className="px-2 py-2">
                {/* Tautan ke halaman detail laporan ini. */}
                <Link
                  href={pathRiwayat + "/" + satu.reportId}
                  className="underline"
                >
                  {satu.tanggalTeks}
                </Link>
              </td>
              <td className="px-2 py-2">{satu.waktuTeks} WIB</td>
              <td className="px-2 py-2">{satu.orderTerhitungTeks}</td>
              <td className="px-2 py-2">{satu.totalPenjualanTeks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Kotak pesan gagal memuat dengan tombol "Coba lagi".
 *
 * Input: pesan untuk ditampilkan (boleh null) dan aksi muat ulang.
 * Output: elemen React.
 *
 * Pesan yang sudah punya kode ERR-xxxx dari server dipakai apa adanya, karena
 * kode itu yang dicari Admin di error_logs (docs/logging.md bagian 5).
 */
function KotakGagal({
  pesan,
  muatUlang,
}: {
  pesan: string | null;
  muatUlang: () => void;
}) {
  return (
    <div className="cetak-sembunyi rounded border border-amber-300 bg-amber-50 px-3 py-2">
      <p role="alert" className="text-sm text-amber-800">
        {pesan ?? teksLaporan.pesan.gagalMuat}
      </p>
      <button
        type="button"
        onClick={muatUlang}
        className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
      >
        {teksLaporan.tombol.cobaLagi}
      </button>
    </div>
  );
}
