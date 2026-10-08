// File ini: komponen tampilan untuk layar Barista.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
// Semua logika ada di src/features/barista/use-antrean-barista.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.
//
// Keamanan tampilan: layar Barista TIDAK memuat harga, total, atau pembayaran
// (docs/pemissions.md bagian 2). Karena itu komponen ini tidak punya apa pun
// untuk menampilkan harga, dan Props di bawah tidak punya field harga pun.

import { teksBarista } from "@/features/barista/teks";
import type { PesananUntukTampil } from "@/features/barista/siapkan-tampil";

// Props untuk satu kartu pesanan.
type PropsKartuPesanan = {
  pesanan: PesananUntukTampil;
  // True kalau pesanan ini yang sedang diproses (Mulai atau Selesai).
  sedangAksi: boolean;
  // Aksi yang dipanggil kalau tombol diklik.
  mulai: () => void;
  selesaikan: () => void;
};

/**
 * Menampilkan satu kartu pesanan di antrean Barista.
 *
 * Input: keadaan satu pesanan (dari hook).
 * Output: elemen React.
 *
 * Tombol yang muncul ditentukan oleh status:
 *   - "antrean"    -> tombol Mulai,
 *   - "dikerjakan" -> tombol Selesai.
 * Sesuai docs/order-flow.md bagian 3: Selesai hanya bisa ditekan setelah Mulai.
 */
export function KartuPesanan({
  pesanan,
  sedangAksi,
  mulai,
  selesaikan,
}: PropsKartuPesanan) {
  // Status "antrean" tampil sebagai "Baru masuk" dengan tombol Mulai.
  const baruMasuk = pesanan.status === "antrean";

  return (
    <li className="rounded border border-gray-200 bg-white p-4">
      {/* Baris atas: nomor antrean besar (yang utama untuk Barista) dan nama. */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold">{pesanan.queueNumber}</span>
        <span className="font-medium">{pesanan.customerName}</span>

        {/* Penanda untuk pesanan yang belum dimulai. */}
        {baruMasuk ? (
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-900">
            {teksBarista.kelompok.penandaBaru}
          </span>
        ) : null}
      </div>

      {/* Status. */}
      <p className="mt-2 text-sm text-gray-700">
        {teksBarista.order.labelStatus}: {pesanan.teksStatus}
      </p>

      {/* Daftar item. Catatan ditampilkan menonjol karena sering dipakai Barista
          (mis. "less sugar", "no ice") dan mudah terlewat kalau kecil. */}
      <div className="mt-3">
        <p className="text-sm text-gray-600">{teksBarista.order.labelItem}</p>
        <ul className="mt-1 space-y-2">
          {pesanan.items.map((satuItem, index) => (
            <li key={index} className="text-sm">
              <span className="font-medium">
                {teksBarista.order.formatItem
                  .replace("{jumlah}", String(satuItem.qty))
                  .replace("{nama}", satuItem.name)}
              </span>

              {/* Catatan hanya tampil kalau ada, dan dibuat menonjol. */}
              {satuItem.note ? (
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-800">
                  {satuItem.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Satu tombol saja, sesuai status. */}
      <div className="mt-3">
        {baruMasuk ? (
          <button
            type="button"
            onClick={mulai}
            // Nonaktif selama aksi sedang berjalan, supaya tidak terkirim dua kali.
            disabled={sedangAksi}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {sedangAksi
              ? teksBarista.tombol.mulaiSedang
              : teksBarista.tombol.mulai}
          </button>
        ) : (
          <button
            type="button"
            onClick={selesaikan}
            disabled={sedangAksi}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {sedangAksi
              ? teksBarista.tombol.selesaiSedang
              : teksBarista.tombol.selesai}
          </button>
        )}
      </div>
    </li>
  );
}
