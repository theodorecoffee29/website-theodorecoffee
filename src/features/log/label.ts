// File ini: logika MURNI untuk mengubah nilai dari database menjadi teks yang
// enak dibaca di halaman log Admin.
//
// Tanpa React, tanpa database, tanpa panggilan API, jadi bisa diuji langsung.
//
// Yang dikerjakan file ini:
//   1. Mengubah nama aksi dari database menjadi label ramah ("order.confirmed" jadi
//      "Order dikonfirmasi").
//   2. Mengubah tingkat, sumber, peran pelaku, dan jenis objek menjadi label ramah.
//   3. Menyusun kalimat pelaku dan kalimat objek untuk satu sel tabel.
//   4. Menormalkan kode error yang diketik Admin di kolom "Cari kode".
//
// KENAPA NILAI YANG TIDAK DIKENAL TIDAK DILEWATI: nama aksi, tingkat, dan sumber
// berasal dari database, dan nilainya bisa saja lebih baru daripada kode aplikasi ini
// (mis. ada aksi baru yang ditambahkan ke database tapi labelnya belum ditulis).
// Kalau nilai itu langsung ditulis mentah ke layar, Admin bisa melihat
// "undefined" atau nama kolom yang tidak dipahami. Jadi semua fungsi di sini punya
// teks cadangan yang menjelaskan apa yang tidak.dimengerti.
//
// CATATAN SOAL PERSAMAAN DAFTAR: daftar nilai enum (actor_role, severity, source,
// entity_type) diambil dari src/lib/enum-log.ts, yang dipakai bersama oleh server
// (validasi filter) dan browser (isi pilihan filter). Daftar label di teks.ts adalah
// padanannya. Tes memeriksa kedua daftar ini tidak berbeda.

import { teksLog } from "./teks";

// Bentuk label aksi yang dibaca dari teksLog.aksi.
type LabelAksi = Record<string, string>;

/**
 * Mengubah nama aksi dari database menjadi label ramah.
 *
 * Input: nama aksi dari database, misal "order.confirmed".
 * Output: kalimat yang tampil, misal "Order dikonfirmasi".
 *
 * Kalau nama aksinya tidak dikenal, nama itu sendiri dikembalikan. Alasan: nama aksi
 * masih berguna untuk mencari (Admin bisa mengetik nama aksi itu di kolom pencarian),
 * sedangkan menulis label dan nama asing sekaligus ("order.confirmed (Order
 * dikonfirmasi)") membuat baris tabel terlalu ramai. Bentuk tunggal ini dipilih supaya
 * tabel tetap ringkas.
 */
export function labelAksi(action: string): string {
  const daftar = teksLog.aksi as LabelAksi;
  const label = daftar[action];

  if (typeof label === "string" && label !== "") {
    return label;
  }

  // Aksi yang tidak dikenal: nama aksinya tampil apa adanya, persis seperti yang
  // diminta di tugas ini.
  // diminta: "Nama aksi yang tidak dikenal tampil apa adanya."
  return action;
}

/**
 * Mengubah tingkat keparahan dari database menjadi teks.
 *
 * Input: nilai severity dari database: "warning", "error", atau "critical".
 * Output: "Peringatan", "Error", atau "Kritis".
 *
 * Hasil SELALU berupa teks, bukan hanya warna. Ini supaya Admin bisa membedakan
 * "Peringatan" dari "Kritis" saat mencetak hitam-putih atau oleh orang yang sulit
 * membedakan warna.
 */
export function labelTingkat(severity: string): string {
  const daftar = teksLog.tingkat as Record<string, string>;
  const label = daftar[severity];

  if (typeof label === "string") {
    return label;
  }

  return daftar.tidakDiketahui;
}

/**
 * Mengubah sumber error dari database menjadi teks.
 *
 * Input: nilai source dari database: "client", "server", atau "database".
 * Output: "Browser", "Server", atau "Database".
 */
export function labelSumber(source: string): string {
  const daftar = teksLog.sumber as Record<string, string>;
  const label = daftar[source];

  if (typeof label === "string") {
    return label;
  }

  return daftar.tidakDiketahui;
}

/**
 * Mengubah peran pelaku dari database menjadi teks.
 *
 * Input: nilai actor_role dari database. Untuk log AKTIVITAS, nilainya bisa "customer"
 *        atau "system", yang tidak punya akun.
 * Output: "Admin", "Cashier", "Barista", "Customer", atau "Sistem".
 */
export function labelPeranPelaku(actorRole: string): string {
  const daftar = teksLog.peran as Record<string, string>;
  const label = daftar[actorRole];

  if (typeof label === "string") {
    return label;
  }

  return daftar.tidakDiketahui;
}

/**
 * Mengubah jenis objek dari database menjadi teks.
 *
 * Input: nilai entity_type dari database, misal "menu_item".
 * Output: "Menu".
 */
export function labelJenisObjek(entityType: string): string {
  const daftar = teksLog.objek as Record<string, string>;
  const label = daftar[entityType];

  if (typeof label === "string") {
    return label;
  }

  return daftar.tidakDiketahui;
}

/**
 * Menyusun kalimat pelaku untuk satu sel tabel.
 *
 * Input:
 *   - actorName: nama pelaku dari tabel profiles, atau string kosong.
 *   - actorRole: nilai actor_role dari database.
 * Output: kalimat siap tampil, misal "Budi (Cashier)", "Customer", atau
 *         "Sistem (nama tidak ditemukan)".
 *
 * TIGA KASUS YANG DIBEDAKAN:
 *   1. Ada nama: staff yang biasa, tampilkan nama dan perannya ("Budi (Cashier)").
 *   2. Tidak ada nama dan perannya customer atau system: itu normal, karena keduanya
 *      memang tidak punya akun (docs/data-model.md tabel activity_logs). Tampilkan
 *      perannya saja: "Customer" atau "Sistem".
 *   3. Tidak ada nama tapi perannya staf: ini tidak normal. Akunnya mungkin sudah
 *      dihapus dari tabel profiles, atau barisnya salah. Diberi tahu supaya Admin
 *      tahu nama itu tidak hilang karena bug tampilan.
 */
export function kalimatPelaku(actorName: string, actorRole: string): string {
  const peran = labelPeranPelaku(actorRole);

  if (actorName !== "") {
    return teksLog.pelaku.bernama
      .replace("{nama}", actorName)
      .replace("{peran}", peran);
  }

  if (actorRole === "customer" || actorRole === "system") {
    return teksLog.pelaku.tanpaNama.replace("{peran}", peran);
  }

  return teksLog.pelaku.namaTidakAda.replace("{peran}", peran);
}

/**
 * Menyusun kalimat objek untuk satu sel tabel.
 *
 * Input: jenis objek (dari entity_type) dan id objek (dari entity_id).
 * Output: kalimat siap tampil, misal "Order 1234abcd" atau "Masuk dan akses".
 *
 * Id-nya dipotong jadi 8 karakter pertama supaya kolom tabel tidak lebar. Id penuhnya
 * tidak hilang: tombol "Lihat jejak order ini" memakai id itu.
 */
export function kalimatObjek(jenisObjek: string, entityId: string): string {
  const jenis = labelJenisObjek(jenisObjek);

  if (entityId === "") {
    return teksLog.objekTampil.tanpaId.replace("{jenis}", jenis);
  }

  return teksLog.objekTampil.denganId
    .replace("{jenis}", jenis)
    .replace("{id}", idPendek(entityId));
}

/**
 * Memotong id jadi 8 karakter pertama supaya mudah dibaca sekilas.
 *
 * Input: id penuh (uuid).
 * Output: 8 karakter pertama id, atau string kosong kalau id-nya kosong.
 *
 * Kenapa dipotong: kolom id di log biasanya uuid 36 karakter. Ditampilkan penuh, tabel jadi
 * lebar sekali dan barisnya berantakan. 8 karakter sudah cukup untuk membedakan dua
 * order.
 */
export function idPendek(id: string): string {
  return id.slice(0, teksLog.panjangIdPendek);
}

/**
 * Menormalkan kode error yang diketik Admin di kolom "Cari kode".
 *
 * Input: teks yang diketik Admin, boleh spasi dan huruf kecil.
 * Output: kode dalam huruf besar ("ERR-4F2A"), atau null kalau teksnya bukan kode.
 *
 * KENAPA HARUS DINORMALKAN: kode disimpan di database seperti yang dibuat helper log,
 * yaitu huruf besar semua ("ERR-4F2A"). Admin sering menyalin kode dari chat customer
 * yang tidak memasang Caps Lock ("err-4f2a"). Kalau tidak dinormalkan, pencarian
 * tidak akan menemukan apa pun dan Admin menyimpulkan kodenya salah.
 *
 * KENAPA null (bukan teks apa adanya): kode yang tidak berbentuk kode error tidak akan
 * menemukan apa pun, jadi lebih baik tidak dikirim sama sekali. Dengan begitu filter
 * lain (tanggal, tingkat) tetap bisa dipakai tanpa ikut gagal karena kode ketik
 * salah.
 *
 * Pola yang diterima: "ERR-" diikuti tepat 4 huruf atau angka (huruf besar maupun
 * kecil), sama persis dengan format di docs/logging.md bagian 5.
 */
export function normalisasiKodeCari(
  teks: string | null | undefined,
): string | null {
  if (teks === null || teks === undefined) {
    return null;
  }

  const bersih = teks.trim().toUpperCase();

  if (!/^ERR-[A-Z0-9]{4}$/.test(bersih)) {
    return null;
  }

  return bersih;
}

/**
 * Mengubah nilai jsonb dari log menjadi teks yang bisa ditampilkan.
 *
 * Input: nilai before/after/meta/context dari database (sudah dibersihkan dari nilai
 *        rahasia oleh server), atau null.
 * Output: teks JSON berformat dua baris, atau null kalau isinya kosong.
 *
 * Kenapa diformat di sini (bukan di komponen): komponen tampilan hanya boleh
 * menerima props, jadi pemformatan harus selesai di src/features/log/.
 *
 * Kenapa JSON.stringify dan bukan menulis objek jadi daftar: isinya jsonb yang bentuknya
 * bebas, jadi hanya format JSON yang bisa menampilkan isinya apa adanya.
 */
export function formatJsonTampil(nilai: unknown): string | null {
  if (nilai === null || nilai === undefined) {
    return null;
  }

  if (typeof nilai === "string" && nilai.trim() === "") {
    return null;
  }

  try {
    const teks = JSON.stringify(nilai, null, 2);

    // JSON.stringify bisa mengembalikan undefined untuk nilai yang tidak bisa
    // diubah jadi JSON (mis. fungsi), sehingga perlu dicek.
    if (teks === undefined) {
      return null;
    }

    return teks;
  } catch {
    // Data berputar (circular) atau tidak bisa diubah jadi JSON. Lebih baik
    // menampilkan "tidak ada isian" daripada membuat halaman error.
    return null;
  }
}
