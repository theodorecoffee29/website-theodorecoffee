// File ini: komponen tampilan ISI satu laporan.
//
// Komponen ini dipakai oleh DUA tempat tanpa perubahan sama sekali:
//   1. Bagian "Hari ini" di /cashier/laporan dan /admin/laporan.
//   2. Halaman detail satu laporan tersimpan di /cashier/laporan/[id] dan
//      /admin/laporan/[id].
//
// Isinya mengikuti urutan yang diminta: kotak ringkasan, kotak Pencocokan uang,
// rincian asal order, menu terlaris, pemakaian bahan, lalu daftar order.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak menghitung apa pun (semua logika ada di src/features/laporan/).
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan class
// Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.
//
// KELAS PENTING UNTUK CETAK (lihat src/app/cetak.css):
//   cetak-sembunyi : disembunyikan saat pencetakan (tautan navigasi, tombol).
//   cetak-tetap    : tidak boleh terpotong di tengah halaman.
//   cetak-ulang-judul: baris judul tabel yang diulang di setiap halaman kertas.

import type {
  IsiLaporanTampil,
  OrderTampil,
} from "@/features/laporan/isi-laporan";
import { teksLaporan } from "@/features/laporan/teks";

// Props komponen isi laporan.
export type PropsIsiLaporan = {
  // Isi laporan yang sudah siap tampil (hasil pemetaan di src/features/laporan).
  isi: IsiLaporanTampil;
};

/**
 * Menampilkan seluruh isi satu laporan.
 *
 * Input: isi laporan siap tampil.
 * Output: elemen React.
 */
export function IsiLaporan({ isi }: PropsIsiLaporan) {
  return (
    <div className="space-y-4">
      <KotakRingkasan isi={isi} />
      <KotakPencocokanUang isi={isi} />
      <KotakAsalOrder isi={isi} />
      <KotakMenuTerlaris isi={isi} />
      <KotakPemakaianBahan isi={isi} />
      <KotakDaftarOrder isi={isi} />
    </div>
  );
}

/**
 * Kotak ringkasan paling atas: tanggal, jumlah order terhitung, total penjualan,
 * jumlah dibatalkan, dan jumlah belum selesai.
 *
 * Input: isi laporan.
 * Output: elemen React.
 *
 * Diberi kelas cetak-tetap supaya seluruh kotak tidak pernah terpisah: angka
 * ringkasan selalu berarti satu kesimpulan.
 */
function KotakRingkasan({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.ringkasan;
  const baris = isi.ringkasan;

  return (
    <section className="cetak-tetap rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <BarisRingkasan label={teks.tanggal} nilai={baris.tanggalTeks} />
        <BarisRingkasan
          label={teks.orderTerhitung}
          nilai={baris.orderTerhitungTeks}
        />
        <BarisRingkasan
          label={teks.totalPenjualan}
          nilai={baris.totalPenjualanTeks}
          tebal
        />
        <BarisRingkasan label={teks.dibatalkan} nilai={baris.dibatalkanTeks} />
        <BarisRingkasan
          label={teks.belumSelesai}
          nilai={baris.belumSelesaiTeks}
        />
      </dl>
    </section>
  );
}

/**
 * Satu baris label dan nilai di kotak ringkasan.
 *
 * Input: label (teks kiri), nilai (teks kanan), dan tebal (true kalau nilainya
 *        ditulis besar).
 * Output: elemen React.
 */
function BarisRingkasan({
  label,
  nilai,
  tebal = false,
}: {
  label: string;
  nilai: string;
  tebal?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-100 pb-1">
      <dt className="text-gray-600">{label}</dt>
      <dd className={tebal ? "font-bold" : "font-medium"}>{nilai}</dd>
    </div>
  );
}

/**
 * Kotak Pencocokan uang: dua angka besar, Tunai dan QRIS.
 *
 * Input: isi laporan.
 * Output: elemen React.
 *
 * Diberi kelas cetak-tetap karena kedua angka ini adalah inti dari laporan: kalau
 * mereka terpisah ke dua halaman kertas, mustahil dibandingkan.
 */
function KotakPencocokanUang({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.pencocokan;

  return (
    <section className="cetak-tetap rounded border-2 border-gray-400 bg-white p-4">
      <h2 className="text-base font-bold">{teks.judul}</h2>

      {/* Keterangan: apa yang harus dicocokkan Cashier. */}
      <p className="mt-1 text-sm text-gray-700">{teks.keterangan}</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SisiPencocokan sisi={isi.pencocokan.tunai} />
        <SisiPencocokan sisi={isi.pencocokan.qris} />
      </div>
    </section>
  );
}

/**
 * Satu sisi kotak Pencocokan uang: jumlah order dan nominalnya.
 *
 * Input: satu sisi (Tunai atau QRIS).
 * Output: elemen React.
 */
function SisiPencocokan({
  sisi,
}: {
  sisi: IsiLaporanTampil["pencocokan"]["tunai"];
}) {
  return (
    <div className="rounded border border-gray-300 p-3">
      <p className="text-sm font-semibold">{sisi.label}</p>
      <p className="text-sm text-gray-700">{sisi.jumlahOrderTeks}</p>

      {/* Nominal ditulis besar: inilah angka yang dibandingkan dengan uang di laci
          atau dengan saldo yang masuk. */}
      <p className="text-2xl font-bold">{sisi.nominalTeks}</p>
    </div>
  );
}

/**
 * Rincian asal order: Online dan Kasir.
 *
 * Input: isi laporan.
 * Output: elemen React.
 */
function KotakAsalOrder({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.asalOrder;

  return (
    <section className="cetak-tetap rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">{isi.sumber.online.label}</dt>
          <dd className="font-medium">
            {isi.sumber.online.jumlahOrderTeks} -{" "}
            {isi.sumber.online.nominalTeks}
          </dd>
        </div>

        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">{isi.sumber.kasir.label}</dt>
          <dd className="font-medium">
            {isi.sumber.kasir.jumlahOrderTeks} - {isi.sumber.kasir.nominalTeks}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Menu terlaris: nama, porsi, dan nominalnya.
 *
 * Input: isi laporan.
 * Output: elemen React.
 */
function KotakMenuTerlaris({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.menuTerlaris;

  return (
    <section className="rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      {isi.menuTerlaris.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">{teks.kosong}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th scope="col" className="py-1 pr-2 font-semibold">
                Menu
              </th>
              <th scope="col" className="py-1 pr-2 font-semibold">
                {teks.kolomPorsi}
              </th>
              <th scope="col" className="py-1 font-semibold">
                {teks.kolomNominal}
              </th>
            </tr>
          </thead>
          <tbody>
            {isi.menuTerlaris.map((satu) => (
              <tr key={satu.nama} className="border-b border-gray-100">
                <td className="py-1 pr-2">{satu.nama}</td>
                <td className="py-1 pr-2">{satu.porsiTeks}</td>
                <td className="py-1">{satu.nominalTeks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Pemakaian bahan: nama, satuan, jumlah terpakai, dan sisa akhir hari.
 *
 * Input: isi laporan.
 * Output: elemen React.
 *
 * Sisa yang minus ditulis dengan TULISAN "Minus", bukan hanya warna, supaya tetap
 * terbaca saat dicetak hitam-putih (AGENTS.md aturan 9: stok boleh minus).
 */
function KotakPemakaianBahan({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.pemakaianBahan;

  return (
    <section className="rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      {isi.pemakaianBahan.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">{teks.kosong}</p>
      ) : (
        <>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th scope="col" className="py-1 pr-2 font-semibold">
                  Bahan
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolomTerpakai}
                </th>
                <th scope="col" className="py-1 font-semibold">
                  {teks.kolomSisa}
                </th>
              </tr>
            </thead>
            <tbody>
              {isi.pemakaianBahan.map((satu) => (
                <tr key={satu.nama} className="border-b border-gray-100">
                  <td className="py-1 pr-2">
                    {satu.nama} ({satu.satuan})
                  </td>
                  <td className="py-1 pr-2">{satu.terpakaiTeks}</td>
                  <td className="py-1">
                    {/* Sisa boleh negatif, jadi tanda minusnya ditulis sendiri
                        supaya jelas. */}
                    {satu.minus ? teks.tandaMinus + " " : ""}
                    {satu.sisaTeks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-2 text-xs text-gray-600">{teks.keteranganMinus}</p>
        </>
      )}
    </section>
  );
}

/**
 * Daftar order hari itu, urut menurut nomor antrean.
 *
 * Input: isi laporan.
 * Output: elemen React.
 *
 * CATATAN SOAL CETAK: tabel ini BOLEH panjang dan boleh berlanjut ke halaman
 * kertas berikutnya. Yang dijaga hanya (a) baris judul tabel diulang di setiap
 * halaman, dan (b) satu order tidak terpotong di tengah. Aturan CSS-nya ada di
 * src/app/cetak.css, bukan di sini.
 */
function KotakDaftarOrder({ isi }: PropsIsiLaporan) {
  const teks = teksLaporan.daftarOrder;

  return (
    <section className="rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      {isi.orders.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">{teks.kosong}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="cetak-ulang-judul">
              <tr className="border-b border-gray-300 text-left">
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.nomorAntrean}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.nama}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.asal}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.metodeBayar}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.item}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.total}
                </th>
                <th scope="col" className="py-1 pr-2 font-semibold">
                  {teks.kolom.status}
                </th>
                <th scope="col" className="py-1 font-semibold">
                  {teks.kolom.jamKonfirmasi}
                </th>
              </tr>
            </thead>
            <tbody>
              {isi.orders.map((satu) => (
                <BarisOrder key={satu.kunci} order={satu} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Satu order di daftar order.
 *
 * Input: satu order siap tampil.
 * Output: elemen React.
 *
 * Order yang dibatalkan tetap ditulis lengkap (Cashier perlu tahu pesanan mana yang
 * batal), tapi diberi tanda "Dibatalkan" beserta alasannya dan keterangan bahwa
 * nominalnya tidak masuk hitungan total penjualan. Baris tambahan itu dikembalikan
 * sebagai SAUDARA dari baris utama, bukan anaknya, karena HTML tidak mengizinkan
 * satu baris tabel berisi baris tabel lain di dalamnya.
 */
function BarisOrder({ order }: { order: OrderTampil }) {
  const teks = teksLaporan.daftarOrder;

  return (
    <>
      <tr className="cetak-tetap border-b border-gray-100 align-top">
        <td className="py-1 pr-2">{order.nomorAntrean}</td>
        <td className="py-1 pr-2">{order.nama}</td>
        <td className="py-1 pr-2">{order.asalTeks}</td>
        <td className="py-1 pr-2">{order.metodeBayarTeks}</td>

        {/* Daftar item: jumlah, nama, dan catatan kalau ada. */}
        <td className="py-1 pr-2">
          <ul className="list-none">
            {order.items.map((item, posisi) => (
              <li key={posisi}>
                {teksItem(teks, item.jumlahTeks, item.nama, item.catatan)}
              </li>
            ))}
          </ul>
        </td>

        <td className="py-1 pr-2">{order.totalTeks}</td>
        <td className="py-1 pr-2">{order.statusTeks}</td>
        <td className="py-1">
          {order.jamTeks === ""
            ? teks.belumAdaJam
            : teks.formatJamWib.replace("{jam}", order.jamTeks)}

          {/* Label waktu manual: order ini waktunya diketik dari catatan kertas
              karena internet sempat putus (docs/prd.md bagian 10). */}
          {order.waktuManual ? (
            <span className="ml-1 text-xs text-gray-600">
              ({teks.labelWaktuManual})
            </span>
          ) : null}
        </td>
      </tr>

      {/* Baris tambahan untuk order yang dibatalkan. */}
      {order.dibatalkan && order.alasanTeks !== null ? (
        <tr className="cetak-tetap border-b border-gray-100">
          <td colSpan={8} className="py-1 text-xs">
            {teks.teksDibatalkan.replace("{alasan}", order.alasanTeks)} -{" "}
            {teks.keteranganTidakDihitung}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * Mengubah satu item order menjadi kalimat siap tampil.
 *
 * Input: teks pola dari teks.ts, jumlah item, nama menu, dan catatan (atau null).
 * Output: kalimat seperti "2 x Americano (less sugar)" atau "1 x Kopi Susu".
 *
 * Dipisah dari komponen supaya komponen tampilan tidak perlu memuat pola kalimat
 * di dalam JSX (semua teks harus datang dari teks.ts).
 */
function teksItem(
  teks: typeof teksLaporan.daftarOrder,
  jumlah: string,
  nama: string,
  catatan: string | null,
): string {
  const pola =
    catatan === null ? teks.formatItem : teks.formatItemDenganCatatan;

  return pola
    .replace("{jumlah}", jumlah)
    .replace("{nama}", nama)
    .replace("{catatan}", catatan === null ? "" : catatan);
}
