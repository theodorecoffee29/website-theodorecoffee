// File ini: popup konfirmasi pembatalan pesanan.
//
// Popup ini memakai elemen dialog HTML dengan dua pilihan, Ya dan Tidak
// (docs/order-flow.md bagian 6 butir 7: "Tidak tidak mengubah apa pun, Ya membuat
// status Dibatalkan").
//
// Mulai tugas 5.6, popup ini juga meminta ALASAN pembatalan. Alasannya:
// Cashier dan Admin wajib memilih alasannya sendiri (acceptance criteria 22),
// dan alasan itu dibaca customer di halaman statusnya (bagian 7 ayat 5). Karena
// itu alasan dipakai radio TANPA nilai bawaan: kalau ada nilai bawaan, alasan
// yang tercatat sering kali bukan alasan sebenarnya.
//
// Komponen ini hanya menerima props, tidak memanggil API.

import type { AlasanBatal } from "@/lib/alasan-batal";
import { teksCashier } from "@/features/cashier/teks";
import type { PilihanAlasan } from "@/features/cashier/alasan-batal";

// Props popup pembatalan.
type PropsDialogBatal = {
  // True kalau pesanan sudah dikonfirmasi (status antrean). Isi popup
  // berbeda: pembatalan seperti ini membatalkan pembayaran dan mengembalikan
  // stok (docs/order-flow.md bagian 3).
  sudahDikonfirmasi: boolean;
  // True selama pembatalan sedang dikirim ke server. Tombol dinonaktifkan
  // supaya tidak terkirim dua kali.
  sedangMemproses: boolean;
  // Daftar pilihan alasan, sudah berurutan dan sudah berlabel.
  pilihanAlasan: PilihanAlasan[];
  // Alasan yang dipilih Cashier, atau null kalau belum memilih. null berarti
  // TIDAK ada nilai bawaan.
  alasanDipilih: AlasanBatal | null;
  // Isian catatan yang diketik Cashier.
  catatan: string;
  // true kalau alasan dan catatannya sudah boleh dikirim.
  bolehKirim: boolean;
  // Pesan kalau belum boleh dikirim (mis. catatan wajib untuk "Lainnya"), atau
  // null kalau sudah boleh.
  pesanAlasan: string | null;
  // Aksi yang dipanggil komponen ini.
  tutupDialog: () => void;
  pilihAlasan: (alasan: AlasanBatal) => void;
  ubahCatatan: (catatan: string) => void;
  konfirmasiBatal: () => void;
};

/**
 * Menampilkan popup konfirmasi pembatalan lengkap dengan pilihan alasan.
 *
 * Input: keadaan popup (dari hook).
 * Output: elemen dialog.
 */
export function DialogBatal({
  sudahDikonfirmasi,
  sedangMemproses,
  pilihanAlasan,
  alasanDipilih,
  catatan,
  bolehKirim,
  pesanAlasan,
  tutupDialog,
  pilihAlasan,
  ubahCatatan,
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

        {/* Pilihan alasan. Radio tanpa nilai bawaan: tidak ada yang tercentang
            sampai Cashier memilih sendiri. */}
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">
            {teksCashier.dialogBatal.labelAlasan}
          </legend>
          <div
            className="mt-1 space-y-1"
            role="radiogroup"
            aria-label={teksCashier.dialogBatal.labelPilihanAlasan}
          >
            {pilihanAlasan.map((satu) => (
              <label
                key={satu.nilai}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="alasan-pembatalan"
                  value={satu.nilai}
                  checked={alasanDipilih === satu.nilai}
                  onChange={() => pilihAlasan(satu.nilai)}
                  disabled={sedangMemproses}
                />
                {satu.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Isian catatan. Selalu ada (bisa diisi untuk alasan apa pun), tapi
            hanya WAJIB kalau alasannya "Lainnya". */}
        <div className="mt-3">
          <label
            className="block text-sm font-medium"
            htmlFor="catatan-pembatalan"
          >
            {teksCashier.dialogBatal.labelCatatan}
          </label>
          <input
            id="catatan-pembatalan"
            type="text"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={catatan}
            placeholder={teksCashier.dialogBatal.placeholderCatatan}
            maxLength={100}
            onChange={(event) => ubahCatatan(event.target.value)}
            disabled={sedangMemproses}
          />
        </div>

        {/* Pesan kalau alasan atau catatannya belum boleh dikirim. */}
        {pesanAlasan !== null ? (
          <p role="status" className="mt-1 text-xs text-amber-700">
            {pesanAlasan}
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

          {/* Ya: membatalkan pesanan. Nonaktif sampai alasan dipilih (dan catatan
              terisi kalau alasannya "Lainnya"). */}
          <button
            type="button"
            onClick={konfirmasiBatal}
            disabled={sedangMemproses || !bolehKirim}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {teksCashier.tombol.konfirmasiBatal}
          </button>
        </div>
      </div>
    </div>
  );
}
