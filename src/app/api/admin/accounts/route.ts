// File ini: route handler untuk /api/admin/accounts.
//
// Dua handler dalam satu file:
//   - GET  : daftar semua akun (Cashier, Barista, dan Admin).
//   - POST : membuat akun Cashier atau Barista baru.
//
// PERAN: hanya Admin. Cashier, Barista, dan customer (anonim) ditolak, dan percobaannya
// dicatat sebagai access.denied oleh jagaPeranAdmin. Belum login mendapat
// UNAUTHENTICATED (docs/permissions.md bagian 2).
//
// CATATAN SOAL AKUN ADMIN DI DAFTAR: akun Admin ikut ditampilkan, karena Admin juga
// butuh tahu akun mana yang aktif. TAPI akun Admin tidak punya tombol aksi apa pun di
// layar, dan semua endpoint ubah, reset, dan nonaktif menolaknya lewat
// src/lib/server/perlindungan-akun.ts. Daftar adalah daftar, bukan hak akses.
//
// CATATAN SOAL GABUNGAN DUA SUMBER: nama, peran, dan status ada di tabel profiles,
// sedangkan email dan waktu login ada di Supabase Auth. Keduanya dibaca lalu digabung
// di dalam memori (lihat src/lib/server/petakan-akun.ts). Daftar Auth dibaca SATU kali
// lewat auth.admin.listUsers, bukan satu permintaan per akun.
//
// CATATAN SOAL PASSWORD: TIDAK ADA nilai password di respons mana pun dari file ini.
// Password hanya dikirim ke Supabase Auth untuk disimpan. Password dikembalikan ke
// Admin lewat isi formulir di browsernya (yang memang sedang diketik Admin), bukan
// lewat server.

import type { NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasAkunDariErrorDatabase,
  balasAkunGagal,
  balasAkunOk,
  balasAkunValidasiGagal,
} from "@/lib/server/balas-akun";
import { detailErrorAuth } from "@/lib/server/err-auth";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import { buatAkun } from "@/lib/server/kelola-akun";
import { petakanDaftarAkun } from "@/lib/server/petakan-akun";
import { buatAkunSchema } from "@/lib/server/validasi-akun";

export const dynamic = "force-dynamic";

// Batas halaman Auth yang akan diambil.
//
// Nilai ini hanya pengaman terhadap daftar yang tidak wajar besar. Kalau batasnya
// tercapai, jumlah sebenarnya dicatat di log sebagai peringatan supaya Admin tahu
// daftar di layar tidak lengkap, bukan diam-diam terpotong.
const MAKSIMAL_HALAMAN_AUTH = 20;

/**
 * Handler GET: daftar semua akun.
 *
 * Output: { ok: true, data: { accounts: [...] } } atau { ok: false, error }.
 *
 * Respons tidak memuat password. Supabase Auth juga tidak pernah mengirimkannya (yang
 * tersimpan di sana adalah hash), dan src/lib/server/petakan-akun.ts hanya mengambil
 * email, created_at, dan last_sign_in_at.
 */
export async function GET() {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("daftar akun");
  if (!jaga.diizinkan) {
    return balasAkunGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Baca daftar akun dari tabel profiles.
  const { data: barisProfiles, error: errorProfiles } = await getAdminClient()
    .from("profiles")
    .select("id, name, role, is_active");

  if (errorProfiles) {
    return balasAkunDariErrorDatabase(
      errorProfiles,
      "daftar akun (baca profiles)",
    );
  }

  // 3. Baca daftar pengguna dari Supabase Auth, satu kali (bukan satu per akun).
  const hasilAuth = await bacaSemuaPenggunaAuth(jaga.sesi.userId);

  if (!hasilAuth.berhasil) {
    return balasAkunGagal({
      type: "INTERNAL_ERROR",
      message:
        "Gagal membaca daftar akun dari Supabase Auth. Kode: " + hasilAuth.kode,
    });
  }

  // 4. Gabungkan kedua sumber menjadi satu daftar urut nama.
  const hasil = petakanDaftarAkun(barisProfiles ?? [], hasilAuth.pengguna);

  // 5. Peringatan kalau ada akun yang tidak berpasangan.
  //
  //    Kasus ini berarti ada akun yang dibuat manual di luar aplikasi (atau profilnya
  //    belum dibuat), jadi Admin perlu tahu. Dicatat sebagai warning, yaitu kejadian
  //    tidak normal tapi aplikasi tetap jalan (docs/logging.md bagian 4).
  if (hasil.tanpaDataAuth > 0) {
    logError({
      message:
        "Ada akun yang data Auth dan profilnya tidak berpasangan: " +
        hasil.tanpaDataAuth +
        " akun.",
      severity: "warning",
      source: "database",
      context: {
        konteks: "daftar akun",
        jumlahTidakBerpasangan: hasil.tanpaDataAuth,
      },
      userId: jaga.sesi.userId,
    });
  }

  return balasAkunOk({ accounts: hasil.accounts });
}

/**
 * Handler POST: membuat akun Cashier atau Barista baru.
 *
 * Input: body { name, email, role, password }.
 * Output: { ok: true, data: { account: {...} } } atau { ok: false, error }.
 */
export async function POST(request: NextRequest) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("buat akun");
  if (!jaga.diizinkan) {
    return balasAkunGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Baca body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasAkunValidasiGagal([
      { path: [], message: "Body permintaan harus berupa JSON yang valid." },
    ]);
  }

  // 3. Validasi dengan zod.
  //
  //    Password yang tidak memenuhi aturan (terlalu pendek, tanpa angka, atau sama
  //    dengan email) ditolak DI SINI, sebelum Supabase Auth dihubungi. Password yang
  //    ditolak tidak pernah dikirim ke mana pun.
  const hasilValidasi = buatAkunSchema.safeParse(body);

  if (!hasilValidasi.success) {
    return balasAkunValidasiGagal(hasilValidasi.error.issues);
  }

  // 4. Buat akun. Nilai password diteruskan ke kelola-akun.ts, dan dari sana HANYA ke
  //    Supabase Auth. Tidak ada catatan atau respons yang memuatnya.
  const hasil = await buatAkun(hasilValidasi.data, jaga.sesi);

  if (!hasil.berhasil) {
    // Catatan: kode ERR-xxxx sudah ikut terikat di dalam pesan oleh kelola-akun.ts
    // (supaya tidak ada kode yang dobel di layar), jadi field code di sini tidak
    // diisi lagi.
    return balasAkunGagal({ type: hasil.kode, message: hasil.pesan });
  }

  // 5. Sukses. Status 201 karena ada sumber daya baru.
  return balasAkunOk({ account: hasil.akun }, 201);
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

/**
 * Membaca seluruh daftar pengguna dari Supabase Auth.
 *
 * Input: id Admin yang sedang login (untuk pesan log).
 * Output: { berhasil: true, pengguna } kalau berhasil, atau
 *         { berhasil: false, kode } kalau gagal.
 *
 * KENAPA DIAMBIL LEBIH DARI SATU HALAMAN: auth.admin.listUsers mengembalikan
 * pengguna per halaman. Kalau hanya satu halaman yang diambil, akun setelah angka itu
 * TIDAK akan muncul di daftar tanpa ada penjelasan. Untuk skala booth, mengambil
 * semua halaman sekaligus sudah cukup.
 *
 * KENAPA ADA BATASNYA: kalau suatu saat daftar Auth tumbuh sangat besar, batas ini
 * mencegah permintaan tanpa akhir. Saat batasnya tercapai, jumlahnya dicatat di log
 * sebagai peringatan, jadi masalahnya kelihatan dan bukan hilang diam-diam.
 */
async function bacaSemuaPenggunaAuth(
  idAdmin: string,
): Promise<
  { berhasil: true; pengguna: unknown[] } | { berhasil: false; kode: string }
> {
  const semua: unknown[] = [];
  let halaman = 1;

  while (halaman <= MAKSIMAL_HALAMAN_AUTH) {
    const { data, error } = await getAdminClient().auth.admin.listUsers({
      page: halaman,
    });

    if (error) {
      const detail = detailErrorAuth(error);

      return {
        berhasil: false,
        kode: logError({
          message: "Gagal membaca daftar pengguna Auth: " + detail.message,
          severity: "error",
          source: "server",
          context: {
            konteks: "daftar akun",
            halaman: halaman,
            authCode: detail.code,
            authStatus: detail.status,
            authMessage: detail.message,
          },
          userId: idAdmin,
        }),
      };
    }

    const pengguna = data?.users ?? [];
    semua.push(...pengguna);

    // Berhenti kalau halaman ini kosong, atau semua pengguna sudah terbaca.
    if (pengguna.length === 0 || semua.length >= (data?.total ?? 0)) {
      return { berhasil: true, pengguna: semua };
    }

    halaman += 1;
  }

  // Batas halaman tercapai: beri tahu lewat log, lalu tetap kirim yang sudah dibaca
  // supaya Admin tetap punya daftar yang bisa dipakai.
  logError({
    message:
      "Daftar pengguna Auth dipotong di " +
      MAKSIMAL_HALAMAN_AUTH +
      " halaman. Daftar akun di layar mungkin tidak lengkap.",
    severity: "warning",
    source: "server",
    context: {
      konteks: "daftar akun",
      maksimalHalaman: MAKSIMAL_HALAMAN_AUTH,
      jumlahDibaca: semua.length,
    },
    userId: idAdmin,
  });

  return { berhasil: true, pengguna: semua };
}
