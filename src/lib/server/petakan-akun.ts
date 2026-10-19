// File ini: menggabungkan data tabel profiles dengan data Supabase Auth
// (auth.users), lalu mengubahnya menjadi bentuk camelCase untuk browser.
//
// KENAPA HARUS DIGABUNG:
//
//   Tabel profiles (milik aplikasi) menyimpan nama, peran, dan status aktif.
//   Supabase Auth menyimpan email, kapan akun dibuat, dan kapan terakhir masuk.
//
//   Keduanya dibutuhkan supaya Admin bisa melihat daftar akun yang berguna: nama untuk
//   mengenali orang, email untuk saling mengidentifikasi, dan "terakhir masuk" untuk
//   melihat apakah akun itu masih dipakai. Tidak ada satu tabel yang menyimpan semuanya.
//
// KENAPA GABUNG DILAKUKAN SECARA EFISIEN:
//
//   auth.admin.listUsers() mengembalikan daftar pengguna DALAM SATU PEMINTAAN. Jadi
//   daftar Auth dibaca sekali, lalu setiap baris profiles dicocokkan dengan baris Auth
//   yang sama di dalam memori. Kalau tiap profil dicari satu per satu, satu daftar akun
//   berarti N permintaan jaringan, dan halaman akan terasa lambat.
//
// File ini MURNI (tanpa database dan tanpa memanggil Auth), jadi bisa diuji langsung.

import { ubahKeTeks } from "./ubah-ke-angka";

// Satu akun siap tampil.
export type AkunTampil = {
  id: string;
  name: string;
  // Email dari Supabase Auth. String kosong kalau baris Auth-nya tidak ditemukan
  // (mis. akun dibuat manual di luar aplikasi).
  email: string;
  // Peran dari tabel profiles: admin / cashier / barista.
  role: string;
  // true kalau akun boleh masuk.
  isActive: boolean;
  // Kapan akun dibuat, format timestamptz (diformat jadi WIB di browser).
  createdAt: string;
  // Kapan terakhir masuk, format timestamptz. String kosong kalau belum pernah masuk.
  lastSignInAt: string;
};

// Hasil pemetaan daftar akun, plus penanda kalau ada yang tidak lengkap.
export type HasilDaftarAkun = {
  accounts: AkunTampil[];
  // Jumlah akun yang tidak punya baris di Auth (atau sebaliknya). Disimpan supaya
  // Admin bisa diberi tahu tanpa mengubah bentuk respons yang sudah disepakati.
  tanpaDataAuth: number;
};

/**
 * Memetakan daftar akun dari dua sumber sekaligus.
 *
 * Input:
 *   - barisProfiles: baris dari tabel profiles (yang dibaca lewat klien admin).
 *   - penggunaAuth: array user dari auth.admin.listUsers().
 * Output: HasilDaftarAkun, sudah urut menurut nama.
 *
 * URUTAN: menurut nama (huruf besar-kecil diabaikan). Alasannya, daftar ini dibaca
 * manusia yang mencari orang tertentu, bukan diurutkan menurut waktu. Akun dengan
 * nama sama diurutkan lagi memakai id supaya urutannya tidak berubah-ubah setiap
 * kali daftar dimuat (yang membuat Admin bisa mengira daftar "berubah sendiri").
 *
 * KALAU ADA AKUN YANG TIDAK PASANGAN:
 *   Dua kemungkinan, dan keduanya ditampilkan, tidak disembunyikan:
 *     - ada di profiles tapi tidak di Auth: profil dibuat manual di luar aplikasi,
 *     - ada di Auth tapi tidak di profiles: akun dibuat di Supabase tanpa profil,
 *       dan orang itu SEBENARNYA tidak bisa masuk (ambilSesiStaf menolak profil yang
 *       tidak ada). Menampilkan akun seperti ini penting supaya Admin tahu ada yang
 *       perlu dibereskan.
 *   Jumlahnya dikembalikan di tanpaDataAuth supaya bisa dicatat sebagai peringatan.
 */
export function petakanDaftarAkun(
  barisProfiles: unknown,
  penggunaAuth: unknown,
): HasilDaftarAkun {
  const profiles = deret(barisProfiles);
  const auth = deret(penggunaAuth);

  // Peta id -> data Auth, supaya pencocokan di dalam memori (O(1) per akun) dan
  // bukan pencarian berulang di dalam array.
  const authPerId = new Map<string, Record<string, unknown>>();

  for (const satu of auth) {
    const kolom = objek(satu);
    const id = ubahKeTeks(kolom.id);

    if (id !== "") {
      authPerId.set(id, kolom);
    }
  }

  const accounts: AkunTampil[] = [];
  const idSudahDipakai = new Set<string>();
  let tanpaDataAuth = 0;

  // 1. Akun yang punya profil (kasus normal: semua akun dibuat lewat halaman ini).
  for (const satu of profiles) {
    const kolom = objek(satu);
    const id = ubahKeTeks(kolom.id);

    if (id === "") {
      continue;
    }

    const dataAuth = authPerId.get(id);
    if (dataAuth === undefined) {
      tanpaDataAuth += 1;
    }

    idSudahDipakai.add(id);
    accounts.push(petakanSatuAkun(kolom, dataAuth));
  }

  // 2. Akun yang HANYA ada di Auth (profilnya belum dibuat).
  for (const [id, kolomAuth] of authPerId) {
    if (idSudahDipakai.has(id)) {
      continue;
    }

    tanpaDataAuth += 1;
    accounts.push(petakanSatuAkun({ id: id }, kolomAuth));
  }

  return {
    accounts: urutkanNama(accounts),
    tanpaDataAuth: tanpaDataAuth,
  };
}

/**
 * Memetakan satu akun (satu baris profiles + satu baris Auth) menjadi bentuk
 * untuk tampilan.
 *
 * Input:
 *   - profil: baris profiles (unknown, boleh undefined kalau hanya ada data Auth).
 *   - auth: user dari Supabase Auth (unknown, boleh undefined kalau tidak ditemukan).
 * Output: AkunTampil.
 *
 * kedua parameter sengaja bertipe unknown: bentuk data dari database dan dari
 * Auth tidak dijamin, jadi pembacaan yang aman dilakukan di dalam fungsi ini
 * (lewat objek()). Dengan begitu pemanggil tidak perlu menebak atau memaksa bentuknya.
 *
 * Ekspor karena endpoint ubah/reset/nonaktif juga butuh memetakan SATU akun, dan
 * memanggil fungsi yang sama memastikan bentuknya tidak berbeda dari bentuk di daftar.
 *
 * CATATAN SOAL PASSWORD: objek user dari Supabase Auth TIDAK pernah memuat password
 * (Supabase menyimpannya sebagai hash, dan hash-nya tidak pernah dikembalikan ke
 * klien). Fungsi ini hanya mengambil email, created_at, dan last_sign_in_at, jadi tidak
 * ada hash yang bisa bocor lewat sini.
 */
export function petakanSatuAkun(profil: unknown, auth: unknown): AkunTampil {
  const kolomProfil = objek(profil);
  const kolomAuth = objek(auth);

  return {
    id: ubahKeTeks(kolomProfil.id),
    name: ubahKeTeks(kolomProfil.name),
    email: ubahKeTeks(kolomAuth.email),
    role: ubahKeTeks(kolomProfil.role),
    isActive: kolomProfil.is_active === true,
    createdAt: ubahKeTeks(kolomAuth.created_at),
    // Kosong kalau belum pernah masuk: layar menulis "Belum pernah".
    lastSignInAt: ubahKeTeks(kolomAuth.last_sign_in_at),
  };
}

/**
 * Mengurutkan daftar akun menurut nama.
 *
 * Input: daftar akun.
 * Output: daftar baru yang sudah terurut.
 *
 * Perbandingan memakai localeCompare dengan opsi basis dan sensitivitas, sehingga
 * "budi" dan "Budi" dianggap sama (dan tidak bergantian tempat setiap kali dimuat).
 */
function urutkanNama(daftar: AkunTampil[]): AkunTampil[] {
  return [...daftar].sort((satu, dua) => {
    const bandingkan = satu.name.localeCompare(dua.name, "id", {
      sensitivity: "base",
      numeric: true,
    });

    if (bandingkan !== 0) {
      return bandingkan;
    }

    // Nama sama: pakai id supaya urutannya tetap sama setiap kali dimuat.
    return satu.id.localeCompare(dua.id);
  });
}

/**
 * Mengubah nilai apa pun menjadi objek yang bisa dibaca dengan aman.
 *
 * Output: objek aslinya kalau memang objek biasa, atau objek kosong kalau bukan.
 */
function objek(nilai: unknown): Record<string, unknown> {
  if (nilai !== null && typeof nilai === "object" && !Array.isArray(nilai)) {
    return nilai as Record<string, unknown>;
  }

  return {};
}

/**
 * Mengubah nilai apa pun menjadi array.
 *
 * Output: array-nya kalau memang array, atau array kosong kalau bukan.
 */
function deret(nilai: unknown): unknown[] {
  return Array.isArray(nilai) ? nilai : [];
}
