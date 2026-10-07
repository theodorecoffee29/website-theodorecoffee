// File ini: membaca sesi login di sisi server dan memeriksa peran pengguna.
//
// File ini adalah PENJAGA UTAMA. src/proxy.ts hanya mengarahkan pengguna agar
// experience-nya enak (tidak sampai melihat halaman kosong), tapi proxy bisa
// ilewati. Karena itu SETIAP halaman peran memanggil wajibPeran() di sini
// sebelum menampilkan apa pun. Kalau penjagaan hanya ada di proxy, membuka
// alamat halaman secara langsung bisa melewati proteksi.
//
// Cara memverifikasi login: pakai supabase.auth.getClaims(). Fungsi ini
// memverifikasi tanda tangan token setiap kali dipanggil. JANGAN memakai
// getSession() di server, karena fungsi itu hanya membaca isi cookie tanpa
// memverifikasi, sehingga cookie palsu bisa dipakai.

import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/log";
import {
  AppRoleSchema,
  type AppRole,
  pathUntukRole,
  peranBolehBukaPath,
} from "./roles";

// Data staf yang sudah dipastikan login, aktif, dan punya peran.
export type SesiStaf = {
  // Id akun di auth.users, sama dengan id di tabel profiles.
  userId: string;
  // Nama tampilan dari tabel profiles.
  name: string;
  // Peran yang diambil dari tabel profiles, bukan dari kiriman klien.
  role: AppRole;
  // Id sesi/perangkat dari Supabase. Satu akun bisa dipakai di beberapa laptop,
  // jadi ini dipakai untuk membedakan aktivitas (docs/pemissions.md bagian 1).
  sessionId: string | null;
};

/**
 * Mengambil data staf yang sedang login.
 *
 * Output: SesiStaf kalau valid, atau null kalau belum login / akunnya nonaktif /
 * profilnya belum ada.
 *
 * Cara kerja:
 *   1. getClaims() memverifikasi token. Kalau tidak ada sesi, berhenti di sini.
 *   2. Baris profil dibaca berdasarkan id akun. Memakai klien server biasa
 *      (kunci publik), sehingga RLS yang mengizinkan akun membaca profil
 *      sendiri tetap berlaku.
 *   3. is_active diperiksa di sini. RLS tidak menolak akun nonaktif untuk
 *      membaca profilnya sendiri, jadi pemeriksaannya kita lakukan sendiri.
 */
export async function ambilSesiStaf(): Promise<SesiStaf | null> {
  const supabase = await createSupabaseServerClient();

  // Verifikasi sesi. claims hanya ada kalau tokennya benar.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const userId = claimsData.claims.sub;
  const sessionId =
    typeof claimsData.claims.session_id === "string"
      ? claimsData.claims.session_id
      : null;

  // Ambil profil untuk tahu nama dan peran. Select hanya kolom yang dipakai,
  // supaya tidak mengambil data yang tidak perlu.
  const { data: profil, error: profilError } = await supabase
    .from("profiles")
    .select("id, name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profilError || !profil) {
    // Akun ada di Supabase Auth tapi belum punya baris di profiles, jadi
    // belum bisa masuk aplikasi.
    return null;
  }

  // Akun yang dinonaktifkan tidak boleh masuk, meskipun masih remember password.
  if (!profil.is_active) {
    return null;
  }

  // Peran di-cast lewat zod supaya kalau ada nilai asing di database, kode
  // berhenti di sini dengan pesan yang jelas, bukan error membingungkan.
  const hasilPeran = AppRoleSchema.safeParse(profil.role);
  if (!hasilPeran.success) {
    return null;
  }

  return {
    userId: profil.id,
    name: profil.name,
    role: hasilPeran.data,
    sessionId,
  };
}

/**
 * Memastikan pengguna yang sedang login berhak membuka sebuah halaman.
 *
 * Input: path halaman yang sedang dibuka, contoh "/cashier".
 * Output: SesiStaf kalau boleh. Kalau tidak, fungsi ini mengarahkan pengguna
 *         ke tempat yang tepat lalu tidak pernah mengembalikan nilai.
 *
 * Kenapa memakai redirect: pengguna tidak berhak harus diarahkan, bukan diberi
 * halaman kosong. Pengguna yang belum login atau akunnya nonaktif diarahkan ke
 * /login; pengguna yang login tapi salah peran diarahkan ke halamannya sendiri.
 *
 * Catatan: halaman peran memanggil fungsi ini sebelum menampilkan isi apa pun,
 * sehingga data peran tidak pernah sampai ke orang yang salah.
 */
export async function wajibPeran(path: string): Promise<SesiStaf> {
  const sesi = await ambilSesiStaf();

  // Belum login, akunnya nonaktif, atau profilnya belum ada: ke halaman login.
  if (!sesi) {
    redirect("/login");
  }

  // Sudah login tapi mencoba membuka halaman yang bukan haknya. Catat
  // access.denied dulu (sesuai docs/logging.md bagian 2), lalu arahkan ke
  // halaman miliknya sendiri.
  if (!peranBolehBukaPath(sesi.role, path)) {
    catatAksesDitolak(sesi, path);
    redirect(pathUntukRole(sesi.role));
  }

  return sesi;
}

/**
 * Mencatat percobaan membuka halaman yang bukan haknya.
 *
 * Input: sesi staf yang mencoba, dan path yang dicoba.
 *
 * Pelaku adalah akunnya sendiri (actorId dan actorRole terisi), sedangkan
 * halaman yang dicoba disimpan di meta supaya Admin bisa melihat siapa mau
 * membuka apa.
 */
function catatAksesDitolak(sesi: SesiStaf, path: string): void {
  logActivity({
    action: "access.denied",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "auth",
    entityId: sesi.userId,
    meta: {
      path: path,
      session_id: sesi.sessionId,
    },
  });
}
