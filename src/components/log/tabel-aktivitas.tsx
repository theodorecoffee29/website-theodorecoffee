// File ini: komponen tampilan tabel log aktivitas.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan tidak
// mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).
//
// CATATAN SOAL PEMAKAIAN PEMFORMAT WAKTU: kolom waktu memakai pemformat WIB yang sudah
// dipakai bersama, src/features/laporan/waktu.ts (jamWib dan tanggalJamWib). Fungsi itu
// disalin ke area laporan dengan alasan yang sama seperti area lain di proyek ini:
// supaya tiap area tidak bergantung pada file area lain. Memakai satu fungsi yang sama
// membuat jam di log, di laporan, dan di layar Cashier tidak pernah tampil berbeda.
//
// CATATAN SOAL KOLOM WAKTU: waktu ditulis dua kali, tanggal lengkap lalu jam saja
// ("11 Oktober 2026, 14.30" lalu "14.30 WIB"). Alasannya, tabel log punya banyak baris
// dengan waktu yang mirip, jadi tanggal lengkap dipakai untuk membaca, dan jam saja
// dipakai untuk membandingkan dengan catatan waktu yang biasa dipakai di booth.

import type { KeadaanAktivitas } from "@/features/log/use-log-admin";
import {
  kalimatObjek,
  kalimatPelaku,
  formatJsonTampil,
  idPendek,
  labelAksi,
} from "@/features/log/label";
import { jamWib, tanggalJamWib } from "@/features/laporan/waktu";
import { teksLog } from "@/features/log/teks";
import type { BarisAktivitasTampil } from "@/lib/server/petakan-log";

/**
 * Menampilkan tabel log aktivitas beserta tombol muat lebih banyak.
 *
 * Input: keadaan bagian aktivitas dari hook.
 * Output: elemen React.
 */
export function TabelAktivitas({ keadaan }: { keadaan: KeadaanAktivitas }) {
  const kolom = teksLog.kolom;

  return (
    <div className="space-y-2">
      {/* Catatan arah urutan. Beda antara daftar biasa dan jejak satu order. */}
      <p className="text-xs text-gray-600">
        {keadaan.modeJejakOrder
          ? teksLog.pesan.catatanUrutJejak
          : teksLog.pesan.catatanUrut}
      </p>

      {keadaan.memuat ? (
        <p className="text-sm">{teksLog.pesan.memuat}</p>
      ) : null}

      {keadaan.gagalMuat ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <p role="alert" className="text-sm text-amber-800">
            {keadaan.pesan ?? teksLog.pesan.gagalMuat}
          </p>
          <button
            type="button"
            onClick={keadaan.muatUlang}
            className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
          >
            {teksLog.kontrol.cobaLagi}
          </button>
        </div>
      ) : null}

      {/* "Tidak ada hasil" hanya ditampilkan kalau pemuatan sudah selesai, supaya
          tidak muncul bersama "Memuat...". */}
      {!keadaan.memuat && !keadaan.gagalMuat && keadaan.items.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksLog.pesan.tidakAdaHasil}
        </p>
      ) : null}

      {keadaan.items.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-300 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {teksLog.kontrol.labelTabelAktivitas}
            </caption>
            <thead className="border-b border-gray-300 bg-gray-100 text-left">
              <tr>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.waktu}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.aksi}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.pelaku}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.objek}
                </th>
              </tr>
            </thead>
            <tbody>
              {keadaan.items.map((satu) => (
                <BarisAktivitas key={satu.id} baris={satu} keadaan={keadaan} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Tombol hanya muncul kalau masih ada halaman berikutnya (server mengembalikan
          nextCursor). */}
      {keadaan.adaLebihBanyak ? (
        <button
          type="button"
          onClick={keadaan.muatLebihBanyak}
          disabled={keadaan.memuatLebih}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        >
          {teksLog.kontrol.muatLebihBanyak}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Satu baris log aktivitas.
 *
 * Input: satu baris dari server dan keadaan bagian (untuk tombol jejak order).
 * Output: elemen React.
 *
 * Detail before/after/meta disimpan di elemen <details>. Dipakai <details> bawaan HTML
 * (bukan komponen atau JavaScript) karena tugas ini tidak memakai library tampilan, dan
 * elemen ini sudah bisa dibuka-tutup oleh keyboard tanpa kode tambahan.
 *
 * Kolom aksi menampilkan DUA hal: label ramah ("Order dikonfirmasi") dan nama aksinya
 * yang mentah ("order.confirmed"). Kenapa dua-duanya: label enak dibaca, tapi nama
 * mentah perlu searched ketika Admin membandingkan dengan dokumen atau dengan log lain.
 */
function BarisAktivitas({
  baris,
  keadaan,
}: {
  baris: BarisAktivitasTampil;
  keadaan: KeadaanAktivitas;
}) {
  return (
    <tr className="border-b border-gray-100 align-top">
      {/* Waktu: tanggal dan jam WIB, dipisah <br> supaya kolom tetap sempit. */}
      <td className="px-2 py-2 whitespace-nowrap">
        {tanggalJamWib(baris.at)}
        <br />
        <span className="text-xs text-gray-600">{jamWib(baris.at)} WIB</span>
      </td>

      <td className="px-2 py-2">
        <span className="font-medium">{labelAksi(baris.action)}</span>
        <br />
        <span className="text-xs text-gray-600">{baris.action}</span>

        <details className="mt-1">
          <summary className="cursor-pointer text-xs underline">
            {teksLog.kontrol.judulDetailAktivitas}
          </summary>

          <div className="mt-1 space-y-2 text-xs">
            <BagianJson
              judul={teksLog.kontrol.labelSebelum}
              isi={formatJsonTampil(baris.before)}
            />
            <BagianJson
              judul={teksLog.kontrol.labelSesudah}
              isi={formatJsonTampil(baris.after)}
            />
            <BagianJson
              judul={teksLog.kontrol.labelKonteks}
              isi={formatJsonTampil(baris.meta)}
            />
          </div>
        </details>
      </td>

      <td className="px-2 py-2">
        {kalimatPelaku(baris.actorName, baris.actorRole)}
      </td>

      <td className="px-2 py-2">
        {kalimatObjek(baris.entityType, baris.entityId)}

        {/* Tombol jejak order. Hanya muncul kalau baris ini memang punya id order. */}
        {baris.orderId !== "" ? (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => keadaan.lihatJejakOrder(baris.orderId)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {teksLog.kontrol.lihatJejakOrder}
            </button>
            <span className="ml-1 text-xs text-gray-600">
              ({idPendek(baris.orderId)})
            </span>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Satu bagian JSON di dalam elemen details.
 *
 * Input: judul bagian (mis. "Sebelum") dan isi yang sudah diformat sebagai teks, atau
 *        null kalau kosong.
 * Output: elemen React.
 */
export function BagianJson({
  judul,
  isi,
}: {
  judul: string;
  isi: string | null;
}) {
  return (
    <div>
      <p className="font-semibold">{judul}</p>
      <pre className="mt-1 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2">
        {isi ?? teksLog.pesan.detailKosong}
      </pre>
    </div>
  );
}
