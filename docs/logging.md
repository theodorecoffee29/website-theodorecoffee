# Logging — Theodore Coffee V1

Terkait: `prd.md` (bagian 9), `data-model.md` (tabel `activity_logs` dan `error_logs`), `permissions.md`.

Tujuan: semua yang terjadi di aplikasi tercatat, dan kalau ada error, penyebabnya mudah dicari.

## 1. Dua jenis log

| Log | Tabel | Isi |
|---|---|---|
| Log aktivitas | `activity_logs` | Aksi yang mengubah sesuatu: siapa, kapan, apa, nilai sebelum dan sesudah |
| Log error | `error_logs` | Kegagalan: di mana, apa yang gagal, konteksnya, dan kode error |

Keduanya hanya bisa ditambah. Tidak ada yang bisa mengubah atau menghapusnya lewat aplikasi, dan hanya Admin yang bisa membacanya.

## 2. Aksi yang dicatat (log aktivitas)

Nama aksi memakai format `kelompok.kejadian`, huruf kecil.

| Kelompok | Nama aksi |
|---|---|
| Order | `order.created`, `order.confirmed`, `order.cancelled`, `order.started`, `order.finished` |
| Pembayaran | `payment.recorded` (metode, nominal, siapa), `payment.voided` (dibatalkan bersama order) |
| Stok | `stock.deducted` (otomatis saat konfirmasi), `stock.restored` (dikembalikan saat pembatalan), `stock.restocked`, `stock.adjusted`, `stock.negative` (peringatan stok minus) |
| Menu, resep, dan bahan | `menu.created`, `menu.updated`, `menu.deactivated`, `recipe.updated`, `ingredient.created`, `ingredient.updated` |
| Akun | `account.created`, `account.updated`, `account.deactivated`, `account.password_reset` |
| Login | `auth.login`, `auth.login_failed`, `auth.logout`, `access.denied` (mencoba membuka yang bukan haknya) |
| Laporan | `report.saved` (otomatis tiap pergantian hari), `report.printed` |

**Tidak dicatat:** membuka halaman laporan atau log, dan aksi yang hanya membaca data.

## 3. Isi satu catatan aktivitas

Field mengikuti `data-model.md`: `at`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before`, `after`, `meta`.

Contoh `order.confirmed`:

```json
{
  "action": "order.confirmed",
  "actor_role": "cashier",
  "entity_type": "order",
  "entity_id": "<id order>",
  "before": { "status": "menunggu_konfirmasi" },
  "after": { "status": "antrean", "payment_method": "qris" },
  "meta": { "session_id": "<id sesi/perangkat>", "queue_number": 12 }
}
```

`actor_id` kosong kalau pelakunya customer atau sistem. `meta` juga memuat tanda waktu manual (kalau order diinput belakangan) dan ID sesi/perangkat.

## 4. Isi satu catatan error

Field mengikuti `data-model.md`, ditambah **`code`**: `at`, `code`, `source` (`client`/`server`/`database`), `severity`, `message`, `context`, `user_id`, `order_id`, `sentry_event_id`.

| Severity | Dipakai untuk |
|---|---|
| `warning` | Kejadian tidak normal tapi aplikasi tetap jalan (login gagal, akses ditolak, stok minus) |
| `error` | Aksi gagal (order gagal dibuat, konfirmasi gagal, halaman gagal dimuat) |
| `critical` | Data berisiko tidak konsisten, transaksi gagal di tengah, atau gagal menulis log |

`context` berisi hal yang membantu mencari penyebab: nama file/fungsi, ID terkait (order, menu), dan pesan teknis. Bukan seluruh isi permintaan.

## 5. Kode error untuk pengguna

Setiap error yang tampil di layar memakai **pesan ramah + kode pendek**:

> Pesanan gagal dikirim, coba lagi. Kode: ERR-4F2A

- Format `ERR-` diikuti 4 huruf besar/angka acak, dibuat otomatis oleh helper log
- Kode yang sama disimpan di kolom `code` pada `error_logs`
- Detail teknis hanya ada di log, tidak pernah ditampilkan ke pengguna
- Mencari penyebab: minta kode dari customer atau Cashier, lalu cari di `error_logs`

## 6. Aturan penulisan log

1. **Satu pintu.** Semua log lewat helper di `src/lib/log` (`logActivity` dan `logError`). Jangan membuat cara log lain.
2. **Aksi kritis dicatat di dalam fungsi database yang sama** (misalnya konfirmasi order), dalam satu transaksi, jadi tidak mungkin berhasil tanpa tercatat.
3. **Jangan pernah mencatat** password, token, API key, service role key, atau header autentikasi. Nama customer boleh karena dibutuhkan untuk melacak order.
4. **Kegagalan menulis log tidak boleh membuat aksi utama gagal** di sisi aplikasi. Kalau penulisan log gagal, tulis ke `console.error` sebagai cadangan. (Pengecualian: log aktivitas yang ada di dalam transaksi database ikut batal bersama transaksinya.)
5. **Setiap operasi yang bisa gagal** (database, jaringan, input) dibungkus penanganan error dan menghasilkan `logError`. Tidak boleh ada error yang ditelan diam-diam.
6. **Nama aksi hanya dari daftar di bagian 2.** Aksi baru ditambahkan ke daftar ini dulu.

## 7. Error dari browser

- Dikirim lewat satu endpoint server (`/api/log-error`)
- Jumlah kiriman dibatasi per perangkat, supaya tabel tidak bisa dibanjiri error palsu
- Hanya jenis error yang terdaftar yang diterima: gagal kirim order, gagal memuat status, gagal konfirmasi atau aksi Cashier/Barista
- Peringatan kecil di browser tidak dicatat

## 8. Cara membaca log (untuk belajar dan mencari error)

| Di mana | Melihat apa |
|---|---|
| Terminal tempat `npm run dev` jalan | Error sisi server |
| Console browser (F12) | Error sisi tampilan |
| Supabase Dashboard > Table Editor | Tabel `activity_logs` dan `error_logs` |
| Halaman log Admin (dibangun di Fase 6) | Filter berdasarkan tanggal, aksi, severity, dan pencarian kode error |

Alur mencari error: ambil kode → cari di `error_logs` → baca `context` (file/fungsi dan ID terkait) → buka `activity_logs` untuk melihat apa yang terjadi sebelumnya pada order yang sama.

## 9. Penyimpanan dan Sentry

- Semua log disimpan dan tidak dihapus (jumlahnya kecil untuk skala booth)
- Selama pengembangan lokal cukup `error_logs`, terminal, dan console browser
- **Sentry dipasang di Fase 9** untuk menangkap error otomatis, dan `sentry_event_id` dicatat di `error_logs` supaya bisa dicocokkan

## 10. Belum diputuskan

- Batas jumlah kiriman error dari browser (angka pastinya ditentukan saat implementasi)
- Kapan perlu arsip log lama kalau jumlahnya sudah terlalu banyak