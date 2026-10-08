// File ini: komponen tampilan untuk form order manual di halaman Cashier.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak melakukan perhitungan apa pun (semua dihitung di hook
// src/features/cashier/use-form-manual.ts). Sesuai aturan di AGENTS.md bagian
// "Tampilan".
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.

import { teksCashier } from "@/features/cashier/teks";
import type { ItemMenu, MetodeBayar } from "@/features/cashier/api";
import type { BarisForm } from "@/features/cashier/form-manual";
import type { KeadaanFormManual } from "@/features/cashier/use-form-manual";

// Props form order manual. Semuanya berasal dari hook useFormOrderManual.
export type PropsFormOrderManual = {
  keadaan: KeadaanFormManual;
};

// Daftar pilihan jam (0 sampai 23) dan menit (0 sampai 59), dipakai untuk
// dropdown. Dibuat sebagai konstanta supaya tidak dibuat ulang tiap render.
const PILIHAN_JAM = Array.from({ length: 24 }, (_, angka) =>
  String(angka).padStart(2, "0"),
);
const PILIHAN_MENIT = Array.from({ length: 60 }, (_, angka) =>
  String(angka).padStart(2, "0"),
);

/**
 * Menampilkan form order manual.
 *
 * Input: keadaan dari hook.
 * Output: elemen form.
 */
export function FormOrderManual({ keadaan }: PropsFormOrderManual) {
  const teks = teksCashier.formManual;

  return (
    <section className="space-y-3 rounded border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">{teks.judul}</h2>
        <p className="text-xs text-gray-600">{teks.keterangan}</p>
      </div>

      {/* Nama customer. */}
      <div>
        <label htmlFor="nama-customer" className="block text-sm text-gray-700">
          {teks.labelNama}
        </label>
        <input
          id="nama-customer"
          type="text"
          value={keadaan.customerName}
          onChange={(event) => keadaan.ubahNama(event.target.value)}
          placeholder={teks.placeholderNama}
          maxLength={50}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Daftar menu. Setiap menu punya isian jumlah dan catatan. */}
      <div>
        <p className="text-sm text-gray-700">{teks.labelMenu}</p>

        {keadaan.memuatMenu ? (
          <p className="mt-1 text-sm text-gray-600">{teks.memuatMenu}</p>
        ) : null}

        <ul className="mt-2 space-y-2">
          {keadaan.menu.map((satuMenu: ItemMenu) => (
            <BarisMenu
              key={satuMenu.id}
              menu={satuMenu}
              baris={keadaan.baris[satuMenu.id]}
              disabled={keadaan.sedangMengirim}
              ubahQty={keadaan.ubahQty}
              ubahCatatan={keadaan.ubahCatatan}
            />
          ))}
        </ul>
      </div>

      {/* Metode bayar. TIDAK ada nilai bawaan. */}
      <fieldset>
        <legend className="text-sm text-gray-700">
          {teks.labelMetodeBayar}
        </legend>
        <div
          className="mt-1 flex gap-3"
          role="radiogroup"
          aria-label={teks.labelMetodeBayar}
        >
          {(["qris", "tunai"] as const).map((satuMetode: MetodeBayar) => (
            <label key={satuMetode} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="metode-bayar-manual"
                value={satuMetode}
                checked={keadaan.paymentMethod === satuMetode}
                onChange={() => keadaan.pilihMetodeBayar(satuMetode)}
                disabled={keadaan.sedangMengirim}
              />
              {satuMetode === "qris"
                ? teksCashier.metodeBayar.qris
                : teksCashier.metodeBayar.tunai}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Waktu manual: hanya untuk input dari catatan kertas. */}
      <div className="rounded border border-dashed border-gray-300 p-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={keadaan.pakaiWaktuManual}
            onChange={(event) => keadaan.ubahWaktuManual(event.target.checked)}
            disabled={keadaan.sedangMengirim}
          />
          {teks.labelWaktuManual}
        </label>

        {/* Isian jam dan menit hanya muncul kalau dicentang. */}
        {keadaan.pakaiWaktuManual ? (
          <div className="mt-2">
            <p className="text-xs text-gray-600">
              {teks.keteranganWaktuManual}
            </p>
            <div className="mt-1 flex items-end gap-2">
              <div>
                <label
                  htmlFor="waktu-manual-jam"
                  className="block text-xs text-gray-600"
                >
                  {teks.labelJam}
                </label>
                <select
                  id="waktu-manual-jam"
                  value={keadaan.jam}
                  onChange={(event) => keadaan.ubahJam(event.target.value)}
                  disabled={keadaan.sedangMengirim}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">--</option>
                  {PILIHAN_JAM.map((satuJam) => (
                    <option key={satuJam} value={satuJam}>
                      {satuJam}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="waktu-manual-menit"
                  className="block text-xs text-gray-600"
                >
                  {teks.labelMenit}
                </label>
                <select
                  id="waktu-manual-menit"
                  value={keadaan.menit}
                  onChange={(event) => keadaan.ubahMenit(event.target.value)}
                  disabled={keadaan.sedangMengirim}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">--</option>
                  {PILIHAN_MENIT.map((satuMenit) => (
                    <option key={satuMenit} value={satuMenit}>
                      {satuMenit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pesan kalau waktu manual melanggar aturan (mis. masa depan). */}
            {keadaan.pesanWaktuManual !== null ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {keadaan.pesanWaktuManual}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Total: hanya untuk informasi, harga sebenarnya dihitung server. */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3">
        <div>
          <p className="text-sm font-medium">{teks.labelTotal}</p>
          <p className="text-xs text-gray-600">{teks.keteranganTotal}</p>
        </div>
        <span className="text-sm font-semibold">
          {teksCashier.order.formatRupiah.replace(
            "{jumlah}",
            keadaan.total.toLocaleString("id-ID"),
          )}
        </span>
      </div>

      {/* Pesan sukses atau error. */}
      {keadaan.pesan !== null ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
        >
          {keadaan.pesan}
        </p>
      ) : null}

      {/* Peringatan stok: BUKAN error (api-contract bagian 4). */}
      {keadaan.peringatanStok.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-sm font-medium">
            {teksCashier.peringatanStok.judul}
          </p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {keadaan.peringatanStok.map((satu, index) => (
              <li key={index}>
                {teksCashier.peringatanStok.baris
                  .replace("{bahan}", satu.ingredientName)
                  .replace("{sisa}", String(satu.stockAfter))}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={keadaan.tutupPeringatanStok}
            className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
          >
            {teksCashier.tombol.batalBatal}
          </button>
        </div>
      ) : null}

      {/* Tombol utama. Nonaktif kalau ada isian yang belum benar. */}
      <button
        type="button"
        onClick={keadaan.bukaDialogRingkas}
        disabled={!keadaan.tombolSimpanAktif || keadaan.sedangMengirim}
        className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
      >
        {teks.tombolPeriksa}
      </button>
    </section>
  );
}

/**
 * Menampilkan satu baris menu: nama, harga, isian jumlah, dan isian catatan.
 *
 * Input: data menu, baris isiannya, status nonaktif, dan aksi ubah isian.
 * Output: elemen list item.
 *
 * Menu yang "Habis" tampil berlabel "Habis", jumlah dan catatannya dinonaktifkan,
 * karena bahannya tidak cukup untuk satu porsi (docs/data-model.md).
 */
function BarisMenu({
  menu,
  baris,
  disabled,
  ubahQty,
  ubahCatatan,
}: {
  menu: ItemMenu;
  baris: BarisForm | undefined;
  disabled: boolean;
  ubahQty: (menuItemId: string, qty: string) => void;
  ubahCatatan: (menuItemId: string, note: string) => void;
}) {
  const teks = teksCashier.formManual;
  // Baris mungkin belum ada kalau menu baru saja dimuat.
  const isian = baris ?? { menuItemId: menu.id, qty: "", note: "" };

  // Menu yang bahannya tidak cukup tidak bisa dipilih.
  const tidakBisaDipilih = !menu.available || disabled;

  return (
    <li className="rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{menu.name}</span>
        <span className="text-sm text-gray-600">
          {teksCashier.order.formatRupiah.replace(
            "{jumlah}",
            menu.price.toLocaleString("id-ID"),
          )}
        </span>
      </div>

      {/* Label "Habis" kalau bahannya tidak cukup. */}
      {!menu.available ? (
        <p className="mt-1 text-xs font-semibold text-red-700">
          {teks.labelHabis}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {/* Isian jumlah. */}
        <div>
          <label
            htmlFor={"qty-" + menu.id}
            className="block text-xs text-gray-600"
          >
            {teks.labelJumlah}
          </label>
          <input
            id={"qty-" + menu.id}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={isian.qty}
            onChange={(event) => ubahQty(menu.id, event.target.value)}
            disabled={tidakBisaDipilih}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          />
        </div>

        {/* Isian catatan. */}
        <div className="min-w-40 flex-1">
          <label
            htmlFor={"catatan-" + menu.id}
            className="block text-xs text-gray-600"
          >
            {teks.labelCatatan}
          </label>
          <input
            id={"catatan-" + menu.id}
            type="text"
            value={isian.note}
            onChange={(event) => ubahCatatan(menu.id, event.target.value)}
            placeholder={teks.placeholderCatatan}
            maxLength={100}
            disabled={tidakBisaDipilih}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          />
        </div>
      </div>
    </li>
  );
}
