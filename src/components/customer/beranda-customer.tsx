// File ini: komponen tampilan untuk halaman awal customer.
//
// Komponen ini HANYA menerima props dan menampilkannya. Komponen tidak memanggil
// API dan tidak punya logika bisnis (sesuai aturan di AGENTS.md bagian
// "Tampilan"). Semua logika ada di src/features/customer/.

import Link from "next/link";
import type { MenuItem } from "@/features/customer/api";
import type { BarisPesanan } from "@/features/customer/validasi-form";
import type { OrderAktif } from "@/features/customer/use-order-aktif";
import { teksCustomer } from "@/features/customer/teks";

// ---------------------------------------------------------------------------
// Daftar order aktif (dipakai kalau ada lebih dari satu order aktif)
// ---------------------------------------------------------------------------

/**
 * Menampilkan daftar order aktif milik HP ini, plus tautan untuk membuat
 * pesanan baru.
 *
 * Input: daftar order aktif.
 * Output: elemen React.
 */
export function DaftarOrderAktif({ orderAktif }: { orderAktif: OrderAktif[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {teksCustomer.beranda.judulOrderAktif}
      </h2>

      {/* Daftar bukan tabel supaya mudah dipakai di layar HP. */}
      <ul className="mt-3 space-y-2">
        {orderAktif.map((satuOrder) => (
          <li key={satuOrder.orderId}>
            {/* Link ke halaman status order tersebut. */}
            <Link
              href={"/status/" + satuOrder.orderId}
              className="block rounded border border-gray-300 px-3 py-2"
            >
              {teksCustomer.beranda.kalimatOrderAktif.replace(
                "{nomor}",
                String(satuOrder.queueNumber),
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4">
        <Link href="/" className="underline">
          {teksCustomer.beranda.tombolPesanBaru}
        </Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form pesan
// ---------------------------------------------------------------------------

// Props untuk komponen form pesan. Semua berasal dari hook useFormPesan.
type PropsFormPesan = {
  menu: MenuItem[];
  barisPesanan: BarisPesanan[];
  customerName: string;
  total: number;
  tombolKirimAktif: boolean;
  sedangMengirim: boolean;
  memuatMenu: boolean;
  pesanError: string | null;
  pesanNama: string | null;
  pesanItem: string | null;
  ubahNama: (nilai: string) => void;
  ubahQty: (menuItemId: string, nilai: string) => void;
  ubahCatatan: (menuItemId: string, nilai: string) => void;
  kirimPesananSekarang: () => void;
};

/**
 * Menampilkan form pesan lengkap dengan daftar menu.
 *
 * Input: keadaan form dari hook useFormPesan.
 * Output: elemen React berupa form HTML.
 */
export function FormPesan(props: PropsFormPesan) {
  return (
    <form
      onSubmit={(peristiwa) => {
        // Cegah reload halaman; pengiriman ditangani hook.
        peristiwa.preventDefault();
        props.kirimPesananSekarang();
      }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold">{teksCustomer.formPesan.judul}</h2>

      {/* Pesan error umum (mis. gagal kirim, atau gagal memuat menu). */}
      {props.pesanError ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {props.pesanError}
        </p>
      ) : null}

      {props.memuatMenu ? (
        <p className="text-sm">{teksCustomer.status.memuat}</p>
      ) : null}

      {/* Isian nama customer. */}
      <div>
        <label htmlFor="customerName" className="block text-sm font-medium">
          {teksCustomer.formPesan.labelNama}
        </label>
        <input
          id="customerName"
          name="customerName"
          type="text"
          maxLength={50}
          value={props.customerName}
          placeholder={teksCustomer.formPesan.placeholderNama}
          onChange={(peristiwa) => props.ubahNama(peristiwa.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
        {props.pesanNama ? (
          <p className="mt-1 text-sm text-red-600">{props.pesanNama}</p>
        ) : null}
      </div>

      {/* Daftar menu: satu menu satu baris. */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          {teksCustomer.formPesan.labelMenu}
        </legend>

        {props.menu.map((satuMenu, index) => {
          // Cari baris pesanan menu ini supaya isiannya terhubung.
          const baris = props.barisPesanan.find(
            (satuBaris) => satuBaris.menuItemId === satuMenu.id,
          );

          // Menu yang habis tidak bisa dipilih, jadi isiannya dimatikan.
          const bisaDipilih = satuMenu.available;

          return (
            <div
              key={satuMenu.id}
              className="rounded border border-gray-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{satuMenu.name}</span>
                <span className="text-sm">{formatRupiah(satuMenu.price)}</span>
              </div>

              {/* Menu habis: tampilkan label "Habis" dan jangan izinkan diisi. */}
              {!bisaDipilih ? (
                <p className="mt-1 text-sm text-gray-500">
                  {teksCustomer.formPesan.labelHabis}
                </p>
              ) : null}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={"qty-" + index}
                    className="block text-xs text-gray-600"
                  >
                    {teksCustomer.formPesan.labelJumlah} (0-
                    {teksCustomer.formPesan.maksQty})
                  </label>
                  <input
                    id={"qty-" + index}
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    disabled={!bisaDipilih}
                    value={baris?.qty ?? ""}
                    onChange={(peristiwa) =>
                      props.ubahQty(satuMenu.id, peristiwa.target.value)
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor={"note-" + index}
                    className="block text-xs text-gray-600"
                  >
                    {teksCustomer.formPesan.labelCatatan}
                  </label>
                  <input
                    id={"note-" + index}
                    type="text"
                    maxLength={100}
                    disabled={!bisaDipilih}
                    placeholder={teksCustomer.formPesan.placeholderCatatan}
                    value={baris?.note ?? ""}
                    onChange={(peristiwa) =>
                      props.ubahCatatan(satuMenu.id, peristiwa.target.value)
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </fieldset>

      {/* Pesan untuk jumlah atau catatan yang salah. */}
      {props.pesanItem ? (
        <p className="text-sm text-red-600">{props.pesanItem}</p>
      ) : null}

      {/* Total. Hanya perkiraan; harga sebenarnya dihitung server. */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3">
        <span className="text-sm font-medium">
          {teksCustomer.formPesan.labelTotal}
        </span>
        <span className="text-sm font-semibold">
          {formatRupiah(props.total)}
        </span>
      </div>

      {/* Pesan sedang mengirim. */}
      {props.sedangMengirim ? (
        <p className="text-sm text-gray-600">
          {teksCustomer.formPesan.pesanMengirim}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!props.tombolKirimAktif}
        className="w-full rounded bg-gray-900 px-3 py-2 text-white disabled:bg-gray-400"
      >
        {props.sedangMengirim
          ? teksCustomer.formPesan.tombolKirimSedang
          : teksCustomer.formPesan.tombolKirim}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Pesan memuat
// ---------------------------------------------------------------------------

/**
 * Menampilkan pesan sedang memeriksa pesanan.
 * Output: elemen React.
 */
export function PesanMemuat() {
  return (
    <p className="text-sm text-gray-600">{teksCustomer.beranda.cekSesi}</p>
  );
}

/**
 * Menampilkan kerangka halaman dengan judul dan Children di dalamnya.
 *
 * Input: judul halaman dan isi (children).
 * Output: elemen React.
 */
export function KerangkaCustomer({
  judul,
  children,
}: {
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{judul}</h1>
      {children}
    </main>
  );
}

// Fungsi kecil untuk menulis rupiah, dipakai di beberapa komponen ini.
function formatRupiah(jumlah: number): string {
  return teksCustomer.formPesan.formatRupiah.replace(
    "{jumlah}",
    jumlah.toLocaleString("id-ID"),
  );
}
