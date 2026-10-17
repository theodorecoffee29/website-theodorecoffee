// File ini: komponen tampilan tabel log error.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan tidak
// mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).
//
// CATATAN SOAL TINGKAT: tingkat ditulis dengan TEKS ("Peringatan", "Error", "Kritis"),
// bukan hanya dibedakan dengan warna. Kalau hanya warna, Admin tidak bisa membedakan
// "Peringatan" dari "Kritis" saat mencetak hitam-putih atau saat layarnya buram. Ini juga
// diminta langsung di docs/logging.md bagian 4, di mana tingkat selalu ditulis dengan
// teks.
//
// CATATAN SOAL KODE: kode ditampilkan apa adanya seperti tersimpan di database
// ("ERR-4F2A"), karena itu yang dipakai Admin saat meminta kode kepada customer atau
// Cashier. Menampilkannya dengan bentuk lain akan membuat Admin salah menuliskan kode.

import type { KeadaanError } from "@/features/log/use-log-admin";
import {
  formatJsonTampil,
  idPendek,
  labelSumber,
  labelTingkat,
} from "@/features/log/label";
import { jamWib, tanggalJamWib } from "@/features/laporan/waktu";
import { teksLog } from "@/features/log/teks";
import { BagianJson } from "./tabel-aktivitas";
import type { BarisErrorTampil } from "@/lib/server/petakan-log";

/**
 * Menampilkan tabel log error beserta tombol muat lebih banyak.
 *
 * Input: keadaan bagian error dari hook.
 * Output: elemen React.
 */
export function TabelError({ keadaan }: { keadaan: KeadaanError }) {
  const kolom = teksLog.kolom;

  return (
    <div className="space-y-2">
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

      {!keadaan.memuat && !keadaan.gagalMuat && keadaan.items.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksLog.pesan.tidakAdaHasil}
        </p>
      ) : null}

      {keadaan.items.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-300 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {teksLog.kontrol.labelTabelError}
            </caption>
            <thead className="border-b border-gray-300 bg-gray-100 text-left">
              <tr>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.waktu}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.kode}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.tingkat}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.sumber}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {kolom.pesanSingkat}
                </th>
              </tr>
            </thead>
            <tbody>
              {keadaan.items.map((satu) => (
                <BarisError key={satu.id} baris={satu} keadaan={keadaan} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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
 * Satu baris log error.
 *
 * Input: satu baris dari server dan keadaan bagian (untuk tombol jejak order).
 * Output: elemen React.
 *
 * Kolom "pesan singkat" menampilkan message yang dipotong supaya tabel tetap ringkas.
 * Message penuhnya ada di dalam elemen details, karena di situlah nama file atau fungsi
 * yang jadi penyebabnya (docs/logging.md bagian 4).
 */
function BarisError({
  baris,
  keadaan,
}: {
  baris: BarisErrorTampil;
  keadaan: KeadaanError;
}) {
  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-2 py-2 whitespace-nowrap">
        {tanggalJamWib(baris.at)}
        <br />
        <span className="text-xs text-gray-600">{jamWib(baris.at)} WIB</span>
      </td>

      {/* Kode ditulis tebal karena ini yang dicari customer dan Cashier. */}
      <td className="px-2 py-2 font-semibold whitespace-nowrap">
        {baris.code}
      </td>

      <td className="px-2 py-2">{labelTingkat(baris.severity)}</td>
      <td className="px-2 py-2">{labelSumber(baris.source)}</td>

      <td className="px-2 py-2">
        {pesanSingkat(baris.message)}

        <details className="mt-1">
          <summary className="cursor-pointer text-xs underline">
            {teksLog.kontrol.judulDetailError}
          </summary>

          <div className="mt-1 space-y-2 text-xs">
            <BagianJson
              judul={teksLog.kontrol.labelPesanError}
              isi={formatJsonTampil(baris.message)}
            />
            <BagianJson
              judul={teksLog.kontrol.labelKonteks}
              isi={formatJsonTampil(baris.context)}
            />

            {/* Tombol jejak order. Hanya muncul kalau baris ini punya id order. */}
            {baris.orderId !== "" ? (
              <div>
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
          </div>
        </details>
      </td>
    </tr>
  );
}

/**
 * Memotong pesan error supaya kolom tabel tidak terlalu lebar.
 *
 * Input: message penuh dari database.
 * Output: potongan pesan yang lebih pendek, dengan penanda kalau dipotong.
 *
 * Kenapa dipotong di sini (bukan di server): memotong tampilan tidak mengubah data,
 * dan message penuhnya tetap bisa dibaca di dalam elemen details. Memotong di server
 * berarti Admin kehilangan informasi saat membandingkan log.
 */
function pesanSingkat(pesan: string): string {
  const batas = 120;

  if (pesan.length <= batas) {
    return pesan;
  }

  return pesan.slice(0, batas) + "...";
}
