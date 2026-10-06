-- File ini: membuat seluruh tipe enum, tabel, kolom, kunci, dan relasi untuk Theodore Coffee V1.
-- Dijalankan manual di Supabase Dashboard > SQL Editor.
-- Belum termasuk RLS, fungsi, dan data isi. Itu ada di file migrasi berikutnya.
-- Sumber: docs/data-model.md (dibantu docs/order-flow.md, docs/api-contract.md, docs/logging.md).

-- ============================================================================
-- TIPE ENUM
-- Tipe enum dipakai untuk daftar nilai yang tertutup, supaya PostgreSQL sendiri
-- menolak nilai yang tidak dikenal (mis. status order yang salah ketik).
-- ============================================================================

-- Peran akun internal. Customer sengaja tidak punya akun, jadi tidak ada di sini.
create type app_role as enum ('admin', 'cashier', 'barista');

-- Peran pelaku di log aktivitas. Terpisah dari app_role karena log juga
-- mencatat aksi customer (membatalkan order sendiri) dan aksi sistem.
create type log_actor_role as enum ('admin', 'cashier', 'barista', 'customer', 'system');

-- Asal order: dikirim sendiri dari HP customer, atau diinput Cashier di booth.
create type order_source as enum ('online', 'cashier');

-- Status order, mengikuti alur di docs/order-flow.md bagian 1.
create type order_status as enum (
  'menunggu_konfirmasi',
  'antrean',
  'dikerjakan',
  'selesai',
  'dibatalkan'
);

-- Siapa yang membatalkan. Lebih sempit dari app_role karena customer bisa
-- membatalkan ordernya sendiri tanpa punya akun.
create type order_cancel_role as enum ('customer', 'cashier', 'admin');

-- Metode pembayaran. V1 hanya dua, tidak ada payment gateway.
create type payment_method as enum ('qris', 'tunai');

-- Satuan bahan. Satu bahan selalu satu satuan supaya stok bisa dijumlahkan langsung.
create type ingredient_unit as enum ('g', 'ml', 'pcs');

-- Alasan kenapa stok berubah, supaya riwayatnya bisa dibaca ulang.
create type stock_movement_type as enum (
  'order_confirm',
  'order_cancel_restore',
  'restock',
  'adjustment'
);

-- Di mana error terjadi.
create type error_source as enum ('client', 'server', 'database');

-- Seberapa serius error. Sesuai tabel severity di docs/logging.md bagian 4.
create type error_severity as enum ('warning', 'error', 'critical');

-- ============================================================================
-- TABEL
-- Urutan creation mengikuti kebutuhan foreign key: yang dirujuk dulu.
-- ============================================================================

-- Akun internal (Admin, Cashier, Barista).
-- Baris dibuat otomatis mengikuti akun di auth.users saat login pertama.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  role        app_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table profiles is
  'Akun internal yang memakai aplikasi: Admin, Cashier, Barista. Satu baris untuk setiap akun di auth.users. Customer tidak punya akun, jadi tidak ada di sini.';

-- Daftar menu yang bisa dipesan, lengkap dengan harga jualnya.
create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       integer not null check (price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table menu_items is
  'Menu yang bisa dipesan beserta harga jual dalam bilangan bulat rupiah. Status Habis sengaja tidak disimpan di sini, tapi dihitung dari stok dan resep (docs/data-model.md bagian 2).';

-- Bahan baku dan stoknya saat ini.
create table ingredients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  unit        ingredient_unit not null,
  -- Boleh minus. Aturan 4 di docs/data-model.md: kekurangan stok hanya peringatan,
  -- bukan blokir, jadi batas bawah nol sengaja tidak dipaksakan.
  stock_qty   numeric(12, 3) not null default 0
);

comment on table ingredients is
  'Bahan baku yang dipakai untuk membuat menu, beserta jumlah stok terkini dalam satuannya. Stok boleh minus supaya selisih takaran dan tumpah tetap tercatat dan bisa dikoreksi Admin.';

-- Resep: takaran bahan yang dibutuhkan untuk membuat satu porsi menu.
create table recipes (
  menu_item_id     uuid not null references menu_items (id) on delete cascade,
  ingredient_id    uuid not null references ingredients (id) on delete cascade,
  qty_per_portion  numeric(12, 3) not null check (qty_per_portion > 0),
  primary key (menu_item_id, ingredient_id)
);

comment on table recipes is
  'Takaran bahan untuk satu porsi menu. Inilah yang dipakai untuk menghitung status Habis: menu dianggap Habis kalau ada bahan di resepnya yang stoknya kurang dari takaran satu porsi.';

-- Nomor antrean harian. Satu baris per tanggal (WIB).
create table queue_counters (
  queue_date    date primary key,
  last_number   integer not null default 0 check (last_number >= 0)
);

comment on table queue_counters is
  'Penghitung nomor antrean per hari (WIB). Satu baris per tanggal, dipakai untuk memberi nomor berikutnya secara atomik supaya tidak ada nomor ganda, dan mulai dari 1 lagi setiap hari.';

-- Pesanan customer.
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  -- Tanggal hari WIB saat order dibuat. Dipakai bersama queue_number untuk
  -- mencari pesanan, dan untuk mengunci laporan harian.
  queue_date         date not null,
  queue_number       integer not null,
  customer_name      text not null check (char_length(customer_name) between 1 and 50),
  source             order_source not null,
  status             order_status not null default 'menunggu_konfirmasi',
  -- Jumlah semua item dalam bilangan bulat rupiah, selalu dihitung ulang di
  -- server dari harga menu, tidak pernah dipercaya dari perangkat customer.
  total              integer not null check (total >= 0),

  -- Waktu order benar-benar dibuat, dipakai untuk notifikasi Cashier.
  created_at         timestamptz not null default now(),
  -- Waktu kejadian sebenarnya. Bedanya dengan created_at kalau Cashier
  -- menginput order yang sudah lampau lalu memakai waktu sebenarnya.
  occurred_at        timestamptz not null default now(),
  -- True kalau occurred_at diisi manual, supaya jelas order ini input belakangan.
  is_manual_time     boolean not null default false,

  -- Kunci idempotensi yang dikirim perangkat customer. Wajib untuk create_order,
  -- boleh kosong untuk order manual Cashier yang tidak punya perangkat pengirim.
  -- Unik, sehingga klik ganda tidak menghasilkan dua order.
  idempotency_key    uuid unique,

  confirmed_at       timestamptz,
  confirmed_by       uuid references profiles (id),
  started_at         timestamptz,
  started_by         uuid references profiles (id),
  finished_at        timestamptz,
  finished_by        uuid references profiles (id),
  cancelled_at       timestamptz,
  cancelled_by_role  order_cancel_role,
  -- Kosong kalau yang membatalkan adalah customer, karena customer tidak punya profil.
  cancelled_by       uuid references profiles (id),

  -- Unik per hari: nomor antrean yang sama boleh dipakai lagi pada tanggal berikutnya.
  constraint orders_queue_date_queue_number_key unique (queue_date, queue_number)
);

comment on table orders is
  'Pesanan customer. Satu order bisa punya banyak item (order_items), satu pembayaran (payments), dan banyak pergerakan stok (stock_movements). Status hanya berubah lewat fungsi database dengan update bersyarat, dan order tidak pernah dihapus.';

-- Baris item di dalam satu order.
create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders (id),
  menu_item_id   uuid not null references menu_items (id),
  -- Nama dan harga disalin saat dipesan. Snapshot ini menjaga laporan lama
  -- tetap benar walaupun nama menu atau harganya nanti berubah.
  name_snapshot  text not null,
  price_snapshot integer not null check (price_snapshot >= 0),
  qty            integer not null check (qty between 1 and 99),
  note           text check (char_length(note) <= 100),
  -- price_snapshot x qty, disimpan supaya laporan tidak perlu menghitung ulang.
  subtotal       integer not null check (subtotal >= 0)
);

comment on table order_items is
  'Item yang dipesan dalam satu order, lengkap dengan salinan nama dan harga saat pemesanan. Satu menu boleh muncul di beberapa baris kalau catatannya berbeda, misalnya sebagian less sugar. Batas jumlah baris dicek di server.';

-- Pembayaran satu order. V1: satu pembayaran per order.
create table payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references orders (id),
  method        payment_method not null,
  amount        integer not null check (amount >= 0),
  recorded_by   uuid not null references profiles (id),
  recorded_at   timestamptz not null default now(),
  -- Diisi kalau order dibatalkan setelah konfirmasi. Pembayaran tidak dihapus,
  -- hanya ditandai batal supaya riwayat keuangannya tetap utuh.
  voided_at     timestamptz,
  voided_by     uuid references profiles (id)
);

comment on table payments is
  'Pembayaran satu order, dicatat saat konfirmasi. Order yang dibatalkan sebelum konfirmasi tidak punya baris di sini. Kalau dibatalkan sesudah konfirmasi, baris ditandai batal lewat voided_at, tidak dihapus dan tidak dihitung di laporan.';

-- Riwayat setiap perubahan stok bahan.
create table stock_movements (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references ingredients (id),
  -- Kosong kalau perubahan stok bukan dari order (mis. restock atau penyesuaian).
  order_id       uuid references orders (id),
  type           stock_movement_type not null,
  -- Negatif berarti berkurang, positif berarti bertambah.
  qty_change     numeric(12, 3) not null check (qty_change <> 0),
  -- Nilai stok setelah perubahan ini, supaya riwayat bisa ditelusuri tanpa
  -- menghitung ulang dari awal.
  stock_after    numeric(12, 3) not null,
  created_by     uuid not null references profiles (id),
  created_at     timestamptz not null default now(),
  note           text
);

comment on table stock_movements is
  'Catatan setiap perubahan stok bahan: berkurang saat konfirmasi order, dikembalikan saat order yang sudah dikonfirmasi dibatalkan, bertambah saat restock, atau disesuaikan manual. Stok bahan ada di ingredients; tabel ini hanya menyimpan jejaknya.';

-- Rekap harian yang sudah selesai. Tidak boleh diubah setelah dibuat.
create table daily_reports (
  report_date   date primary key,
  -- Isi laporan dalam bentuk JSON: total penjualan, rincian per asal order dan
  -- metode bayar, menu terlaris, pemakaian bahan, sisa stok, dan baris order hari itu.
  data          jsonb not null,
  generated_at  timestamptz not null default now()
);

comment on table daily_reports is
  'Laporan harian yang sudah dikunci, satu laporan per tanggal (WIB). Dibuat otomatis saat pergantian hari dan tidak boleh diubah setelah itu, supaya angka penjualan historis tidak bisa berubah.';

-- Log aktivitas: siapa melakukan apa, dan nilai sebelum sesudahnya.
create table activity_logs (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  -- Kosong kalau pelakunya customer atau sistem.
  actor_id      uuid references profiles (id),
  actor_role    log_actor_role,
  -- Format kelompok.kejadian huruf kecil, misalnya order.confirmed.
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  -- Terisi kalau aksi ini berkaitan dengan satu pesanan. Ada di ERD
  -- docs/data-model.md, dan memudahkan menelusuri semua jejak satu order.
  order_id      uuid references orders (id),
  -- Nilai objek sebelum dan sesudah perubahan, untuk keperluan audit.
  before        jsonb,
  after         jsonb,
  -- Konteks tambahan, misalnya ID sesi atau perangkat (satu akun bisa login di
  -- beberapa laptop) dan tanda waktu manual.
  meta          jsonb
);

comment on table activity_logs is
  'Log aktivitas: setiap aksi yang mengubah sesuatu, lengkap dengan pelaku, waktu, nilai sebelum dan sesudah. Hanya bisa ditambah, tidak pernah diubah atau dihapus. Kolom order_id dipakai untuk menelusuri semua jejak satu pesanan dari awal sampai akhir.';

-- Log error: kegagalan yang perlu dicari penyebabnya lewat kode error.
create table error_logs (
  id               uuid primary key default gen_random_uuid(),
  at               timestamptz not null default now(),
  -- Kode pendek yang ditampilkan ke pengguna, misalnya ERR-4F2A. Dicocokkan
  -- dengan baris ini ketika ada customer atau Cashier yang melapor.
  code             text not null,
  source           error_source not null,
  severity         error_severity not null,
  message          text not null,
  -- Konteks teknis: halaman, file atau fungsi, dan pesan error. Bukan seluruh
  -- isi permintaan.
  context          jsonb,
  -- Sengaja tanpa foreign key: error yang pelakunya belum punya akun, atau
  -- order-nya gagal dibuat, tetap harus bisa masuk ke tabel ini.
  user_id          uuid,
  order_id         uuid,
  -- Dipakai untuk mencocokkan baris ini dengan event di Sentry.
  sentry_event_id  text
);

comment on table error_logs is
  'Log error: kegagalan yang terjadi di aplikasi atau database, lengkap dengan kode error untuk dicari, tingkat keparahan, dan konteks teknisnya. user_id dan order_id sengaja tidak berupa foreign key supaya error yang referensinya belum ada tetap bisa dicatat. Hanya bisa ditambah, tidak pernah diubah atau dihapus.';

-- ============================================================================
-- INDEX
-- Index membuat pencarian dan penyaringan cepat. Kolom mana yang paling sering
-- dicari: status order untuk layar Cashier dan Barista, queue_date untuk
-- laporan harian, dan order_id untuk mengambil isi satu order.
-- ============================================================================

create index orders_status_idx on orders (status);

create index orders_queue_date_idx on orders (queue_date);

create index order_items_order_id_idx on order_items (order_id);