// File ini: popup konfirmasi pembatalan pesanan.
//
// Popup ini memakai elemen dialog HTML dengan dua pilihan, Ya dan Tidak
// (docs/order-flow.md bagian 6 butir 7: "Tidak tidak mengubah apa pun, Ya membuat
// status Dibatalkan").
//
// Komponen ini hanya menerima props, tidak memanggil API.

import { teksCashier } from "@/features/cashier/teks";

// Props popup pembatalan.
type PropsDialogBatal = {
  // True kalau pesanan sudah dikonfirmasi (status antrean). Isi popup
  // berbeda: pembatalan seperti ini membatalkan pembayaran dan mengembalikan
  // stok (docs/order-flow.md bagian 3).
  sudahDikonfirmasi: boolean;
  // True selama pembatalan sedang dikirim ke server. Tombol dinonaktifkan
  // supaya tidak terkirim dua kali.
  sedangMemproses: boolean;
  tutupDialog: () => void;
  konfirmasiBatal: () => void;
};

/**
 * Menampilkan popup konfirmasi pembatalan.
 *
 * Input: keadaan popup (dari hook).
 * Output: elemen dialog.
 */
export function DialogBatal({
  sudahDikonfirmasi,
  sedangMemproses,
  tutupDialog,
  konfirmasiBatal,
}: PropsDialogBatal) {
  return (
    <div
      // Dialog HTML biasa dengan penanda role, supaya popup ini terbaca oleh
      // pembaca layar, bukan hanya sekilas.
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-batal"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-dialog-batal" className="text-base font-semibold">
          {teksCashier.dialogBatal.judul}
        </h2>

        {/* Isi popup menyesuaikan status pesanan. Kalau sudah dikonfirmasi,
            Cashier diberi tahu soal pembayaran dan stok yang akan dikembalikan. */}
        <p className="mt-2 text-sm text-gray-700">
          {sudahDikonfirmasi
            ? teksCashier.dialogBatal.isiSudahDikonfirmasi
            : teksCashier.dialogBatal.isiBelumDikonfirmasi}
        </p>

        {sudahDikonfirmasi ? (
          <p className="mt-1 text-xs text-gray-600">
            {teksCashier.dialogBatal.keteranganSudahDikerjakan}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          {/* Tidak: menutup popup tanpa membatalkan apa pun. */}
          <button
            type="button"
            onClick={tutupDialog}
            disabled={sedangMemproses}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {teksCashier.tombol.batalBatal}
          </button>

          {/* Ya: membatalkan pesanan. */}
          <button
            type="button"
            onClick={konfirmasiBatal}
            disabled={sedangMemproses}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {teksCashier.tombol.konfirmasiBatal}
          </button>
        </div>
      </div>
    </div>
  );
}
