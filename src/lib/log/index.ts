// File ini: satu-satunya cara aplikasi menulis log (docs/logging.md bagian 6).
// Semua pencatatan log aktivitas dan log error harus lewat file ini, jangan
// membuat cara baru di tempat lain.
//
// Isi file ini:
//   1. redactSecrets: membuang nilai rahasia sebelum apa pun dicatat.
//   2. logError: menulis ke tabel error_logs dan membuat kode "ERR-xxxx".
//   3. logActivity: menulis ke activity_logs lewat fungsi database write_activity_log.
//
// File ini dipakai di sisi server saja, karena memakai klien admin (kunci
// service role).

import "server-only";

import { getAdminClient } from "../supabase/admin";
import type { Json } from "../supabase/database.types";
import type { Enums } from "../supabase/database.types";

// Nilai enum yang diambil dari tipe database, supaya tidak salah ketik.
type ErrorSeverity = Enums<"error_severity">;
type ErrorSource = Enums<"error_source">;
type LogActorRole = Enums<"log_actor_role">;

/**
 * Daftar nama aksi yang BOLEH dicatat, persis docs/logging.md bagian 2.
 *
 * Kenapa dibatasi daftar: supaya tidak ada aksi yang ditulis bebas. Aksi baru
 * harus ditambah ke daftar ini dulu (dan ke dokumennya) sebelum dipakai.
 * TypeScript membuat daftar ini jadi tipe, sehingga nama di luar daftar
 * ditolak saat ngetik kode.
 */
export const ACTIVITY_ACTIONS = [
  "order.created",
  "order.confirmed",
  "order.cancelled",
  "order.started",
  "order.finished",
  "payment.recorded",
  "payment.voided",
  "stock.deducted",
  "stock.restored",
  "stock.restocked",
  "stock.adjusted",
  "stock.negative",
  "menu.created",
  "menu.updated",
  "menu.deactivated",
  "recipe.updated",
  "account.created",
  "account.updated",
  "account.deactivated",
  "account.password_reset",
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "access.denied",
  "report.saved",
  "report.printed",
] as const;

// Tipe untuk nama aksi. Hanya bisa berisi salah satu nama di atas.
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

// ---------------------------------------------------------------------------
// 1. redactSecrets: membuang nilai rahasia sebelum dicatat
// ---------------------------------------------------------------------------

// Kata-kata yang menandai sebuah nilai sebagai rahasia. Kalau nama kunci di
// dalam data mengandung salah satu kata ini, nilainya dibuang.
const KATA_KUNCI_RAHASIA = [
  "password",
  "token",
  "apikey",
  "authorization",
  "secret",
  "service_role",
];

/**
 * Menghapus nilai rahasia dari data sebelum dicatat.
 *
 * Input: data bebas dalam bentuk objek biasa (Json).
 * Output: objek baru dengan nilai yang dianggap rahasia diganti teks
 *         "[DISEMBUNYIKAN]".
 *
 * Cara kerja: fungsi ini menelusuri objek/array. Untuk setiap kunci, kalau
 * nama kuncinya mengandung kata rahasia (misalnya "user_password" mengandung
 * "password"), nilainya diganti. Kalau sebuah nilainya adalah objek atau array
 * (bukan teks), fungsinya menelusuri ke dalam. Nama kuncinya ikut dibersihkan
 * juga supaya kuncinya yang mengandung "token" atau "secret" ikut disamarkan.
 */
export function redactSecrets(data: unknown): Json {
  return redaksiNilai(data) as Json;
}

// Fungsi bantu (internal) untuk menelusuri satu nilai. Dipisah supaya redactSecrets
// hanya punya satu tanda tangan yang jelas untuk pemanggil.
function redaksiNilai(nilai: unknown): unknown {
  // Primitif (teks, angka, boolean, null) tidak punya kunci, jadi dikembalikan
  // apa adanya.
  if (nilai === null || typeof nilai !== "object") {
    return nilai;
  }

  // Array: telusuri tiap elemennya satu per satu.
  if (Array.isArray(nilai)) {
    return nilai.map((elemen) => redaksiNilai(elemen));
  }

  // Objek biasa: periksa setiap kunci.
  const objekHasil: Record<string, Json> = {};
  for (const [kunci, isi] of Object.entries(nilai as Record<string, unknown>)) {
    // Kalau nama kunci menandai rahasia (huruf kecil semua biar aman),
    // ganti nilainya dengan teks penanda.
    const kunciBersih = kunci.toLowerCase();
    const adaKataRahasia = KATA_KUNCI_RAHASIA.some((kata) =>
      kunciBersih.includes(kata),
    );

    if (adaKataRahasia) {
      objekHasil[kunci] = "[DISEMBUNYIKAN]";
    } else {
      objekHasil[kunci] = redaksiNilai(isi) as Json;
    }
  }

  return objekHasil;
}

// ---------------------------------------------------------------------------
// 2. logError: menulis ke error_logs dan membuat kode ERR-xxxx
// ---------------------------------------------------------------------------

// Huruf dan angka yang boleh dipakai di kode ERR. Huruf I dan O serta angka 0
// dan 1 sengaja tidak dipakai supaya kode lebih mudah dibaca dan tidak tertukar
// dengan huruf/angka yang mirip.
const HURUF_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Membuat kode error pendek untuk ditampilkan ke pengguna.
 *
 * Format: "ERR-" + 4 karakter huruf besar/angka acak, contoh "ERR-4F2A".
 *
 * Cara kerja: untuk tiap posisi dari 4, ambil satu karakter acak dari
 * HURUF_KODE. Fungsi ini hanya menentukan bentuk kode, bukan nilai rahasianya,
 * jadi aman dipanggil kapan saja.
 */
export function buatKodeError(): string {
  let kode = "";
  for (let posisi = 0; posisi < 4; posisi++) {
    const indeksAcak = Math.floor(Math.random() * HURUF_KODE.length);
    kode += HURUF_KODE[indeksAcak];
  }
  return "ERR-" + kode;
}

/**
 * Parameter untuk menulis satu catatan error.
 */
export type LogErrorParams = {
  // Pesan teknis error (bukan pesan untuk pengguna). Ini yang dicari di log.
  message: string;
  // Seberapa serius: warning / error / critical (docs/logging.md bagian 4).
  severity: ErrorSeverity;
  // Di mana error terjadi: client / server / database.
  source: ErrorSource;
  // Konteks untuk mencari penyebab: nama file/fungsi, id order, id menu, dll.
  context?: Record<string, unknown>;
  // Id user yang sedang bermasalah (kalau ada).
  userId?: string;
  // Id order yang berkaitan (kalau ada).
  orderId?: string;
};

/**
 * Menulis satu baris ke tabel error_logs dan mengembalikan kode error.
 *
 * Input: LogErrorParams (pesan, tingkat keparahan, sumber, konteks, dll).
 * Output: kode "ERR-xxxx" supaya bisa ditampilkan ke pengguna.
 *
 * Aturan penting (docs/logging.md bagian 6 poin 4): kegagalan menulis log TIDAK
 * BOLEH membuat aksi utama gagal. Jadi fungsi ini tidak pernah melempar error;
 * kalau penulisan ke database gagal, cukup tulis ke console.error sebagai
 * cadangan, dan kode yang dikembalikan tetap dipakai di layar.
 */
export function logError(param: LogErrorParams): string {
  const kode = buatKodeError();

  // Buang nilai rahasia dari konteks sebelum dikirim ke database.
  const konteksBersih = redactSecrets(param.context ?? {});

  try {
    // Pakai admin client karena menulis ke error_logs harus lewat service role.
    const admin = getAdminClient();

    // Sengaja TIDAK await: penulisan log tidak boleh menghentikan alur.
    // Kalau gagal, error-nya ditangani di dalam blok catch di bawah.
    void admin
      .from("error_logs")
      .insert({
        code: kode,
        message: param.message,
        severity: param.severity,
        source: param.source,
        context: konteksBersih,
        user_id: param.userId ?? null,
        order_id: param.orderId ?? null,
      })
      .then(
        ({ error }) => {
          if (error) {
            // Pemanggilan selesai tapi database menolak. Laporkan lewat
            // console.error supaya tidak hilang begitu saja.
            console.error(
              "[src/lib/log] gagal menulis error_logs: " +
                kode +
                " | pesan: " +
                param.message +
                " | error: " +
                error.message,
            );
          }
        },
        (error: unknown) => {
          // Permintaannya sendiri gagal (jaringan, atau klien tidak siap).
          console.error(
            "[src/lib/log] gagal menulis error_logs: " +
              kode +
              " | pesan: " +
              param.message +
              " | error: " +
              String(error),
          );
        },
      );
  } catch (error) {
    // outermost: kalau menunggu sesi/pengaturan env gagal, tangkap juga.
    console.error(
      "[src/lib/log] gagal menyiapkan penulisan error_logs: " +
        kode +
        " | pesan: " +
        param.message +
        " | error: " +
        String(error),
    );
  }

  return kode;
}

// ---------------------------------------------------------------------------
// 3. logActivity: menulis ke activity_logs lewat fungsi database
// ---------------------------------------------------------------------------

/**
 * Parameter untuk menulis satu catatan aktivitas.
 */
export type LogActivityParams = {
  // Nama aksi. Harus salah satu dari ACTIVITY_ACTIONS.
  action: ActivityAction;
  // Peran pelaku: admin / cashier / barista / customer / system.
  actorRole: LogActorRole;
  // Id profil pelaku. Kosong untuk customer atau sistem (tidak punya akun).
  actorId?: string | null;
  // Objek yang berubah, misalnya "order" atau "report".
  entityType: string;
  // Id objek yang berubah (uuid), boleh kosong.
  entityId?: string | null;
  // Id order yang berkaitan, boleh kosong.
  orderId?: string | null;
  // Nilai sebelum objek berubah.
  before?: Json;
  // Nilai sesudah objek berubah.
  after?: Json;
  // Konteks tambahan, misalnya ID sesi/perangkat.
  meta?: Json;
};

/**
 * Menulis satu catatan aktivitas ke activity_logs lewat fungsi database
 * write_activity_log.
 *
 * Input: LogActivityParams (aksi, pelaku, objek yang berubah, nilai sebelum
 * dan sesudah, dll).
 * Output: void.
 *
 * Kenapa lewat Fungsi database dan bukan insert langsung: fungsi
 * write_activity_log sudah dikunci hanya untuk service_role (dari migrasi
 * bagian 1), dan menulis lewat fungsi ini membuat pencatatan selalu konsisten.
 *
 * Catatan: kegagalan menulis log aktivitas di lapisan aplikasi juga tidak
 * boleh menggagalkan aksi utama (docs/logging.md bagian 6 poin 4), jadi error
 * ditangani dan ditulis ke console.error sebagai cadangan.
 */
export function logActivity(param: LogActivityParams): void {
  // Buang nilai rahasia dari before, after, dan meta sebelum dikirim.
  const sebelumBersih = param.before ? redactSecrets(param.before) : null;
  const sesudahBersih = param.after ? redactSecrets(param.after) : null;
  const metaBersih = param.meta ? redactSecrets(param.meta) : null;

  // Argumen untuk fungsi write_activity_log. Tipe yang di-generate (dari
  // database.types.ts) menuliskan kolom yang boleh kosong sebagai wajib (string),
  // padahal di database kolom-kolom itu memang menerima null (actor_id kosong
  // untuk customer, dan seterusnya). Karena itu argumen di sini di-cast ke
  // bentuk yang dipakai supabase-js, supaya kita tetap boleh mengirim null
  // sesuai aturan database.
  const argumen = {
    p_actor_id: param.actorId ?? null,
    p_actor_role: param.actorRole,
    p_action: param.action,
    p_entity_type: param.entityType,
    p_entity_id: param.entityId ?? null,
    p_order_id: param.orderId ?? null,
    p_before: sebelumBersih,
    p_after: sesudahBersih,
    p_meta: metaBersih,
  };

  void getAdminClient()
    .rpc("write_activity_log", argumen as never)
    .then(
      ({ error }) => {
        if (error) {
          console.error(
            "[src/lib/log] gagal menulis activity_logs: " +
              param.action +
              " | error: " +
              error.message,
          );
        }
      },
      (error: unknown) => {
        console.error(
          "[src/lib/log] gagal menulis activity_logs: " +
            param.action +
            " | error: " +
            String(error),
        );
      },
    );
}
