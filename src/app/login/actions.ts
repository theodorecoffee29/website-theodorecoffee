// File ini: Server Action untuk login dan logout.
//
// Kenapa Server Action (bukan fetch dari browser): Supabase harus menulis
// cookie sesi. Server Action berjalan di server, jadi cookie bisa ditulis ke
// respons dan langsung disimpan browser. Kalau login dilakukan langsung dari
// browser, sesi tetap bisa hilang saat halaman dirender di server.
//
// PENTING: file ini memakai "use server", jadi semua yang diekspor di sini
// HARUS berupa fungsi async. Type (seperti HasilLogin) aman karena type dihapus
// saat kode dijalankan. Pembantu yang bukan async (pencatatan log) sengaja
// dipisah ke src/lib/auth/log-auth.ts.
//
// Semua pesan error yang tampil ke pengguna dibuat generik ("Email atau kata
// sandi salah"). Kita sengaja TIDAK membedakan "email tidak ada" dari "sandi
// salah", karena pesan yang membedakan bisa dipakai orang untuk menebak email
// mana yang terdaftar. Rincian kegagalan yang sebenarnya dicatat ke log.
//
// Password TIDAK PERNAH dicatat ke log, bahkan saat login gagal. Yang dicatat
// hanya email yang dicoba (docs/logging.md bagian 6 poin 3).

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ambilSesiStaf } from "@/lib/auth/session";
import { pathUntukRole } from "@/lib/auth/roles";
import {
  catatLoginBerhasil,
  catatLoginGagal,
  catatLogout,
} from "@/lib/auth/log-auth";

// Bentuk data yang dikirim balik ke form di browser setelah Server Action selesai.
export type HasilLogin = {
  // Pesan error yang aman ditampilkan ke pengguna, atau null kalau berhasil.
  error: string | null;
};

// Validasi input form. zod dipakai supaya aturan "email benar, sandi tidak
// kosong" diperiksa satu tempat.
const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

// Satu pesan untuk semua kegagalan login, supaya tidak membocorkan informasi
// apakah sebuah email terdaftar.
const PESAN_LOGIN_GAGAL = "Email atau kata sandi salah.";

/**
 * Server Action untuk memproses form login.
 *
 * Input: FormData dari form di /login (field "email" dan "password").
 * Output: objek HasilLogin. Kalau login berhasil, fungsi ini mengarahkan
 *         pengguna ke halaman perannya, jadi tidak pernah kembali.
 *
 * Alur:
 *   1. Validasi bentuk input.
 *   2. signInWithPassword ke Supabase Auth.
 *   3. Kalau gagal: catat auth.login_failed dan kembalikan pesan generik.
 *   4. Kalau berhasil: baca profil. Kalau profil tidak ada atau akun nonaktif,
 *      keluarkan sesi, catat auth.login_failed, dan tolak.
 *   5. Kalau semuanya beres: catat auth.login lalu arahkan ke halaman peran.
 *
 * Catatan penting: kegagalan menulis log (di dalam logActivity) tidak boleh
 * menggagalkan login. logActivity sudah dirancang begitu, jadi di sini kita
 * tidak perlu try/catch tambahan di sekeliling pemanggilannya.
 */
export async function loginAction(formData: FormData): Promise<HasilLogin> {
  // 1. Validasi input.
  const hasilValidasi = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!hasilValidasi.success) {
    // Tidak perlu mencatat ke log: ini kesalahan pengisian form, bukan kegagalan
    // sistem (docs/api-contract.md bagian 6: VALIDATION_FAILED tidak dicatat).
    return { error: "Email dan kata sandi wajib diisi dengan benar." };
  }

  const email = hasilValidasi.data.email;
  const password = hasilValidasi.data.password;

  const supabase = await createSupabaseServerClient();

  // 2. Coba login ke Supabase Auth.
  const { error: errorLogin } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // 3. Login ditolak Supabase (sandi salah atau email tidak terdaftar).
  if (errorLogin) {
    catatLoginGagal(email, "kredensial salah atau email tidak terdaftar");
    return { error: PESAN_LOGIN_GAGAL };
  }

  // 4. Login berhasil, sekarang cek profil dan status aktif.
  //    ambilSesiStaf mengembalikan null kalau profil tidak ada atau nonaktif.
  const sesi = await ambilSesiStaf();

  if (!sesi) {
    // Login berhasil tapi tidak boleh masuk (profil belum ada atau nonaktif).
    // Keluarkan sesi supaya tidak tinggal masuk setengah jalan.
    await supabase.auth.signOut();
    catatLoginGagal(email, "profil tidak ada atau akun nonaktif");
    return { error: PESAN_LOGIN_GAGAL };
  }

  // 5. Berhasil. Catat login, lalu arahkan ke halaman sesuai peran.
  catatLoginBerhasil(sesi);

  redirect(pathUntukRole(sesi.role));
}

/**
 * Server Action untuk keluar (logout).
 *
 * Input: tidak ada.
 * Output: pengguna selalu diarahkan ke /login.
 *
 * Alur: catat auth.logout lebih dulu (supaya tetap tercatat walau proses
 * keluar berikutnya gagal), lalu hapus sesi di Supabase.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Catat logout dengan pelaku sedekat mungkin. Sesi mungkin sudah tidak ada
  // lagi, jadi ambil id dan peran dari sesi bila tersedia.
  const sesi = await ambilSesiStaf();
  if (sesi) {
    catatLogout(sesi);
  }

  await supabase.auth.signOut();
  redirect("/login");
}
