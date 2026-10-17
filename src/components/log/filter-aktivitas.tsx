// File ini: komponen tampilan formulir filter bagian "Aktivitas".
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan tidak
// mengubah state sendiri. Semua perubahan isian diteruskan ke hook lewat props
// (sesuai aturan di AGENTS.md bagian "Tampilan").
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan class
// Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.
//
// SETIAP isian punya label teks yang jelas, dan setiap tombol punya nama yang jelas,
// karena halaman ini dipakai sambil mencari penyebab masalah.

import type { FormFilterAktivitas } from "@/features/log/use-log-admin";
import {
  labelAksi,
  labelJenisObjek,
  labelPeranPelaku,
} from "@/features/log/label";
import { teksLog } from "@/features/log/teks";

// Props formulir filter aktivitas.
export type PropsFilterAktivitas = {
  // Isi formulir (sedang diketik).
  form: FormFilterAktivitas;
  // Meneruskan perubahan satu isian ke hook.
  ubahForm: (nama: keyof FormFilterAktivitas, nilai: string) => void;
  // Tombol "Terapkan".
  terapkan: () => void;
  // Tombol "Atur ulang".
  aturUlang: () => void;
};

// Nama aksi yang bisa dipilih, diambil dari daftar label di teks.ts.
//
// Urutannya mengikuti docs/logging.md bagian 2, jadi mudah dibandingkan dengan dokumen
// saat sedang mencari aksi yang benar.
const DAFTAR_AKSI = [
  "order.created",
  "order.confirmed",
  "order.cancelled",
  "order.started",
  "order.finished",
  "payment.recorded",
  "payment.voided",
  "stock.deducted",
  "stock.restored",
  "stock.restocked",
  "stock.adjusted",
  "stock.negative",
  "menu.created",
  "menu.updated",
  "menu.deactivated",
  "recipe.updated",
  "account.created",
  "account.updated",
  "account.deactivated",
  "account.password_reset",
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "access.denied",
  "report.saved",
  "report.printed",
];

// Nilai peran pelaku yang bisa dipilih. Nilainya sama dengan enum log_actor_role di
// database (src/lib/enum-log.ts).
const DAFTAR_PERAN = ["admin", "cashier", "barista", "customer", "system"];

// Nilai jenis objek yang bisa dipilih. Nilainya sama dengan enum entity_type di
// database (src/lib/enum-log.ts).
const DAFTAR_JENIS_OBJEK = [
  "order",
  "payment",
  "menu_item",
  "recipe",
  "ingredient",
  "account",
  "report",
  "auth",
];

/**
 * Menampilkan formulir filter aktivitas.
 *
 * Input: keadaan form dan aksi dari hook.
 * Output: elemen React.
 */
export function FilterAktivitas({
  form,
  ubahForm,
  terapkan,
  aturUlang,
}: PropsFilterAktivitas) {
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
      <div className="flex flex-wrap items-end gap-3">
        <KolomTanggal
          label={teks.labelDariTanggal}
          id="logaktivitas-dari"
          nilai={form.from}
          ubah={(nilai) => ubahForm("from", nilai)}
        />

        <KolomTanggal
          label={teks.labelSampaiTanggal}
          id="logaktivitas-sampai"
          nilai={form.to}
          ubah={(nilai) => ubahForm("to", nilai)}
        />

        <div>
          <label
            htmlFor="logaktivitas-aksi"
            className="block text-xs text-gray-600"
          >
            {teks.labelAksi}
          </label>
          <select
            id="logaktivitas-aksi"
            value={form.action}
            onChange={(event) => ubahForm("action", event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {/* Pilihan kosong pertama berarti "tidak memfilter". */}
            <option value="">{teks.pilihanSemua}</option>
            {DAFTAR_AKSI.map((satu) => (
              <option key={satu} value={satu}>
                {labelAksi(satu)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="logaktivitas-peran"
            className="block text-xs text-gray-600"
          >
            {teks.labelPeranPelaku}
          </label>
          <select
            id="logaktivitas-peran"
            value={form.actorRole}
            onChange={(event) => ubahForm("actorRole", event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{teks.pilihanSemua}</option>
            {DAFTAR_PERAN.map((satu) => (
              <option key={satu} value={satu}>
                {labelPeranPelaku(satu)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="logaktivitas-objek"
            className="block text-xs text-gray-600"
          >
            {teks.labelJenisObjek}
          </label>
          <select
            id="logaktivitas-objek"
            value={form.entityType}
            onChange={(event) => ubahForm("entityType", event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{teks.pilihanSemua}</option>
            {DAFTAR_JENIS_OBJEK.map((satu) => (
              <option key={satu} value={satu}>
                {labelJenisObjek(satu)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="logaktivitas-order"
            className="block text-xs text-gray-600"
          >
            {teks.labelIdOrder}
          </label>
          <input
            id="logaktivitas-order"
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
