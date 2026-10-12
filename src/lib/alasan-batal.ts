// File ini: daftar alasan pembatalan order.
//
// Kenapa file terpisah: daftar ini dipakai DUA pihak yang tidak boleh berbeda,
// yaitu validasi di server (src/lib/server/validasi.ts) dan pilihan di dialog
// pembatalan di browser (src/features/cashier/alasan-batal.ts). Kalau masing-masing
// menulis daftarnya sendiri, cepat atau lambat keduanya berbeda: Cashier memilih
// alasan yang lalu ditolak server, atau server menerima alasan yang tidak pernah
// tampil di layar.
//
// Isinya HARUS sama dengan enum order_cancel_reason di database
// (supabase/migrations/20261010073525_cancel_reason_stock_overview.sql).
//
// File ini MURNI: hanya konstanta dan tipe, tanpa React, tanpa database, dan
// tanpa dependensi.

// Daftar alasan pembatalan, sesuai urutan yang ditampilkan di dialog.
export const ALASAN_BATAL = [
  "stok_habis",
  "pembayaran_tidak_diterima",
  "diminta_customer",
  "pesanan_ganda",
  "salah_input",
  "lainnya",
] as const;

// Tipe nilai alasan.
//
// Diturunkan dari daftar di atas (bukan ditulis manual), jadi menambah alasan baru
// di satu tempat akan membuat TypeScript menandai setiap tempat yang lupa
// menangani nilai baru itu.
export type AlasanBatal = (typeof ALASAN_BATAL)[number];
