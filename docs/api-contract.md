# API Contract — Theodore Coffee V1

Terkait: `order-flow.md`, `data-model.md`, `permissions.md`, `logging.md`.

Dokumen ini mendefinisikan fungsi server: siapa yang boleh memanggil, input, output, dan error. Detail lengkap hanya untuk fungsi order (inti V1). Fungsi lain cukup daftar ringkas, dan detailnya ditulis di fasenya.

## 1. Prinsip

1. **Semua permintaan lewat server Next.js** (Server Actions atau route handler). Browser tidak memanggil Supabase langsung untuk fungsi di dokumen ini.
2. Alur di server: **cek login dan peran → validasi input → panggil fungsi database → catat log → kirim respons**.
3. Perpindahan status order hanya lewat fungsi database (lihat `order-flow.md`).
4. Customer anonim (tanpa login). Cashier, Barista, dan Admin memakai sesi login, dan server memeriksa perannya.
5. **Format respons selalu sama:**

```json
{ "ok": true, "data": { } }
```
```json
{
  "ok": false,
  "error": {
    "type": "ORDER_STATUS_CHANGED",
    "message": "Status pesanan sudah berubah. Muat ulang halaman.",
    "code": "ERR-4F2A"
  }
}
```

- `type`: jenis error yang tetap (daftar di bagian 6), dipakai kode untuk menentukan tampilan
- `message`: pesan ramah untuk pengguna
- `code`: kode pendek untuk dicari di `error_logs`, hanya ada kalau errornya dicatat (lihat `logging.md`)

## 2. Aturan validasi

| Data | Aturan |
|---|---|
| Nama customer | Wajib, 1-50 karakter setelah spasi pinggir dipangkas |
| Jumlah baris item per order | 1-20 baris. Satu menu boleh muncul di lebih dari satu baris kalau catatannya berbeda (misalnya "less sugar" dan biasa). |
| Jumlah per item (qty) | Bilangan bulat 1-99. Tidak ada batas bisnis yang ketat karena Cashier mengonfirmasi semua order. Angka 99 hanya batas teknis untuk mencegah data sampah. |
| Catatan per item | Opsional, maksimal 100 karakter |
| Menu | Harus ada, aktif, dan tidak Habis |
| Metode bayar | Hanya `qris` atau `tunai` |
| Alasan pembatalan (`reason`) | Salah satu: `stok_habis`, `pembayaran_tidak_diterima`, `diminta_customer`, `pesanan_ganda`, `salah_input`, `lainnya`. Catatan (`note`) maksimal 100 karakter, dan wajib untuk `lainnya`. |
| `idempotencyKey` | Wajib pada pembuatan order (uuid dari klien) |
| Harga dan total | **Tidak diterima dari klien.** Selalu dihitung ulang di server dari `menu_items`. |

Pembatasan jumlah permintaan (rate limit) berlaku untuk fungsi yang bisa dipanggil anonim (`create_order`, `cancel_order`, `get_order_status`, `log_client_error`). Angkanya ditentukan saat implementasi.

## 3. Daftar fungsi

| Fungsi | Siapa | Tugas |
|---|---|---|
| `get_menu` | Anonim, semua peran | Daftar menu aktif + status Habis |
| `create_order` | Anonim (customer) | Buat order online |
| `get_order_status` | Anonim (dengan ID order) | Status order sendiri |
| `cancel_order` | Customer (order sendiri), Cashier, Admin | Batalkan (customer: sebelum konfirmasi, Cashier/Admin: sampai Barista menekan Mulai) |
| `list_orders` | Cashier, Admin | Daftar order dengan status, pembayaran, dan notifikasi baru |
| `confirm_order` | Cashier, Admin | Konfirmasi + metode bayar |
| `create_manual_order` | Cashier, Admin | Input order manual (sekaligus dikonfirmasi) |
| `get_barista_queue` | Barista | Antrean tanpa harga dan pembayaran |
| `get_stock_overview` | Cashier, Barista, Admin | Sisa stok (hanya baca): sisa porsi per menu dan sisa bahan |
| `start_order` | Barista | Tombol Mulai |
| `finish_order` | Barista | Tombol Selesai |
| `log_client_error` | Anonim dan staf (dibatasi) | Catat error penting dari browser (`/api/log-error`) |

**Ringkas saja (detail ditulis saat fasenya):**
- **Admin, menu, resep, dan stok:** detail di bagian 4b
- **Admin, akun:** `create_account`, `update_account`, `deactivate_account`, `reset_password`
- **Admin, log:** `list_activity_logs`, `list_error_logs`
- **Cashier dan Admin, laporan:** `get_today_report`, `list_reports`, `get_report`
- **Sistem:** `save_daily_report` (otomatis tiap pergantian hari)

## 4. Detail fungsi order

### get_menu
- **Input:** tidak ada
- **Output:** `{ items: [{ id, name, price, available }] }` (`available` false berarti tampil Habis)

### create_order (customer)
- **Input:** `{ customerName, items: [{ menuItemId, qty, note? }], idempotencyKey }`
- **Output:** `{ orderId, queueNumber, queueDate, status: "menunggu_konfirmasi", total }`
- **Efek:** order dan item tersimpan (nama dan harga disalin), nomor antrean diambil secara atomik, `order.created` dicatat
- **Error:** `VALIDATION_FAILED`, `MENU_UNAVAILABLE`, `RATE_LIMITED`, `INTERNAL_ERROR`
- **Catatan:** kalau `idempotencyKey` sudah pernah dipakai, kembalikan order yang sama (bukan error), sehingga klik ganda tidak membuat order ganda. Setelah berhasil, browser menyimpan `orderId` untuk halaman status.

### get_order_status (customer)
- **Input:** `{ orderId }`. Di database, parameternya `p_order_id` bertipe **text** (bukan uuid), supaya ID yang tidak valid menghasilkan `ORDER_NOT_FOUND`, bukan error konversi tipe.
- **Output:** `{ status, queueNumber, queueDate, items: [{ name, qty, note }], total, cancelReason?, cancelNote? }` (alasan hanya ada untuk order yang dibatalkan)
- **Error:** `ORDER_NOT_FOUND` (juga dipakai untuk ID yang tidak valid), `RATE_LIMITED`
- Dipanggil berulang (polling) sampai status akhir

### cancel_order
- **Input:** `{ orderId }` untuk customer. Untuk staf: `{ orderId, reason, note? }`. Staf wajib mengisi `reason`, dan `lainnya` wajib `note`. Customer otomatis memakai `diminta_customer`. Alasan dan catatan ikut tercatat di log `order.cancelled`.
- **Output:** `{ status: "dibatalkan" }`
- **Efek:** update bersyarat. Customer hanya bisa membatalkan saat `menunggu_konfirmasi`. Cashier dan Admin bisa membatalkan saat `menunggu_konfirmasi` atau `antrean`. Kalau status `antrean`, dalam satu transaksi: pembayaran ditandai batal, stok dikembalikan, order keluar dari antrean Barista. Log: `order.cancelled` dengan peran pembatal, plus `payment.voided` dan `stock.restored` untuk order yang sudah dikonfirmasi
- **Error:** `ORDER_NOT_FOUND`, `ORDER_STATUS_CHANGED` (customer: sudah dikonfirmasi atau dibatalkan, staf: sudah dikerjakan, selesai, atau dibatalkan), `FORBIDDEN`, `RATE_LIMITED`

### list_orders (Cashier, Admin)
- **Input:** `{ statuses?: [...], date? }` (bawaan: order hari ini)
- **Output:** daftar order: `orderId`, `queueNumber`, `customerName`, `source`, `status`, `items`, `total`, `payment` (kalau ada), waktu terkait
- **Error:** `UNAUTHENTICATED`, `FORBIDDEN`
- Notifikasi "Pesanan baru dari A" muncul dari order berstatus `menunggu_konfirmasi` yang baru terlihat

### confirm_order (Cashier, Admin)
- **Input:** `{ orderId, paymentMethod: "qris" | "tunai" }`
- **Output:** `{ status: "antrean", queueNumber, stockWarnings: [{ ingredientName, stockAfter }] }`
- **Efek:** satu transaksi database: cek status → catat pembayaran → kurangi stok dan catat pergerakan → ubah status ke `antrean` → log `order.confirmed`, `payment.recorded`, `stock.deducted` (dan `stock.negative` kalau stok jadi minus)
- **Error:** `ORDER_NOT_FOUND`, `ORDER_STATUS_CHANGED`, `VALIDATION_FAILED` (metode bayar tidak valid), `FORBIDDEN`, `INTERNAL_ERROR`
- `stockWarnings` bukan error. Konfirmasi tetap berhasil dan Cashier hanya melihat peringatan.

### create_manual_order (Cashier, Admin)
- **Input:** `{ customerName, items, paymentMethod, occurredAt?, idempotencyKey }`
- **Output:** sama dengan `confirm_order`, ditambah `orderId`
- **Efek:** order langsung berstatus `antrean`, **tanpa tahap Menunggu konfirmasi**, dalam satu transaksi: order, pembayaran, pengurangan stok, dan log (`order.created` dan `order.confirmed` keduanya dicatat)
- **Waktu manual (`occurredAt`):** hanya boleh di **hari berjalan (WIB)** dan tidak boleh di masa depan, karena laporan hari sebelumnya sudah terkunci di Riwayat. Order dengan waktu manual ditandai (`is_manual_time`).
- **Error:** `VALIDATION_FAILED`, `MENU_UNAVAILABLE`, `FORBIDDEN`, `INTERNAL_ERROR`

### get_stock_overview (Cashier, Barista, Admin)
- **Input:** tidak ada
- **Output:** `{ menus: [{ menuItemId, name, portionsLeft }], ingredients: [{ ingredientId, name, unit, stockQty, isNegative }] }`
- `portionsLeft`: bilangan bulat 0 atau lebih (stok dibagi takaran, dibulatkan ke bawah, bahan yang paling sedikit menentukan), atau kosong (`null`) untuk menu tanpa resep. Stok minus dihitung 0 porsi. Hanya menu aktif.
- Tidak memuat harga atau data pembayaran. Hanya baca.
- **Error:** `UNAUTHENTICATED`, `FORBIDDEN`
- Dipanggil berulang (polling), lihat bagian 5.

### get_barista_queue (Barista)
- **Input:** tidak ada
- **Output:** daftar order berstatus `antrean` dan `dikerjakan`, diurutkan dari waktu konfirmasi paling awal: `orderId`, `queueNumber`, `customerName`, `items: [{ name, qty, note }]`, `status`
- **Tidak berisi** harga dan data pembayaran

### start_order dan finish_order (Barista)
- **Input:** `{ orderId }`
- **Output:** `{ status: "dikerjakan" }` untuk `start_order`, `{ status: "selesai" }` untuk `finish_order`
- **Efek:** update bersyarat (`antrean` → `dikerjakan`, `dikerjakan` → `selesai`), log `order.started` atau `order.finished`
- **Error:** `ORDER_NOT_FOUND`, `ORDER_STATUS_CHANGED` (misalnya Barista lain sudah menekan lebih dulu), `FORBIDDEN`

## 4b. Detail fungsi Admin: menu, resep, dan stok

Semua fungsi hanya untuk **admin**. Server mengirim `p_actor_id`, dan database memeriksa bahwa akunnya admin dan aktif (peran dari tabel `profiles`, bukan dari klien). Id memakai tipe text, kembalian jsonb camelCase. Kesalahan memakai jenis error yang sudah ada: `FORBIDDEN`, dan `VALIDATION_FAILED` dengan detail penyebabnya (misalnya nama sudah dipakai atau id tidak ditemukan).

| Fungsi | Input | Aturan | Log |
|---|---|---|---|
| `create_menu_item` | `name`, `price` | Nama 1-60 karakter setelah dipangkas, unik tanpa membedakan huruf besar/kecil. Harga bilangan bulat 1-10.000.000. Menu baru langsung aktif. | `menu.created` |
| `update_menu_item` | `menuItemId`, `name`, `price` | Aturan sama. Harga baru tidak mengubah order lama (harga sudah disalin di `order_items`). | `menu.updated` (before/after) |
| `set_menu_active` | `menuItemId`, `isActive` | Menu tidak pernah dihapus, hanya dinonaktifkan atau diaktifkan lagi. | `menu.deactivated`, atau `menu.updated` saat diaktifkan lagi |
| `set_recipe` | `menuItemId`, `lines: [{ ingredientId, qtyPerPortion }]` | Mengganti seluruh resep dalam satu transaksi. 0-20 baris, bahan tidak boleh ganda dan harus ada, `qtyPerPortion` lebih dari 0 (`numeric(12,3)`). Resep kosong diizinkan (menu dianggap selalu tersedia). | `recipe.updated` (before/after) |
| `create_ingredient` | `name`, `unit` (`g`/`ml`/`pcs`), `initialStock?` | Nama 1-60 karakter, unik tanpa membedakan huruf besar/kecil. `initialStock` 0 atau lebih (bawaan 0). Kalau lebih dari 0, dicatat sebagai pergerakan stok bertipe `restock`. | `ingredient.created`, plus `stock.restocked` kalau ada stok awal |
| `update_ingredient` | `ingredientId`, `name` | Hanya nama. **Satuan tidak bisa diubah** setelah bahan dibuat, karena mengubahnya merusak arti angka stok dan resep. | `ingredient.updated` |
| `restock_ingredient` | `ingredientId`, `qty`, `note?` | `qty` lebih dari 0. Catatan maksimal 100 karakter. Pergerakan bertipe `restock`. | `stock.restocked` |
| `adjust_stock` | `ingredientId`, `newQty`, `reason` | Koreksi ke jumlah hasil hitung fisik. `newQty` 0 atau lebih, alasan wajib 1-100 karakter. Pergerakan bertipe `adjustment` berisi selisihnya (positif atau negatif). Stok yang minus dikoreksi kembali ke angka sebenarnya lewat fungsi ini. | `stock.adjusted` (dengan alasan) |

Semua fungsi yang mengubah stok mengunci baris bahan (`for update`) dan mengisi `stock_after` di `stock_movements`.

**Bacaan Admin (route server, tanpa fungsi database baru):**
- `GET /api/admin/menu`: semua menu termasuk yang nonaktif, beserta baris resepnya
- `GET /api/admin/ingredients`: nama, satuan, dan stok (stok minus ditandai)
- `GET /api/admin/ingredients/[id]/movements`: riwayat pergerakan stok, terbaru dulu, maksimal 100

## 5. Polling (pembaruan layar)

| Layar | Fungsi yang dipanggil | Interval |
|---|---|---|
| Status customer | `get_order_status` | 5 detik, berhenti saat status akhir (`selesai` atau `dibatalkan`) |
| Cashier | `list_orders` | 2 detik |
| Barista | `get_barista_queue` | 2 detik |
| Menu di halaman pesan customer | `get_menu` | 30 detik, hanya saat tab terlihat |
| Sisa stok di Cashier | `get_stock_overview` | 5 detik |
| Sisa stok di Barista | `get_stock_overview` | 10 detik |

## 6. Jenis error

| `type` | Artinya | Dicatat ke `error_logs`? |
|---|---|---|
| `UNAUTHENTICATED` | Belum login atau sesi habis | Tidak |
| `FORBIDDEN` | Peran tidak boleh melakukan aksi ini | Ya (warning), plus `access.denied` di log aktivitas |
| `VALIDATION_FAILED` | Input tidak sesuai aturan (respons menyebut field yang salah) | Tidak |
| `ORDER_NOT_FOUND` | Order tidak ada atau ID tidak valid | Tidak |
| `ORDER_STATUS_CHANGED` | Status sudah berubah sejak layar dimuat (kasus balapan) | Tidak |
| `MENU_UNAVAILABLE` | Menu nonaktif atau Habis | Tidak |
| `RATE_LIMITED` | Terlalu banyak permintaan | Ya (warning) |
| `INTERNAL_ERROR` | Kegagalan tak terduga di server atau database | **Ya (error), dengan kode `ERR-xxxx`** |

Penolakan bisnis yang normal (validasi, status berubah, menu habis) bukan kegagalan sistem, jadi tidak membanjiri `error_logs`. Kegagalan sistem (`INTERNAL_ERROR`) selalu mendapat kode yang tampil di layar.

## 7. Belum diputuskan

- Angka pasti pembatasan permintaan per fungsi anonim. Pembatas per IP bisa menolak banyak customer yang memakai WiFi booth yang sama (satu IP), jadi diuji dan dilonggarkan (misalnya dibatasi per ID order) di Fase 8, bersama uji beban
- Pagination untuk `list_activity_logs` dan `list_error_logs` (ditentukan di Fase 6)