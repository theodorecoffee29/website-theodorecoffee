// File ini: dialog ringkasan order manual sebelum disimpan.
//
// Dialog ini dipakai Cashier untuk memeriksa ulang pesanan: nama, item, total,
// metode bayar, dan waktu manual kalau ada (docs/Order-flow.md bagian 4: "Sebelum
// Simpan, layar menampilkan ringkasan pesanan untuk dicek ulang").
//
// Komponen ini hanya menerima props, tidak memanggil API.

import { teksCashier } from "@/features/cashier/teks";
import type { KeadaanFormManual } from "@/features/cashier/use-form-manual";

// Props dialog ringkasan.
type PropsDialogRingkas = {
  keadaan: KeadaanFormManual;
};

/**
 * Menampilkan ringkasan pesanan yang akan disimpan.
 *
 * Input: keadaan dari hook (bagian ringkasan dipakai di sini).
 * Output: elemen dialog.
 *
 * Dua tombol:
 *   - Kembali: menutup dialog, form TIDAK dikosongkan (bisa diperbaiki),
 *   - Simpan: benar-benar mengirim pesanan ke server.
 */
export function DialogRingkas({ keadaan }: PropsDialogRingkas) {
  const teks = teksCashier.dialogRingkas;
  const ringkasan = keadaan.ringkasan;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-ringkas"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-lg bg-white p-4">
        <h2 id="judul-dialog-ringkas" className="text-base font-semibold">
          {teks.judul}
        </h2>

        {/* Nama customer. */}
        <div className="mt-2">
          <p className="text-xs text-gray-600">
            {teksCashier.formManual.labelNama}
          </p>
          <p className="text-sm font-medium">{ringkasan.customerName}</p>
        </div>

        {/* Daftar item: jumlah, nama, dan catatan kalau ada. */}
        <div className="mt-3">
          <p className="text-xs text-gray-600">{teks.labelItem}</p>
          <ul className="mt-1 space-y-1">
            {ringkasan.items.map((satuItem) => (
              <li key={satuItem.menuItemId} className="text-sm">
                {satuItem.catatan
                  ? // Pakai pola kalimat yang menyertakan catatan dalam kurung.
                    teks.formatItemDenganCatatan
                      .replace("{jumlah}", String(satuItem.jumlah))
                      .replace("{nama}", satuItem.nama)
                      .replace("{catatan}", satuItem.catatan)
                  : teks.formatItem
                      .replace("{jumlah}", String(satuItem.jumlah))
                      .replace("{nama}", satuItem.nama)}
              </li>
            ))}
          </ul>
        </div>

        {/* Total. Angka ini perkiraan; harga sebenarnya dihitung server. */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-medium">
            {teksCashier.formManual.labelTotal}
          </span>
          <span className="text-sm font-semibold">
            {teksCashier.order.formatRupiah.replace(
              "{jumlah}",
              ringkasan.total.toLocaleString("id-ID"),
            )}
          </span>
        </div>

        {/* Metode bayar. */}
        <div className="mt-2">
          <p className="text-xs text-gray-600">{teks.labelMetodeBayar}</p>
          <p className="text-sm">{ringkasan.metodeBayar}</p>
        </div>

        {/* Waktu manual: hanya tampil kalau Cashier mencantumkan waktu. */}
        {ringkasan.jamManual !== null ? (
          <div className="mt-2">
            <p className="text-xs text-gray-600">{teks.labelWaktu}</p>
            <p className="text-sm">{ringkasan.jamManual} WIB</p>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {/* Kembali: menutup dialog tanpa menyimpan apa pun. */}
          <button
            type="button"
            onClick={keadaan.tutupDialogRingkas}
            disabled={keadaan.sedangMengirim}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {teks.tombolKembali}
          </button>

          {/* Simpan: mengirim pesanan ke server. */}
          <button
            type="button"
            onClick={keadaan.simpanPesanan}
            disabled={keadaan.sedangMengirim}
            className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {keadaan.sedangMengirim
              ? teks.tombolSimpanSedang
              : teks.tombolSimpan}
          </button>
        </div>
      </div>
    </div>
  );
}
