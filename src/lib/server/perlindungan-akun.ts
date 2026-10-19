// File ini: penjaga yang mencegah halaman kelola akun menyentuh akun Admin.
//
// KENAPA PERLU: halaman ini HANYA untuk mengelola akun Cashier dan Barista
// (docs/permissions.md bagian 2). Akun Admin tidak boleh:
//   - diubah nama atau peran,
//   - dinonaktifkan,
//   - passwordnya direset,
// lewat halaman ini. Akun admin dibuat manual di Supabase (akun pertama), dan
// kalau bisa dinonaktifkan dari sini, Admin bisa mengunci dirinya sendiri di luar
// aplikasi tanpa ada yang bisa membukanya lagi dari aplikasi juga.
//
// File ini MURNI (tanpa database), jadi bisa diuji langsung.
//
// KENAPA PENOLAKANNYA FORBIDDEN, BUKAN VALIDATION_FAILED:
//   Ini batas PERAN, bukan kesalahan pengisian data. docs/permissions.md bagian 6
//   mendefinisikan FORBIDDEN sebagai "Peran tidak boleh melakukan aksi ini", dan tipe
//   itu juga otomatis dicatat sebagai access.denied (docs/logging.md bagian 2).
//   Kalau dipakai VALIDATION_FAILED, percobaan menyentuh akun admin tidak akan masuk
//   ke jejak audit, padahal justru kasus yang paling perlu diawasi.
//   Perbedaannya dengan input tidak valid: input tidak valid adalah salah isi form
//   (mis. nama kosong), sedangkan ini adalah mencoba mengubah sesuatu yang memang tidak
//   boleh diubah.

// Hasil penjagaan. Kalau "boleh", tidak ada keterangan tambahan yang perlu dibaca.
export type HasilJagaAkun =
  { boleh: true } | { boleh: false; tipe: "FORBIDDEN"; pesan: string };

/**
 * Memeriksa apakah Admin boleh mengelola satu akun.
 *
 * Input:
 *   - akunTarget: id dan peran akun yang jadi sasaran.
 *   - idAdmin: id akun Admin yang sedang login (pelaku aksi).
 * Output: HasilJagaAkun.
 *
 * CARA KERJA (dua syarat, urut dari yang paling jelas):
 *   1. Akun Admin lain tidak boleh disentuh. Perannya berbeda, dan halaman ini hanya
 *      untuk Cashier dan Barista.
 *   2. Akun Admin sendiri juga tidak boleh disentuh. Seandainya aturan pertama tidak
 *      ada, Admin masih bisa mengunci dirinya sendiri dari halaman yang sedang dia pakai.
 */
export function jagaAkunYangBolehDikelola(
  akunTarget: { id: string; role: string },
  idAdmin: string,
): HasilJagaAkun {
  // Syarat 1: peran admin. Mencakup akun Admin sendiri juga, karena perannya admin.
  if (akunTarget.role === "admin") {
    return {
      boleh: false,
      tipe: "FORBIDDEN",
      pesan:
        akunTarget.id === idAdmin
          ? "Akun Admin ini tidak boleh diubah dari halaman ini."
          : "Akun Admin tidak boleh diubah dari halaman ini.",
    };
  }

  // Pengaman kedua: kalau ada peran lain yang belum dikenal di masa depan, akun
  // dengan id yang sama dengan Admin juga ditolak. Pengaman ini murah dan menutup
  // kemungkinan peran baru lolos tanpa sengaja.
  if (akunTarget.id === idAdmin) {
    return {
      boleh: false,
      tipe: "FORBIDDEN",
      pesan: "Akun sendiri tidak boleh diubah dari halaman ini.",
    };
  }

  return { boleh: true };
}
