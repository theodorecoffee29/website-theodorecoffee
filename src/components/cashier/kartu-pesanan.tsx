// File ini: komponen tampilan untuk layar Cashier.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API
// (sesuai aturan di AGENTS.md bagian "Tampilan"). Semua logika polling,
// konfirmasi, dan pembatalan ada di src/features/cashier/use-daftar-pesanan.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.

import type { MetodeBayar } from "@/features/cashier/api";
import type { PesananTampil } from "@/features/cashier/use-daftar-pesanan";
import { teksCashier } from "@/features/cashier/teks";

// Props untuk satu kartu pesanan.
type PropsKartuPesanan = {
  pesanan: PesananTampil;
  // True kalau pesanan ini yang sedang diproses (konfirmasi atau batal).
  sedangAksi: boolean;
  // Metode bayar yang dipilih, atau null kalau belum memilih. Hanya dipakai
  // untuk menandai tombol metode yang aktif.
  metodeDipilih: MetodeBayar | null;
  // Tombol metode bayar yang perlu ditampilkan. Hanya untuk pesanan yang
  // menunggu konfirmasi.
  tampilkanPilihanBayar: boolean;
  // Tombol Konfirmasi harus nonaktif sampai metode bayar dipilih.
  konfirmasiNonaktif: boolean;
  // Aksi yang dipanggil kalau tombol diklik.
  pilihMetodeBayar: (metode: MetodeBayar) => void;
  konfirmasi: () => void;
  bukaDialogBatal: () => void;
};

/**
 * Menampilkan satu kartu pesanan lengkap dengan tombol aksinya.
 *
 * Input: keadaan satu pesanan (dari hook).
 * Output: elemen React.
 *
 * Tombol yang muncul tergantung status:
 *   - menunggu_konfirmasi: pilihan metode bayar + Konfirmasi + Batalkan,
 *   - antrean: hanya Batalkan (dengan keterangan),
 *   - dikerjakan, selesai, dibatalkan: tanpa tombol (docs/order-flow.md bagian 3).
 */
export function KartuPesanan({
  pesanan,
  sedangAksi,
  metodeDipilih,
  tampilkanPilihanBayar,
  konfirmasiNonaktif,
  pilihMetodeBayar,
  konfirmasi,
  bukaDialogBatal,
}: PropsKartuPesanan) {
  const status = pesanan.status;
  const menunggu = status === "menunggu_konfirmasi";
  const diAntrean = status === "antrean";

  return (
    <li className="rounded border border-gray-200 bg-white p-4">
      {/* Baris atas: nomor antrean (besar, mudah dibaca dari jauh), nama, dan
          label asal. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{pesanan.nomorAntrean}</span>
          <span className="font-medium">{pesanan.nama}</span>
          <span className="rounded border border-gray-300 px-2 py-0.5 text-xs">
            {pesanan.labelAsal}
          </span>
        </div>
        <span className="text-xs text-gray-600">
          {teksCashier.order.labelJamDibuat}:{" "}
          {teksCashier.order.formatJamWib.replace("{jam}", pesanan.jamDibuat)}
        </span>
      </div>

      {/* Penanda jelas untuk pesanan yang perlu konfirmasi. */}
      {menunggu ? (
        <p className="mt-2 inline-block rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-900">
          {teksCashier.kelompok.penandaMenunggu}
        </p>
      ) : null}

      {/* Label untuk order yang diinput dari catatan kertas (waktu manual).
          Cashier perlu tahu ini supaya tidak bingung kenapa jamnya berbeda dari
          jam dia mengetik. Jam yang ditampilkan adalah jam KEJADIAN order
          (docs/Order-flow.md bagian 5). */}
      {pesanan.waktuManual ? (
        <p className="mt-1 text-xs text-gray-600">
          {teksCashier.orderWaktuManual}: {pesanan.jamKejadian} WIB
        </p>
      ) : null}

      {/* Status dan metode bayar (kalau sudah ada). */}
      <p className="mt-2 text-sm text-gray-700">
        {teksCashier.order.labelStatus}: {pesanan.teksStatus}
        {pesanan.metodeBayarTampil
          ? " (" + pesanan.metodeBayarTampil + ")"
          : ""}
      </p>

      {/* Daftar item: nama, jumlah, catatan, dan subtotal. Harga tampil karena
          Cashier boleh melihat harga (docs/pemissions.md bagian 2). */}
      <div className="mt-3">
        <p className="text-sm text-gray-600">{teksCashier.order.labelItem}</p>
        <ul className="mt-1 space-y-1">
          {pesanan.items.map((satuItem, index) => (
            <li key={index} className="text-sm">
              <span>
                {teksCashier.order.formatItem
                  .replace("{jumlah}", String(satuItem.jumlah))
                  .replace("{nama}", satuItem.nama)}
              </span>
              {satuItem.catatan ? (
                <span className="text-xs text-gray-600">
                  {" "}
                  — {teksCashier.order.labelCatatan}: {satuItem.catatan}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Total. */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2">
        <span className="text-sm font-medium">
          {teksCashier.order.labelTotal}
        </span>
        <span className="text-sm font-semibold">
          {teksCashier.order.formatRupiah.replace(
            "{jumlah}",
            pesanan.total.toLocaleString("id-ID"),
          )}
        </span>
      </div>

      {/* Pilihan metode bayar: hanya untuk pesanan yang menunggu konfirmasi.
          TIDAK ada nilai bawaan (order-flow.md bagian 6, criteria 3). */}
      {tampilkanPilihanBayar ? (
        <fieldset className="mt-3">
          <legend className="text-sm text-gray-600">
            {teksCashier.metodeBayar.label}
          </legend>
          <div
            className="mt-1 flex gap-3"
            role="radiogroup"
            aria-label={teksCashier.metodeBayar.labelPilihan}
          >
            {(["qris", "tunai"] as const).map((satuMetode) => (
              <label
                key={satuMetode}
                className="flex items-center gap-1 text-sm"
              >
                <input
                  type="radio"
                  name={`metode-bayar-${pesanan.orderId}`}
                  value={satuMetode}
                  checked={metodeDipilih === satuMetode}
                  onChange={() => pilihMetodeBayar(satuMetode)}
                  disabled={sedangAksi}
                />
                {satuMetode === "qris"
                  ? teksCashier.metodeBayar.qris
                  : teksCashier.metodeBayar.tunai}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Tombol aksi. */}
      <div className="mt-3 flex gap-2">
        {menunggu ? (
          <button
            type="button"
            onClick={konfirmasi}
            // Nonaktif sampai metode bayar dipilih, dan selama aksi berjalan.
            disabled={konfirmasiNonaktif || sedangAksi}
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {sedangAksi
              ? teksCashier.tombol.konfirmasiSedang
              : teksCashier.tombol.konfirmasi}
          </button>
        ) : null}

        {/* Batalkan hanya saat masih bisa: menunggu konfirmasi atau antrean.
            Setelah Barista menekan Mulai, order tidak bisa dibatalkan. */}
        {menunggu || diAntrean ? (
          <button
            type="button"
            onClick={bukaDialogBatal}
            disabled={sedangAksi}
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:bg-gray-100"
          >
            {sedangAksi
              ? teksCashier.tombol.batalkanSedang
              : teksCashier.tombol.batalkan}
          </button>
        ) : null}
      </div>

      {/* Keterangan tambahan untuk pesanan di antrean: masih bisa dibatalkan. */}
      {diAntrean ? (
        <p className="mt-1 text-xs text-gray-600">
          {teksCashier.dialogBatal.keteranganSudahDikerjakan}
        </p>
      ) : null}
    </li>
  );
}
