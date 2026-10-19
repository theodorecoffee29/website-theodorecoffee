// File ini: komponen tampilan halaman Kelola Akun (/admin/akun).
//
// Isinya dua bagian yang disusun berurutan ke bawah: form tambah akun, lalu daftar
// akun. Kenapa bukan tab: daftar akun pendek dan form tambah harus selalu terlihat di
// atas, jadi tidak perlu state tab yang bisa membuat Admin salah kira sedang membuka
// bagian mana (AGENTS.md bagian "Tampilan": jangan membuat keputusan desain sendiri).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan tidak
// mengubah state sendiri (semua logika ada di src/features/akun/).
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7): HTML semantik dengan class
// Tailwind seperlunya, tanpa komponen jadi, tanpa ikon, tanpa animasi.
//
// SOAL PEMFORMAT WAKTU: kolom "Terakhir masuk" memakai pemformat WIB yang sudah dipakai
// bersama, src/features/laporan/waktu.ts, supaya jam di halaman ini sama persis dengan
// jam di laporan dan di layar Cashier.

import type { AkunTampil } from "@/features/akun/api";
import { tanggalJamWib } from "@/features/laporan/waktu";
import { teksAkun } from "@/features/akun/teks";
import type {
  DialogTerbuka,
  FormUbahAkun,
  KeadaanAkunAdmin,
  PasswordSekaliTampil,
} from "@/features/akun/use-akun-admin";

// Props layar Kelola Akun.
export type PropsLayarAkun = {
  keadaan: KeadaanAkunAdmin;
  // Nama akun yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Menampilkan halaman Kelola Akun.
 *
 * Input: keadaan dari hook, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarAkun({ keadaan, namaAkun, keluar }: PropsLayarAkun) {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksAkun.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              {teksAkun.subjudulHalaman} Masuk sebagai {namaAkun}.
            </p>
          </div>

          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksAkun.tombol.keluar}
          </button>
        </header>

        {/* Pesan aksi (sukses atau error). */}
        {keadaan.pesan !== null ? (
          <div className="flex items-start justify-between gap-2">
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
            <button
              type="button"
              onClick={keadaan.tutupPesan}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {teksAkun.tombol.tutup}
            </button>
          </div>
        ) : null}

        <FormBuatAkunSection keadaan={keadaan} />

        <DaftarAkunSection keadaan={keadaan} />

        {/* Dialog yang sedang terbuka, kalau ada. */}
        {keadaan.dialog !== null ? <DialogSection keadaan={keadaan} /> : null}

        {/* Tampilan password satu kali. Hanya muncul selagi passwordnya belum dihapus,
            jadi begitu ditutup, isinya hilang dari layar. */}
        {keadaan.passwordSekali !== null &&
        keadaan.passwordSekali.password !== "" ? (
          <DialogPasswordSekali
            passwordSekali={keadaan.passwordSekali}
            tutup={keadaan.tutupPasswordSekali}
          />
        ) : null}
      </div>
    </main>
  );
}

/**
 * Form tambah akun.
 *
 * Kolom password memakai input TEKS biasa (bukan type="password") dan menampilkan
 * nilainya apa adanya, karena Admin harus membacanya dan menyalinnya untuk diserahkan
 * ke pemilik akun.
 */
function FormBuatAkunSection({ keadaan }: { keadaan: KeadaanAkunAdmin }) {
  const form = keadaan.formBuat;

  return (
    <section className="rounded border border-gray-300 bg-white p-4">
      <h2 className="text-base font-semibold">{teksAkun.formBuat.judul}</h2>
      <p className="mt-1 text-xs text-gray-600">
        {teksAkun.formBuat.keterangan}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <KolomTeks
          label={teksAkun.formBuat.labelNama}
          id="akun-nama"
          nilai={form.name}
          placeholder={teksAkun.formBuat.placeholderNama}
          ubah={(nilai) => keadaan.ubahFormBuat("name", nilai)}
          nonaktif={keadaan.sedangAksi}
        />

        <KolomTeks
          label={teksAkun.formBuat.labelEmail}
          id="akun-email"
          nilai={form.email}
          placeholder={teksAkun.formBuat.placeholderEmail}
          ubah={(nilai) => keadaan.ubahFormBuat("email", nilai)}
          nonaktif={keadaan.sedangAksi}
        />

        <KolomPeran
          label={teksAkun.formBuat.labelPeran}
          id="akun-peran"
          nilai={form.role}
          ubah={(nilai) => keadaan.ubahFormBuat("role", nilai)}
          nonaktif={keadaan.sedangAksi}
        />

        <div>
          <label
            htmlFor="akun-password"
            className="block text-xs text-gray-600"
          >
            {teksAkun.formBuat.labelPassword}
          </label>
          <input
            id="akun-password"
            type="text"
            value={form.password}
            onChange={(event) =>
              keadaan.ubahFormBuat("password", event.target.value)
            }
            disabled={keadaan.sedangAksi}
            autoComplete="off"
            className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <p className="mt-1 text-xs text-gray-600">
            {teksAkun.formBuat.keteranganPassword}
          </p>
        </div>

        <button
          type="button"
          onClick={keadaan.acakPasswordBaru}
          disabled={keadaan.sedangAksi}
          className="rounded border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-100"
        >
          {teksAkun.tombol.buatAcak}
        </button>

        <button
          type="button"
          onClick={keadaan.kirimBuat}
          disabled={keadaan.sedangAksi}
          className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
        >
          {teksAkun.tombol.buat}
        </button>
      </div>
    </section>
  );
}

/**
 * Daftar akun.
 *
 * Baris akun admin TIDAK punya tombol aksi, dan diberi keterangan singkat. Alasannya
 * bukan karena server akan menolak (server memang menolak), tapi supaya Admin tidak
 * mencari-cari tombol yang memang tidak ada.
 */
function DaftarAkunSection({ keadaan }: { keadaan: KeadaanAkunAdmin }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{teksAkun.judulHalaman}</h2>

      {keadaan.memuat ? (
        <p className="text-sm">{teksAkun.pesan.memuat}</p>
      ) : null}

      {keadaan.gagalMuat ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <p role="alert" className="text-sm text-amber-800">
            {keadaan.pesanGagalMuat ?? teksAkun.pesan.gagal}
          </p>
          <button
            type="button"
            onClick={keadaan.muatUlang}
            className="mt-2 rounded border border-amber-300 px-2 py-1 text-xs"
          >
            {teksAkun.tombol.cobaLagi}
          </button>
        </div>
      ) : null}

      {!keadaan.memuat && !keadaan.gagalMuat && keadaan.daftar.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksAkun.pesan.belumAdaAkun}
        </p>
      ) : null}

      {keadaan.daftar.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-300 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-300 bg-gray-100 text-left">
              <tr>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.nama}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.email}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.peran}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.status}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.terakhirMasuk}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {teksAkun.kolom.aksi}
                </th>
              </tr>
            </thead>
            <tbody>
              {keadaan.daftar.map((akun) => (
                <BarisAkun key={akun.id} akun={akun} keadaan={keadaan} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-gray-600">{teksAkun.pesan.catatan}</p>
    </section>
  );
}

/**
 * Satu baris akun di daftar.
 */
function BarisAkun({
  akun,
  keadaan,
}: {
  akun: AkunTampil;
  keadaan: KeadaanAkunAdmin;
}) {
  // Akun admin tidak punya tombol aksi apa pun.
  const bisaDiubah = akun.role !== "admin";

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-2 py-2">{akun.name}</td>
      <td className="px-2 py-2">{akun.email}</td>
      <td className="px-2 py-2">{teksPeran(akun.role)}</td>

      {/* Status ditulis dengan TEKS, bukan hanya dibedakan dengan warna, supaya tetap
          terbaca saat dicetak hitam-putih. */}
      <td className="px-2 py-2">
        {akun.isActive ? teksAkun.status.aktif : teksAkun.status.nonaktif}
      </td>

      <td className="px-2 py-2">
        {akun.lastSignInAt === ""
          ? teksAkun.belumPernahMasuk
          : tanggalJamWib(akun.lastSignInAt)}
      </td>

      <td className="px-2 py-2">
        {bisaDiubah ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => keadaan.bukaDialogUbah(akun)}
              disabled={keadaan.sedangAksi}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
            >
              {teksAkun.tombol.ubah}
            </button>

            <button
              type="button"
              onClick={() => keadaan.bukaDialogStatus(akun)}
              disabled={keadaan.sedangAksi}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
            >
              {akun.isActive
                ? teksAkun.tombol.nonaktifkan
                : teksAkun.tombol.aktifkan}
            </button>

            <button
              type="button"
              onClick={() => keadaan.bukaDialogReset(akun)}
              disabled={keadaan.sedangAksi}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
            >
              {teksAkun.tombol.resetPassword}
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-600">
            {teksAkun.keteranganAdmin}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Menampilkan dialog yang sedang terbuka.
 *
 * Dialog mana yang tampil ditentukan dari jenisnya, jadi di layar ini hanya boleh ada
 * satu dialog terbuka pada satu waktu.
 */
function DialogSection({ keadaan }: { keadaan: KeadaanAkunAdmin }) {
  const dialog: DialogTerbuka = keadaan.dialog as DialogTerbuka;

  if (dialog.jenis === "ubah") {
    return <DialogUbah keadaan={keadaan} akun={dialog.akun} />;
  }

  if (dialog.jenis === "status") {
    return <DialogStatus keadaan={keadaan} akun={dialog.akun} />;
  }

  return <DialogReset keadaan={keadaan} akun={dialog.akun} />;
}

/**
 * Dialog ubah nama dan peran.
 */
function DialogUbah({
  keadaan,
  akun,
}: {
  keadaan: KeadaanAkunAdmin;
  akun: AkunTampil;
}) {
  const form: FormUbahAkun = keadaan.formUbah;

  return (
    <KotakDialog namaAkun={akun.name}>
      <h2 className="text-base font-semibold">
        {teksAkun.dialogUbah.judulDenganNama.replace("{nama}", akun.name)}
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <KolomTeks
          label={teksAkun.formBuat.labelNama}
          id="ubah-akun-nama"
          nilai={form.name}
          placeholder={teksAkun.formBuat.placeholderNama}
          ubah={(nilai) => keadaan.ubahFormUbah("name", nilai)}
          nonaktif={keadaan.sedangAksi}
        />

        <KolomPeran
          label={teksAkun.formBuat.labelPeran}
          id="ubah-akun-peran"
          nilai={form.role}
          ubah={(nilai) => keadaan.ubahFormUbah("role", nilai)}
          nonaktif={keadaan.sedangAksi}
        />
      </div>

      <TombolDialog
        keadaan={keadaan}
        labelKonfirmasi={teksAkun.tombol.simpan}
        aksiKonfirmasi={keadaan.kirimUbah}
        aksiBatal={keadaan.tutupDialog}
      />
    </KotakDialog>
  );
}

/**
 * Dialog konfirmasi mengubah status aktif.
 *
 * Isinya memakai bahasa yang jelas ("Akun ini tidak akan bisa masuk lagi"), karena
 * akibatnya besar untuk pemilik akun itu: dia tidak bisa bekerja sampai akunnya
 * diaktifkan kembali.
 */
function DialogStatus({
  keadaan,
  akun,
}: {
  keadaan: KeadaanAkunAdmin;
  akun: AkunTampil;
}) {
  const teks = teksAkun.dialogStatus;

  return (
    <KotakDialog namaAkun={akun.name}>
      <h2 className="text-base font-semibold">
        {akun.isActive ? teks.judulNonaktifkan : teks.judulAktifkan}
      </h2>
      <p className="mt-1 text-sm text-gray-700">
        {akun.isActive ? teks.isiNonaktifkan : teks.isiAktifkan}
      </p>

      <TombolDialog
        keadaan={keadaan}
        labelKonfirmasi={teksAkun.tombol.konfirmasi}
        aksiKonfirmasi={keadaan.kirimStatus}
        aksiBatal={keadaan.tutupDialog}
      />
    </KotakDialog>
  );
}

/**
 * Dialog reset password.
 */
function DialogReset({
  keadaan,
  akun,
}: {
  keadaan: KeadaanAkunAdmin;
  akun: AkunTampil;
}) {
  return (
    <KotakDialog namaAkun={akun.name}>
      <h2 className="text-base font-semibold">
        {teksAkun.dialogReset.judulDenganNama.replace("{nama}", akun.name)}
      </h2>
      <p className="mt-1 text-sm text-gray-700">{teksAkun.dialogReset.isi}</p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor="reset-akun-password"
            className="block text-xs text-gray-600"
          >
            {teksAkun.dialogReset.labelPassword}
          </label>
          <input
            id="reset-akun-password"
            type="text"
            value={keadaan.passwordReset}
            onChange={(event) => keadaan.ubahPasswordReset(event.target.value)}
            disabled={keadaan.sedangAksi}
            autoComplete="off"
            className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={keadaan.acakPasswordReset}
          disabled={keadaan.sedangAksi}
          className="rounded border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-100"
        >
          {teksAkun.tombol.buatAcak}
        </button>
      </div>

      <TombolDialog
        keadaan={keadaan}
        labelKonfirmasi={teksAkun.tombol.konfirmasi}
        aksiKonfirmasi={keadaan.kirimReset}
        aksiBatal={keadaan.tutupDialog}
      />
    </KotakDialog>
  );
}

/**
 * Dialog yang menampilkan email dan password SATU KALI.
 *
 * Dialog ini sengaja tidak ditutup dengan menekan area gelap di luar (berbeda dengan
 * dialog konfirmasi): Admin harus menekan tombol Tutup, supaya ia sempat membaca
 * peringatan di dalamnya. Password yang tampil di sini adalah satu-satunya salinan
 * yang ada, jadi mengabaikannya berarti harus mengganti password lagi.
 */
function DialogPasswordSekali({
  passwordSekali,
  tutup,
}: {
  passwordSekali: PasswordSekaliTampil;
  tutup: () => void;
}) {
  const teks = teksAkun.dialogBerhasil;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-password-sekali"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-password-sekali" className="text-base font-semibold">
          {passwordSekali.dariReset ? teks.judulReset : teks.judul}
        </h2>

        <dl className="mt-2 space-y-2 text-sm">
          <div>
            <dt className="text-xs text-gray-600">{teks.labelEmail}</dt>
            <dd className="font-medium">{passwordSekali.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{teks.labelPassword}</dt>
            <dd>
              {/* readOnly supaya Admin bisa menyalin dengan ctrl+C, tapi tidak bisa
                  mengubahnya lewat mengetik (nilai aslinya sudah benar). onFocus
                  membuat teksnya otomatis terselect, jadi ctrl+C langsung menyalin
                  seluruhnya. */}
              <input
                type="text"
                readOnly
                value={passwordSekali.password}
                aria-label={teks.labelPassword}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
              />
            </dd>
          </div>
        </dl>

        {/* Peringatan ditulis tebal supaya tidak kelewat. */}
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-800">
          {passwordSekali.dariReset ? teks.keteranganReset : teks.peringatan}
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={tutup}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksAkun.tombol.tutup}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen pembantu tampilan
// ---------------------------------------------------------------------------

/**
 * Mengubah nilai peran dari server menjadi teks yang tampil.
 *
 * Input: nilai role dari database.
 * Output: "Admin", "Cashier", "Barista", atau teks cadangan.
 *
 * Nilai yang tidak dikenal memakai teks cadangan, bukan nilai mentah, supaya tidak
 * ada "undefined" yang muncul di layar.
 */
function teksPeran(role: string): string {
  if (role === "admin") {
    return teksAkun.peran.admin;
  }
  if (role === "cashier") {
    return teksAkun.peran.cashier;
  }
  if (role === "barista") {
    return teksAkun.peran.barista;
  }
  return teksAkun.peran.tidakDiketahui;
}

/**
 * Latar gelap dan kotak putih untuk sebuah dialog.
 *
 * Input: nama akun (dipakai untuk aria-label, supaya pembaca layar tahu dialog ini
 *        untuk siapa), dan isi dialog.
 * Output: elemen React.
 */
function KotakDialog({
  namaAkun,
  children,
}: {
  namaAkun: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={teksAkun.ariaDialog.replace("{nama}", namaAkun)}
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">{children}</div>
    </div>
  );
}

/**
 * Dua tombol di bawah dialog: Tidak (batal) dan tombol utama.
 *
 * labelKonfirmasi sengaja diberi sebagai parameter, karena teksnya berbeda tiap dialog:
 * "Simpan" untuk ubah akun, "Ya, lanjutkan" untuk konfirmasi status aktif.
 */
function TombolDialog({
  keadaan,
  labelKonfirmasi,
  aksiKonfirmasi,
  aksiBatal,
}: {
  keadaan: KeadaanAkunAdmin;
  labelKonfirmasi: string;
  aksiKonfirmasi: () => void;
  aksiBatal: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={aksiBatal}
        disabled={keadaan.sedangAksi}
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
      >
        {teksAkun.tombol.batal}
      </button>

      <button
        type="button"
        onClick={aksiKonfirmasi}
        disabled={keadaan.sedangAksi}
        className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
      >
        {labelKonfirmasi}
      </button>
    </div>
  );
}

/**
 * Satu kolom isian teks dengan labelnya.
 */
function KolomTeks({
  label,
  id,
  nilai,
  placeholder,
  ubah,
  nonaktif,
}: {
  label: string;
  id: string;
  nilai: string;
  placeholder: string;
  ubah: (nilai: string) => void;
  nonaktif: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-600">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={nilai}
        placeholder={placeholder}
        onChange={(event) => ubah(event.target.value)}
        disabled={nonaktif}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </div>
  );
}

/**
 * Satu kolom pilihan peran.
 *
 * TIDAK ada nilai bawaan. Pilihan kosong pertama memaksa Admin memilih Cashier atau
 * Barista, dan server juga menolak nilai kosong, jadi tidak ada yang bisa terlewat.
 */
function KolomPeran({
  label,
  id,
  nilai,
  ubah,
  nonaktif,
}: {
  label: string;
  id: string;
  nilai: string;
  ubah: (nilai: string) => void;
  nonaktif: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-600">
        {label}
      </label>
      <select
        id={id}
        value={nilai}
        onChange={(event) => ubah(event.target.value)}
        disabled={nonaktif}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        {/* Nilai kosong pertama berarti "belum dipilih". */}
        <option value="">--</option>
        <option value="cashier">{teksAkun.peran.cashier}</option>
        <option value="barista">{teksAkun.peran.barista}</option>
      </select>
    </div>
  );
}
