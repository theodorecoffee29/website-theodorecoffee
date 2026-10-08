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

// Skema untuk POST /api/cashier/orders (order manual oleh Cashier).
//
// Perbedaan dari buatOrderSchema:
//   - paymentMethod WAJIB diisi (Cashier yang menerima pembayaran langsung),
//   - ada occurredAt opsional untuk input order belakangan (mis. catatan di
//     kertas), dan
//   - nama, item, dan idempotencyKey punya aturan yang sama seperti order
//     online, jadi diketik ulang dari itemOrderSchema yang sama.
//
//occurredAt punya tiga aturan (docs/api-contract.md bagian 4, create_manual_order):
//   1. Kalau diisi, harus berupa waktu yang bisa dibaca.
//   2. Tidak boleh di masa depan.
//   3. Harus jatuh pada hari ini menurut zona WIB.
// Aturan (2) dan (3) diperiksa di refine di bawah. Fungsi database juga
// memeriksanya lagi, jadi ada pengaman di dua lapisan.
export const orderManualSchema = z
  .object({
    customerName: z
      .string("customerName wajib diisi.")
      .trim()
      .min(1, "customerName wajib diisi.")
      .max(50, "customerName maksimal 50 karakter."),
    items: z
      .array(itemOrderSchema)
      .min(1, "pesanan harus punya minimal 1 item.")
      .max(20, "pesanan maksimal 20 baris item."),
    // Wajib, dan tidak ada nilai bawaan: Cashier harus memilih sendiri.
    paymentMethod: z.enum(["qris", "tunai"], {
      message: "paymentMethod harus 'qris' atau 'tunai'.",
    }),
    // Waktu kejadian order. String ISO dengan zona waktu, contoh
    // "2026-10-08T09:15:00+07:00" atau "...Z".
    // Kalau tidak dikirim, database memakai waktu sekarang.
    //
    // Kenapa zona waktu WAJIB ada (offset: true): kolom occurred_at di database
    // bertipe timestamptz, jadi harus tahu jam berapa di zona mana. Kalau
    // klien mengirim "2026-10-08T09:15" tanpa zona, maknanya tidak jelas
    // (09:15 UTC? 09:15 WIB?) dan bisa meleset 7 jam. Jadi bentuk tanpa zona
    // ditolak, dan Cashier harus mengirim waktu yang sudah berzone.
    occurredAt: z
      .string()
      .datetime({
        offset: true,
        message:
          "occurredAt harus berupa waktu ISO yang ada zonanya, contoh 2026-10-08T09:15:00+07:00.",
      })
      .optional(),
    idempotencyKey: z
      .string()
      .uuid("idempotencyKey harus berupa uuid yang valid."),
  })
  // refine = aturan yang melibatkan lebih dari satu field, jadi tidak bisa
  // ditulis sebagai pemeriksaan satu field.
  .refine((isi) => occurredAtBoleh(isi.occurredAt), {
    message:
      "occurredAt harus di hari ini (WIB) dan tidak boleh di masa depan.",
    // Field yang dikembalikan zod supaya kasar error-nya jelas.
    path: ["occurredAt"],
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
export type OrderManualValidasi = z.infer<typeof orderManualSchema>;

// Zona waktu Indonesia Barat. "Hari" selalu dihitung dalam zona ini
// (docs/data-model.md bagian 3), bukan zona jam server (biasanya UTC).
const ZONA_WIB = "Asia/Jakarta";

/**
 * Memeriksa apakah occurredAt boleh dipakai untuk input order manual.
 *
 * Input: teks waktu ISO, atau undefined kalau tidak diisi.
 * Output: true kalau boleh.
 *
 * Aturan (docs/api-contract.md bagian 4, create_manual_order):
 *   - Tidak diisi: boleh. Database akan memakai waktu sekarang.
 *   - Terisi: harus di hari ini menurut WIB dan tidak di masa depan.
 *
 * Kenapa dibatasi begitu: laporan hari sebelumnya sudah dikunci di Riwayat, jadi
 * order dengan tanggal lebih lama akan mengubah angka yang sudah final. Waktu
 * di masa depan juga tidak masuk akal karena pesanan belum terjadi
 * (docs/Order-flow.md bagian 5).
 *
 * Cara menghitung "hari ini": tanggal WIB dari occurredAt dibandingkan dengan
 * tanggal WIB dari waktu sekarang. Perbandingan ini dilakukan di zona WIB,
 * jadi jam 23:30 WIB tetap dianggap hari yang sama walau di UTC sudah lewat
 * tengah malam.
 */
function occurredAtBoleh(occurredAt: string | undefined): boolean {
  // Tidak diisi: database yang memakai waktu sekarang.
  if (occurredAt === undefined) {
    return true;
  }

  const waktuOrder = new Date(occurredAt);
  const sekarang = new Date();

  // new Date("bukan tanggal") menghasilkan Invalid Date. Aturan ini mungkin
  // sudah ditangkap zod, tapi dicek lagi supaya aman kalau fungsi ini dipanggil
  // dari tempat lain.
  if (Number.isNaN(waktuOrder.getTime())) {
    return false;
  }

  // Aturan 1: tidak boleh di masa depan.
  if (waktuOrder.getTime() > sekarang.getTime()) {
    return false;
  }

  // Aturan 2: harus jatuh pada hari yang sama dalam zona WIB.
  return tanggalWib(waktuOrder) === tanggalWib(sekarang);
}

/**
 * Mengubah satu waktu menjadi tanggal "YYYY-MM-DD" di zona WIB.
 *
 * Input: objek waktu.
 * Output: teks tanggal, contoh "2026-10-08".
 *
 * Cara kerja: Intl.DateTimeFormat dengan timeZone Asia/Jakarta sudah bisa
 * mengubah waktu ke zona WIB, termasuk bagian tanggalnya.
 */
function tanggalWib(waktu: Date): string {
  const bagianTanggal = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(waktu);

  // Locale en-CA memakai format YYYY-MM-DD, jadi hasilnya bisa langsung dipakai.
  return bagianTanggal;
}
