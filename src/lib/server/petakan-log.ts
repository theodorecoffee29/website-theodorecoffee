// File ini: mengubah baris mentah dari tabel activity_logs dan error_logs menjadi
// bentuk camelCase yang dikirim ke browser untuk halaman log Admin.
//
// File ini melakukan tiga hal:
//
//   1. PEMETAAN NAMA KOLOM. Database memakai snake_case (actor_id, entity_type),
//      browser memakai camelCase (actorId, entityType). Pemetaan dilakukan di sini
//      supaya tidak ada nama kolom mentah yang bocor ke layar.
//
//   2. MENCOCOKKAN NAMA PELAKU. Kolom actor_id di log cuma berisi uuid. Supaya
//      Admin melihat nama ("Budi") dan bukan uuid, nama diambil dari tabel
//      profiles. Semua id dalam satu halaman dikumpulkan dulu, lalu dibaca dengan
//      SATU query. Kalau satu per baris, satu halaman 50 baris berarti 50 query
//      ke database, dan halaman log akan terasa sangat lambat.
//
//   3. MENYEMBUNYIKAN RAHASIA LAGI. Nilai before, after, meta, dan context sudah
//      dibersihkan ketika ditulis (logActivity dan logError memanggil
//      redactSecrets). Tapi halaman log dibaca dari browser, jadi nilainya perlu
//      dibersihkan satu kali lagi di sini. Alasannya: kalau di masa depan ada
//      baris lama yang ditulis sebelum aturan penyaringan ada, atau ada kode baru
//      yang menulis log tanpa lewat helper, nilainya akan ikut terlihat.
//      Ini lapisan kedua, bukan pengganti yang pertama (docs/logging.md bagian 6).
//
// KOLOM YANG TIDAK PERNAH DIKIRIM: file ini hanya mengambil kolom yang ada di
// kontrak. Tidak ada kolom lain yang ikut, termasuk kolom yang mungkin ditambahkan
// nanti. Ini supaya halaman log tidak pernah mengirim sesuatu yang tidak diminta.
//
// CATATAN SOAL redactSecrets: fungsi itu ada di @/lib/log, yang ditandai
// server-only (karena memegang kunci service role). File ini karena itu HANYA boleh
// dipakai di sisi server.

import { redactSecrets } from "@/lib/log";
import type { Json } from "@/lib/supabase/database.types";
import { ubahKeTeks } from "./ubah-ke-angka";

// ---------------------------------------------------------------------------
// Bentuk hasil untuk tampilan
// ---------------------------------------------------------------------------

// Satu baris log aktivitas, siap tampil.
export type BarisAktivitasTampil = {
  id: string;
  // Waktu kejadian, format timestamptz database (diformat jadi WIB di browser).
  at: string;
  // Nama aksi mentah dari database, misal "order.confirmed".
  action: string;
  // Id pelaku, atau string kosong kalau pelakunya customer atau sistem (keduanya
  // tidak punya akun, jadi tidak ada di tabel profiles).
  actorId: string;
  // Peran pelaku, dari tabel log (bukan dari profiles).
  actorRole: string;
  // Nama pelaku dari tabel profiles, atau string kosong.
  actorName: string;
  // Jenis objek yang berubah, misal "order".
  entityType: string;
  // Id objek, atau string kosong kalau tidak ada.
  entityId: string;
  // Id order kalau catatan ini berkaitan dengan satu pesanan.
  orderId: string;
  // Nilai sebelum perubahan (sudah dibersihkan dari nilai rahasia).
  before: Json | null;
  // Nilai sesudah perubahan (sudah dibersihkan).
  after: Json | null;
  // Konteks tambahan (sudah dibersihkan).
  meta: Json | null;
};

// Satu baris log error, siap tampil.
export type BarisErrorTampil = {
  id: string;
  at: string;
  // Kode pendek yang sama dengan yang pernah dilihat pengguna, misal "ERR-4F2A".
  code: string;
  // Tingkat keparahan dari database: warning / error / critical.
  severity: string;
  // Tempat error terjadi dari database: client / server / database.
  source: string;
  // Pesan teknis error. Ini yang dicari Admin di sistem.
  message: string;
  // Konteks teknis (sudah dibersihkan).
  context: Json | null;
  // Id akun yang bermasalah, boleh kosong.
  userId: string;
  // Id order yang berkaitan, boleh kosong.
  orderId: string;
};

// Bentuk baris mentah dari database. Field-nya ditulis satu per satu supaya kolom
// yang tidak dipilih di query tidak bisa bocor ke respons.
type BarisAktivitasDatabase = {
  id?: unknown;
  at?: unknown;
  actor_id?: unknown;
  actor_role?: unknown;
  action?: unknown;
  entity_type?: unknown;
  entity_id?: unknown;
  order_id?: unknown;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

type BarisErrorDatabase = {
  id?: unknown;
  at?: unknown;
  code?: unknown;
  severity?: unknown;
  source?: unknown;
  message?: unknown;
  context?: unknown;
  user_id?: unknown;
  order_id?: unknown;
};

// Peta nama pelaku. Key = actor_id, value = nama dari tabel profiles.
export type PetaNamaAktor = Map<string, string>;

/**
 * Menggabungkan hasil query profiles menjadi peta nama pelaku.
 *
 * Input:
 *   - daftarId: semua actor_id yang muncul di halaman ini (boleh kosong, dan
 *     boleh berisi duplikat).
 *   - barisProfiles: hasil query SELECT id, name FROM profiles WHERE id IN (...)
 * Output: PetaNamaAktor.
 *
 * KENAPA FUNGSI INI MENGAMBIL DAFTAR ID DAN MENERIMA HASIL QUERYNYA (bukan langsung
 * querying): supaya pemetaan baris tetap MURNI dan bisa diuji tanpa database.
 * Route handler yang.collect id, memanggil query satu kali, lalu mengoper hasilnya
 * ke sini.
 *
 * Cara kerja:
 *   1. Id dikumpulkan jadi satu daftar unik, supaya satu id yang muncul di banyak
 *      baris log hanya dikirim ke database sekali.
 *   2. Setiap baris profiles dimasukkan ke peta, dan nama kosong atau tidak terbaca
 *      TIDAK dimasukkan. Alasannya: baris log untuk customer dan sistem punya
 *      actor_id kosong, dan di peta itu tidak boleh ada entri yang namanya kosong,
 *      karena layar akan memakai "Customer" atau "Sistem".
 */
export function gabungNamaAktor(
  daftarId: string[],
  barisProfiles: unknown[],
): PetaNamaAktor {
  const peta: PetaNamaAktor = new Map();

  // Nama yang sudah dibaca, supaya id yang sama tidak dihitung dua kali.
  const idUnik = new Set<string>();
  for (const satuId of daftarId) {
    if (satuId !== "") {
      idUnik.add(satuId);
    }
  }

  for (const satu of barisProfiles) {
    if (satu === null || typeof satu !== "object") {
      continue;
    }

    const kolom = satu as Record<string, unknown>;
    const id = ubahKeTeks(kolom.id);
    const nama = ubahKeTeks(kolom.name);

    // Baris tanpa nama yang terbaca dilewati: lebih baik nama kosong (layar
    // menulis "Tidak diketahui") daripada nama yang ikut kosong.
    if (id === "" || nama === "") {
      continue;
    }

    peta.set(id, nama);
  }

  return peta;
}

/**
 * Memetakan satu baris activity_logs menjadi bentuk untuk tampilan.
 *
 * Input:
 *   - baris: baris mentah dari database.
 *   - petaNama: peta nama pelaku hasil gabungNamaAktor.
 * Output: BarisAktivitasTampil.
 *
 * Kenapa actor_name diambil dari peta: kolom log hanya menyimpan uuid, sedangkan
 * layar harus menampilkan nama.
 */
export function petakanBarisAktivitas(
  baris: BarisAktivitasDatabase,
  petaNama: PetaNamaAktor,
): BarisAktivitasTampil {
  const actorId = ubahKeTeks(baris.actor_id);

  return {
    id: ubahKeTeks(baris.id),
    at: ubahKeTeks(baris.at),
    action: ubahKeTeks(baris.action),
    actorId: actorId,
    actorRole: ubahKeTeks(baris.actor_role),
    // Nama mungkin tidak ada kalau actor_id kosong (customer, sistem) atau kalau
    // akunnya sudah dihapus dari tabel profiles.
    actorName: petaNama.get(actorId) ?? "",
    entityType: ubahKeTeks(baris.entity_type),
    entityId: ubahKeTeks(baris.entity_id),
    orderId: ubahKeTeks(baris.order_id),
    // before, after, dan meta dibersihkan satu kali lagi sebelum dikirim.
    before: bersihkanJson(baris.before),
    after: bersihkanJson(baris.after),
    meta: bersihkanJson(baris.meta),
  };
}

/**
 * Memetakan satu baris error_logs menjadi bentuk untuk tampilan.
 *
 * Input: baris mentah dari database.
 * Output: BarisErrorTampil.
 *
 * Baris log error tidak punya pelaku yang berupa akun, jadi tidak ada actorName
 * di sini. Yang ada adalah user_id: akun yang sedang bermasalah (bisa kosong).
 */
export function petakanBarisError(baris: BarisErrorDatabase): BarisErrorTampil {
  return {
    id: ubahKeTeks(baris.id),
    at: ubahKeTeks(baris.at),
    code: ubahKeTeks(baris.code),
    severity: ubahKeTeks(baris.severity),
    source: ubahKeTeks(baris.source),
    message: ubahKeTeks(baris.message),
    // context dibersihkan satu kali lagi sebelum dikirim.
    context: bersihkanJson(baris.context),
    userId: ubahKeTeks(baris.user_id),
    orderId: ubahKeTeks(baris.order_id),
  };
}

/**
 * Membersihkan nilai jsonb dari nilai rahasia sebelum dikirim ke browser.
 *
 * Input: nilai jsonb dari database (objek, array, teks, atau null).
 * Output: Json yang sudah bersih, atau null kalau aslinya kosong.
 *
 * KENAPA NULL DIJAGA SEBAGAI NULL: kunci JSON yang bernilai undefined akan HILANG
 * sama sekali saat respons dikirim. Kalau sebelum/after yang kosong jadi undefined,
 * bentuk responsnya berubah tergantung isi, dan browser harus memeriksa dua kasus.
 * null selalu ikut terkirim, jadi bentuk responsnya selalu sama.
 */
function bersihkanJson(nilai: unknown): Json | null {
  if (nilai === null || nilai === undefined) {
    return null;
  }

  return redactSecrets(nilai);
}
