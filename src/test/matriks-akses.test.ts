// Tes matriks akses seluruh route API dan halaman (tugas audit keamanan 8.1).
//
// Tugas tes ini:
//   1. Menyalin aturan "siapa boleh apa" dari docs/pemissions.md bagian 2
//      menjadi daftar elektronik, lalu memeriksanya dengan PENJAGA YANG DITIRU.
//   2. Menjadi PENGAMAN: kalau ada berkas route.ts atau page.tsx BARU di
//      src/app yang belum terdaftar di matriks ini, tes ini GAGAL. Dengan
//      begitu route baru tidak pernah lolos tanpa aturan akses yang ditulis
//      dulu di sini.
//
// CARA KERJA (penting untuk dipahami sebelum mengubah tes ini):
//   - Route API: penjaganya DITIRU dengan menyalin perilaku
//     jagaPeranStaf()/jagaPeranAdmin() (src/lib/server/jaga-peran.ts):
//     tanpa sesi -> UNAUTHENTICATED, peran tidak diizinkan -> FORBIDDEN,
//     selain itu -> LOLOS. Daftar peran yang diizinkan DIBACA dari isi berkas
//     route-nya sendiri di disk, jadi kalau penjaga suatu route diubah, tes
//     ini otomatis ikut berubah dan ketidakcocokan dengan dokumen ketahuan.
//   - Halaman: tes ini memakai fungsi ASLI peranBolehBukaPath() dari
//     src/lib/auth/roles.ts, jadi aturan halaman diuji sungguhan, bukan tiruan.
//
// Catatan: tes ini tidak menyentuh database dan tidak memanggil Supabase.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HALAMAN_PERAN, peranBolehBukaPath } from "@/lib/auth/roles";

// Peran yang dipakai di seluruh tes.
// "anonim" = pengunjung tanpa login (customer).
type Peran = "anonim" | "cashier" | "barista" | "admin";

// Hasil yang mungkin dari penjaga (sama dengan tipe error di
// docs/api-contract.md bagian 6).
type Hasil = "UNAUTHENTICATED" | "FORBIDDEN" | "LOLOS";

const SEMUA_PERAN: Peran[] = ["anonim", "cashier", "barista", "admin"];

// Folder src/test (berkas ini) dan folder src/app (tempat semua route/halaman).
const folderTest = path.dirname(fileURLToPath(import.meta.url));
const folderSrc = path.join(folderTest, "..");
const folderApp = path.join(folderSrc, "app");

// ---------------------------------------------------------------------------
// ALAT BACA: membaca isi berkas route/halaman dari disk.
// ---------------------------------------------------------------------------

/**
 * Membaca isi sebuah berkas di dalam src/app.
 *
 * Input: path relatif terhadap src/app, misal "api/orders/route.ts".
 * Output: isi berkas sebagai teks.
 */
function bacaBerkas(relatif: string): string {
  return fs.readFileSync(path.join(folderApp, relatif), "utf8");
}

/**
 * Mencari semua berkas dengan nama tertentu di dalam src/app (rakus).
 *
 * Input: nama berkas, misal "route.ts".
 * Output: daftar path relatif terhadap src/app, memakai garis miring "/",
 *         diurutkan supaya hasilnya konsisten antar sistem operasi.
 */
function cariBerkas(namaBerkas: string): string[] {
  const hasil: string[] = [];

  function jalan(folder: string): void {
    for (const entri of fs.readdirSync(folder, { withFileTypes: true })) {
      const penuh = path.join(folder, entri.name);
      if (entri.isDirectory()) {
        jalan(penuh);
      } else if (entri.name === namaBerkas) {
        hasil.push(penuh);
      }
    }
  }

  jalan(folderApp);
  return hasil
    .map((p) => path.relative(folderApp, p).split(path.sep).join("/"))
    .sort();
}

/**
 * Mengubah daftar peran menjadi teks yang mudah dibandingkan (urut tetap).
 */
function urut(daftar: readonly Peran[]): string {
  return [...daftar].sort().join(",");
}

// ---------------------------------------------------------------------------
// PEMBACA PENJAGA ROUTE: menyalin daftar peran dari isi berkas route.
// ---------------------------------------------------------------------------

/**
 * Mengubah isi "[...]" menjadi daftar peran.
 *
 * Input: teks di dalam kurung siku, misal `"cashier", "admin"`.
 * Output: daftar peran.
 * Kenapa pakai kecocokan kata: daftar peran selalu ditulis sebagai string
 * huruf kecil sesuai enum app_role, jadi cara ini cukup dan sederhana.
 */
function peranDariIsiKurung(isi: string, asal: string): Peran[] {
  const cocok = isi.match(/"(anonim|cashier|barista|admin)"/g);
  if (!cocok || cocok.length === 0) {
    throw new Error(
      `Tes matriks akses: daftar peran tidak terbaca di ${asal}. ` +
        `Perbarui parser di src/test/matriks-akses.test.ts.`,
    );
  }
  return cocok.map((t) => t.replace(/"/g, "")) as Peran[];
}

/**
 * Mengambil isi "const NAMA = [ ... ]" dari sebuah teks berkas.
 *
 * Input: teks berkas dan nama konstanta.
 * Output: teks di dalam kurung siku pertama yang cocok.
 */
function bacaIsiKonstanta(
  sumberBerkas: string,
  nama: string,
  asal: string,
): string {
  const pola = new RegExp(`const\\s+${nama}\\s*=\\s*\\[([^\\]]*)\\]`);
  const cocok = sumberBerkas.match(pola);
  if (!cocok) {
    throw new Error(
      `Tes matriks akses: konstanta "${nama}" tidak ditemukan di ${asal}. ` +
        `Perbarui matriks di src/test/matriks-akses.test.ts.`,
    );
  }
  return cocok[1];
}

/**
 * Membaca konstanta peran yang diimpor dari berkas lain (misalnya
 * PERAN_SISA_STOK dari src/lib/server/petakan-stok.ts).
 *
 * Input: isi berkas route, nama konstanta, nama berkas (untuk pesan error).
 * Output: teks isi konstanta tersebut.
 */
function bacaKonstantaImpor(
  sumberRoute: string,
  nama: string,
  relatifRoute: string,
): string {
  const pola = new RegExp(
    `import\\s*{[^}]*\\b${nama}\\b[^}]*}\\s*from\\s*"([^"]+)"`,
  );
  const cocok = sumberRoute.match(pola);
  if (!cocok || !cocok[1].startsWith("@/")) {
    throw new Error(
      `Tes matriks akses: impor "${nama}" tidak ditemukan di ` +
        `${relatifRoute}. Perbarui src/test/matriks-akses.test.ts.`,
    );
  }

  // Ubah "@/lib/server/petakan-stok" menjadi path src/lib/server/petakan-stok.
  const dasar = path.join(folderSrc, cocok[1].slice(2));
  const kandidat = [`${dasar}.ts`, `${dasar}.tsx`, path.join(dasar, "index.ts")];
  const ada = kandidat.find((p) => fs.existsSync(p));
  if (!ada) {
    throw new Error(
      `Tes matriks akses: berkas modul untuk "${nama}" tidak ditemukan ` +
        `(dicari di ${kandidat.join(", ")}).`,
    );
  }

  return bacaIsiKonstanta(fs.readFileSync(ada, "utf8"), nama, cocok[1]);
}

/**
 * Membaca penjaga peran yang DIPAKAI sebuah route, dari isi berkasnya.
 *
 * Input: path route relatif terhadap src/app.
 * Output: "anonim" kalau route tidak memakai penjaga peran sama sekali,
 *         atau daftar peran yang diizinkan (hasil dari jagaPeranAdmin /
 *         jagaPeranStaf).
 *
 * Kenapa dibaca dari berkas (bukan dari matriks): supaya tes ini tidak
 * sekadar mengulang apa yang tertulis di matriks. Kalau penjaga sebuah route
 * diubah di kode, hasil bacaan ini ikut berubah dan tes ketidakcocokan dengan
 * docs/pemissions.md akan menunjukkannya.
 */
function bacaPenjagaRoute(relatif: string): Peran[] | "anonim" {
  const sumber = bacaBerkas(relatif);

  // jagaPeranAdmin selalu berarti hanya ["admin"] (lihat jaga-admin.ts).
  if (/\bjagaPeranAdmin\s*\(/.test(sumber)) {
    return ["admin"];
  }

  const polaStaf = /\bjagaPeranStaf\(\s*\[([^\]]*)\]/;
  const cocok = sumber.match(polaStaf);
  if (!cocok) {
    if (/\bjagaPeranStaf\s*\(/.test(sumber)) {
      throw new Error(
        `Tes matriks akses: ${relatif} memanggil jagaPeranStaf tapi ` +
          `pola pemanggilannya tidak dikenali tes ini. Perbarui parser di ` +
          `src/test/matriks-akses.test.ts.`,
      );
    }
    return "anonim";
  }

  const isiArray = cocok[1];

  // Bentuk langsung: jagaPeranStaf(["cashier", "admin"], ...)
  if (isiArray.includes('"')) {
    return peranDariIsiKurung(isiArray, relatif);
  }

  // Bentuk spread: jagaPeranStaf([...PERAN_LAPORAN], ...) — nilai konstantanya
  // dicari dulu di berkas route yang sama, kalau tidak ada lewat impor.
  const spread = isiArray.match(/\.\.\.\s*(\w+)/);
  if (spread) {
    const namaKonstanta = spread[1];
    const isiKonstanta = sumber.includes(`const ${namaKonstanta}`)
      ? bacaIsiKonstanta(sumber, namaKonstanta, relatif)
      : bacaKonstantaImpor(sumber, namaKonstanta, relatif);
    return peranDariIsiKurung(isiKonstanta, `${relatif} (${namaKonstanta})`);
  }

  throw new Error(
    `Tes matriks akses: pola penjaga di ${relatif} tidak dikenali. ` +
      `Perbarui src/test/matriks-akses.test.ts.`,
  );
}

/**
 * Membaca metode HTTP yang diekspor sebuah berkas route.
 *
 * Input: path route relatif terhadap src/app.
 * Output: daftar metode, misal ["GET", "POST"], diurutkan.
 */
function metodeRoute(relatif: string): string[] {
  const sumber = bacaBerkas(relatif);
  const hasil = new Set<string>();

  for (const cocok of sumber.matchAll(
    /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g,
  )) {
    hasil.add(cocok[1]);
  }
  for (const cocok of sumber.matchAll(
    /export\s+const\s+(GET|POST|PATCH|PUT|DELETE)\s*[:=]/g,
  )) {
    hasil.add(cocok[1]);
  }

  return [...hasil].sort();
}

/**
 * Penjaga tiruan untuk route API: menyalin urutan pemeriksaan
 * jagaPeranStaf() (src/lib/server/jaga-peran.ts bagian 2 dan 3).
 *
 * Input: penjaga route ("anonim" atau daftar peran yang diizinkan) dan peran
 *        yang mencoba masuk.
 * Output: "UNAUTHENTICATED" (tanpa sesi), "FORBIDDEN" (peran salah), atau
 *         "LOLOS".
 */
function tiruanPenjagaRoute(
  penjaga: Peran[] | "anonim",
  peran: Peran,
): Hasil {
  // Route tanpa penjaga: siapa pun boleh, termasuk anonim.
  if (penjaga === "anonim") {
    return "LOLOS";
  }
  // Route berpenjaga: anonim tidak punya sesi sama sekali.
  if (peran === "anonim") {
    return "UNAUTHENTICATED";
  }
  return penjaga.includes(peran) ? "LOLOS" : "FORBIDDEN";
}

// ---------------------------------------------------------------------------
// MATRIKS ROUTE API
//
// bolehDokumen = aturan dari docs/pemissions.md bagian 2 (dan api-contract.md
//                bagian 3 untuk endpoint log-error yang tidak dibahas di
//                pemissions.md).
// penjagaRoute = penjaga yang sekarang ada di kode. Kalau keduanya berbeda,
//                route itu masuk daftar ketidakcocokanTercatat di bawah, jadi
//                perbedaannya terlihat eksplisit dan bisa dibahas (audit 8.1
//                MELAPORKAN, bukan memperbaiki).
// ---------------------------------------------------------------------------

type EntriRoute = {
  // Path relatif terhadap src/app, misal "api/orders/route.ts".
  berkas: string;
  // Alamat URL, misal "/api/orders". Untuk segmen dinamis memakai [id].
  alamat: string;
  metode: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  // Penjaga menurut docs/pemissions.md bagian 2.
  bolehDokumen: Peran[];
  // Penjaga yang benar-benar ada di kode (dicek ulang dari isi berkasnya).
  penjagaRoute: Peran[] | "anonim";
};

const ADMIN: Peran[] = ["admin"];
const BARISTA: Peran[] = ["barista"];
const KASIR_ADMIN: Peran[] = ["cashier", "admin"];
const KASIR_BARISTA_ADMIN: Peran[] = ["cashier", "barista", "admin"];
const SEMUA: Peran[] = ["anonim", "cashier", "barista", "admin"];

const matriksRoute: EntriRoute[] = [
  // --- Admin: akun ---
  { berkas: "api/admin/accounts/route.ts", alamat: "/api/admin/accounts", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/accounts/route.ts", alamat: "/api/admin/accounts", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/accounts/[id]/route.ts", alamat: "/api/admin/accounts/[id]", metode: "PATCH", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/accounts/[id]/active/route.ts", alamat: "/api/admin/accounts/[id]/active", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/accounts/[id]/password/route.ts", alamat: "/api/admin/accounts/[id]/password", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },

  // --- Admin: bahan dan stok ---
  { berkas: "api/admin/ingredients/route.ts", alamat: "/api/admin/ingredients", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/ingredients/route.ts", alamat: "/api/admin/ingredients", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/ingredients/[id]/route.ts", alamat: "/api/admin/ingredients/[id]", metode: "PATCH", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/ingredients/[id]/adjust/route.ts", alamat: "/api/admin/ingredients/[id]/adjust", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/ingredients/[id]/movements/route.ts", alamat: "/api/admin/ingredients/[id]/movements", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/ingredients/[id]/restock/route.ts", alamat: "/api/admin/ingredients/[id]/restock", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },

  // --- Admin: log (hanya baca) ---
  { berkas: "api/admin/logs/activity/route.ts", alamat: "/api/admin/logs/activity", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/logs/errors/route.ts", alamat: "/api/admin/logs/errors", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },

  // --- Admin: menu dan resep ---
  { berkas: "api/admin/menu/route.ts", alamat: "/api/admin/menu", metode: "GET", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/menu/route.ts", alamat: "/api/admin/menu", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/menu/[id]/route.ts", alamat: "/api/admin/menu/[id]", metode: "PATCH", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/menu/[id]/active/route.ts", alamat: "/api/admin/menu/[id]/active", metode: "POST", bolehDokumen: ADMIN, penjagaRoute: ADMIN },
  { berkas: "api/admin/menu/[id]/recipe/route.ts", alamat: "/api/admin/menu/[id]/recipe", metode: "PUT", bolehDokumen: ADMIN, penjagaRoute: ADMIN },

  // --- Barista ---
  { berkas: "api/barista/queue/route.ts", alamat: "/api/barista/queue", metode: "GET", bolehDokumen: BARISTA, penjagaRoute: BARISTA },
  { berkas: "api/barista/orders/[id]/start/route.ts", alamat: "/api/barista/orders/[id]/start", metode: "POST", bolehDokumen: BARISTA, penjagaRoute: BARISTA },
  { berkas: "api/barista/orders/[id]/finish/route.ts", alamat: "/api/barista/orders/[id]/finish", metode: "POST", bolehDokumen: BARISTA, penjagaRoute: BARISTA },

  // --- Cashier ---
  { berkas: "api/cashier/orders/route.ts", alamat: "/api/cashier/orders", metode: "GET", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/cashier/orders/route.ts", alamat: "/api/cashier/orders", metode: "POST", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/cashier/orders/[id]/confirm/route.ts", alamat: "/api/cashier/orders/[id]/confirm", metode: "POST", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/cashier/orders/[id]/cancel/route.ts", alamat: "/api/cashier/orders/[id]/cancel", metode: "POST", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },

  // --- Sisa stok (Cashier, Barista, Admin) ---
  { berkas: "api/staff/stock/route.ts", alamat: "/api/staff/stock", metode: "GET", bolehDokumen: KASIR_BARISTA_ADMIN, penjagaRoute: KASIR_BARISTA_ADMIN },

  // --- Laporan (Cashier, Admin) ---
  { berkas: "api/reports/route.ts", alamat: "/api/reports", metode: "GET", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/reports/today/route.ts", alamat: "/api/reports/today", metode: "GET", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/reports/today/printed/route.ts", alamat: "/api/reports/today/printed", metode: "POST", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/reports/[id]/route.ts", alamat: "/api/reports/[id]", metode: "GET", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },
  { berkas: "api/reports/[id]/printed/route.ts", alamat: "/api/reports/[id]/printed", metode: "POST", bolehDokumen: KASIR_ADMIN, penjagaRoute: KASIR_ADMIN },

  // --- Endpoint customer (tanpa login) ---
  // Semua route ini TIDAK punya penjaga peran; yang menjaga adalah kombinasi
  // pembatas permintaan + validasi id uuid + aturan di dalam fungsi database.
  { berkas: "api/menu/route.ts", alamat: "/api/menu", metode: "GET", bolehDokumen: SEMUA, penjagaRoute: "anonim" },
  { berkas: "api/orders/route.ts", alamat: "/api/orders", metode: "POST", bolehDokumen: ["anonim"], penjagaRoute: "anonim" },
  { berkas: "api/orders/[id]/status/route.ts", alamat: "/api/orders/[id]/status", metode: "GET", bolehDokumen: ["anonim"], penjagaRoute: "anonim" },
  { berkas: "api/orders/[id]/cancel/route.ts", alamat: "/api/orders/[id]/cancel", metode: "POST", bolehDokumen: ["anonim", "cashier", "admin"], penjagaRoute: "anonim" },
  // log-error tidak dibahas di docs/pemissions.md; acuannya api-contract.md
  // bagian 3: "Anonim dan staf (dibatasi)".
  { berkas: "api/log-error/route.ts", alamat: "/api/log-error", metode: "POST", bolehDokumen: SEMUA, penjagaRoute: "anonim" },
];

/**
 * Ketidakcocokan antara penjaga di KODE dengan docs/pemissions.md bagian 2
 * yang sudah diketahui dan dicatat (audit keamanan 8.1 melaporkan, tidak
 * memperbaiki).
 *
 * Aturan tesnya: daftar ketidakcocokan yang TERJADI di lapangan harus persis
 * daftar ini. Kalau muncul ketidakcocokan BARU, tes gagal. Kalau salah satu
 * ketidakcocokan di sini sudah diperbaiki di kode, tes juga gagal — supaya
 * entri ini tidak basi dan harus dihapus.
 */
const ketidakcocokanTercatat: { kunci: string; alasan: string }[] = [
  {
    kunci: "POST /api/orders",
    alasan:
      "docs/pemissions.md bagian 2: buat order online hanya Customer. " +
      "Route tidak punya penjaga peran, jadi staf yang login pun ikut lolos.",
  },
  {
    kunci: "GET /api/orders/[id]/status",
    alasan:
      "docs/pemissions.md bagian 2: lihat status order hanya Customer. " +
      "Route tidak punya penjaga peran, jadi staf yang login pun ikut lolos.",
  },
  {
    kunci: "POST /api/orders/[id]/cancel",
    alasan:
      "docs/pemissions.md bagian 2: pembatalan oleh Customer, Cashier, dan " +
      "Admin; Barista tidak boleh. Route tidak punya penjaga peran, jadi " +
      "Barista yang login (dan tahu id order) ikut lolos; aturan Customer " +
      "hanya ditegakkan di dalam fungsi database cancel_order.",
  },
];

/**
 * Kunci unik satu baris matriks: metode + alamat.
 */
function kunciRoute(entri: EntriRoute): string {
  return `${entri.metode} ${entri.alamat}`;
}

/**
 * Peran yang DIIZINKAN KODE untuk sebuah route.
 * Route tanpa penjaga mengizinkan semua peran (termasuk anonim).
 */
function diizinkanKode(entri: EntriRoute): Peran[] {
  return entri.penjagaRoute === "anonim" ? SEMUA_PERAN : entri.penjagaRoute;
}

// ---------------------------------------------------------------------------
// MATRIKS HALAMAN
// ---------------------------------------------------------------------------

type EntriHalaman = {
  // Path relatif terhadap src/app, misal "cashier/page.tsx".
  berkas: string;
  // Alamat URL yang dibuka pengguna.
  alamat: string;
  // True = halaman umum tanpa login (customer / login / status).
  publik: boolean;
  // Path yang ditulis di dalam pemanggilan wajibPeran("...") di dalam berkas.
  // Untuk halaman publik bernilai null.
  panggilanWajibPeran: string | null;
  // Peran yang BOLEH membuka menurut docs/pemissions.md bagian 2.
  bolehDokumen: Peran[];
};

const matriksHalaman: EntriHalaman[] = [
  // Halaman customer dan login: terbuka untuk siapa pun.
  { berkas: "page.tsx", alamat: "/", publik: true, panggilanWajibPeran: null, bolehDokumen: SEMUA },
  { berkas: "login/page.tsx", alamat: "/login", publik: true, panggilanWajibPeran: null, bolehDokumen: SEMUA },
  { berkas: "status/[orderId]/page.tsx", alamat: "/status/[orderId]", publik: true, panggilanWajibPeran: null, bolehDokumen: SEMUA },

  // Halaman peran.
  { berkas: "cashier/page.tsx", alamat: "/cashier", publik: false, panggilanWajibPeran: "/cashier", bolehDokumen: KASIR_ADMIN },
  { berkas: "cashier/laporan/page.tsx", alamat: "/cashier/laporan", publik: false, panggilanWajibPeran: "/cashier/laporan", bolehDokumen: KASIR_ADMIN },
  { berkas: "cashier/laporan/[id]/page.tsx", alamat: "/cashier/laporan/[id]", publik: false, panggilanWajibPeran: "/cashier/laporan/[id]", bolehDokumen: KASIR_ADMIN },
  { berkas: "barista/page.tsx", alamat: "/barista", publik: false, panggilanWajibPeran: "/barista", bolehDokumen: BARISTA },
  { berkas: "admin/page.tsx", alamat: "/admin", publik: false, panggilanWajibPeran: "/admin", bolehDokumen: ADMIN },
  { berkas: "admin/akun/page.tsx", alamat: "/admin/akun", publik: false, panggilanWajibPeran: "/admin/akun", bolehDokumen: ADMIN },
  { berkas: "admin/laporan/page.tsx", alamat: "/admin/laporan", publik: false, panggilanWajibPeran: "/admin/laporan", bolehDokumen: ADMIN },
  { berkas: "admin/laporan/[id]/page.tsx", alamat: "/admin/laporan/[id]", publik: false, panggilanWajibPeran: "/admin/laporan/[id]", bolehDokumen: ADMIN },
  { berkas: "admin/log/page.tsx", alamat: "/admin/log", publik: false, panggilanWajibPeran: "/admin/log", bolehDokumen: ADMIN },
  // Catatan: dua halaman ini menjaga lewat path induk "/admin" (bukan
  // "/admin/menu"). aturannya tetap hanya Admin karena peranBolehBukaPath
  // memakai kecocokan persis dengan daftar HALAMAN_PERAN.
  { berkas: "admin/menu/page.tsx", alamat: "/admin/menu", publik: false, panggilanWajibPeran: "/admin", bolehDokumen: ADMIN },
  { berkas: "admin/stok/page.tsx", alamat: "/admin/stok", publik: false, panggilanWajibPeran: "/admin", bolehDokumen: ADMIN },
];

/**
 * Penjaga tiruan untuk halaman.
 *
 * Input: apakah halaman publik, path yang dipanggil wajibPeran, dan peran.
 * Output: "UNAUTHENTICATED" untuk anonim di halaman terlindungi, "FORBIDDEN"
 *         untuk peran yang tidak berhak, "LOLOS" untuk yang berhak.
 *
 * Untuk staf tes ini memakai fungsi ASLI peranBolehBukaPath(), jadi aturan
 * halaman yang diuji adalah aturan yang benar-benar dipakai aplikasi.
 */
function tiruanPenjagaHalaman(
  entri: EntriHalaman,
  peran: Peran,
): Hasil {
  if (entri.publik) {
    return "LOLOS";
  }
  if (peran === "anonim") {
    return "UNAUTHENTICATED";
  }
  const pathDipakai = entri.panggilanWajibPeran ?? entri.alamat;
  return peranBolehBukaPath(peran, pathDipakai) ? "LOLOS" : "FORBIDDEN";
}

// ---------------------------------------------------------------------------
// TES: ROUTE API
// ---------------------------------------------------------------------------

describe("matriks akses route API", () => {
  // PENGAMAN UTAMA: route baru yang belum terdaftar harus membuat tes gagal.
  it("pengaman: setiap berkas route.ts di src/app harus terdaftar di matriks", () => {
    const diDisk = cariBerkas("route.ts");
    const belumTerdaftar = diDisk.filter(
      (berkas) => !matriksRoute.some((entri) => entri.berkas === berkas),
    );

    expect(belumTerdaftar).toEqual([]);
  });

  it("pengaman: tidak ada entri matriks yang menunjuk berkas tidak ada", () => {
    const hilang = matriksRoute
      .filter(
        (entri) => !fs.existsSync(path.join(folderApp, entri.berkas)),
      )
      .map(kunciRoute);

    expect(hilang).toEqual([]);
  });

  it("metode HTTP di matriks sama persis dengan metode yang diekspor berkasnya", () => {
    const daftarBerkas = [...new Set(matriksRoute.map((e) => e.berkas))];

    for (const berkas of daftarBerkas) {
      const diMatriks = matriksRoute
        .filter((e) => e.berkas === berkas)
        .map((e) => e.metode)
        .sort();

      expect({ berkas, metode: diMatriks }).toEqual({
        berkas,
        metode: metodeRoute(berkas),
      });
    }
  });

  it("penjaga peran yang tertulis di dalam berkas route sesuai matriks", () => {
    const daftarBerkas = [...new Set(matriksRoute.map((e) => e.berkas))];

    for (const berkas of daftarBerkas) {
      // Semua entri satu berkas harus sepakat soal penjaga.
      const penjagaMatriks = new Set(
        matriksRoute.filter((e) => e.berkas === berkas).map((e) => JSON.stringify(e.penjagaRoute)),
      );
      expect({ berkas, penjaga: [...penjagaMatriks] }).toEqual({
        berkas,
        penjaga: [JSON.stringify(bacaPenjagaRoute(berkas))],
      });
    }
  });

  it("anonim: UNAUTHENTICATED di route berpenjaga, LOLOS di route customer", () => {
    for (const entri of matriksRoute) {
      const hasil = tiruanPenjagaRoute(bacaPenjagaRoute(entri.berkas), "anonim");
      const diharapkan: Hasil =
        entri.penjagaRoute === "anonim" ? "LOLOS" : "UNAUTHENTICATED";

      expect({ route: kunciRoute(entri), hasil }).toEqual({
        route: kunciRoute(entri),
        hasil: diharapkan,
      });
    }
  });

  it("setiap peran: LOLOS kalau berhak, FORBIDDEN kalau tidak berhak", () => {
    const kunciTidakCocok = new Set(ketidakcocokanTercatat.map((k) => k.kunci));

    for (const entri of matriksRoute) {
      // Acuan hasil: aturan dokumen. Kecuali route yang ketidakcocokannya
      // sudah tercatat, untuk itu acuannya memang apa yang dilakukan kode.
      const acuan = kunciTidakCocok.has(kunciRoute(entri))
        ? diizinkanKode(entri)
        : entri.bolehDokumen;

      for (const peran of ["cashier", "barista", "admin"] as const) {
        const hasil = tiruanPenjagaRoute(bacaPenjagaRoute(entri.berkas), peran);
        const diharapkan: Hasil = acuan.includes(peran) ? "LOLOS" : "FORBIDDEN";

        expect({ route: kunciRoute(entri), peran, hasil }).toEqual({
          route: kunciRoute(entri),
          peran,
          hasil: diharapkan,
        });
      }
    }
  });

  it("kode hanya berbeda dari docs/pemissions.md bagian 2 pada ketidakcocokan yang tercatat", () => {
    const terjadi = matriksRoute
      .filter(
        (entri) =>
          urut(diizinkanKode(entri)) !== urut(entri.bolehDokumen),
      )
      .map(kunciRoute)
      .sort();
    const tercatat = ketidakcocokanTercatat.map((k) => k.kunci).sort();

    // Pesan kalau gagal: kalau "terjadi" lebih banyak, ada route yang lebih
    // longgar/ketat dari dokumen tapi belum dicatat. Kalau "tercatat" lebih
    // banyak, ada ketidakcocokan yang sudah diperbaiki dan entrinya harus
    // dihapus dari ketidakcocokanTercatat.
    expect(terjadi).toEqual(tercatat);
  });

  it("setiap ketidakcocokan yang tercatat punya alasan yang ditulis", () => {
    for (const catatan of ketidakcocokanTercatat) {
      expect(catatan.alasan.length).toBeGreaterThan(20);
    }
  });
});

// ---------------------------------------------------------------------------
// TES: HALAMAN
// ---------------------------------------------------------------------------

describe("matriks akses halaman", () => {
  it("pengaman: setiap berkas page.tsx di src/app harus terdaftar di matriks", () => {
    const diDisk = cariBerkas("page.tsx");
    const belumTerdaftar = diDisk.filter(
      (berkas) => !matriksHalaman.some((entri) => entri.berkas === berkas),
    );

    expect(belumTerdaftar).toEqual([]);
  });

  it("pengaman: tidak ada entri matriks halaman yang menunjuk berkas tidak ada", () => {
    const hilang = matriksHalaman
      .filter((entri) => !fs.existsSync(path.join(folderApp, entri.berkas)))
      .map((entri) => entri.berkas);

    expect(hilang).toEqual([]);
  });

  it("halaman terlindungi memanggil wajibPeran dengan path yang tercatat; halaman publik tidak", () => {
    for (const entri of matriksHalaman) {
      const sumber = bacaBerkas(entri.berkas);
      const panggilan = sumber.match(/wajibPeran\(\s*"([^"]+)"/);

      if (entri.publik) {
        expect({ berkas: entri.berkas, panggilan: panggilan?.[1] ?? null }).toEqual({
          berkas: entri.berkas,
          panggilan: null,
        });
      } else {
        expect({ berkas: entri.berkas, panggilan: panggilan?.[1] ?? null }).toEqual({
          berkas: entri.berkas,
          panggilan: entri.panggilanWajibPeran,
        });
      }
    }
  });

  it("aturan peran halaman (peranBolehBukaPath asli) sesuai docs/pemissions.md bagian 2", () => {
    for (const entri of matriksHalaman) {
      for (const peran of ["cashier", "barista", "admin"] as const) {
        const hasil = tiruanPenjagaHalaman(entri, peran);
        const diharapkan: Hasil = entri.bolehDokumen.includes(peran)
          ? "LOLOS"
          : "FORBIDDEN";

        expect({ halaman: entri.alamat, peran, hasil }).toEqual({
          halaman: entri.alamat,
          peran,
          hasil: diharapkan,
        });
      }
    }
  });

  it("halaman terlindungi ikut tercakup proxy, jadi anonim diarahkan ke /login", () => {
    for (const entri of matriksHalaman) {
      if (entri.publik) continue;

      // Proxy memakai kecocokan awalan atas daftar HALAMAN_PERAN.
      const tercakup = HALAMAN_PERAN.some(
        (prefix) =>
          entri.alamat === prefix || entri.alamat.startsWith(`${prefix}/`),
      );

      expect({ alamat: entri.alamat, tercakup }).toEqual({
        alamat: entri.alamat,
        tercakup: true,
      });
    }
  });

  it("anonim: halaman terlindungi UNAUTHENTICATED, halaman publik LOLOS", () => {
    for (const entri of matriksHalaman) {
      const hasil = tiruanPenjagaHalaman(entri, "anonim");
      const diharapkan: Hasil = entri.publik ? "LOLOS" : "UNAUTHENTICATED";

      expect({ alamat: entri.alamat, hasil }).toEqual({
        alamat: entri.alamat,
        hasil: diharapkan,
      });
    }
  });
});
