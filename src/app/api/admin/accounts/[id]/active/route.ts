// File ini: route handler untuk POST /api/admin/accounts/[id]/active.
//
// Tugasnya: mengaktifkan atau menonaktifkan satu akun Cashier atau Barista.
//
// PERAN: hanya Admin. Cashier, Barista, dan customer (anonim) ditolak, dan percobaannya
// dicatat sebagai access.denied oleh jagaPeranAdmin.
//
// PERLINDUNGAN: akun dengan peran admin tidak boleh dinonaktifkan maupun diaktifkan,
// termasuk akun Admin yang sedang login. Alasannya di src/lib/server/perlindungan-akun.ts.
//
// URUTAN DUA LANGKAHNYA (profil lalu Auth, atau Auth lalu profil) ada di
// src/lib/server/kelola-akun.ts, bukan di sini. File ini hanya merangkai: validasi,
// baca akun, lindungi, lalu panggil.
//
// CATATAN SOAL PASSWORD: file ini tidak menyentuh password sama sekali.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasAkunDariErrorDatabase,
  balasAkunGagal,
  balasAkunOk,
  balasAkunValidasiGagal,
} from "@/lib/server/balas-akun";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import { aktifkanAkun, nonaktifkanAkun } from "@/lib/server/kelola-akun";
import type { AkunTampil } from "@/lib/server/petakan-akun";
import { petakanSatuAkun } from "@/lib/server/petakan-akun";
import { jagaAkunYangBolehDikelola } from "@/lib/server/perlindungan-akun";
import { akunIdSchema, ubahStatusAkunSchema } from "@/lib/server/validasi-akun";

export const dynamic = "force-dynamic";

/**
 * Handler POST: mengubah status aktif sebuah akun.
 *
 * Input: parameter alamat { id } dan body { isActive }.
 * Output: { ok: true, data: { account: {...} } } atau { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("ubah status akun");
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
  //    isActive tidak punya nilai bawaan: server harus tahu Admin memang memilih
  //    status ini, bukan menganggapnya "aktif" kalau field-nya lupa dikirim.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasAkunValidasiGagal([
      { path: [], message: "Body permintaan harus berupa JSON yang valid." },
    ]);
  }

  const hasilValidasi = ubahStatusAkunSchema.safeParse(body);

  if (!hasilValidasi.success) {
    return balasAkunValidasiGagal(hasilValidasi.error.issues);
  }

  // 4. Baca akunnya, sekaligus membedakan "tidak ada" dari "gagal membaca".
  const hasilBaca = await bacaAkunDenganAuth(idAkun);

  if (hasilBaca.gagal) {
    return balasAkunDariErrorDatabase(
      hasilBaca.gagal,
      "ubah status akun (baca profil)",
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

  // 6. Kerjakan. Urutan langkahnya diatur di dalam fungsi yang dipanggil.
  const { isActive } = hasilValidasi.data;

  const hasil = isActive
    ? await aktifkanAkun(idAkun, jaga.sesi, akunSebelum)
    : await nonaktifkanAkun(idAkun, jaga.sesi, akunSebelum);

  if (!hasil.berhasil) {
    return balasAkunGagal({ type: hasil.kode, message: hasil.pesan });
  }

  // 7. Sukses. Kirim ulang akun dengan status yang sudah baru, supaya layar tidak
  //    perlu memuat ulang daftar untuk melihat perubahan.
  const akunSesudah: AkunTampil = { ...akunSebelum, isActive: isActive };

  return balasAkunOk({ account: akunSesudah });
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

  // Data Auth bersifat opsional: email hanya informasi tambahan, bukan syarat untuk
  // mengubah status aktif.
  const { data: dataAuth } = await getAdminClient().auth.admin.getUserById(id);

  return {
    akun: petakanSatuAkun(profil, dataAuth?.user ?? undefined),
    gagal: null,
  };
}
