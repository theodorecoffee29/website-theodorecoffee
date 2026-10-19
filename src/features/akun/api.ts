// File ini: pemanggil API untuk halaman Kelola Akun (/admin/akun), di browser.
//
// Semua panggilan melewati file ini, supaya hanya ada satu tempat yang tahu bentuk URL
// dan bentuk respons, setiap kegagalan ditangani di satu tempat, dan komponen tampilan
// tidak pernah memanggil API langsung (cuma menerima props).
//
// Endpoint yang dipakai:
//   GET   /api/admin/accounts            -> daftar akun
//   POST  /api/admin/accounts            -> membuat akun
//   PATCH /api/admin/accounts/[id]       -> mengubah nama dan peran
//   POST  /api/admin/accounts/[id]/active -> mengaktifkan atau menonaktifkan
//   POST  /api/admin/accounts/[id]/password -> menyetel password baru
//
// CATATAN SOAL PASSWORD: password hanya dikirim ke server saat membuat akun atau
// mengganti password, dan TIDAK PERNAH dibaca dari respons. Server memang tidak
// pernah mengirimkannya kembali (lihat src/app/api/admin/accounts/[id]/password/
// route.ts). Jadi password hanya ada di state tampilan selama Admin memakainya, dan
// di situ pun dihapus begitu selesai.

import type { AkunTampil } from "@/lib/server/petakan-akun";

export type { AkunTampil };

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server.
  type: string;
  // Pesan untuk ditampilkan.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong, tapi kalau ada
  // HARUS ditampilkan supaya Admin bisa mencarinya di error_logs
  // (docs/logging.md bagian 5).
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

// Isi form tambah akun.
export type DataBuatAkun = {
  name: string;
  email: string;
  role: string;
  password: string;
};

// Isi form ubah akun.
export type DataUbahAkun = {
  name: string;
  role: string;
};

/**
 * Mengambil daftar semua akun.
 *
 * Output: HasilApi berisi array akun, atau GagalApi.
 */
export async function ambilDaftarAkun(): Promise<HasilApi<AkunTampil[]>> {
  const hasil = await panggilApi<{ accounts?: AkunTampil[] }>(
    "/api/admin/accounts",
    { method: "GET" },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  // Server dijamin mengirim array, tapi dicek lagi supaya baris yang aneh tidak
  // membuat halaman error.
  return {
    berhasil: true,
    data: Array.isArray(hasil.data.accounts) ? hasil.data.accounts : [],
  };
}

/**
 * Membuat akun baru.
 *
 * Input: nama, email, peran, dan password.
 * Output: HasilApi berisi akun yang baru dibuat, atau GagalApi.
 */
export async function buatAkun(
  data: DataBuatAkun,
): Promise<HasilApi<AkunTampil>> {
  const hasil = await panggilApi<{ account: AkunTampil }>(
    "/api/admin/accounts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return { berhasil: true, data: hasil.data.account };
}

/**
 * Mengubah nama dan peran satu akun.
 *
 * Input: id akun dan data baru.
 * Output: HasilApi berisi akun setelah diubah, atau GagalApi.
 */
export async function ubahAkun(
  id: string,
  data: DataUbahAkun,
): Promise<HasilApi<AkunTampil>> {
  const hasil = await panggilApi<{ account: AkunTampil }>(
    "/api/admin/accounts/" + id,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return { berhasil: true, data: hasil.data.account };
}

/**
 * Mengaktifkan atau menonaktifkan satu akun.
 *
 * Input: id akun dan status baru (true = aktif).
 * Output: HasilApi berisi akun setelah diubah, atau GagalApi.
 */
export async function ubahStatusAkun(
  id: string,
  isActive: boolean,
): Promise<HasilApi<AkunTampil>> {
  const hasil = await panggilApi<{ account: AkunTampil }>(
    "/api/admin/accounts/" + id + "/active",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: isActive }),
    },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return { berhasil: true, data: hasil.data.account };
}

/**
 * Menyetel password baru untuk satu akun.
 *
 * Input: id akun dan password baru.
 * Output: HasilApi berisi id akun yang dipassword barunya, atau GagalApi.
 *
 * CATATAN: hasil ini TIDAK memuat password, dan memang tidak memuat apa pun soal
 * password. Admin sudah mengetik password itu sendiri, jadi tidak ada yang perlu
 * dikirim balik.
 */
export async function resetPasswordAkun(
  id: string,
  password: string,
): Promise<HasilApi<{ accountId: string }>> {
  return panggilApi("/api/admin/accounts/" + id + "/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: password }),
  });
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman, jadi
 *         error ditelan setelah dicatat ke console.error.
 *
 * CATATAN SOAL YANG DIKIRIM: pesan di sini sengaja dibuat oleh kode ini sendiri dan
 * HANYA berisi nama aksi, bukan isi formulir. Password, email, dan nama akun tidak
 * pernah ikut, karena konteks browser ini langsung ditulis ke tabel error_logs yang
 * tidak bisa dihapus (docs/logging.md bagian 6).
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_aksi_staf",
  message: string,
): Promise<void> {
  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: jenis, message: message }),
    });
  } catch (error) {
    console.error(
      "[src/features/akun/api] gagal mengirim log error ke server: " +
        String(error),
    );
  }
}

/**
 * Fungsi inti: melakukan satu panggilan fetch dan membaca format respons server.
 *
 * Input: URL dan opsi fetch.
 * Output: HasilApi. Fungsi ini TIDAK melempar error, semua masalah diubah jadi
 *         GagalApi supaya pemanggil tidak perlu try/catch.
 */
async function panggilApi<T>(
  url: string,
  opsi: RequestInit,
): Promise<HasilApi<T>> {
  let respons: Response;

  // 1. Panggil server. Ini bisa gagal karena jaringan.
  try {
    respons = await fetch(url, opsi);
  } catch (error) {
    console.error(
      "[src/features/akun/api] gagal memanggil " + url + ": " + String(error),
    );
    return {
      berhasil: false,
      error: {
        type: "INTERNAL_ERROR",
        message:
          "Tidak bisa menghubungi server. Periksa koneksi internet kamu.",
      },
    };
  }

  // 2. Baca isi respons sebagai JSON.
  let data: unknown;
  try {
    data = await respons.json();
  } catch (error) {
    console.error(
      "[src/features/akun/api] balasan " +
        url +
        " bukan JSON: " +
        String(error),
    );
    return {
      berhasil: false,
      error: {
        type: "INTERNAL_ERROR",
        message: "Terjadi kesalahan. Coba lagi.",
      },
    };
  }

  // 3. Bentuk respons server: { ok: true, data } atau { ok: false, error }.
  const bentukRespons = data as {
    ok?: boolean;
    data?: T;
    error?: { type?: string; message?: string; code?: string };
  };

  if (bentukRespons.ok === true) {
    return { berhasil: true, data: bentukRespons.data as T };
  }

  // 4. Server menolak permintaan. Pesan dari server dipakai apa adanya karena sudah
  //    ditulis ramah untuk pengguna (docs/api-contract.md bagian 1).
  const dariServer = bentukRespons.error ?? {};
  return {
    berhasil: false,
    error: {
      type: dariServer.type ?? "INTERNAL_ERROR",
      message: dariServer.message ?? "Terjadi kesalahan. Coba lagi.",
      code: dariServer.code,
    },
  };
}
