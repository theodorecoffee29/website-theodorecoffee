// File ini: aturan validasi input untuk route handler Admin (menu, resep, stok).
//
// File ini MURNI (tidak memakai database maupun Supabase), supaya aturan
// validasi bisa diuji dengan cepat.
//
// Aturan diambil dari docs/api-contract.md bagian 4b:
//   - Nama menu dan nama bahan: wajib, 1-60 karakter setelah dipangkas.
//   - Harga: bilangan bulat 1 sampai 10.000.000.
//   - Satuan bahan: hanya "g", "ml", atau "pcs".
//   - Jumlah stok dan takaran: numeric(12,3), jadi paling banyak 3 angka di
//     belakang koma, dan tidak lebih dari 1.000.000 (agar muat di kolom).
//   - qty restock dan qtyPerPortion: lebih dari 0.
//   - newQty dan initialStock: 0 atau lebih.
//   - Resep: 0 sampai 20 baris, ingredientId uuid, bahan tidak boleh ganda.
//   - reason: wajib 1-100 karakter. note: maksimal 100 karakter.
//
// PENTING: satuan bahan TIDAK bisa dikirim lewat update_ingredient (hanya nama),
// jadi skema updateIngredient tidak punya field unit sama sekali.

import { z } from "zod";

// Batas panjang nama menu dan bahan (docs/api-contract.md bagian 4b).
export const MAKSIMAL_NAMA = 60;

// Batas harga: bilangan bulat 1 sampai 10.000.000 rupiah.
export const MINIMAL_HARGA = 1;
export const MAKSIMAL_HARGA = 10000000;

// Batas jumlah stok dan takaran. Kolomnya numeric(12,3): 9 digit bulat dan 3
// angka desimal. Batas 1.000.000 menjaga supaya nilai yang tidak wajar tidak
// masuk, dan kenapa tidak sampai 1 miliar: tidak ada alasan operasional memakai
// stok lebih dari itu.
export const MAKSIMAL_JUMLAH = 1000000;
export const MAKSIMAL_BARIS_RESEP = 20;

// Batas panjang catatan dan alasan.
export const MAKSIMAL_CATATAN = 100;
export const MAKSIMAL_ALASAN = 100;

// Skema nama menu atau bahan: wajib, dipangkas dulu, lalu 1-60 karakter.
const namaSchema = z
  .string("nama wajib diisi.")
  .trim()
  .min(1, "nama wajib diisi.")
  .max(MAKSIMAL_NAMA, `nama maksimal ${MAKSIMAL_NAMA} karakter.`);

// Skema harga: bilangan bulat 1 sampai 10.000.000.
// z.coerce mengubah angka dari JSON menjadi angka, lalu dicek bilangan bulat.
const hargaSchema = z.coerce
  .number("price harus berupa angka.")
  .int("price harus bilangan bulat.")
  .min(MINIMAL_HARGA, `price minimal ${MINIMAL_HARGA}.`)
  .max(MAKSIMAL_HARGA, `price maksimal ${MAKSIMAL_HARGA}.`);

/**
 * Skema jumlah stok atau takaran.
 *
 * Dipakai bersama untuk initialStock, qty restock, qtyPerPortion, dan newQty,
 * lalu batas bawahnya dibedakan per kasus (ada yang boleh 0, ada yang wajib
 * lebih dari 0).
 *
 * Aturan: paling banyak 3 angka di belakang koma. Ini diperlukan karena kolomnya
 * numeric(12,3): kalau lebih, nilainya dipotong diam-diam oleh database dan
 * nilai yang tersimpan berbeda dari yang dikirim.
 */
const jumlahSchema = z.coerce
  .number("jumlah harus berupa angka.")
  // Batas desimal 3 angka. dipakai refine supaya pesannya menyebut aturannya.
  .refine(
    (nilai) => {
      // Cara memeriksa jumlah angka desimal: ambil teksnya, pisahkan bagian
      // koma, lalu hitung panjang bagian desimalnya.
      const teks = String(nilai);
      if (!teks.includes(".")) {
        return true;
      }
      const bagianDesimal = teks.split(".")[1] ?? "";
      return bagianDesimal.length <= 3;
    },
    { message: "jumlah maksimal 3 angka di belakang koma." },
  )
  .refine((nilai) => nilai <= MAKSIMAL_JUMLAH, {
    message: `jumlah tidak boleh lebih dari ${MAKSIMAL_JUMLAH}.`,
  });

// -----------------------------------------------------------------------------
// Skema per endpoint
// -----------------------------------------------------------------------------

/** POST /api/admin/menu: membuat menu baru. */
export const buatMenuSchema = z.object({
  name: namaSchema,
  price: hargaSchema,
});

/** PATCH /api/admin/menu/[id]: mengubah nama dan harga menu. */
export const ubahMenuSchema = z.object({
  name: namaSchema,
  price: hargaSchema,
});

/** POST /api/admin/menu/[id]/active: mengaktifkan atau menonaktifkan menu. */
export const ubahStatusMenuSchema = z.object({
  // Tidak ada nilai bawaan: server harus tahu Admin memang memilih status ini.
  isActive: z.boolean("isActive harus true atau false."),
});

/**
 * Satu baris resep: ingredientId dan qtyPerPortion.
 * Dipakai oleh ubahResepSchema di bawah.
 */
const barisResepSchema = z.object({
  ingredientId: z.string().uuid("ingredientId harus berupa uuid yang valid."),
  qtyPerPortion: jumlahSchema.refine((nilai) => nilai > 0, {
    message: "qtyPerPortion harus lebih dari 0.",
  }),
});

/**
 * PUT /api/admin/menu/[id]/recipe: mengganti seluruh resep.
 *
 * Resep kosong (lines: []) diizinkan: itu berarti menu dianggap selalu tersedia
 * (docs/api-contract.md bagian 4b).
 *
 * Bahan tidak boleh ganda di dalam satu resep. Aturan ini diperiksa DI SINI
 * supaya pesannya jelas dan menyebut bahan mana yang ganda, sebelum dikirim ke
 * database. Database juga memeriksanya sendiri sebagai pengaman lapis kedua.
 */
export const ubahResepSchema = z.object({
  lines: z
    .array(barisResepSchema)
    .max(MAKSIMAL_BARIS_RESEP, `resep maksimal ${MAKSIMAL_BARIS_RESEP} baris.`)
    // refine karena aturan ini melibatkan seluruh isi array, bukan satu field.
    .refine(
      (baris) => {
        const idTerlihat = new Set<string>();
        for (const satu of baris) {
          if (idTerlihat.has(satu.ingredientId)) {
            return false;
          }
          idTerlihat.add(satu.ingredientId);
        }
        return true;
      },
      { message: "satu bahan tidak boleh disebut lebih dari sekali di resep." },
    ),
});

/** POST /api/admin/ingredients: membuat bahan baru. */
export const buatBahanSchema = z.object({
  name: namaSchema,
  // Hanya tiga satuan yang ada di database (enum ingredient_unit).
  unit: z.enum(["g", "ml", "pcs"], {
    message: "unit harus 'g', 'ml', atau 'pcs'.",
  }),
  // Stok awal opsional: kalau tidak dikirim, dianggap 0.
  initialStock: jumlahSchema
    .refine((nilai) => nilai >= 0, {
      message: "initialStock tidak boleh negatif.",
    })
    .optional(),
});

/**
 * PATCH /api/admin/ingredients/[id]: mengubah nama bahan saja.
 *
 * SENGAJA TIDAK ADA field unit: satuan tidak bisa diubah setelah bahan dibuat
 * (docs/api-contract.md bagian 4b). Kalau field unit dikirim, zod mengabaikannya
 * karena tidak ada di skema ini, jadi satuan tidak akan berubah.
 */
export const ubahBahanSchema = z.object({
  name: namaSchema,
});

/** POST /api/admin/ingredients/[id]/restock: menambah stok. */
export const restockBahanSchema = z.object({
  // Restock berarti menambah, jadi qty wajib lebih dari 0.
  qty: jumlahSchema.refine((nilai) => nilai > 0, {
    message: "qty harus lebih dari 0.",
  }),
  // Catatan opsional, maksimal 100 karakter.
  note: z
    .string()
    .max(MAKSIMAL_CATATAN, `note maksimal ${MAKSIMAL_CATATAN} karakter.`)
    .optional(),
});

/** POST /api/admin/ingredients/[id]/adjust: mengoreksi stok ke hasil hitung fisik. */
export const koreksiStokSchema = z.object({
  // Hasil hitung fisik: 0 atau lebih.
  newQty: jumlahSchema.refine((nilai) => nilai >= 0, {
    message: "newQty tidak boleh negatif.",
  }),
  // Alasan wajib: tanpa alasan, riwayat stok tidak bisa ditelusuri.
  reason: z
    .string("reason wajib diisi.")
    .trim()
    .min(1, "reason wajib diisi.")
    .max(MAKSIMAL_ALASAN, `reason maksimal ${MAKSIMAL_ALASAN} karakter.`),
});

// Bentuk hasil validasi, dipakai route handler.
export type BuatMenuValidasi = z.infer<typeof buatMenuSchema>;
export type UbahMenuValidasi = z.infer<typeof ubahMenuSchema>;
export type UbahStatusMenuValidasi = z.infer<typeof ubahStatusMenuSchema>;
export type UbahResepValidasi = z.infer<typeof ubahResepSchema>;
export type BuatBahanValidasi = z.infer<typeof buatBahanSchema>;
export type UbahBahanValidasi = z.infer<typeof ubahBahanSchema>;
export type RestockBahanValidasi = z.infer<typeof restockBahanSchema>;
export type KoreksiStokValidasi = z.infer<typeof koreksiStokSchema>;
