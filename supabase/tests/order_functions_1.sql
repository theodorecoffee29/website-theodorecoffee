-- ============================================================================
-- HANYA UNTUK DEVELOPMENT. Jangan dijalankan di project production.
-- ============================================================================
--
-- Uji manual untuk migrasi supabase/migrations/20261007013910_order_functions_1.sql.
-- File ini BUKAN migrasi; jangan taruh di supabase/migrations/.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor, lalu jalankan perintah di
-- bawah SATU PER SATU dari atas ke bawah. Setiap perintah diberi komentar
-- "Hasil:" sebagai hasil yang diharapkan.
--
-- Prasyarat: sudah menjalankan supabase/seed/dev_seed.sql, sehingga ada menu
-- bernama 'Americano' dan 'Latte'. Kalau data contoh belum ada, ganti nama menu
-- di bawah dengan menu yang ada.

-- ----------------------------------------------------------------------------
-- Langkah 1. Ambil dua id menu dari data contoh berdasarkan nama.
-- Hasil: dua baris (id uuid, name): Americano dan Latte, terurut nama.
-- ----------------------------------------------------------------------------
select id, name
from public.menu_items
where name in ('Americano', 'Latte')
order by name;

-- ----------------------------------------------------------------------------
-- Langkah 2. Panggil get_menu.
-- Hasil: satu kolom jsonb berisi {"items":[...]} dengan daftar menu aktif,
-- masing-masing punya id, name, price, dan available (true kalau stok cukup).
-- ----------------------------------------------------------------------------
select public.get_menu();

-- ----------------------------------------------------------------------------
-- Langkah 3. create_order pertama (pakai idempotency_key TETAP di bawah).
-- Id menu diambil lewat subquery berdasarkan nama, jadi tidak perlu menyalin.
-- Hasil: satu baris jsonb dengan order_id, queue_number (mulai dari 1),
-- queue_date (hari ini WIB), status 'menunggu_konfirmasi', total 62000
-- (Americano 18000 x 1 + Latte 22000 x 2).
-- ----------------------------------------------------------------------------
select public.create_order(
  'Budi Uji',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1,
      'note', 'less sugar'
    ),
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Latte'),
      'qty', 2
    )
  ),
  '11111111-1111-4111-8111-111111111111'::uuid
);

-- ----------------------------------------------------------------------------
-- Langkah 4. create_order KEDUA dengan idempotency_key yang SAMA.
-- Hasil: order_id, queue_number, queue_date, dan total PERSIS SAMA dengan
-- Langkah 3. Tidak ada order baru dan nomor antrean tidak bertambah.
-- ----------------------------------------------------------------------------
select public.create_order(
  'Budi Uji',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 1,
      'note', 'less sugar'
    ),
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Latte'),
      'qty', 2
    )
  ),
  '11111111-1111-4111-8111-111111111111'::uuid
);

-- ----------------------------------------------------------------------------
-- Langkah 5. create_order dengan qty 0 (harus gagal).
-- Hasil: ERROR dengan message 'VALIDATION_FAILED' dan detail
-- 'qty harus bilangan bulat 1-99'. Tidak ada order yang dibuat.
-- ----------------------------------------------------------------------------
select public.create_order(
  'Sari Uji',
  jsonb_build_array(
    jsonb_build_object(
      'menuItemId', (select id from public.menu_items where name = 'Americano'),
      'qty', 0
    )
  ),
  '22222222-2222-4222-8222-222222222222'::uuid
);

-- ----------------------------------------------------------------------------
-- Langkah 6. get_order_status untuk order dari Langkah 3.
-- Hasil: jsonb status 'menunggu_konfirmasi', queue_number dan queue_date,
-- items berisi name/qty/note, dan total dalam rupiah.
-- ----------------------------------------------------------------------------
select public.get_order_status(
  (select id::text from public.orders where idempotency_key = '11111111-1111-4111-8111-111111111111')
);
