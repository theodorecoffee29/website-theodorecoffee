// File ini: aturan validasi input untuk semua route handler order.
//
// File ini MURNI (tidak memakai database maupun Supabase), supaya aturan
// validasi bisa diuji dengan cepat.
//
// Aturan diambil dari docs/api-contract.md bagian 2:
//   - Nama customer: wajib, 1-50 karakter setelah spasi pinggir dipangkas.
//   - Jumlah baris item: 1-20 baris.
//   - qty per item: bilangan bulat 1-99.
//   - Catatan per item: opsional, maksimal 100 karakter.
//   - Metode bayar: hanya "qris" atau "tunai".
//   - idempotencyKey: wajib (uuid dari klien).
//
// PENTING: harga dan total TIDAK ADA di skema ini. Harga selalu dihitung ulang
// di server dari menu_items, tidak pernah dipercaya dari klien
// (docs/api-contract.md bagian 2). Kalau ada-field harga di body, field itu
// diabaikan oleh zod karena tidak ada di skema.

import { z } from "zod";

// Satu baris item order. menuItemId dan qty wajib; note opsional.
const itemOrderSchema = z.object({
  menuItemId: z.string().uuid("menuItemId harus berupa uuid yang valid."),
  // z.coerce mengubah angka dari JSON menjadi angka, lalu dicek bilangan bulat.
  qty: z.coerce
    .number("qty harus berupa angka.")
    .int("qty harus bilangan bulat.")
    .min(1, "qty minimal 1.")
    .max(99, "qty maksimal 99."),
  // Catatan opsional. Kalau tidak dikirim, dianggap tidak ada.
  note: z.string().max(100, "catatan maksimal 100 karakter.").optional(),
});

// Skema untuk POST /api/orders (buat order online oleh customer).
export const buatOrderSchema = z.object({
  customerName: z
    .string("customerName wajib diisi.")
    // trim dulu supaya spasi pinggir tidak ikut terhitung panjangnya,
    // baru dicep 1-50 karakter.
    .trim()
    .min(1, "customerName wajib diisi.")
    .max(50, "customerName maksimal 50 karakter."),
  // 1-20 baris. Satu menu boleh muncul di lebih dari satu baris kalau catatannya
  // berbeda, jadi TIDAK ada aturan unique di sini.
  items: z
    .array(itemOrderSchema)
    .min(1, "pesanan harus punya minimal 1 item.")
    .max(20, "pesanan maksimal 20 baris item."),
  // idempotencyKey wajib, Ini kunci anti-klik-ganda yang dikirim klien.
  idempotencyKey: z
    .string()
    .uuid("idempotencyKey harus berupa uuid yang valid."),
});

// Skema untuk POST konfirmasi (pilih metode bayar).
export const konfirmasiOrderSchema = z.object({
  // Hanya dua nilai yang diterima, sesuai enum payment_method di database.
  paymentMethod: z.enum(["qris", "tunai"], {
    message: "paymentMethod harus 'qris' atau 'tunai'.",
  }),
});

// Skema untuk POST /api/log-error (error dari browser).
//
// Hanya jenis error yang terdaftar di docs/logging.md bagian 7 yang diterima,
// supaya tabel log tidak bisa dibanjiri error palsu.
const jenisErrorBrowserSchema = z.enum([
  "gagal_kirim_order",
  "gagal_muat_status",
  "gagal_konfirmasi",
  "gagal_aksi_staf",
]);

export const logErrorBrowserSchema = z.object({
  // machine-readable jenis error, hanya yang terdaftar.
  kind: jenisErrorBrowserSchema,
  // Pesan singkat dari browser. Dipangkas supaya tidak jadi tempat menyembunyikan
  // data besar. Tidak boleh mengandung password/token karena redactSecrets
  // akan membersihkannya lagi sebelum ditulis.
  message: z
    .string()
    .min(1, "message wajib diisi.")
    .max(500, "message maksimal 500 karakter."),
  // Konteks tambahan opsional (halaman, nama fungsi). Dipangkas juga supaya
  // isinya tetap ringkas.
  context: z
    .object({
      path: z.string().max(200).optional(),
      fungsi: z.string().max(100).optional(),
    })
    .optional(),
  // Id order kalau error-nya berkaitan dengan sebuah pesanan.
  orderId: z.string().uuid("orderId harus berupa uuid yang valid.").optional(),
});

// Bentuk item yang sudah divalidasi, dipakai route handler.
export type ItemOrderValidasi = z.infer<typeof itemOrderSchema>;
export type BuatOrderValidasi = z.infer<typeof buatOrderSchema>;
