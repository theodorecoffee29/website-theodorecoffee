// File ini: langkah-langkah server untuk mengelola akun Cashier dan Barista.
//
// File ini memanggil Supabase Auth (auth.admin.*) dan tabel profiles. Semua
// keputusan penting (urutan langkah, pembatalan kalau gagal, apa yang dicatat ke log)
// ada di sini, supaya route handler di src/app/api/admin/accounts/ tinggal merangkai
// dan fokus pada penjagaan peran serta validasi input.
//
// TIGA ATURAN YANG DITERAPKAN DI SINI:
//
// 1. PASSWORD TIDAK PERNAH DICATAT.
//    Nilai password hanya dikirim ke Supabase Auth untuk disimpan. Tidak ada satu pun
//    tempat di file ini (atau file lain di area ini) yang menuliskan password ke log,
//    ke console, atau ke respons. Ini berasal dari docs/logging.md bagian 6 poin 3,
//    dan bukan sekadar kehati-hatian: password yang bocor ke log berarti password itu
//    tersimpan permanen di sistem yang tidak bisa dihapus.
//
// 2. PENGGUNA BARU YANG GAGAL DIISIKI PROFILNYA HARUS DIHAPUS.
//    Kalau tidak, ada pengguna di Supabase Auth tanpa profil. Orang itu tidak akan
//    bisa masuk (ambilSesiStaf menolak profil yang tidak ada), tapi emailnya tetap
//    terpakai, sehingga Admin yang mencoba membuat akun dengan email sama akan
//    mendapat "email sudah dipakai" tanpa tahu kenapa.
//
// 3. NONAKTIF DAN AKTIF TIDAK BISA ATOMIK.
//    profiles.is_active dan status ban di Supabase Auth berada di dua sistem berbeda,
//    jadi tidak bisa diubah dalam satu transaksi. Urutannya dipilih supaya AKUN
//    SELALU AMAN walau langkah kedua gagal (penjelasan panjang ada di nonaktifkanAkun
//    dan aktifkanAkun).

import type { SesiStaf } from "@/lib/auth/session";
import { logActivity, logError } from "@/lib/log";
import { ambilDetailError } from "@/lib/errors";
import { metaSesi } from "@/lib/server/jaga-admin";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  detailErrorAuth,
  emailSudahDipakai,
  kunciRahasiaDitolak,
} from "./err-auth";
import type { AkunTampil } from "./petakan-akun";
import type { BuatAkunValidasi, UbahAkunValidasi } from "./validasi-akun";

// Nilai ban_duration yang berarti "dilarang tanpa akhir".
//
// Dipakai Supabase untuk memblokir masuk tanpa memakai pesan yang membocorkan alasan.
// Nilainya dipilih jauh di masa depan supaya tidak perlu diurus, jadi ban ini praktis
// permanen. Akun yang dinonaktifkan tetap bisa diaktifkan lagi (ban_duration "none").
const BAN_PERMANEN = "876000h";

// Pesan untuk kasus "email sudah dipakai".
export const PESAN_EMAIL_SUDAH_DIPAKAI = "Email sudah dipakai.";

// Bentuk hasil yang selalu berhasil.
export type HasilBerhasil = { berhasil: true };

// Bentuk hasil gagal. Tipe errornya hanya boleh salah satu dari daftar di
// docs/api-contract.md bagian 6.
export type HasilGagal = {
  berhasil: false;
  kode: "VALIDATION_FAILED" | "INTERNAL_ERROR";
  pesan: string;
};

// Hasil pembuatan akun: membawa data akun barunya supaya layar bisa langsung
// menampilkannya tanpa memuat ulang daftar.
export type HasilBuatAkun = HasilBerhasil & { akun: AkunTampil };

/**
 * Membuat akun Cashier atau Barista baru.
 *
 * Input:
 *   - data: hasil validasi buatAkunSchema (name, email, role, password).
 *   - sesi: Admin yang sedang login (untuk mencatat log aktivitas).
 * Output: HasilBuatAkun kalau berhasil, atau HasilGagal.
 *
 * LANGKAH-LANGKAH:
 *   1. Buat pengguna di Supabase Auth dengan email_confirm true. Email konfirmasi
 *      TIDAK dikirim (createUser memang tidak mengirim email, berbeda dari
 *      inviteUserByEmail), karena aplikasi tidak punya layanan email dan passwordnya
 *      diberikan Admin secara langsung.
 *   2. Isi tabel profiles untuk pengguna itu (id, name, role, is_active true).
 *   3. Kalau langkah 2 gagal: hapus pengguna yang baru dibuat, catat logError, dan
 *      kembalikan INTERNAL_ERROR dengan kode ERR-xxxx.
 *   4. Kalau berhasil: catat account.created, lalu kembalikan data akun.
 */
export async function buatAkun(
  data: BuatAkunValidasi,
  sesi: SesiStaf,
): Promise<HasilBuatAkun | HasilGagal> {
  const klien = getAdminClient();

  // 1. Buat pengguna di Supabase Auth.
  const { data: dataAuth, error: errorAuth } =
    await klien.auth.admin.createUser({
      email: data.email,
      password: data.password,
      // Tandai email sudah terverifikasi tanpa mengirim email apa pun. Tanpa ini,
      // orang tidak bisa login karena harus konfirmasi lewat email yang tidak pernah
      // dikirim.
      email_confirm: true,
    });

  if (errorAuth || dataAuth === null || dataAuth.user === null) {
    return klasifikasiGagalAuth(errorAuth);
  }

  const idPengguna = dataAuth.user.id;

  // 2. Isi tabel profiles.
  //
  //    profiles.id memakai id yang sama dengan auth.users.id (docs/data-model.md
  //    bagian 2 tabel profiles), jadi tidak ada id baru yang perlu dibuat.
  const { error: errorProfil } = await klien.from("profiles").insert({
    id: idPengguna,
    name: data.name,
    role: data.role,
    is_active: true,
  });

  if (errorProfil) {
    // 3. Pengisian profil gagal: batalkan pengguna yang baru dibuat, lalu kembalikan
    //    kode errornya supaya layar bisa menampilkannya.
    const kode = await batalkanPenggunaBaru(
      idPengguna,
      data.email,
      errorProfil,
    );

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal membuat akun. Coba lagi. Kode: " + kode,
    };
  }

  // 4. Berhasil.
  const akun: AkunTampil = {
    id: idPengguna,
    name: data.name,
    email: data.email,
    role: data.role,
    isActive: true,
    createdAt: dataAuth.user.created_at ?? "",
    // Belum pernah masuk: layar menulis "Belum pernah".
    lastSignInAt: "",
  };

  logActivity({
    action: "account.created",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "account",
    entityId: idPengguna,
    meta: metaSesi(sesi),
    after: ringkasAkun(akun),
  });

  return { berhasil: true, akun: akun };
}

/**
 * Mengubah nama dan peran satu akun.
 *
 * Input:
 *   - id: id akun yang diubah.
 *   - data: hasil validasi ubahAkunSchema (name, role).
 *   - akunSebelum: data akun sebelum diubah (untuk before dan after di log).
 *   - sesi: Admin yang sedang login.
 * Output: HasilBuatAkun (akun sesudah diubah) atau HasilGagal.
 *
 * Tidak menyentuh Supabase Auth: nama dan peran disimpan di tabel profiles,
 * sedangkan email tetap milik Auth dan tidak diubah lewat halaman ini (mengubah
 * email berarti identitas akun berubah di mata pengguna, jadi tidak ada gunanya).
 */
export async function ubahAkun(
  id: string,
  data: UbahAkunValidasi,
  akunSebelum: AkunTampil,
  sesi: SesiStaf,
): Promise<HasilBuatAkun | HasilGagal> {
  const { error } = await getAdminClient()
    .from("profiles")
    .update({ name: data.name, role: data.role })
    .eq("id", id);

  if (error) {
    const kode = catatGagalDatabase("mengubah akun", error, sesi, id);

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal mengubah akun. Coba lagi. Kode: " + kode,
    };
  }

  const akunSesudah: AkunTampil = {
    ...akunSebelum,
    name: data.name,
    role: data.role,
  };

  logActivity({
    action: "account.updated",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "account",
    entityId: id,
    meta: metaSesi(sesi),
    before: ringkasAkun(akunSebelum),
    after: ringkasAkun(akunSesudah),
  });

  return { berhasil: true, akun: akunSesudah };
}

/**
 * Menonaktifkan satu akun.
 *
 * Input: id akun, sesi Admin, dan data akun sebelum dinonaktifkan.
 * Output: HasilBerhasil atau HasilGagal.
 *
 * URUTAN LANGKAH DAN ALASANNYA (bagian paling penting dari file ini):
 *
 *   Langkah 1: profiles.is_active = false  (DULU)
 *   Langkah 2: ban_duration di Supabase Auth = permanen
 *
 *   Kenapa profil DULU: pemeriksaan is_active dilakukan di ambilSesiStaf, yang dipakai
 *   SETIAP halaman dan SETIAP permintaan. Jadi begitu langkah pertama selesai, orang
 *   itu langsung kehilangan akses ke aplikasi, walau langkah kedua belum berjalan.
 *   Urutan sebaliknya (Auth dulu, baru profil) punya jeda di mana orang itu masih
 *   bisa masuk ke Supabase Auth DAN masih terbaca aktif di aplikasi.
 *
 *   Kalau langkah 2 gagal: akunnya sudah ditolak aplikasinya (profil nonaktif), tapi
 *   status ban di Auth belum berubah. Ini dikembalikan sebagai INTERNAL_ERROR dengan
 *   keterangan JELAS bahwa akun sudah dinonaktifkan di aplikasi tapi belum di Auth,
 *   supaya Admin tahu akun itu belum aman sepenuhnya dan perlu dicoba lagi.
 *
 *   Kenapa tidak dibalik (cabut ban lalu gagal aktifkan)? Membalikkan berarti membuka
 *   akses yang baru saja ditutup, dan itu lebih berbahaya daripada akun yang masih
 *   boleh masuk lewat Auth tapi sudah ditolak aplikasinya.
 */
export async function nonaktifkanAkun(
  id: string,
  sesi: SesiStaf,
  akunSebelum: AkunTampil,
): Promise<HasilBerhasil | HasilGagal> {
  const klien = getAdminClient();

  // Langkah 1: nonaktifkan di aplikasi lebih dulu.
  const { error: errorProfil } = await klien
    .from("profiles")
    .update({ is_active: false })
    .eq("id", id);

  if (errorProfil) {
    // Belum ada yang berubah, jadi ini kegagalan biasa.
    const kode = catatGagalDatabase(
      "menonaktifkan akun",
      errorProfil,
      sesi,
      id,
    );

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal menonaktifkan akun. Coba lagi. Kode: " + kode,
    };
  }

  // Langkah 2: tandai tidak boleh masuk di Supabase Auth.
  const { error: errorAuth } = await klien.auth.admin.updateUserById(id, {
    ban_duration: BAN_PERMANEN,
  });

  if (errorAuth) {
    // Peringatan: akun sudah ditolak aplikasinya, tapi belum diblokir di Auth.
    catatGagalAuth(
      "menonaktifkan akun di Supabase Auth",
      errorAuth,
      sesi,
      id,
      // Catatan tambahan supaya Admin dan pemilik project tahu keadaan sebenarnya.
      "Profil sudah nonaktif, jadi akun sudah tidak bisa masuk lewat aplikasi. Ban di Supabase Auth belum aktif.",
    );

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan:
        "Akun sudah dinonaktifkan di aplikasi, tapi belum di Supabase Auth. Coba lagi.",
    };
  }

  logActivity({
    action: "account.deactivated",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "account",
    entityId: id,
    meta: metaSesi(sesi),
    before: ringkasAkun(akunSebelum),
    after: ringkasAkun({ ...akunSebelum, isActive: false }),
  });

  return { berhasil: true };
}

/**
 * Mengaktifkan kembali satu akun.
 *
 * Input: id akun, sesi Admin, dan data akun sebelum diaktifkan.
 * Output: HasilBerhasil atau HasilGagal.
 *
 * URUTAN LANGKAHNYA TERBALIK dari nonaktifkanAkun, dan alasannya sama:
 *
 *   Langkah 1: ban_duration di Supabase Auth = "none"  (DULU, cabut ban)
 *   Langkah 2: profiles.is_active = true
 *
 *   Kenapa Auth dulu: mencabut ban tidak memberi akses apa pun selama profilnya masih
 *   nonaktif, jadi langkah ini aman kalau langkah kedua gagal. Urutan sebaliknya
 *   (aktifkan profil dulu, baru cabut ban) punya jeda di mana profilnya sudah aktif
 *   tapi masuknya masih diblokir, dan kalau ban tidak pernah tercabut, akunnya jadi
 *   setengah aktif yang sulit dijelaskan.
 */
export async function aktifkanAkun(
  id: string,
  sesi: SesiStaf,
  akunSebelum: AkunTampil,
): Promise<HasilBerhasil | HasilGagal> {
  const klien = getAdminClient();

  // Langkah 1: cabut ban di Supabase Auth lebih dulu.
  const { error: errorAuth } = await klien.auth.admin.updateUserById(id, {
    // "none" adalah nilai khusus Supabase untuk mencabut ban.
    ban_duration: "none",
  });

  if (errorAuth) {
    // Belum ada yang berubah: ban masih aktif, jadi kegagalan biasa.
    catatGagalAuth("mengaktifkan akun di Supabase Auth", errorAuth, sesi, id);

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal mengaktifkan akun. Coba lagi.",
    };
  }

  // Langkah 2: aktifkan di aplikasi.
  const { error: errorProfil } = await klien
    .from("profiles")
    .update({ is_active: true })
    .eq("id", id);

  if (errorProfil) {
    // Peringatan: ban sudah tercabut, tapi aplikasi masih menolak akunnya.
    catatGagalDatabase(
      "mengaktifkan akun di aplikasi (ban Auth sudah tercabut)",
      errorProfil,
      sesi,
      id,
    );

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan:
        "Ban di Supabase Auth sudah tercabut, tapi akun belum aktif di aplikasi. Coba lagi.",
    };
  }

  logActivity({
    // account.updated, dan bukan aksi terpisah: dari user, mengaktifkan kembali akun
    // memang bagian dari mengelola akun, bukan kejadian yang perlu dibedakan.
    action: "account.updated",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "account",
    entityId: id,
    meta: metaSesi(sesi),
    before: ringkasAkun(akunSebelum),
    after: ringkasAkun({ ...akunSebelum, isActive: true }),
  });

  return { berhasil: true };
}

/**
 * Menyetel password baru untuk satu akun.
 *
 * Input: id akun, password baru, sesi Admin, dan data akun sebelum.
 * Output: HasilBerhasil atau HasilGagal.
 *
 * TIDAK ADA YANG DISIMPAN DI profiles: password hanya milik Supabase Auth.
 *
 * CATATAN PENTING SOAL LOG: password baru TIDAK ikut dicatat, meskipun yang berubah
 * adalah password. before dan after sengaja dibuat sama (keduanya ringkasan akun
 * tanpa password), jadi dari log activity orang tidak bisa melihat bahwa password
 * baru sudah disetel, hanya bahwa ada aksi reset pada akun itu. Ini memang
 * disengaja: log tidak boleh memberi informasi apa pun soal password.
 */
export async function resetPasswordAkun(
  id: string,
  passwordBaru: string,
  sesi: SesiStaf,
  akunSebelum: AkunTampil,
): Promise<HasilBerhasil | HasilGagal> {
  const { error } = await getAdminClient().auth.admin.updateUserById(id, {
    password: passwordBaru,
  });

  if (error) {
    catatGagalAuth("menyetel password baru", error, sesi, id);

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal menyetel password baru. Coba lagi.",
    };
  }

  logActivity({
    action: "account.password_reset",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "account",
    entityId: id,
    meta: metaSesi(sesi),
    before: ringkasAkun(akunSebelum),
    after: ringkasAkun(akunSebelum),
  });

  return { berhasil: true };
}

/**
 * Membatalkan pengguna yang barusan dibuat kalau pengisian profilnya gagal.
 *
 * Input: id pengguna di Auth, email-nya, dan error dari pengisian profil.
 * Output: kode ERR-xxxx dari kegagalan yang dicatat, supaya bisa ditampilkan ke layar.
 *
 * Kenapa penghapusan ini penting: tanpa itu, email tersebut sudah tercatat di
 * Supabase Auth sementara di aplikasi tidak ada akunnya. Setelahnya, Admin yang
 * mencoba membuat akun dengan email sama akan mendapat "email sudah dipakai" tanpa
 * penjelasan, dan email itu hanya bisa dibebaskan lewat dashboard Supabase.
 *
 * Kegagalan penghapusan juga dicatat, karena kalau sampai terjadi, Admin perlu tahu
 * ada email yang terkunci begitu.
 */
async function batalkanPenggunaBaru(
  idPengguna: string,
  email: string,
  errorProfil: unknown,
): Promise<string> {
  const { error: errorHapus } =
    await getAdminClient().auth.admin.deleteUser(idPengguna);

  const detailProfil = ambilDetailError(errorProfil);

  // Penghapusan berhasil: tetap kegagalan sistem (bukan warning), karena berarti ada
  // operasi setengah selesai yang sempat meninggalkan pengguna tanpa profil.
  if (errorHapus === null || errorHapus === undefined) {
    return logError({
      message:
        "Pengisian profil akun gagal, pengguna Auth sudah dihapus. Email: " +
        email,
      severity: "error",
      source: "database",
      context: {
        konteks: "buat akun (profil gagal, pengguna dihapus)",
        // Email aman dicatat (bukan rahasia) dan berguna supaya Admin tahu email mana
        // yang perlu dibebaskan lewat dashboard Supabase.
        email: email,
        userId: idPengguna,
        errorProfil: detailProfil.message,
      },
    });
  }

  // Penghapusan GAGAL: ini yang paling perlu diwaspadai, jadi severity-nya critical
  // (docs/logging.md bagian 4: data berisiko tidak konsisten).
  const detailHapus = ambilDetailError(errorHapus);

  return logError({
    message:
      "Pengisian profil akun gagal DAN pengguna Auth tidak bisa dihapus, email mungkin " +
      "terkunci. Email: " +
      email +
      " | " +
      detailHapus.message,
    severity: "critical",
    source: "server",
    context: {
      konteks: "buat akun (profil gagal, penghapusan gagal)",
      email: email,
      userId: idPengguna,
      errorProfil: detailProfil.message,
      errorHapus: detailHapus.message,
    },
  });
}

/**
 * Mengubah kegagalan dari Supabase Auth menjadi alasan yang aman dikirim ke browser.
 *
 * Input: error dari auth.admin.*.
 * Output: HasilGagal.
 *
 * Tiga kasus yang dibedakan:
 *   - Email sudah dipakai: VALIDATION_FAILED dengan pesan ramah. Penolakan bisnis yang
 *     normal, jadi TIDAK dicatat ke error_logs (docs/api-contract.md bagian 6).
 *   - Kunci server ditolak: INTERNAL_ERROR dengan kode ERR-xxxx, dan dicatat dengan
 *     severity critical supaya mudah dicari.
 *   - Selain itu: INTERNAL_ERROR biasa yang dicatat sebagai kegagalan sistem.
 */
function klasifikasiGagalAuth(error: unknown): HasilGagal {
  // Tidak ada error tapi tidak juga pengguna: ini kondisi tak terduga.
  if (error === null || error === undefined) {
    const kode = logError({
      message:
        "auth.admin.createUser tidak mengembalikan pengguna maupun error. Ini kondisi tak terduga.",
      severity: "error",
      source: "server",
      context: { konteks: "buat akun" },
    });

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Gagal membuat akun. Coba lagi. Kode: " + kode,
    };
  }

  // Email sudah dipakai: penolakan normal, tidak perlu kode error.
  if (emailSudahDipakai(error)) {
    return {
      berhasil: false,
      kode: "VALIDATION_FAILED",
      pesan: PESAN_EMAIL_SUDAH_DIPAKAI,
    };
  }

  // Kunci server ditolak. TINDAKAN YANG BENAR ADALAH BERHENTI DAN LAPORKAN: jangan
  // mengganti kunci, jangan membaca .env.local, dan jangan mencoba permintaan lain.
  // Memutar di sini hanya menyembunyikan masalah yang harus diperbaiki pemilik project.
  if (kunciRahasiaDitolak(error)) {
    const detail = detailErrorAuth(error);

    const kode = logError({
      message:
        "Supabase Admin API menolak kunci server saat membuat akun. Hentikan dan " +
        "periksa konfigurasi kunci service role di environment variable. Detail: " +
        detail.message,
      // critical: seluruh fitur yang memakai Admin API akan gagal, bukan hanya fitur ini.
      severity: "critical",
      source: "server",
      context: {
        konteks: "buat akun",
        authCode: detail.code,
        authStatus: detail.status,
        authMessage: detail.message,
      },
    });

    return {
      berhasil: false,
      kode: "INTERNAL_ERROR",
      pesan: "Server ditolak oleh Supabase. Kode: " + kode,
    };
  }

  // Kegagalan lain: dicatat sebagai kegagalan sistem, dengan kode ERR-xxxx.
  const detail = detailErrorAuth(error);

  const kode = logError({
    message: "Gagal membuat pengguna Auth: " + detail.message,
    severity: "error",
    source: "server",
    context: {
      konteks: "buat akun",
      authCode: detail.code,
      authStatus: detail.status,
      authMessage: detail.message,
    },
  });

  return {
    berhasil: false,
    kode: "INTERNAL_ERROR",
    pesan: "Gagal membuat akun. Coba lagi. Kode: " + kode,
  };
}

/**
 * Menuliskan kegagalan yang berasal dari tabel profiles.
 *
 * Input: keterangan sedang apa yang gagal, error, sesi Admin, id akun, dan catatan
 *        tambahan (opsional, untuk menjelaskan keadaan kalau langkah lain SUDAH
 *        berhasil).
 * Output: kode ERR-xxxx, supaya bisa ditampilkan ke layar.
 *
 * Fungsi ini TIDAK punya parameter password, sehingga ada yang secara struktur tidak
 * bisa mengirim password ke log dari sini.
 */
function catatGagalDatabase(
  keterangan: string,
  error: unknown,
  sesi: SesiStaf,
  idAkun: string,
  catatanTambahan?: string,
): string {
  const detail = ambilDetailError(error);

  return logError({
    message: "Gagal " + keterangan + " di tabel profiles: " + detail.message,
    severity: "error",
    source: "database",
    context: {
      konteks: keterangan,
      accountId: idAkun,
      ...(catatanTambahan === undefined ? {} : { catatan: catatanTambahan }),
      message: detail.message,
      code: detail.code,
    },
    userId: sesi.userId,
  });
}

/**
 * Menuliskan kegagalan yang berasal dari Supabase Auth.
 *
 * Input: keterangan sedang apa yang gagal, error, sesi Admin, id akun, dan catatan
 *        tambahan (opsional).
 * Output: kode ERR-xxxx.
 *
 * Fungsi ini juga TIDAK punya parameter password, dengan alasan yang sama seperti
 * catatGagalDatabase.
 */
function catatGagalAuth(
  keterangan: string,
  error: unknown,
  sesi: SesiStaf,
  idAkun: string,
  catatanTambahan?: string,
): string {
  const detail = detailErrorAuth(error);

  return logError({
    message: "Gagal " + keterangan + " di Supabase Auth: " + detail.message,
    severity: "error",
    source: "server",
    context: {
      konteks: keterangan,
      accountId: idAkun,
      ...(catatanTambahan === undefined ? {} : { catatan: catatanTambahan }),
      authCode: detail.code,
      authStatus: detail.status,
      authMessage: detail.message,
    },
    userId: sesi.userId,
  });
}

/**
 * Membentuk objek log before/after untuk satu akun.
 *
 * Input: data akun.
 * Output: objek dengan HANYA nama, peran, email, dan status aktif.
 *
 * Ini satu-satunya tempat yang membentuk before/after untuk log akun, jadi ada satu
 * tempat yang harus diawasi kalau suatu saat ada field baru. Field yang tidak ada di
 * sini tidak akan pernah masuk ke log, dan password tidak akan pernah punya tempat
 * untuk masuk.
 */
function ringkasAkun(akun: AkunTampil): Json {
  return {
    name: akun.name,
    role: akun.role,
    email: akun.email,
    isActive: akun.isActive,
  };
}
