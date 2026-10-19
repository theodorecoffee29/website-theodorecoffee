// File ini: route handler untuk POST /api/admin/accounts/[id]/password.
//
// Tugasnya: menyetel password baru untuk satu akun Cashier atau Barista.
//
// PERAN: hanya Admin. Cashier, Barista, dan customer (anonim) ditolak, dan percobaannya
// dicatat sebagai access.denied oleh jagaPeranAdmin. Ini sesuai docs/permissions.md
// bagian 2: hanya Admin yang boleh mengelola akun Cashier/Barista.
//
// PERLINDUNGAN: akun admin tidak boleh disentuh, termasuk akun Admin sendiri
// (src/lib/server/perlindungan-akun.ts).
//
// CATATAN SOAL PASSWORD YANG SANGAT PENTING DI FILE INI:
//   1. Password dibaca dari body HANYA untuk divalidasi dan diteruskan ke
//      src/lib/server/kelola-akun.ts, yang meneruskannya ke Supabase Auth.
//   2. Password TIDAK PERNAH masuk ke respons. Mengembalikan password baru dari server
//      tidak ada gunanya: Admin yang baru saja mengetiknya di browsernya sudah
//      memilikinya, dan mengembalikannya lewat respons berarti nilai itu ikut tersimpan
//      di cache dan riwayat jaringan.
//   3. Password TIDAK PERNAH masuk ke log.dan before/after di log sengaja tidak memuat
//      password (lihat ringkasAkun di kelola-akun.ts).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasAkunDariErrorDatabase,
  balasAkunGagal,
  balasAkunOk,
  balasAkunValidasiGagal,
} from "@/lib/server/balas-akun";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import { resetPasswordAkun } from "@/lib/server/kelola-akun";
import type { AkunTampil } from "@/lib/server/petakan-akun";
import { petakanSatuAkun } from "@/lib/server/petakan-akun";
import { jagaAkunYangBolehDikelola } from "@/lib/server/perlindungan-akun";
import { akunIdSchema, resetPasswordSchema } from "@/lib/server/validasi-akun";

export const dynamic = "force-dynamic";

/**
 * Handler POST: menyetel password baru.
 *
 * Input: parameter alamat { id } dan body { password }.
 * Output: { ok: true, data: { accountId } } atau { ok: false, error }.
 *
 * Yang dikembalikan hanya id akun, bukan akun lengkap dan tentu bukan password.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("reset password akun");
  if (!jaga.diizinkan) {
    return balasAkunGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Validasi id SEBELUM menyentuh database.
  const { id } = await params;
  const hasilId = akunIdSchema.safeParse({ id: id });

  if (!hasilId.success) {
    return balasAkunGagal({
      type: "VALIDATION_FAILED",
      message: "Akun tidak ditemukan.",
    });
  }

  const idAkun = hasilId.data.id;

  // 3. Baca body dan validasi dengan zod.
  //
  //    Aturan password yang sama seperti saat membuat akun (minimal 10 karakter, ada
  //    huruf, ada angka). Satu perbedaan yang disengaja: aturan "tidak boleh sama dengan
  //    email" TIDAK bisa dipakai di sini, karena endpoint ini tidak menerima email.
  //    Admin yang mengganti password dengan emailnya sendiri adalah pilihan
  //    Administrator yang hasilnya dia sendiri yang menanggung, dan server tidak punya
  //    cukup informasi untuk menilainya tanpa membaca email yang tidak ada di body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasAkunValidasiGagal([
      { path: [], message: "Body permintaan harus berupa JSON yang valid." },
    ]);
  }

  const hasilValidasi = resetPasswordSchema.safeParse(body);

  if (!hasilValidasi.success) {
    return balasAkunValidasiGagal(hasilValidasi.error.issues);
  }

  // 4. Baca akunnya, sekaligus membedakan "tidak ada" dari "gagal membaca".
  const hasilBaca = await bacaAkunDenganAuth(idAkun);

  if (hasilBaca.gagal) {
    return balasAkunDariErrorDatabase(
      hasilBaca.gagal,
      "reset password (baca profil)",
    );
  }

  if (hasilBaca.akun === null) {
    return balasAkunGagal({
      type: "VALIDATION_FAILED",
      message: "Akun tidak ditemukan.",
    });
  }

  const akunSebelum = hasilBaca.akun;

  // 5. Lindungi akun Admin dan akun sendiri.
  const jagaAkun = jagaAkunYangBolehDikelola(
    { id: akunSebelum.id, role: akunSebelum.role },
    jaga.sesi.userId,
  );

  if (!jagaAkun.boleh) {
    return balasAkunGagal({ type: jagaAkun.tipe, message: jagaAkun.pesan });
  }

  // 6. Setel password barunya. Nilai password berhenti di dalam fungsi itu.
  const hasil = await resetPasswordAkun(
    idAkun,
    hasilValidasi.data.password,
    jaga.sesi,
    akunSebelum,
  );

  if (!hasil.berhasil) {
    return balasAkunGagal({ type: hasil.kode, message: hasil.pesan });
  }

  // 7. Sukses. Hanya id akun yang dikembalikan: bukan akun lengkap, dan tentu bukan
  //    passwordnya.
  return balasAkunOk({ accountId: idAkun });
}

/**
 * Membaca satu akun beserta data Auth-nya.
 *
 * Input: id akun (uuid).
 * Output: objek dengan tepat satu dari tiga keadaan (akun ditemukan / akun tidak ada /
 *         gagal membaca), dengan alasan yang sama seperti di route PATCH.
 */
async function bacaAkunDenganAuth(id: string): Promise<{
  akun: AkunTampil | null;
  gagal: unknown | null;
}> {
  const { data: profil, error: errorProfil } = await getAdminClient()
    .from("profiles")
    .select("id, name, role, is_active")
    .eq("id", id)
    .maybeSingle();

  if (errorProfil) {
    return { akun: null, gagal: errorProfil };
  }

  if (profil === null) {
    return { akun: null, gagal: null };
  }

  const { data: dataAuth } = await getAdminClient().auth.admin.getUserById(id);

  return {
    akun: petakanSatuAkun(profil, dataAuth?.user ?? undefined),
    gagal: null,
  };
}
