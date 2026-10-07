-- ============================================================================
-- HANYA UNTUK DEVELOPMENT. Jangan dijalankan di project production.
-- ============================================================================
--
-- Uji manual untuk migrasi supabase/migrations/20261007022728_order_functions_2.sql.
-- File ini BUKAN migrasi; jangan taruh di supabase/migrations/.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor, jalankan perintah SATU PER
-- SATU dari atas ke bawah. Setiap langkah diberi komentar "Hasil:" sebagai hasil
-- yang diharapkan. Di SQL Editor kita berperan sebagai pemilik tabel, jadi RLS
-- dilewati dan fungsi yang sebenarnya hanya untuk service_role tetap bisa dipanggil.
--
-- Persyaratan data: sudah menjalankan supabase/seed/dev_seed.sql (ada menu
-- 'Americano' dan 'Latte'), dan sudah menjalankan order_functions_1.sql serta
-- 20261007022728_order_functions_2.sql.
--
-- CATATAN MENGULANG: order tidak pernah dihapus (trigger melarang), jadi kalau
-- file ini dijalankan ulang dengan idempotency_key yang sama, hasilnya akan
-- mengembalikan order lama. Untuk percobaan bersih, ganti angka idempotency_key
-- di bawah dengan uuid baru.

-- ============================================================================
-- LANGKAH 0. SIAPKAN DUA AKUN TES
-- ============================================================================
-- Lakukan di dashboard dulu: Authentication > Users > Add user, buat dua user:
--   - tes-cashier@example.com  (role cashier)
--   - tes-barista@example.com  (role barista)
-- Lalu baris di bawah ini menautkan profilnya di public.profiles berdasarkan
-- email di auth.users. Hasil: dua baris, satu cashier dan satu barista.
insert into public.profiles (id, name, role)
select u.id, 'Cashier Uji', 'cashier'::public.app_role
from auth.users as u
where u.email = 'tes-cashier@example.com'
on conflict (id) do nothing;

insert into public.profiles (id, name, role)
select u.id, 'Barista Uji', 'barista'::public.app_role
from auth.users as u
where u.email = 'tes-barista@example.com'
on conflict (id) do nothing;

-- Cek profil tes. Hasil: dua baris (Cashier Uji, Barista Uji), is_active = true.
select id, name, role, is_active
from public.profiles
where name in ('Cashier Uji', 'Barista Uji')
order by name;

-- Catatan: di bawah ini "cashier" dan "barista" adalah subquery yang mengambil
-- id profil dari email auth.users, supaya tidak perlu menyalin uuid manual.

-- ============================================================================
-- LANGKAH (a). Buat order online, konfirmasi oleh Cashier, cek pembayaran & stok
-- ============================================================================

-- (a.1) Customer membuat order online: Americano x2.
-- Hasil: status 'menunggu_konfirmasi', queue_number, total 36000 (18000 x 2).
select public.create_order(
  'Pelanggan Online',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 2
    )
  ),
  'aaaaaaaa-0000-4000-8000-0000000000a1'::uuid
);

-- Catat stok bahan sebelum konfirmasi (Biji Kopi dan Gelas dipakai Americano).
-- Hasil: angka stok saat ini, akan dibandingkan setelah konfirmasi.
select name, stock_qty
from public.ingredients
where name in ('Biji Kopi', 'Gelas')
order by name;

-- (a.2) Cashier mengonfirmasi order, metode tunai.
-- Hasil: status 'antrean', queue_number, stock_warnings (kosong kalau stok cukup).
select public.confirm_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  'tunai',
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- (a.3) Cek pembayaran. Hasil: satu baris, method 'tunai', amount 36000.
select method, amount, voided_at
from public.payments
where order_id = (select id from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1');

-- (a.4) Cek stok setelah konfirmasi. Hasil: Biji Kopi turun 15 (7.5 x 2),
-- Gelas turun 2. bandingkan dengan Langkah (a.1).
select name, stock_qty
from public.ingredients
where name in ('Biji Kopi', 'Gelas')
order by name;

-- (a.5) Cek jejak stok. Hasil: baris stock_movements type 'order_confirm'
-- dengan qty_change negatif (mis. -15 dan -2).
select i.name, sm.type, sm.qty_change, sm.stock_after
from public.stock_movements as sm
join public.ingredients as i on i.id = sm.ingredient_id
where sm.order_id = (select id from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1')
order by i.name;

-- ============================================================================
-- LANGKAH (b). Konfirmasi KEDUA kali harus gagal ORDER_STATUS_CHANGED
-- ============================================================================

-- Hasil: ERROR message 'ORDER_STATUS_CHANGED' (order sudah 'antrean'), dan
-- tidak ada pembayaran kedua.
select public.confirm_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  'tunai',
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- ============================================================================
-- LANGKAH (c). Barista Mulai lalu Selesai
-- ============================================================================

-- (c.1) Mulai. Hasil: status 'dikerjakan'.
select public.start_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-barista@example.com')
);

-- (c.2) Selesai. Hasil: status 'selesai' dan order.finished tercatat di log.
select public.finish_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-barista@example.com')
);

-- ============================================================================
-- LANGKAH (d). Selesai tanpa Mulai harus gagal
-- ============================================================================
-- Order baru (Latte x1) dibuat online lalu dikonfirmasi Cashier, sehingga
-- berstatus 'antrean' tetapi belum pernah Mulai.
select public.create_order(
  'Pelanggan D',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Latte'),
      'qty', 1
    )
  ),
  'aaaaaaaa-0000-4000-8000-0000000000d4'::uuid
);

select public.confirm_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000d4'),
  'qris',
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- Hasil: ERROR message 'ORDER_STATUS_CHANGED' (order belum 'dikerjakan').
select public.finish_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000d4'),
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-barista@example.com')
);

-- ============================================================================
-- LANGKAH (e). Barista mencoba konfirmasi harus gagal FORBIDDEN
-- ============================================================================
-- Order baru (Americano x1) berstatus 'menunggu_konfirmasi'.
select public.create_order(
  'Pelanggan E',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1
    )
  ),
  'aaaaaaaa-0000-4000-8000-0000000000e5'::uuid
);

-- Hasil: ERROR message 'FORBIDDEN' (konfirmasi hanya cashier/admin).
select public.confirm_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000e5'),
  'tunai',
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-barista@example.com')
);

-- ============================================================================
-- LANGKAH (f). Cashier membatalkan order yang sudah dikonfirmasi
-- ============================================================================
-- Pakai order dari Langkah (d): Latte x1 berstatus 'antrean'.
-- Catat stok sebelum pembatalan. Hasil: Biji Kopi, Susu, Gelas saat ini.
select name, stock_qty
from public.ingredients
where name in ('Biji Kopi', 'Susu', 'Gelas')
order by name;

-- Batalkan oleh Cashier. Hasil: status 'dibatalkan'.
select public.cancel_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000d4'),
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- Cek pembayaran sudah di-void. Hasil: voided_at terisi, voided_by = id cashier.
select amount, voided_at, voided_by
from public.payments
where order_id = (select id from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000d4');

-- Cek stok kembali seperti sebelum konfirmasi (Latte: Biji Kopi +9, Susu +150,
-- Gelas +1). Hasil: angka sama dengan sebelum Langkah (d) mengonfirmasi.
select name, stock_qty
from public.ingredients
where name in ('Biji Kopi', 'Susu', 'Gelas')
order by name;

-- ============================================================================
-- LANGKAH (g). Customer membatalkan: boleh saat menunggu, gagal saat antrean
-- ============================================================================

-- (g.1) Customer membatalkan order dari Langkah (e) yang masih
-- 'menunggu_konfirmasi'. Hasil: status 'dibatalkan'.
select public.cancel_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000e5'),
  null
);

-- (g.2) Siapkan satu order 'antrean' (Americano x1) untuk membuktikan customer
-- tidak boleh membatalkan order yang sudah dikonfirmasi.
select public.create_order(
  'Pelanggan G',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1
    )
  ),
  'aaaaaaaa-0000-4000-8000-0000000000f7'::uuid
);

select public.confirm_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000f7'),
  'tunai',
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- Hasil: ERROR message 'ORDER_STATUS_CHANGED' (customer hanya boleh saat
-- menunggu_konfirmasi). Order tetap 'antrean'.
select public.cancel_order(
  (select id::text from public.orders where idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000f7'),
  null
);

-- ============================================================================
-- LANGKAH (h). create_manual_order langsung 'antrean' dan idempoten
-- ============================================================================

-- (h.1) Input order manual oleh Cashier (Americano x1, tunai).
-- Hasil: status 'antrean', order_id dan queue_number terisi, stock_warnings [].
select public.create_manual_order(
  'Pelanggan Manual',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1
    )
  ),
  'tunai',
  null,
  'aaaaaaaa-0000-4000-8000-0000000000b8'::uuid,
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- (h.2) Panggil LAGI dengan idempotency_key yang sama.
-- Hasil: order_id dan queue_number PERSIS SAMA dengan (h.1): tidak ada order baru.
select public.create_manual_order(
  'Pelanggan Manual',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1
    )
  ),
  'tunai',
  null,
  'aaaaaaaa-0000-4000-8000-0000000000b8'::uuid,
  (select p.id from public.profiles as p join auth.users as u on u.id = p.id
   where u.email = 'tes-cashier@example.com')
);

-- (h.3) Bukti hanya sekali efek. Hasil: 1 pembayaran dan 1 baris item untuk
-- order manual itu, dan statusnya 'antrean' dengan source 'cashier'.
select
  o.source,
  o.status,
  (select count(*) from public.payments as pay where pay.order_id = o.id) as jumlah_pembayaran,
  (select count(*) from public.order_items as oi where oi.order_id = o.id) as jumlah_baris_item
from public.orders as o
where o.idempotency_key = 'aaaaaaaa-0000-4000-8000-0000000000b8';
