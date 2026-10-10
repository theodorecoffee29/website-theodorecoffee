// File ini: komponen tampilan untuk daftar menu dan resep Admin (/admin/menu).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak melakukan perhitungan apa pun (sesuai aturan di AGENTS.md bagian
// "Tampilan"). Semua logika ada di src/features/admin/menu/.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan
// class Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.

import { useState } from "react";
import type {
  KeadaanMenuAdmin,
  MenuSiapTampil,
} from "@/features/admin/menu/use-menu-admin";
import { teksMenuAdmin } from "@/features/admin/menu/teks";

// Props untuk layar menu.
export type PropsLayarMenuAdmin = {
  keadaan: KeadaanMenuAdmin;
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar. Server Action boleh dikirim sebagai prop ke
  // komponen browser.
  keluar: () => void;
};

/**
 * Menampilkan seluruh isi layar Menu dan Resep Admin.
 *
 * Input: keadaan dari hook, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarMenuAdmin({
  keadaan,
  namaAkun,
  keluar,
}: PropsLayarMenuAdmin) {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <HeaderMenuAdmin namaAkun={namaAkun} keluar={keluar} />

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
          <p className="text-sm text-gray-600">{teksMenuAdmin.pesan.memuat}</p>
        ) : null}

        {keadaan.gagalMuat ? (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <p role="status" className="text-sm text-amber-800">
              {teksMenuAdmin.pesan.gagalMuat}
            </p>
            <button
              type="button"
              onClick={keadaan.muatUlang}
              className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
            >
              {teksMenuAdmin.pesan.cobaLagi}
            </button>
          </div>
        ) : null}

        {/* Form tambah menu. */}
        <FormTambahMenu keadaan={keadaan} />

        {/* Daftar menu. */}
        <DaftarMenu
          menu={keadaan.menu}
          sedangAksi={keadaan.sedangAksi}
          formUbahUntuk={keadaan.formUbahUntuk}
          bukaFormUbah={keadaan.bukaFormUbah}
          tutupFormUbah={keadaan.tutupFormUbah}
          kirimUbahMenu={keadaan.kirimUbahMenu}
          bukaDialogNonaktif={keadaan.bukaDialogNonaktif}
          aktifkanMenu={keadaan.aktifkanMenu}
          bukaEditorResep={keadaan.bukaEditorResep}
        />

        {/* Dialog konfirmasi nonaktifkan. */}
        {keadaan.dialogNonaktifUntuk !== null ? (
          <DialogNonaktifkan
            namaMenu={cariNama(keadaan.dialogNonaktifUntuk, keadaan.menu)}
            tutupDialog={keadaan.tutupDialogNonaktif}
            konfirmasi={keadaan.konfirmasiNonaktifkan}
          />
        ) : null}
      </div>
    </main>
  );
}

/**
 * Header halaman: judul, nama akun, dan tombol keluar.
 */
function HeaderMenuAdmin({
  namaAkun,
  keluar,
}: {
  namaAkun: string;
  keluar: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
      <div>
        <h1 className="text-xl font-bold">{teksMenuAdmin.judulHalaman}</h1>
        <p className="text-sm text-gray-600">
          {teksMenuAdmin.subjudulHalaman} Masuk sebagai {namaAkun}.
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
  );
}

/**
 * Form untuk menambah menu baru.
 */
function FormTambahMenu({ keadaan }: { keadaan: KeadaanMenuAdmin }) {
  const teks = teksMenuAdmin.formMenu;

  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold">{teks.judulTambah}</h2>

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
          <label htmlFor="tambah-harga" className="block text-xs text-gray-600">
            {teks.labelHarga}
          </label>
          <input
            id="tambah-harga"
            type="number"
            value={keadaan.formTambahHarga}
            onChange={(event) =>
              keadaan.ubahFormTambahHarga(event.target.value)
            }
            placeholder={teks.placeholderHarga}
            disabled={keadaan.sedangAksi !== null}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={keadaan.kirimTambahMenu}
          disabled={keadaan.sedangAksi !== null}
          className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
        >
          {teks.tombolTambah}
        </button>
      </div>

      {/* Pesan validasi isian form. */}
      {keadaan.pesanFormTambah !== null ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {keadaan.pesanFormTambah}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Daftar menu, satu kartu per menu.
 *
 * Setiap menu bisa punya: ringkasan resep, status, dan tombol Resep, Ubah, dan
 * Aktif/Nonaktifkan. Tidak ada tombol hapus: menu tidak pernah dihapus
 * (docs/data-model.md aturan 5).
 */
function DaftarMenu({
  menu,
  sedangAksi,
  formUbahUntuk,
  bukaFormUbah,
  tutupFormUbah,
  kirimUbahMenu,
  bukaDialogNonaktif,
  aktifkanMenu,
  bukaEditorResep,
}: {
  menu: MenuSiapTampil[];
  sedangAksi: string | null;
  formUbahUntuk: string | null;
  bukaFormUbah: (menuItemId: string) => void;
  tutupFormUbah: () => void;
  kirimUbahMenu: (menuItemId: string, nama: string, harga: string) => void;
  bukaDialogNonaktif: (menuItemId: string) => void;
  aktifkanMenu: (menuItemId: string) => void;
  bukaEditorResep: (menuItemId: string) => void;
}) {
  return (
    <section className="space-y-3">
      {menu.length === 0 && !sedangAksi ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksMenuAdmin.pesan.belumAdaMenu}
        </p>
      ) : null}

      <ul className="space-y-3">
        {menu.map((satu) => (
          <KartuMenu
            key={satu.menuItemId}
            menu={satu}
            sedangAksi={sedangAksi === satu.menuItemId}
            formUbahTerbuka={formUbahUntuk === satu.menuItemId}
            bukaFormUbah={bukaFormUbah}
            tutupFormUbah={tutupFormUbah}
            kirimUbahMenu={kirimUbahMenu}
            bukaDialogNonaktif={bukaDialogNonaktif}
            aktifkanMenu={aktifkanMenu}
            bukaEditorResep={bukaEditorResep}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Satu kartu menu dengan tombol-tombolnya.
 *
 * Kalau form ubah terbuka untuk menu ini, formnya tampil di dalam kartu ini.
 */
function KartuMenu({
  menu,
  sedangAksi,
  formUbahTerbuka,
  bukaFormUbah,
  tutupFormUbah,
  kirimUbahMenu,
  bukaDialogNonaktif,
  aktifkanMenu,
  bukaEditorResep,
}: {
  menu: MenuSiapTampil;
  sedangAksi: boolean;
  formUbahTerbuka: boolean;
  bukaFormUbah: (menuItemId: string) => void;
  tutupFormUbah: () => void;
  kirimUbahMenu: (menuItemId: string, nama: string, harga: string) => void;
  bukaDialogNonaktif: (menuItemId: string) => void;
  aktifkanMenu: (menuItemId: string) => void;
  bukaEditorResep: (menuItemId: string) => void;
}) {
  return (
    <li className="rounded border border-gray-200 bg-white p-4">
      {/* Nama, harga, dan status. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{menu.nama}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{menu.hargaTeks}</span>
          <span className="rounded border border-gray-300 px-2 py-0.5 text-xs">
            {menu.teksStatus}
          </span>
        </div>
      </div>

      {/* Ringkasan resep. */}
      <p className="mt-1 text-xs text-gray-600">{menu.ringkasResep}</p>

      {/* Form ubah, kalau dibuka untuk menu ini. */}
      {formUbahTerbuka ? (
        <FormUbahMenu
          menu={menu}
          sedangAksi={sedangAksi}
          tutupFormUbah={tutupFormUbah}
          kirimUbahMenu={kirimUbahMenu}
        />
      ) : null}

      {/* Tombol aksi. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => bukaEditorResep(menu.menuItemId)}
          disabled={sedangAksi}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
        >
          {teksMenuAdmin.tombolMenu.resep}
        </button>

        {!formUbahTerbuka ? (
          <button
            type="button"
            onClick={() => bukaFormUbah(menu.menuItemId)}
            disabled={sedangAksi}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          >
            {teksMenuAdmin.tombolMenu.ubah}
          </button>
        ) : null}

        {/* Menu aktif: tombolnya Nonaktifkan (lewat dialog). Nonaktif: Aktifkan
            (langsung, tanpa dialog). */}
        {menu.isActive ? (
          <button
            type="button"
            onClick={() => bukaDialogNonaktif(menu.menuItemId)}
            disabled={sedangAksi}
            className="rounded border border-red-300 px-2 py-1 text-sm text-red-700 disabled:bg-gray-100"
          >
            {teksMenuAdmin.tombolMenu.nonaktifkan}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => aktifkanMenu(menu.menuItemId)}
            disabled={sedangAksi}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          >
            {teksMenuAdmin.tombolMenu.aktifkan}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Form ubah nama dan harga menu.
 *
 * Isian form disimpan di komponen ini (useState lokal), karena isian ini milik
 * satu kartu menu saja. Hook utama hanya mengatur kapan form dibuka dan
 * ditutup.
 */
function FormUbahMenu({
  menu,
  sedangAksi,
  tutupFormUbah,
  kirimUbahMenu,
}: {
  menu: MenuSiapTampil;
  sedangAksi: boolean;
  tutupFormUbah: () => void;
  kirimUbahMenu: (menuItemId: string, nama: string, harga: string) => void;
}) {
  // Isian form. useState di sini (bukan di hook utama) karena setiap kartu
  // punya formnya sendiri.
  const teks = teksMenuAdmin.formMenu;
  const [nama, setNama] = useState(menu.nama);
  const [harga, setHarga] = useState(hargaMentah(menu.hargaTeks));

  return (
    <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-medium">{teks.judulUbah}</p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor={"ubah-nama-" + menu.menuItemId}
            className="block text-xs text-gray-600"
          >
            {teks.labelNama}
          </label>
          <input
            id={"ubah-nama-" + menu.menuItemId}
            type="text"
            value={nama}
            onChange={(event) => setNama(event.target.value)}
            maxLength={60}
            disabled={sedangAksi}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor={"ubah-harga-" + menu.menuItemId}
            className="block text-xs text-gray-600"
          >
            {teks.labelHarga}
          </label>
          <input
            id={"ubah-harga-" + menu.menuItemId}
            type="number"
            value={harga}
            onChange={(event) => setHarga(event.target.value)}
            disabled={sedangAksi}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => kirimUbahMenu(menu.menuItemId, nama, harga)}
          disabled={sedangAksi}
          className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
        >
          {teks.tombolUbah}
        </button>

        <button
          type="button"
          onClick={tutupFormUbah}
          disabled={sedangAksi}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        >
          {teks.tombolBatal}
        </button>
      </div>

      {/* Pengingat: harga baru tidak mengubah pesanan lama. */}
      <p className="mt-2 text-xs text-gray-600">{teks.catatanHarga}</p>
    </div>
  );
}

/**
 * Dialog konfirmasi nonaktifkan menu.
 *
 * Elemen dialog HTML dengan dua pilihan, Ya dan Tidak (dokumen Order-flow bagian
 * 6).
 */
function DialogNonaktifkan({
  namaMenu,
  tutupDialog,
  konfirmasi,
}: {
  namaMenu: string;
  tutupDialog: () => void;
  konfirmasi: () => void;
}) {
  const teks = teksMenuAdmin.dialogNonaktifkan;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-nonaktifkan"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-dialog-nonaktifkan" className="text-base font-semibold">
          {teks.judul}
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          {namaMenu}: {teks.isi}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={tutupDialog}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.tombolTidak}
          </button>
          <button
            type="button"
            onClick={konfirmasi}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white"
          >
            {teks.tombolYa}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mencari nama menu dari daftar (dipakai dialog konfirmasi).
function cariNama(menuItemId: string, daftar: MenuSiapTampil[]): string {
  const ditemukan = daftar.find((satu) => satu.menuItemId === menuItemId);
  return ditemukan ? ditemukan.nama : "";
}

// Mengubah teks rupiah ("Rp 20.000") kembali menjadi angka untuk isian edit
// (input type="number" tidak menerima format dengan titik).
function hargaMentah(hargaTeks: string): string {
  return hargaTeks.replace(/[^\d]/g, "");
}
