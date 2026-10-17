// File ini: daftar nilai enum milik tabel log yang dipakai BOTH server dan browser.
//
// KENAPA FILE INI DIPISAH:
//   1. Nilai enum activity_logs.actor_role, error_logs.severity, dan
//      error_logs.source dibutuhkan di dua sisi:
//        - di server, untuk memvalidasi filter dari query string
//          (src/lib/server/validasi-log.ts),
//        - di browser, untuk mengisi pilihan filter di formulir log Admin.
//   2. Nilai enum untuk actor_role TIDAK bisa diambil dari src/lib/log, karena file
//      itu memakai klien admin (kunci service role) dan ditandai server-only. Kalau
//      modul itu diimpor ke kode browser, build Next.js GAGAL. Itu memang alat
//      pengaman supaya kunci rahasia tidak pernah sampai ke klien.
//   3. File ini murni: hanya konstanta dan tipe. Aman diimpor dari kedua sisi.
//
// PERSAMAAN DENGAN DOKUMEN DAN DATABASE (harus selalu sama):
//   - log_actor_role, error_severity, error_source diambil dari enum di migrasi
//     20261006020347_tables.sql, dan nilainya sama persis dengan yang tercatat di
//     docs/data-model.md (tabel activity_logs dan error_logs) serta
//     docs/logging.md bagian 4.
//
// KENAPA TIDAK ADA DAFTAR NAMA AKSI DI FILE INI: nama aksi sudah punya satu tempat
// resmi, yaitu ACTIVITY_ACTIONS di src/lib/log/index.ts (docs/logging.md bagian 6
// poin 6). Daftar aksi yang dipakai browser ada di src/features/log/teks.ts, dan
// pemeriksa tipe di file itu memastikan tidak ada aksi yang tertinggal.

// Nilai actor_role di tabel activity_logs. Berbeda dengan profiles.role: tabel ini
// punya dua nilai tambahan, yaitu "customer" dan "system", karena keduanya boleh
// melakukan aksi tanpa punya akun.
export const PERAN_LOG = [
  "admin",
  "cashier",
  "barista",
  "customer",
  "system",
] as const;

export type PeranLog = (typeof PERAN_LOG)[number];

// Nilai severity di tabel error_logs (docs/logging.md bagian 4).
export const TINGKAT_ERROR = ["warning", "error", "critical"] as const;

export type TingkatError = (typeof TINGKAT_ERROR)[number];

// Nilai source di tabel error_logs: di mana error itu terjadi.
export const SUMBER_ERROR = ["client", "server", "database"] as const;

export type SumberError = (typeof SUMBER_ERROR)[number];

// Nilai entity_type di tabel activity_logs (docs/data-model.md tabel activity_logs).
// Ditulis eksplisit supaya filter "jenis objek" di layar Admin tidak memakai teks
// bebas yang bisa typo.
export const JENIS_OBJEK_LOG = [
  "order",
  "payment",
  "menu_item",
  "recipe",
  "ingredient",
  "account",
  "report",
  "auth",
] as const;

export type JenisObjekLog = (typeof JENIS_OBJEK_LOG)[number];
