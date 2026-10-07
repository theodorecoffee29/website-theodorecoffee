// File ini: penjaga akses untuk endpoint yang hanya boleh dipakai staf
// (Cashier, Barista, Admin).
//
// Kenapa penjaga ini ada di server dan bukan hanya di halaman: setiap route
// handler bisa dipanggil langsung dari luar browser, jadi halaman yang
// tertutup belum tentu cukup. Di setiap route handler staf, fungsi
// jagaPeranStaf() dipanggil SEBELUM touching database.
//
// Cara kerja:
//   1. Baca sesi dari cookie lewat ambilSesiStaf() (dari tugas 2.7).
//      Fungsi itu sudah memverifikasi token, mengecek akun aktif, dan
//      mengambil peran dari tabel profiles. Jadi peran di sini bukan dari klien.
//   2. Kalau tidak ada sesi (belum login / akun nonaktif / profil belum ada),
//      jawabannya ditolak dengan UNAUTHENTICATED.
//   3. Kalau peran tidak termasuk peran yang diizinkan untuk endpoint ini,
//      jawabannya ditolak dengan FORBIDDEN, dan access.denied dicatat lewat
//      logActivity (sesuai docs/logging.md bagian 2 dan api-contract bagian 6).
//   4. Kalau lolos, fungsi mengembalikan id staf dan meta sesi supaya route
//      bisa mengirimkannya sebagai p_actor_id dan p_meta ke fungsi database.
//
// File ini sengaja mengembalikan hasil ("diizinkan" atau "ditolak") dan TIDAK
// langsung menulis respons HTTP. Dengan begitu mudah diuji tanpa server.

import { ambilSesiStaf, type SesiStaf } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";
import { logActivity } from "@/lib/log";

// Hasil penjagaan: kalau "diizinkan", iface berisi sesi staf. Kalau "ditolak",
// iface berisi tipe error dan pesan.
export type HasilJagaPeran =
  | { diizinkan: true; sesi: SesiStaf }
  | { diizinkan: false; tipe: "UNAUTHENTICATED" | "FORBIDDEN"; pesan: string };

/**
 * Memeriksa apakah staf yang sedang login boleh memakai sebuah endpoint.
 *
 * Input:
 *   - peranDiizinkan: peran yang BOLEH memakai endpoint ini.
 *   - namaEndpoint: nama endpoint, hanya untuk pesan log (misal "confirm_order").
 * Output: HasilJagaPeran.
 *
 * Contoh pemakaian: jagaPeranStaf(["cashier", "admin"], "konfirmasi order").
 */
export async function jagaPeranStaf(
  peranDiizinkan: AppRole[],
  namaEndpoint: string,
): Promise<HasilJagaPeran> {
  // 1. Baca sesi (sudah termasuk cek aktif + ambil peran dari profiles).
  const sesi = await ambilSesiStaf();

  // 2. Belum login / akun nonaktif / profil belum ada.
  if (!sesi) {
    return {
      diizinkan: false,
      tipe: "UNAUTHENTICATED",
      pesan: "Kamu harus masuk dulu.",
    };
  }

  // 3. Peran tidak cocok dengan endpoint ini: catat access.denied lalu tolak.
  if (!peranDiizinkan.includes(sesi.role)) {
    catatAksesDitolak(sesi, peranDiizinkan, namaEndpoint);
    return {
      diizinkan: false,
      tipe: "FORBIDDEN",
      pesan: "Kamu tidak punya izin untuk melakukan ini.",
    };
  }

  // 4. Lolos.
  return { diizinkan: true, sesi };
}

/**
 * Membentuk objek meta untuk fungsi database dari sesi staf.
 *
 * Input: sesi staf.
 * Output: objek meta yang isinya session_id kalau tersedia, supaya aktivitas
 *         dari satu akun di beberapa laptop masih bisa dibedakan.
 */
export function metaSesi(
  sesi: SesiStaf,
): { session_id: string } | Record<string, never> {
  if (sesi.sessionId) {
    return { session_id: sesi.sessionId };
  }
  return {};
}

/**
 * Mencatat percobaan memakai endpoint yang bukan haknya (access.denied).
 *
 * Input: sesi staf yang mencoba, peran yang diizinkan, dan nama endpoint.
 *
 * Pelaku adalah akunnya sendiri. Halaman yang dicoba disimpan di meta supaya
 * Admin bisa melihat siapa mencoba apa.
 */
function catatAksesDitolak(
  sesi: SesiStaf,
  peranDiizinkan: AppRole[],
  namaEndpoint: string,
): void {
  logActivity({
    action: "access.denied",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "auth",
    entityId: sesi.userId,
    meta: {
      endpoint: namaEndpoint,
      peranDiizinkan: peranDiizinkan.join(","),
      session_id: sesi.sessionId,
    },
  });
}
