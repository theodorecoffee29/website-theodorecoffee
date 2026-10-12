// File ini: komponen tampilan untuk panel "Sisa stok".
//
// Panel ini dipakai BERSAMA oleh layar Cashier dan layar Barista, jadi
// komponennya diletakkan di src/components/stok/ (bukan di components/cashier
// atau components/barista). Kalau komponennya digandakan, perbaikan tampilan di
// satu tempat tidak akan ikut ke tempat lain.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
// Data dan pollingnya ada di src/features/stok/use-sisa-stok.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.
//
// CATATAN KEAMANAN: panel ini TIDAK memuat harga, total, maupun pembayaran.
// Layar Barista tidak boleh melihat data itu (docs/pemissions.md bagian 2), dan
// panel ini dipakai Barista juga.
// Layar Barista tidak boleh melihat data itu (docs/pemissions.md bagian 2), dan
// panel ini dipakai Barista juga.

import { formatStokIndonesia } from "@/features/stok/format";
import { teksStok } from "@/features/stok/teks";
import type { BahanSisaStok, MenuSisaStok } from "@/features/stok/api";

// Props panel sisa stok. Semuanya berasal dari hook useSisaStok.
export type PropsPanelSisaStok = {
  menus: MenuSisaStok[];
  ingredients: BahanSisaStok[];
  // True saat panel belum pernah termuat.
  memuat: boolean;
  // True saat pemuatan terakhir gagal. Data yang sudah tampil tetap ditampilkan.
  gagalMuat: boolean;
};

/**
 * Menampilkan panel sisa stok: sisa porsi per menu dan daftar sisa bahan.
 *
 * Input: keadaan dari hook.
 * Output: elemen React.
 *
 * Cara membacanya:
 *   - Sisa porsi per menu ditampilkan sebagai daftar singkat. Menu yang bahannya
 *     habis ditulis "Habis", menu tanpa resep ditulis "Tanpa resep".
 *   - Sisa bahan disembunyikan di dalam elemen <details>. Alasannya: daftar bahan
 *     bisa panjang, sementara layar Cashier sudah penuh dengan kartu pesanan.
 *     Dengan <details>, Cashier bisa membukanya hanya saat memang membutuhkannya.
 */
export function PanelSisaStok({
  menus,
  ingredients,
  memuat,
  gagalMuat,
}: PropsPanelSisaStok) {
  return (
    <section
      className="rounded border border-gray-200 bg-white p-3"
      aria-label={teksStok.judul}
    >
      <h2 className="text-base font-semibold">{teksStok.judul}</h2>
      <p className="text-xs text-gray-600">{teksStok.keterangan}</p>

      {/* Pesan status memuat / gagal. Gagal tidak menghapus data yang sudah
          tampil: Cashier/Barista masih bisa membaca sisa stok terakhir. */}
      {memuat ? (
        <p className="mt-2 text-xs text-gray-600">{teksStok.memuat}</p>
      ) : null}
      {gagalMuat ? (
        <p role="status" className="mt-2 text-xs text-amber-700">
          {teksStok.gagalMuat}
        </p>
      ) : null}

      {/* Sisa porsi per menu. */}
      {menus.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {menus.map((satu) => (
            <li key={satu.menuItemId} className="flex justify-between text-sm">
              <span>{satu.name}</span>
              <span className="text-gray-700">
                {teksSisaPorsi(satu.portionsLeft)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Sisa bahan, disembunyikan di dalam <details>. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">
          {teksStok.labelBahan}
        </summary>
        {ingredients.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {ingredients.map((satu) => (
              <li key={satu.ingredientId} className="text-sm">
                {teksStok.barisBahan
                  .replace("{nama}", satu.name)
                  .replace("{jumlah}", formatStokIndonesia(satu.stockQty))
                  .replace("{satuan}", satu.unit)}
                {/* Stok minus ditulis sebagai teks, bukan hanya ditandai warna,
                    supaya tetap jelas kalau warnanya tidak bisa dibedakan. */}
                {satu.isNegative ? (
                  <span className="ml-2 font-medium text-red-700">
                    {teksStok.penandaMinus}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}

/**
 * Mengubah sisa porsi satu menu menjadi teks yang tampil.
 *
 * Input: sisa porsi (angka) atau null kalau menunya tanpa resep.
 * Output: teks.
 *
 * Tiga kasus dibedakan dengan sengaja:
 *   - null  : "Tanpa resep", karena tidak ada bahan yang bisa dihitung.
 *   - 0     : "Habis", lebih jelas daripada "sisa 0 porsi".
 *   - > 0   : "sisa N porsi".
 *
 * Fungsi kecil ini sengaja dipisah supaya aturan tampilnya mudah diuji tanpa
 * membuka browser.
 */
function teksSisaPorsi(portionsLeft: number | null): string {
  if (portionsLeft === null) {
    return teksStok.tanpaResep;
  }
  if (portionsLeft <= 0) {
    return teksStok.habis;
  }
  return teksStok.sisaPorsi.replace("{jumlah}", String(portionsLeft));
}
