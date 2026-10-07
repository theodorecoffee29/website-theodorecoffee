// File ini: komponen tampilan untuk halaman status pesanan.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API
// (sesuai aturan di AGENTS.md bagian "Tampilan"). Semua logika polling dan
// pembatalan ada di src/features/customer/use-status-order.ts.

import Link from "next/link";
import type { StatusOrderResponse } from "@/features/customer/api";
import { teksCustomer } from "@/features/customer/teks";

// Props untuk komponen halaman status.
type PropsStatusOrder = {
  order: StatusOrderResponse | null;
  // Nama customer, disimpan terpisah karena fungsi get_order_status tidak
  // mengirimkannya (dan tidak perlu: customer itu orangnya sendiri).
  customerName: string;
  teksStatus: string;
  bolehBatalkan: boolean;
  dialogBatalTerbuka: boolean;
  sedangMembatalkan: boolean;
  memuat: boolean;
  gagalMuat: boolean;
  tidakDitemukan: boolean;
  pesan: string | null;
  bukaDialogBatal: () => void;
  tutupDialogBatal: () => void;
  konfirmasiBatal: () => void;
};

/**
 * Menampilkan seluruh isi halaman status pesanan.
 *
 * Input: keadaan dari hook useStatusOrder.
 * Output: elemen React.
 */
export function StatusOrder(props: PropsStatusOrder) {
  // Order tidak ditemukan: tampilkan pesan ramah dan tautan ke beranda.
  if (props.tidakDitemukan) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">{teksCustomer.status.tidakDitemukan}</p>
        <Link href="/" className="underline">
          {teksCustomer.status.tautanPesanLagi}
        </Link>
      </section>
    );
  }

  // Masih memuat untuk pertama kali.
  if (props.memuat && props.order === null) {
    return <p className="text-sm text-gray-600">{teksCustomer.status.memuat}</p>;
  }

  // Statusnya sudah ada, tampilkan detailnya.
  const order = props.order;
  if (order === null) {
    return <p className="text-sm text-gray-600">{teksCustomer.status.memuat}</p>;
  }

  return (
    <section className="space-y-4">
      {/* Nomor antrean, ukuran lebih besar supaya mudah dibaca dari jauh. */}
      <div>
        <p className="text-sm text-gray-600">{teksCustomer.status.labelNomorAntrean}</p>
        <p className="text-3xl font-bold">{order.queueNumber}</p>
      </div>

      {/* Nama customer. */}
      <div>
        <p className="text-sm text-gray-600">{teksCustomer.status.labelNama}</p>
        <p className="text-sm">{props.customerName}</p>
      </div>

      {/* Status saat ini. */}
      <div>
        <p className="text-sm text-gray-600">{teksCustomer.status.labelStatus}</p>
        <p className="text-sm font-medium">{props.teksStatus}</p>
      </div>

      {/* Petunjuk bayar, hanya saat menunggu konfirmasi. */}
      {order.status === "menunggu_konfirmasi" ? (
        <p className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
          {teksCustomer.status.petunjukBayar}
        </p>
      ) : null}

      {/* Pesan kecil saat polling gagal; polling tetap dilanjutkan. */}
      {props.gagalMuat ? (
        <p role="status" className="text-sm text-amber-700">
          {teksCustomer.status.gagalMuat}
        </p>
      ) : null}

      {/* Pesan tambahan (mis. status sudah berubah saat pembatalan). */}
      {props.pesan ? (
        <p role="alert" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {props.pesan}
        </p>
      ) : null}

      {/* Daftar item yang dipesan. */}
      <div>
        <p className="text-sm text-gray-600">{teksCustomer.status.labelItem}</p>
        <ul className="mt-1 space-y-2">
          {order.items.map((satuItem, index) => (
            <li key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
              <span className="font-medium">
                {satuItem.qty} x {satuItem.name}
              </span>
              {/* Catatan hanya ditampilkan kalau ada. */}
              {satuItem.note ? (
                <p className="text-xs text-gray-600">
                  {teksCustomer.status.labelCatatan}: {satuItem.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Total. */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3">
        <span className="text-sm font-medium">{teksCustomer.status.labelTotal}</span>
        <span className="text-sm font-semibold">{formatRupiah(order.total)}</span>
      </div>

      {/* Tombol batalkan: hanya saat menunggu konfirmasi. Saat status sudah
          final, tampilkan tautan "Pesan lagi". */}
      {props.bolehBatalkan ? (
        <button
          type="button"
          onClick={props.bukaDialogBatal}
          disabled={props.sedangMembatalkan}
          className="w-full rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:bg-gray-100"
        >
          {teksCustomer.status.tombolBatalkan}
        </button>
      ) : order.status === "selesai" || order.status === "dibatalkan" ? (
        <Link href="/" className="block rounded bg-gray-900 px-3 py-2 text-center text-white">
          {teksCustomer.status.tautanPesanLagi}
        </Link>
      ) : null}

      {/* Popup konfirmasi batalkan (element dialog HTML biasa). */}
      {props.dialogBatalTerbuka ? (
        <DialogBatal
          tutupDialog={props.tutupDialogBatal}
          konfirmasiBatal={props.konfirmasiBatal}
        />
      ) : null}
    </section>
  );
}

/**
 * Popup konfirmasi pembatalan: elemen dialog HTML biasa dengan pilihan Ya dan
 * Tidak (docs/prd.md bagian 4: pembatalan selalu lewat popup Ya/Tidak).
 *
 * Input: aksi tutup dialog dan aksi konfirmasi batal.
 * Output: elemen dialog.
 */
function DialogBatal({
  tutupDialog,
  konfirmasiBatal,
}: {
  tutupDialog: () => void;
  konfirmasiBatal: () => void;
}) {
  return (
    <div
      // Dialog HTML biasa: penanda bahwa ini kotak dialog. Elemen dialog
      // dipakai agar popup ini terbaca oleh screen reader, bukan cuma
      // sekilas (dialog dipakai tanpa showModal supaya tidak butuh ref).
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-batal"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-xs rounded-lg bg-white p-4">
        <h2 id="judul-dialog-batal" className="text-base font-semibold">
          {teksCustomer.status.judulDialogBatal}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{teksCustomer.status.isiDialogBatal}</p>

        <div className="mt-4 flex gap-2">
          {/* Tidak: tutup tanpa membatalkan apa pun. */}
          <button
            type="button"
            onClick={tutupDialog}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksCustomer.status.tombolTidak}
          </button>
          {/* Ya: batalkan pesanan. */}
          <button
            type="button"
            onClick={konfirmasiBatal}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white"
          >
            {teksCustomer.status.tombolYa}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fungsi kecil untuk menulis rupiah, sama seperti di komponen beranda.
function formatRupiah(jumlah: number): string {
  return teksCustomer.formPesan.formatRupiah.replace("{jumlah}", jumlah.toLocaleString("id-ID"));
}