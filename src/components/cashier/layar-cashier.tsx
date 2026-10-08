// File ini: komponen tampilan utama layar Cashier (/cashier).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
// Semua logika ada di src/features/cashier/use-daftar-pesanan.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.

import { KartuPesanan } from "./kartu-pesanan";
import { DialogBatal } from "./dialog-batal";
import { FormOrderManual } from "./form-order-manual";
import { DialogRingkas } from "./dialog-ringkas";
import { teksCashier } from "@/features/cashier/teks";
import type {
  KeadaanCashier,
  PesananTampil,
} from "@/features/cashier/use-daftar-pesanan";
import type { KeadaanFormManual } from "@/features/cashier/use-form-manual";

// Props layar Cashier. Semuanya berasal dari hook useDaftarPesanan dan
// useFormOrderManual.
export type PropsLayarCashier = {
  keadaan: KeadaanCashier;
  // Keadaan form order manual (bagian atas halaman).
  formManual: KeadaanFormManual;
  // Nama akun Cashier yang sedang login (untuk ditampilkan di header).
  namaAkun: string;
  // Aksi keluar. Dipanggil dari form di komponen ini.
  keluar: () => void;
};

/**
 * Menampilkan seluruh isi layar Cashier.
 *
 * Input: keadaan dari hook, keadaan form manual, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarCashier({
  keadaan,
  formManual,
  namaAkun,
  keluar,
}: PropsLayarCashier) {
  // Pesanan yang jadi popup pembatalannya sedang terbuka, kalau ada.
  const pesananSedangDibatalkan =
    keadaan.dialogBatalUntuk !== null
      ? cariPesanan(
          keadaan.dialogBatalUntuk,
          keadaan.menunggu,
          keadaan.dikerjakan,
        )
      : null;

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header: judul, nama akun, tombol keluar. */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksCashier.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              {teksCashier.subjudulHalaman} Masuk sebagai {namaAkun}.
            </p>
          </div>
          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksCashier.tombol.keluar}
          </button>
        </header>

        {/* Spanduk pesanan baru. Tanpa suara, hanya teks (docs/prd.md bagian 5:
            notifikasi suara di luar V1). */}
        {keadaan.spandukBaru !== null ? (
          <div
            role="status"
            className="flex items-center justify-between rounded border border-blue-300 bg-blue-50 px-3 py-2"
          >
            <span className="text-sm font-medium">{keadaan.spandukBaru}</span>
            <button
              type="button"
              onClick={keadaan.tutupSpanduk}
              className="rounded border border-blue-300 px-2 py-1 text-xs"
            >
              {teksCashier.tombol.batalBatal}
            </button>
          </div>
        ) : null}

        {/* Peringatan stok setelah konfirmasi. BUKAN error: konfirmasi tetap
            berhasil, Cashier hanya diberi tahu (api-contract.md bagian 4). */}
        {keadaan.peringatanStok.length > 0 ? (
          <div
            role="status"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2"
          >
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

        {/* Pesan status memuat / gagal / aksi. */}
        {keadaan.memuat ? (
          <p className="text-sm text-gray-600">{teksCashier.pesan.memuat}</p>
        ) : null}
        {keadaan.gagalMuat ? (
          <p role="status" className="text-sm text-amber-700">
            {teksCashier.pesan.gagalMuat}
          </p>
        ) : null}
        {keadaan.pesan !== null ? (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
          >
            {keadaan.pesan}
          </p>
        ) : null}

        {/* Form order manual. Di atas daftar pesanan, karena dipakai untuk
            pesanan yang sedang dilayani (docs/Order-flow.md bagian 4). */}
        <FormOrderManual keadaan={formManual} />

        {/* Daftar pesanan hari ini (tiga kelompok). */}
        <BagianKelompok
          judul={teksCashier.kelompok.menunggu}
          keterangan={teksCashier.kelompok.keteranganMenunggu}
          jumlah={keadaan.menunggu.length}
          tekankan={true}
        >
          {keadaan.menunggu.map((satu) => (
            <KartuPesanan
              key={satu.orderId}
              pesanan={satu}
              sedangAksi={keadaan.sedangAksi === satu.orderId}
              metodeDipilih={keadaan.metodeDipilih[satu.orderId] ?? null}
              tampilkanPilihanBayar={true}
              // Konfirmasi hanya aktif kalau metode bayar untuk pesanan ini saja
              // sudah dipilih.
              konfirmasiNonaktif={
                (keadaan.metodeDipilih[satu.orderId] ?? null) === null
              }
              pilihMetodeBayar={(metode) =>
                keadaan.pilihMetodeBayar(satu.orderId, metode)
              }
              konfirmasi={() => keadaan.konfirmasi(satu.orderId)}
              bukaDialogBatal={() => keadaan.bukaDialogBatal(satu.orderId)}
            />
          ))}
        </BagianKelompok>

        {/* Kelompok (b): Di antrean dan dikerjakan. */}
        <BagianKelompok
          judul={teksCashier.kelompok.dikerjakan}
          keterangan={teksCashier.kelompok.keteranganDikerjakan}
          jumlah={keadaan.dikerjakan.length}
          tekankan={false}
        >
          {keadaan.dikerjakan.map((satu) => (
            <KartuPesanan
              key={satu.orderId}
              pesanan={satu}
              sedangAksi={keadaan.sedangAksi === satu.orderId}
              metodeDipilih={keadaan.metodeDipilih[satu.orderId] ?? null}
              // Tidak ada pilihan metode bayar di sini: sudah dikonfirmasi.
              tampilkanPilihanBayar={false}
              konfirmasiNonaktif={true}
              pilihMetodeBayar={(metode) =>
                keadaan.pilihMetodeBayar(satu.orderId, metode)
              }
              konfirmasi={() => keadaan.konfirmasi(satu.orderId)}
              bukaDialogBatal={() => keadaan.bukaDialogBatal(satu.orderId)}
            />
          ))}
        </BagianKelompok>

        {/* Kelompok (c): Selesai dan dibatalkan. */}
        <BagianKelompok
          judul={teksCashier.kelompok.selesai}
          keterangan={teksCashier.kelompok.keteranganSelesai}
          jumlah={keadaan.selesai.length}
          tekankan={false}
        >
          {keadaan.selesai.map((satu) => (
            <KartuPesanan
              key={satu.orderId}
              pesanan={satu}
              sedangAksi={keadaan.sedangAksi === satu.orderId}
              metodeDipilih={keadaan.metodeDipilih[satu.orderId] ?? null}
              // Status akhir: tanpa pilihan bayar dan tanpa tombol (KartuPesanan
              // sendiri yang menyembunyikan tombolnya).
              tampilkanPilihanBayar={false}
              konfirmasiNonaktif={true}
              pilihMetodeBayar={(metode) =>
                keadaan.pilihMetodeBayar(satu.orderId, metode)
              }
              konfirmasi={() => keadaan.konfirmasi(satu.orderId)}
              bukaDialogBatal={() => keadaan.bukaDialogBatal(satu.orderId)}
            />
          ))}
        </BagianKelompok>
      </div>

      {/* Dialog ringkasan order manual, hanya tampil kalau tombol
          "Periksa dan simpan" ditekan. */}
      {formManual.dialogRingkasTerbuka ? (
        <DialogRingkas keadaan={formManual} />
      ) : null}

      {/* Popup konfirmasi pembatalan, hanya tampil kalau ada pesanan yang
          dipilih. */}
      {pesananSedangDibatalkan !== null ? (
        <DialogBatal
          // Status antrean berarti sudah dikonfirmasi, jadi isi popup menjelaskan
          // pembatalan pembayaran dan pengembalian stok.
          sudahDikonfirmasi={pesananSedangDibatalkan.status === "antrean"}
          sedangMemproses={
            keadaan.sedangAksi === pesananSedangDibatalkan.orderId
          }
          tutupDialog={keadaan.tutupDialogBatal}
          konfirmasiBatal={keadaan.sudahKonfirmasiBatal}
        />
      ) : null}
    </main>
  );
}

/**
 * Menampilkan satu kelompok pesanan beserta judul, keterangan, dan jumlahnya.
 *
 * Input: judul, keterangan, jumlah order, penanda apakah kelompok ini butuh
 *        perhatian, dan anak-anaknya (daftar kartu pesanan).
 * Output: elemen section.
 *
 * Dipisah jadi komponen kecil supaya tiga kelompok di layar Cashier punya
 * tampilan yang benar-benar sama.
 */
function BagianKelompok({
  judul,
  keterangan,
  jumlah,
  tekankan,
  children,
}: {
  judul: string;
  keterangan: string;
  jumlah: number;
  tekankan: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className={tekankan ? "text-lg font-bold" : "text-base font-semibold"}
        >
          {judul}
        </h2>
        <span className="text-xs text-gray-600">
          {teksCashier.kelompok.jumlahOrder.replace("{jumlah}", String(jumlah))}
        </span>
      </div>

      <p className="text-xs text-gray-600">{keterangan}</p>

      {/* Kalau kelompok kosong, tampilkan pesan supaya Cashier tahu itu bukan
          kegagalan pemuatan. */}
      {jumlah === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksCashier.kelompok.kosong}
        </p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}

/**
 * Mencari satu pesanan di dalam daftar yang diberikan.
 *
 * Input: id pesanan dan daftar yang mungkin memuatnya.
 * Output: pesanan yang dicari, atau null kalau tidak ada (mis. sudah hilang
 *         karena polling terbaru).
 *
 * Dipakai supaya isi popup pembatalan tahu pesanan mana yang dibatalkan.
 */
function cariPesanan(
  orderId: string,
  ...daftar: PesananTampil[][]
): PesananTampil | null {
  for (const satuDaftar of daftar) {
    for (const satu of satuDaftar) {
      if (satu.orderId === orderId) {
        return satu;
      }
    }
  }
  return null;
}
