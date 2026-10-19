// File ini: route handler untuk PATCH /api/admin/accounts/[id].
//
// Tugasnya: mengubah nama dan peran satu akun Cashier atau Barista.
//
// PERAN: hanya Admin. Cashier, Barista, dan customer (anonim) ditolak, dan percobaannya
// dicatat sebagai access.denied oleh jagaPeranAdmin.
//
// PERLINDUNGAN: akun dengan peran admin tidak boleh diubah, termasuk akun Admin yang
// sedang login. Alasannya dijelaskan di src/lib/server/perlindungan-akun.ts. Penolakan
// ini memakai tipe FORBIDDEN, supaya percobaannya tercatat sebagai access.denied.
//
// CATATAN SOAL PASSWORD: file ini tidak menyentuh password sama sekali. input maupun output di file ini memuatnya.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasAkunDariErrorDatabase,
  balasAkunGagal,
  balasAkunOk,
  balasAkunValidasiGagal,
} from "@/lib/server/balas-akun";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import { ubahAkun } from "@/lib/server/kelola-akun";
import type { AkunTampil } from "@/lib/server/petakan-akun";
import { petakanSatuAkun } from "@/lib/server/petakan-akun";
import { jagaAkunYangBolehDikelola } from "@/lib/server/perlindungan-akun";
import { akunIdSchema, ubahAkunSchema } from "@/lib/server/validasi-akun";

export const dynamic = "force-dynamic";

/**
 * Handler PATCH: mengubah nama dan peran akun.
 *
 * Input: parameter alamat { id } dan body { name, role }.
 * Output: { ok: true, data: { account: {...} } } atau { ok: false, error }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("ubah akun");
  if (!jaga.diizinkan) {
    return balasAkunGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Validasi id SEBELUM menyentuh database. Id yang bukan uuid tidak mungkin ada,
  //    jadi jawabannya "akun tidak ditemukan" dan tidak dicatat ke error_logs
  //    (docs/api-contract.md bagian 6).
  const { id } = await params;
  const hasilId = akunIdSchema.safeParse({ id: id });

  if (!hasilId.success) {
    return balasAkunGagal({
      type: "VALIDATION_FAILED",
      message: "Akun tidak ditemukan.",
    });
  }

  const idAkun = hasilId.data.id;

  // 3. Baca body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasAkunValidasiGagal([
      { path: [], message: "Body permintaan harus berupa JSON yang valid." },
    ]);
  }

  // 4. Validasi body dengan zod.
  const hasilValidasi = ubahAkunSchema.safeParse(body);

  if (!hasilValidasi.success) {
    return balasAkunValidasiGagal(hasilValidasi.error.issues);
  }

  // 5. Baca akun yang akan diubah. Ini juga menjawab "akun tidak ditemukan" kalau
  //    id-nya uuid yang benar tapi tidak ada di tabel profiles.
  //
  //    Data Auth (email) ikut dibaca supaya before/after di log lengkap, dan supaya
  //    respons bisa mengembalikan email yang sama seperti sebelumnya.
  const hasilBaca = await bacaAkunDenganAuth(idAkun);

  // Kegagalan membaca tabel profil adalah kegagalan sistem, bukan "akun tidak ada".
  // Kalau keduanya dicampur, masalah server yang sebenarnya akan tersembunyi di
  // belakang pesan "akun tidak ditemukan", dan tidak ada yang mencarinya di log.
  if (hasilBaca.gagal) {
    return balasAkunDariErrorDatabase(
      hasilBaca.gagal,
      "ubah akun (baca profil)",
    );
  }

  if (hasilBaca.akun === null) {
    return balasAkunGagal({
      type: "VALIDATION_FAILED",
      message: "Akun tidak ditemukan.",
    });
  }

  const akunSebelum = hasilBaca.akun;

  // 6. Lindungi akun Admin dan akun sendiri.
  const jagaAkun = jagaAkunYangBolehDikelola(
    { id: akunSebelum.id, role: akunSebelum.role },
    jaga.sesi.userId,
  );

  if (!jagaAkun.boleh) {
    return balasAkunGagal({ type: jagaAkun.tipe, message: jagaAkun.pesan });
  }

  // 7. Ubah akunnya.
  const hasil = await ubahAkun(
    idAkun,
    hasilValidasi.data,
    akunSebelum,
    jaga.sesi,
  );

  if (!hasil.berhasil) {
    return balasAkunGagal({ type: hasil.kode, message: hasil.pesan });
  }

  return balasAkunOk({ account: hasil.akun });
}

/**
 * Membaca satu akun beserta data Auth-nya.
 *
 * Input: id akun (uuid).
 * Output: objek dengan tepat satu dari tiga keadaan:
 *   - { akun: <AkunTampil>, gagal: null }: akun ditemukan,
 *   - { akun: null, gagal: null }: akun memang tidak ada,
 *   - { akun: null, gagal: <error> }:membaca profil gagal karena masalah server.
 *
 * KENAPA TIGA KEADAAN, BUKAN DUA: "akun tidak ada" adalah penolakan normal yang tidak
 * perlu dicatat, sedangkan "gagal membaca" adalah kegagalan sistem yang HARUS dicatat
 * (docs/api-contract.md bagian 6). Kalau keduanya jadi satu nilai null, kegagalan
 * sistem akan tersembunyi di balik pesan ramah dan tidak ada jejaknya.
 *
 * Data Auth diambil satu per akun di sini, bukan seperti di daftar (yang membaca
 * semuanya sekaligus). Alasannya: endpoint ini mengubah SATU akun, jadi membaca semua
 * pengguna Auth hanya untuk mengambil satu email hanya membuang-buang permintaan.
 *
 * Kegagalan membaca Auth TIDAK menggagalkan: akun tetap bisa dibuka tanpa email, karena
 * email hanyalah informasi tambahan dan bukan syarat untuk mengubah nama atau peran.
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
    // Profil benar-benar tidak ada: penolakan normal.
    return { akun: null, gagal: null };
  }

  // Data Auth bersifat opsional: kalau gagal dibaca, akunnya tetap bisa ditampilkan
  // tanpa email.
  const { data: dataAuth } = await getAdminClient().auth.admin.getUserById(id);

  return {
    akun: petakanSatuAkun(profil, dataAuth?.user ?? undefined),
    gagal: null,
  };
}
