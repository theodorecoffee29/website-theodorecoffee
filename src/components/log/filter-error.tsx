// File ini: komponen tampilan formulir filter bagian "Error".
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan tidak
// mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).
//
// URUTAN ISIAN: kolom "Cari kode" paling atas, karena itu yang paling sering dipakai.
// Alasan: Admin umumnya sudah punya kode dari customer atau Cashier, dan ingin langsung
// melihat baris yang kode itu. Filter lain (tanggal, tingkat, sumber) debajo dipakai
// saat Admin justru belum tahu apa yang dia cari.
//
// CATATAN SOAL KODE: isian kode sengaja berupa teks biasa, bukan dengan pola yang
// memaksa huruf besar. Admin menyalin kode dari chat yang bisa huruf kecil, dan
// normalisasinya dilakukan di src/features/log/label.ts (normalisasiKodeCari), bukan di
// sini. Komponen tampilan tidak boleh punya aturan sendiri.

import type { FormFilterError } from "@/features/log/use-log-admin";
import { labelSumber, labelTingkat } from "@/features/log/label";
import { teksLog } from "@/features/log/teks";

// Props formulir filter error.
export type PropsFilterError = {
  // Isi formulir (sedang diketik).
  form: FormFilterError;
  // Meneruskan perubahan satu isian ke hook.
  ubahForm: (nama: keyof FormFilterError, nilai: string) => void;
  // Tombol "Terapkan".
  terapkan: () => void;
  // Tombol "Atur ulang".
  aturUlang: () => void;
};

// Nilai tingkat yang bisa dipilih. Nilainya sama dengan enum error_severity di
// database (src/lib/enum-log.ts).
const DAFTAR_TINGKAT = ["warning", "error", "critical"];

// Nilai sumber yang bisa dipilih. Nilainya sama dengan enum error_source di database.
const DAFTAR_SUMBER = ["client", "server", "database"];

/**
 * Menampilkan formulir filter error.
 *
 * Input: keadaan form dan aksi dari hook.
 * Output: elemen React.
 */
export function FilterError({
  form,
  ubahForm,
  terapkan,
  aturUlang,
}: PropsFilterError) {
  const teks = teksLog.kontrol;

  return (
    <form
      className="rounded border border-gray-300 bg-white p-3"
      onSubmit={(event) => {
        // Mencegah halaman memuat ulang saat tombol Enter ditekan, karena pemuatan
        // halaman ini dikendalikan oleh hook, bukan oleh submit form.
        event.preventDefault();
        terapkan();
      }}
    >
      {/* Baris paling atas: cari kode error. */}
      <div>
        <label htmlFor="logerror-kode" className="block text-xs text-gray-600">
          {teks.labelCariKode}
        </label>
        <input
          id="logerror-kode"
          type="text"
          value={form.code}
          onChange={(event) => ubahForm("code", event.target.value)}
          placeholder={teks.placeholderKode}
          // autoComplete="off" supaya peramban tidak mengisi otomatis dari riwayat, yang
          // bisa membuat Admin mengira kode lama itu sengaja diketik.
          autoComplete="off"
          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <KolomTanggal
          label={teks.labelDariTanggal}
          id="logerror-dari"
          nilai={form.from}
          ubah={(nilai) => ubahForm("from", nilai)}
        />

        <KolomTanggal
          label={teks.labelSampaiTanggal}
          id="logerror-sampai"
          nilai={form.to}
          ubah={(nilai) => ubahForm("to", nilai)}
        />

        <div>
          <label
            htmlFor="logerror-tingkat"
            className="block text-xs text-gray-600"
          >
            {teks.labelTingkat}
          </label>
          <select
            id="logerror-tingkat"
            value={form.severity}
            onChange={(event) => ubahForm("severity", event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{teks.pilihanSemua}</option>
            {DAFTAR_TINGKAT.map((satu) => (
              <option key={satu} value={satu}>
                {labelTingkat(satu)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="logerror-sumber"
            className="block text-xs text-gray-600"
          >
            {teks.labelSumber}
          </label>
          <select
            id="logerror-sumber"
            value={form.source}
            onChange={(event) => ubahForm("source", event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{teks.pilihanSemua}</option>
            {DAFTAR_SUMBER.map((satu) => (
              <option key={satu} value={satu}>
                {labelSumber(satu)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="logerror-order"
            className="block text-xs text-gray-600"
          >
            {teks.labelIdOrder}
          </label>
          <input
            id="logerror-order"
            type="text"
            value={form.orderId}
            onChange={(event) => ubahForm("orderId", event.target.value)}
            placeholder={teks.placeholderIdOrder}
            className="w-64 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white"
          >
            {teks.terapkan}
          </button>

          <button
            type="button"
            onClick={aturUlang}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.aturUlang}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Satu kolom isian tanggal.
 *
 * Input: label, id elemen (dipakai supaya label terhubung dengan isiannya), nilai
 *        sekarang, dan fungsi untuk melaporkan perubahan.
 * Output: elemen React.
 *
 * type="date" dipakai supaya peramban menampilkan pemilih tanggal, dan hasil isiannya
 * selalu format YYYY-MM-DD, persis seperti yang diharapkan server.
 */
function KolomTanggal({
  label,
  id,
  nilai,
  ubah,
}: {
  label: string;
  id: string;
  nilai: string;
  ubah: (nilai: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-600">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={nilai}
        onChange={(event) => ubah(event.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </div>
  );
}
