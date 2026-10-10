// File ini: komponen tampilan untuk halaman Stok Admin (/admin/stok).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak melakukan perhitungan apa pun (sesuai aturan di AGENTS.md bagian
// "Tampilan"). Semua logika ada di src/features/admin/stok/.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.

import {
  angkaJadiAngka,
  formatAngkaIndonesia,
  formatPerubahan,
} from "@/features/admin/stok/angka";
import { hitungSelisihKoreksi } from "@/features/admin/stok/perhitungan";
import type {
  BahanSiapTampil,
  KeadaanStokAdmin,
} from "@/features/admin/stok/use-stok-admin";
import type { RiwayatTampil } from "@/features/admin/stok/perhitungan";
import { teksStokAdmin } from "@/features/admin/stok/teks";

// Props untuk layar stok.
export type PropsLayarStokAdmin = {
  keadaan: KeadaanStokAdmin;
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Menampilkan seluruh isi layar Stok Admin.
 *
 * Input: keadaan dari hook, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarStokAdmin({
  keadaan,
  namaAkun,
  keluar,
}: PropsLayarStokAdmin) {
  const bahanRestock = cariBahan(keadaan.dialogRestockUntuk, keadaan.bahan);
  const bahanKoreksi = cariBahan(keadaan.dialogKoreksiUntuk, keadaan.bahan);
  const bahanRiwayat = cariBahan(keadaan.riwayatUntuk, keadaan.bahan);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header. */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksStokAdmin.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              {teksStokAdmin.subjudulHalaman} Masuk sebagai {namaAkun}.
            </p>
          </div>
          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            Keluar
          </button>
        </header>

        {/* Pesan aksi (sukses atau error). */}
        {keadaan.pesan !== null ? (
          <p
            role={keadaan.pesanAdalahError ? "alert" : "status"}
            className={
              keadaan.pesanAdalahError
                ? "rounded border border-red-300 bg-red-50 px-3 py-2 text-sm"
                : "rounded border border-green-300 bg-green-50 px-3 py-2 text-sm"
            }
          >
            {keadaan.pesan}
          </p>
        ) : null}

        {/* Memuat atau gagal memuat. */}
        {keadaan.memuat ? (
          <p className="text-sm text-gray-600">{teksStokAdmin.pesan.memuat}</p>
        ) : null}

        {keadaan.gagalMuat ? (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <p role="status" className="text-sm text-amber-800">
              {teksStokAdmin.pesan.gagalMuat}
            </p>
            <button
              type="button"
              onClick={keadaan.muatUlang}
              className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
            >
              {teksStokAdmin.pesan.cobaLagi}
            </button>
          </div>
        ) : null}

        {/* Form tambah bahan. */}
        <FormTambahBahan keadaan={keadaan} />

        {/* Daftar bahan. */}
        <DaftarBahan keadaan={keadaan} />

        {/* Dialog restock. */}
        {bahanRestock !== undefined ? (
          <DialogRestock
            keadaan={keadaan}
            nama={bahanRestock.nama}
            stokSekarang={bahanRestock.stokTeks}
          />
        ) : null}

        {/* Dialog koreksi stok. */}
        {bahanKoreksi !== undefined ? (
          <DialogKoreksi keadaan={keadaan} nama={bahanKoreksi.nama} />
        ) : null}

        {/* Riwayat pergerakan. */}
        {bahanRiwayat !== undefined ? (
          <DialogRiwayat
            keadaan={keadaan}
            nama={bahanRiwayat.nama}
            satuan={bahanRiwayat.satuan}
          />
        ) : null}
      </div>
    </main>
  );
}

/**
 * Form untuk menambah bahan baru.
 *
 * Satuan TIDAK punya nilai bawaan: Admin wajib memilih sendiri, karena satuan
 * tidak bisa diubah setelah bahan dibuat.
 */
function FormTambahBahan({ keadaan }: { keadaan: KeadaanStokAdmin }) {
  const teks = teksStokAdmin.formTambah;

  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judul}</h2>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="tambah-nama" className="block text-xs text-gray-600">
            {teks.labelNama}
          </label>
          <input
            id="tambah-nama"
            type="text"
            value={keadaan.formTambahNama}
            onChange={(event) => keadaan.ubahFormTambahNama(event.target.value)}
            placeholder={teks.placeholderNama}
            maxLength={60}
            disabled={keadaan.sedangAksi !== null}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="tambah-satuan"
            className="block text-xs text-gray-600"
          >
            {teks.labelSatuan}
          </label>
          <select
            id="tambah-satuan"
            value={keadaan.formTambahSatuan}
            onChange={(event) =>
              keadaan.ubahFormTambahSatuan(event.target.value)
            }
            disabled={keadaan.sedangAksi !== null}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {/* Tanpa nilai bawaan: pilihan kosong pertama memaksa Admin memilih. */}
            <option value="">--</option>
            <option value="g">Gram (g)</option>
            <option value="ml">Mililiter (ml)</option>
            <option value="pcs">Buah (pcs)</option>
          </select>
        </div>

        <div>
          <label htmlFor="tambah-stok" className="block text-xs text-gray-600">
            {teks.labelStokAwal}
          </label>
          <input
            id="tambah-stok"
            type="text"
            inputMode="decimal"
            value={keadaan.formTambahStok}
            onChange={(event) => keadaan.ubahFormTambahStok(event.target.value)}
            placeholder={teks.placeholderStokAwal}
            disabled={keadaan.sedangAksi !== null}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={keadaan.kirimTambahBahan}
          disabled={keadaan.sedangAksi !== null}
          className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
        >
          {teks.tombolTambah}
        </button>
      </div>

      {/* Catatan satuan, dekat pilihan satuan. */}
      <p className="mt-2 text-xs text-gray-600">{teks.catatanSatuan}</p>

      {/* Pesan validasi. */}
      {keadaan.pesanSatuan !== null ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {keadaan.pesanSatuan}
        </p>
      ) : null}

      {keadaan.pesanFormTambah !== null ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {keadaan.pesanFormTambah}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Daftar bahan, satu kartu per bahan.
 *
 * Setiap bahan punya tombol Restock, Koreksi stok, Riwayat, dan Ubah.
 */
function DaftarBahan({ keadaan }: { keadaan: KeadaanStokAdmin }) {
  return (
    <section className="space-y-3">
      {keadaan.bahan.length === 0 && !keadaan.memuat ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksStokAdmin.daftarBahan.belumAdaBahan}
        </p>
      ) : null}

      <ul className="space-y-3">
        {keadaan.bahan.map((satu) => (
          <KartuBahan
            key={satu.ingredientId}
            bahan={satu}
            sedangAksi={keadaan.sedangAksi === satu.ingredientId}
            formUbahTerbuka={keadaan.formUbahUntuk === satu.ingredientId}
            keadaan={keadaan}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Satu kartu bahan dengan stok dan tombolnya.
 */
function KartuBahan({
  bahan,
  sedangAksi,
  formUbahTerbuka,
  keadaan,
}: {
  bahan: BahanSiapTampil;
  sedangAksi: boolean;
  formUbahTerbuka: boolean;
  keadaan: KeadaanStokAdmin;
}) {
  return (
    <li className="rounded border border-gray-200 bg-white p-4">
      {/* Nama, satuan, dan stok. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{bahan.nama}</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">{bahan.satuanPanjang}</span>
          <span className="font-semibold">{bahan.stokTeks}</span>
        </div>
      </div>

      {/* Stok minus: ditandai dengan TULISAN, bukan hanya warna, supaya tetap
          terbaca. */}
      {bahan.minus ? (
        <p className="mt-1 text-sm font-semibold text-red-700">
          {teksStokAdmin.daftarBahan.tandaMinus}{" "}
          {teksStokAdmin.daftarBahan.keteranganMinus}
        </p>
      ) : null}

      {/* Form ubah nama, kalau dibuka untuk bahan ini. */}
      {formUbahTerbuka ? (
        <FormUbahBahan keadaan={keadaan} bahan={bahan} />
      ) : null}

      {/* Tombol aksi. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => keadaan.bukaDialogRestock(bahan.ingredientId)}
          disabled={sedangAksi}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
        >
          {teksStokAdmin.tombolBahan.restock}
        </button>

        <button
          type="button"
          onClick={() => keadaan.bukaDialogKoreksi(bahan.ingredientId)}
          disabled={sedangAksi}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
        >
          {teksStokAdmin.tombolBahan.koreksi}
        </button>

        <button
          type="button"
          onClick={() => keadaan.bukaRiwayat(bahan.ingredientId)}
          disabled={sedangAksi}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
        >
          {teksStokAdmin.tombolBahan.riwayat}
        </button>

        {!formUbahTerbuka ? (
          <button
            type="button"
            onClick={() => keadaan.bukaFormUbah(bahan.ingredientId)}
            disabled={sedangAksi}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          >
            {teksStokAdmin.tombolBahan.ubah}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Form ubah nama bahan.
 *
 * Satuan ditampilkan sebagai teks biasa, tidak bisa diedit (docs/api-contract.md
 * bagian 4b: satuan tidak bisa diubah setelah bahan dibuat).
 */
function FormUbahBahan({
  keadaan,
  bahan,
}: {
  keadaan: KeadaanStokAdmin;
  bahan: BahanSiapTampil;
}) {
  const teks = teksStokAdmin.formUbah;

  return (
    <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-medium">{teks.judul}</p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor={"ubah-nama-" + bahan.ingredientId}
            className="block text-xs text-gray-600"
          >
            {teksStokAdmin.formTambah.labelNama}
          </label>
          <input
            id={"ubah-nama-" + bahan.ingredientId}
            type="text"
            defaultValue={bahan.nama}
            maxLength={60}
            disabled={keadaan.sedangAksi === bahan.ingredientId}
            onBlur={(event) => {
              // Simpan saat Admin selesai mengetik dan meninggalkan isian.
              if (event.target.value.trim() !== bahan.nama) {
                keadaan.kirimUbahNama(bahan.ingredientId, event.target.value);
              }
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        {/* Satuan ditampilkan, tapi disabled: tidak bisa diubah. */}
        <div>
          <span className="block text-xs text-gray-600">
            {teksStokAdmin.formTambah.labelSatuan}
          </span>
          <input
            type="text"
            value={bahan.satuanPanjang}
            readOnly
            disabled
            className="rounded border border-gray-300 bg-gray-100 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={keadaan.tutupFormUbah}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {teks.tombolBatal}
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-600">{teks.catatanSatuan}</p>
    </div>
  );
}

/**
 * Dialog konfirmasi tambah stok (restock).
 *
 * Menampilkan stok sekarang dan perkiraan stok sesudahnya, supaya Admin tahu
 * hasilnya sebelum menyetujui.
 */
function DialogRestock({
  keadaan,
  nama,
  stokSekarang,
}: {
  keadaan: KeadaanStokAdmin;
  nama: string;
  // Stok sekarang, sudah berupa teks gaya Indonesia.
  stokSekarang: string;
}) {
  const teks = teksStokAdmin.dialogRestock;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-restock"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-dialog-restock" className="text-base font-semibold">
          {teks.judul.replace("{nama}", nama)}
        </h2>

        {/* Ringkasan: stok sekarang dan perkiraan sesudahnya. */}
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">{teks.labelStokSekarang}</dt>
            <dd className="font-medium">{stokSekarang}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{teks.labelPerkiraanSesudah}</dt>
            <dd className="font-semibold">
              {formatPerkiraan(keadaan.perkiraanRestock)}
            </dd>
          </div>
        </dl>

        <div className="mt-3">
          <label
            htmlFor="restock-jumlah"
            className="block text-xs text-gray-600"
          >
            {teks.labelJumlah}
          </label>
          <input
            id="restock-jumlah"
            type="text"
            inputMode="decimal"
            value={keadaan.formRestockJumlah}
            onChange={(event) => keadaan.ubahRestockJumlah(event.target.value)}
            disabled={keadaan.sedangAksi !== null}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <div className="mt-2">
          <label
            htmlFor="restock-catatan"
            className="block text-xs text-gray-600"
          >
            {teks.labelCatatan}
          </label>
          <input
            id="restock-catatan"
            type="text"
            value={keadaan.formRestockCatatan}
            onChange={(event) => keadaan.ubahRestockCatatan(event.target.value)}
            placeholder={teks.placeholderCatatan}
            maxLength={100}
            disabled={keadaan.sedangAksi !== null}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        {keadaan.pesanRestock !== null ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {keadaan.pesanRestock}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={keadaan.tutupDialogRestock}
            disabled={keadaan.sedangAksi !== null}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.tombolTidak}
          </button>
          <button
            type="button"
            onClick={keadaan.konfirmasiRestock}
            disabled={keadaan.sedangAksi !== null}
            className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm text-white"
          >
            {teks.tombolYa}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog konfirmasi koreksi stok.
 *
 * Menampilkan stok tercatat, angka baru, selisihnya (dengan tanda), dan alasan.
 */
function DialogKoreksi({
  keadaan,
  nama,
}: {
  keadaan: KeadaanStokAdmin;
  nama: string;
}) {
  const teks = teksStokAdmin.dialogKoreksi;
  const bahanSekarang = cariBahan(keadaan.dialogKoreksiUntuk, keadaan.bahan);

  // Selisih dihitung dari nilai yang sudah diketik, memakai fungsi yang sama
  // dengan yang dipakai hook. Kalau isian masih kosong atau bukan angka, belum
  // ada selisih yang bisa ditampilkan.
  const fisikBaru = angkaJadiAngka(keadaan.formKoreksiFisik);
  const selisih =
    keadaan.formKoreksiFisik.trim() === ""
      ? null
      : hitungSelisihKoreksi(bahanSekarang?.stokAngka ?? 0, fisikBaru);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-koreksi"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-dialog-koreksi" className="text-base font-semibold">
          {teks.judul.replace("{nama}", nama)}
        </h2>

        {/* Keterangan kapan fungsi ini dipakai. */}
        <p className="mt-1 text-xs text-gray-600">{teks.keterangan}</p>

        {/* Ringkasan: stok tercatat, angka baru, dan selisih. */}
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">{teks.labelStokTercatat}</dt>
            <dd className="font-medium">{bahanSekarang?.stokTeks ?? ""}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{teks.labelAngkaBaru}</dt>
            <dd className="font-medium">{keadaan.formKoreksiFisik}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{teks.labelSelisih}</dt>
            <dd className="font-semibold">
              {selisih === null ? "" : formatSelisih(selisih)}
            </dd>
          </div>
        </dl>

        <div className="mt-3">
          <label
            htmlFor="koreksi-fisik"
            className="block text-xs text-gray-600"
          >
            {teks.labelJumlahFisik}
          </label>
          <input
            id="koreksi-fisik"
            type="text"
            inputMode="decimal"
            value={keadaan.formKoreksiFisik}
            onChange={(event) => keadaan.ubahKoreksiFisik(event.target.value)}
            disabled={keadaan.sedangAksi !== null}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <div className="mt-2">
          <label
            htmlFor="koreksi-alasan"
            className="block text-xs text-gray-600"
          >
            {teks.labelAlasan}
          </label>
          <input
            id="koreksi-alasan"
            type="text"
            value={keadaan.formKoreksiAlasan}
            onChange={(event) => keadaan.ubahKoreksiAlasan(event.target.value)}
            placeholder={teks.placeholderAlasan}
            maxLength={100}
            disabled={keadaan.sedangAksi !== null}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        {keadaan.pesanKoreksi !== null ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {keadaan.pesanKoreksi}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={keadaan.tutupDialogKoreksi}
            disabled={keadaan.sedangAksi !== null}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.tombolTidak}
          </button>
          <button
            type="button"
            onClick={keadaan.konfirmasiKoreksi}
            disabled={keadaan.sedangAksi !== null}
            className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm text-white"
          >
            {teks.tombolYa}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog riwayat pergerakan stok satu bahan.
 */
function DialogRiwayat({
  keadaan,
  nama,
  satuan,
}: {
  keadaan: KeadaanStokAdmin;
  nama: string;
  satuan: string;
}) {
  const teks = teksStokAdmin.riwayat;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-riwayat"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4">
        <h2 id="judul-dialog-riwayat" className="text-base font-semibold">
          {teks.judul.replace("{nama}", nama)}
        </h2>

        {keadaan.memuatRiwayat ? (
          <p className="mt-2 text-sm text-gray-600">
            {teksStokAdmin.pesan.memuat}
          </p>
        ) : null}

        {!keadaan.memuatRiwayat && keadaan.riwayat.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">{teks.belumAda}</p>
        ) : null}

        {keadaan.riwayat.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {keadaan.riwayat.map((satu) => (
              <BarisRiwayat
                key={satu.movementId}
                baris={satu}
                satuan={satuan}
              />
            ))}
          </ul>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={keadaan.tutupRiwayat}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.tombolTutup}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Satu baris riwayat: waktu, jenis, perubahan, stok sesudah, catatan, dan id
 * order (kalau ada).
 */
function BarisRiwayat({
  baris,
  satuan,
}: {
  baris: RiwayatTampil;
  satuan: string;
}) {
  const teks = teksStokAdmin.riwayat;

  return (
    <li className="rounded border border-gray-200 px-3 py-2 text-sm">
      {/* Waktu dan jenis. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{baris.jenisTeks}</span>
        <span className="text-xs text-gray-600">{baris.waktuTeks} WIB</span>
      </div>

      {/* Perubahan dan stok sesudah. */}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <span>
          {teks.labelPerubahan}:{" "}
          <span className="font-semibold">
            {baris.perubahanTeks} {satuan}
          </span>
        </span>
        <span>
          {teks.labelStokSesudah}: {baris.stokSesudahTeks} {satuan}
        </span>
      </div>

      {/* Catatan (kalau ada). */}
      {baris.catatan !== null && baris.catatan !== "" ? (
        <p className="mt-1 text-xs text-gray-600">
          {teks.labelCatatan}: {baris.catatan}
        </p>
      ) : null}

      {/* 8 karakter pertama id order kalau berasal dari order. */}
      {baris.orderIdPendek !== null ? (
        <p className="mt-1 text-xs text-gray-600">
          {teks.orderPrefix.replace("{id}", baris.orderIdPendek)}
        </p>
      ) : null}
    </li>
  );
}

// -----------------------------------------------------------------------------
// Pembantu tampilan
// -----------------------------------------------------------------------------

// Mencari bahan dari daftar (dipakai dialog).
function cariBahan(
  ingredientId: string | null,
  daftar: BahanSiapTampil[],
): BahanSiapTampil | undefined {
  if (ingredientId === null) {
    return undefined;
  }
  return daftar.find((satu) => satu.ingredientId === ingredientId);
}

// Format angka untuk tampilan dialog. Memakai fungsi yang sama dengan riwayat
// supaya konsisten.
function formatPerkiraan(nilai: number): string {
  return formatAngkaIndonesia(nilai);
}

// Format selisih dengan tanda plus atau minus.
function formatSelisih(nilai: number): string {
  return formatPerubahan(nilai);
}
