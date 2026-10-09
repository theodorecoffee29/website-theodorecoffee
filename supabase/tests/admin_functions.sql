-- =============================================================================
-- PERINGATAN: FILE INI HANYA UNTUK PENGEMBANGAN (development).
-- =============================================================================
--
-- File ini BUKAN migrasi. File ini tidak pernah dijalankan oleh
-- `supabase db push` dan tidak boleh ikut ke database production.
-- Isinya hanya langkah-langkah tes manual untuk dijalankan sendiri di
-- Supabase Dashboard > SQL Editor.
--
-- Kapan memakai file ini: setelah menjalankan migrasi
-- 20261008062847_admin_functions.sql di project development, untuk memastikan
-- fungsi Admin benar-benar bekerja sebelum dipakai aplikasinya.
--
-- CARA MEMAKAI:
--   1. Buka Supabase Dashboard > SQL Editor (project DEVELOPMENT).
--   2. Pastikan migrasi sudah dijalankan (fungsi create_menu_item, dll. sudah ada).
--   3. Jalankan blok-blok di bawah satu per satu (pilih blok, tekan Run).
--   4. Bandingkan hasilnya dengan hasil yang diharapkan yang tertulis di
--      komentar setiap blok.
--   5. Kalau hasilnya berbeda, JANGAN lanjut ke blok berikutnya. Catat
--      pesannya, itu petunjuknya.
--
-- CATATAN TENTANG DATA:
--   - Blok-blok di bawah MEMBUAT data uji (menu, bahan, resep). Data ini akan
--     muncul di aplikasi. Kalau tidak mau sisa, hapus manual lewat SQL Editor
--     (lihat blok PERSIAPAN di bawah: id admin dan id cashier yang dipakai).
--   - Blok TIDAK menghapus order apa pun. Order tidak pernah dihapus
--     (docs/data-model.md aturan 5).
--
-- CARA MENDAPATKAN ID AKUN:
--   Id admin diambil dengan subquery dari public.profiles yang perannya 'admin'.
--   Id cashier diambil dari yang perannya 'cashier' (dipakai untuk tes penolakan
--   FORBIDDEN di blok (i)).
-- =============================================================================


-- =============================================================================
-- PERSIAPAN: cek dulu akunnya ada
-- =============================================================================
-- Hasil yang diharapkan: dua baris (satu admin, satu cashier).
-- Kalau kosong, buat dulu akunnya lewat Dashboard > Authentication > Users, lalu
-- isi baris di public.profiles dengan role dan is_active yang sesuai.
select role, is_active, count(*) as jumlah_akun
from public.profiles
where role in ('admin', 'cashier')
group by role, is_active
order by role;


-- =============================================================================
-- (a) create_menu_item berhasil, lalu nama yang sama dengan huruf besar/kecil
--     berbeda gagal VALIDATION_FAILED
-- =============================================================================

-- (a1) Membuat menu baru.
-- Hasil yang diharapkan: satu objek jsonb
--   {"menuItemId": "...", "name": "Kopi Susu", "price": 22000, "isActive": true}
select public.create_menu_item(
  'Kopi Susu',
  22000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (a2) Membuat menu dengan nama yang sama tapi huruf besar/kecil berbeda.
-- Hasil yang diharapkan: ERROR dengan message 'VALIDATION_FAILED'
--   dan detail: 'name "Kopi Susu" sudah dipakai (huruf besar/kecil tidak dibedakan)'
-- Catatan: nama di sini "KOPI SUSU" sengaja berbeda huruf besar/kecil dari "Kopi Susu".
select public.create_menu_item(
  'KOPI SUSU',
  23000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (a3) Harga di luar batas (0 dan lebih dari 10.000.000).
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'price harus bilangan bulat antara 1 dan 10.000.000'
select public.create_menu_item(
  'Menu Harga Ngawur',
  0,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (a4) Nama lebih dari 60 karakter.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'name wajib 1-60 karakter setelah spasi pinggir dipangkas'
select public.create_menu_item(
  repeat('x', 61),
  10000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (b) update_menu_item mengubah harga, dan order lama tidak berubah
-- =============================================================================

-- (b1) Mengubah harga "Kopi Susu" menjadi 25000.
-- Hasil yang diharapkan: {"menuItemId": "...", "name": "Kopi Susu", "price": 25000}
update public.menu_items
set price = 25000
where name = 'Kopi Susu';

select public.update_menu_item(
  (select id::text from public.menu_items where name = 'Kopi Susu'),
  'Kopi Susu',
  25000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (b2) Cek harga menu sudah berubah.
-- Hasil yang diharapkan: 25000
select name, price from public.menu_items where name = 'Kopi Susu';

-- (b3) Cek order lama TIDAK ikut berubah.
-- Hasil yang diharapkan: price_snapshot tetap 22000 (harga saat pesanan dibuat),
--   walaupun harga menu sekarang 25000.
--   Ini yang dijamin docs/data-model.md aturan 6 (snapshot harga).
-- CATATAN: kalau belum ada order apa pun, hasilnya 0 baris. Kalau begitu, lewati
--   blok ini dan jangan dianggap gagal: yang diuji adalah kode harga yang sudah
--   tercatat, dan belum ada order untuk diperiksa.
select
  oi.name_snapshot,
  oi.price_snapshot as harga_saat_dipesan,
  (select price from public.menu_items where id = oi.menu_item_id) as harga_menu_sekarang
from public.order_items as oi
where oi.menu_item_id = (select id from public.menu_items where name = 'Kopi Susu')
order by oi.created_at desc
limit 5;

-- (b4) Id menu yang formatnya bukan uuid.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'menuItemId harus berupa uuid yang valid'
select public.update_menu_item(
  'bukan-uuid',
  'Kopi Susu',
  25000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (b5) Id menu yang formatnya uuid tapi tidak ada di database.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED' detail: 'menu dengan id ... tidak ditemukan'
select public.update_menu_item(
  '00000000-0000-4000-8000-000000000000',
  'Kopi Susu',
  25000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (c) set_menu_active menonaktifkan menu sehingga hilang dari get_menu,
--     lalu mengaktifkannya lagi
-- =============================================================================

-- (c1) Menonaktifkan "Kopi Susu".
-- Hasil yang diharapkan: {"menuItemId": "...", "isActive": false}
select public.set_menu_active(
  (select id::text from public.menu_items where name = 'Kopi Susu'),
  false,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (c2) Cek get_menu: "Kopi Susu" harus HILANG (menu nonaktif tidak dikirim).
-- Hasil yang diharapkan: tidak ada baris berisi 'Kopi Susu'
select items->>'name' as nama_menu
from public.get_menu() as hasil_menu,
     lateral jsonb_array_elements(hasil_menu.items) as items
where items->>'name' = 'Kopi Susu';
-- Kalau baris ini kosong, artinya menu benar-benar hilang (BERHASIL).

-- (c3) Mengaktifkan kembali.
-- Hasil yang diharapkan: {"menuItemId": "...", "isActive": true}
select public.set_menu_active(
  (select id::text from public.menu_items where name = 'Kopi Susu'),
  true,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (c4) Cek get_menu: "Kopi Susu" harus MUNCUL LAGI.
-- Hasil yang diharapkan: satu baris, nama_menu = 'Kopi Susu'
select items->>'name' as nama_menu
from public.get_menu() as hasil_menu,
     lateral jsonb_array_elements(hasil_menu.items) as items
where items->>'name' = 'Kopi Susu';


-- =============================================================================
-- (d) create_ingredient dengan stok awal membuat pergerakan restock
-- =============================================================================

-- (d1) Membuat bahan "Susu" dengan stok awal 5000.
-- Catatan urutan parameter: nama, unit, actor, meta, initialStock.
-- Hasil yang diharapkan: {"ingredientId": "...", "name": "Susu", "unit": "g", "stockQty": 5000}
select public.create_ingredient(
  'Susu',
  'g',
  (select id from public.profiles where role = 'admin' and is_active limit 1),
  '{}'::jsonb,
  5000
) as hasil;

-- (d2) Cek stok bahan dan pergerakan yang tercatat.
-- Hasil yang diharapkan: dua baris.
--   stock_qty = 5000
--   movements: type='restock', qty_change=5000, stock_after=5000
select
  i.name,
  i.unit,
  i.stock_qty,
  m.type,
  m.qty_change,
  m.stock_after,
  m.note
from public.ingredients as i
left join public.stock_movements as m on m.ingredient_id = i.id
where i.name = 'Susu';

-- (d3) Stok awal negatif.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'initialStock tidak boleh negatif'
select public.create_ingredient(
  'Bahan Minus',
  'g',
  (select id from public.profiles where role = 'admin' and is_active limit 1),
  '{}'::jsonb,
  -5
) as hasil;

-- (d4) Nama bahan yang sama huruf besar/kecil berbeda.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED' detail: 'name "Susu" sudah dipakai ...'
select public.create_ingredient(
  'susu',
  'ml',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (e) set_recipe untuk menu baru, lalu bahan ganda di resep gagal
-- =============================================================================

-- (e1) Membuat menu baru untuk dites resepnya (supaya tidak mengubah resep menu
--      yang sudah dipakai order lama).
-- Hasil yang diharapkan: objek dengan menuItemId baru.
select public.create_menu_item(
  'Americano',
  18000,
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (e2) Mengatur resep "Americano" memakai bahan "Susu" sebanyak 20 gram.
-- Ganti id bahan di bawah dengan milikmu sendiri kalau nama bahannya berbeda.
-- Hasil yang diharapkan: {"menuItemId": "...", "lines": [
--   {"ingredientId": "...", "qtyPerPortion": ...}, ... ]}
select public.set_recipe(
  (select id::text from public.menu_items where name = 'Americano'),
  jsonb_build_array(
    jsonb_build_object(
      'ingredientId', (select id from public.ingredients where name = 'Susu'),
      'qtyPerPortion', 20
    )
  ),
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (e3) Resep dengan bahan yang sama disebut dua kali.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'bahan ... disebut lebih dari sekali di resep'
select public.set_recipe(
  (select id::text from public.menu_items where name = 'Americano'),
  jsonb_build_array(
    jsonb_build_object(
      'ingredientId', (select id from public.ingredients where name = 'Susu'),
      'qtyPerPortion', 20
    ),
    jsonb_build_object(
      'ingredientId', (select id from public.ingredients where name = 'Susu'),
      'qtyPerPortion', 30
    )
  ),
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (e4) Resep dengan qtyPerPortion 0.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED' detail: 'qtyPerPortion harus lebih dari 0'
select public.set_recipe(
  (select id::text from public.menu_items where name = 'Americano'),
  jsonb_build_array(
    jsonb_build_object(
      'ingredientId', (select id from public.ingredients where name = 'Susu'),
      'qtyPerPortion', 0
    )
  ),
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (e5) Resep dengan bahan yang tidak ada di database.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED' detail: 'bahan dengan id ... tidak ditemukan'
select public.set_recipe(
  (select id::text from public.menu_items where name = 'Americano'),
  jsonb_build_array(
    jsonb_build_object(
      'ingredientId', '00000000-0000-4000-8000-000000000000',
      'qtyPerPortion', 10
    )
  ),
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (e6) Cek resep Americano. Hasil yang diharapkan: hanya satu baris (resep lama
--     tidak ikut tersisa setelah e3/e4/e5 gagal).
select r.menu_item_id, i.name as bahan, r.qty_per_portion
from public.recipes as r
join public.ingredients as i on i.id = r.ingredient_id
join public.menu_items as m on m.id = r.menu_item_id
where m.name = 'Americano';


-- =============================================================================
-- (f) restock_ingredient menambah stok
-- =============================================================================

-- (f1) Menambah stok "Susu" sebesar 2000.
-- Hasil yang diharapkan: {"ingredientId": "...", "stockQty": 7000, "qtyChange": 2000}
select public.restock_ingredient(
  (select id::text from public.ingredients where name = 'Susu'),
  2000,
  'Pembelian susu minggu ini',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (f2) Cek riwayat pergerakan Susu (terbaru dulu).
-- Hasil yang diharapkan: dua baris restock: 2000 lalu 5000.
select m.type, m.qty_change, m.stock_after, m.note
from public.stock_movements as m
join public.ingredients as i on i.id = m.ingredient_id
where i.name = 'Susu'
order by m.created_at desc, m.id;

-- (f3) Restock dengan qty 0 atau negatif.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED' detail: 'qty harus lebih dari 0'
select public.restock_ingredient(
  (select id::text from public.ingredients where name = 'Susu'),
  0,
  'nol',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (g) adjust_stock mengubah stok ke angka tertentu dan membuat pergerakan
--     adjustment berisi selisih
-- =============================================================================

-- (g1) Mengoreksi stok "Susu" menjadi 6500 (hasil hitung fisik).
-- Stok sebelumnya 7000, jadi selisihnya -500.
-- Hasil yang diharapkan: {"ingredientId": "...", "stockQty": 6500, "qtyChange": -500}
select public.adjust_stock(
  (select id::text from public.ingredients where name = 'Susu'),
  6500,
  'Hasil hitung fisik setelah penghitungan ulang',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (g2) Cek pergerakan adjustment tercatat dengan selisihnya.
-- Hasil yang diharapkan: type='adjustment', qty_change=-500, stock_after=6500,
--   dan note berisi alasannya.
select m.type, m.qty_change, m.stock_after, m.note, i.stock_qty as stok_sekarang
from public.stock_movements as m
join public.ingredients as i on i.id = m.ingredient_id
where i.name = 'Susu' and m.type = 'adjustment'
order by m.created_at desc;

-- (g3) Kembalikan stok minus ke angka sebenarnya (ini tujuan utama fungsi ini).
--
-- CATATAN: baris update di bawah MENYETEL stok jadi minus secara langsung. Ini
-- hanya untuk menyiapkan data uji, BUKAN cara yang dipakai aplikasi. Aplikasi
-- tidak pernah menulis ingredients.stock_qty langsung; stok hanya berubah lewat
-- fungsi restock_ingredient, adjust_stock, atau konfirmasi order.
-- Kalau stok minus tidak ingin disimulasikan, lewati blok ini.
--
-- Hasil yang diharapkan: objek dengan stockQty = 0 dan qtyChange positif +500
--   (stok -500 dikoreksi ke 0, jadi selisihnya +500).
update public.ingredients set stock_qty = -500 where name = 'Susu';

select public.adjust_stock(
  (select id::text from public.ingredients where name = 'Susu'),
  0,
  'Stok dikoreksi ke nol setelah ada kehilangan',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (h) adjust_stock tanpa alasan gagal
-- =============================================================================

-- (h1) Alasan kosong (spasi saja).
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'reason wajib diisi, maksimal 100 karakter'
select public.adjust_stock(
  (select id::text from public.ingredients where name = 'Susu'),
  123,
  '   ',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (h2) newQty negatif.
-- Hasil yang diharapkan: ERROR 'VALIDATION_FAILED'
--   detail: 'newQty tidak boleh negatif (hasil hitung fisik 0 atau lebih)'
select public.adjust_stock(
  (select id::text from public.ingredients where name = 'Susu'),
  -1,
  'coba negatif',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;


-- =============================================================================
-- (i) pemanggilan dengan akun cashier (id tes-cashier) gagal FORBIDDEN
-- =============================================================================
-- Perhatikan: blok ini memakai id dari profil BERPERAN cashier, bukan admin.

-- (i1) Cashier mencoba membuat menu.
-- Hasil yang diharapkan: ERROR dengan message 'FORBIDDEN'
--   dan detail: 'peran cashier tidak boleh mengelola menu, resep, dan stok'
select public.create_menu_item(
  'Menu Dari Cashier',
  10000,
  (select id from public.profiles where role = 'cashier' and is_active limit 1)
) as hasil;

-- (i2) Cashier mencoba menambah stok.
-- Hasil yang diharapkan: ERROR 'FORBIDDEN'
select public.restock_ingredient(
  (select id::text from public.ingredients where name = 'Susu'),
  1000,
  'seharusnya ditolak',
  (select id from public.profiles where role = 'cashier' and is_active limit 1)
) as hasil;

-- (i3) Akun yang tidak ada (id uuid asal).
-- Hasil yang diharapkan: ERROR 'FORBIDDEN'
--   detail: 'akun tidak ditemukan atau sudah dinonaktifkan'
select public.create_menu_item(
  'Menu Dari Tidak Ada',
  10000,
  '00000000-0000-4000-8000-000000000000'
) as hasil;


-- =============================================================================
-- (j) update_ingredient tidak mengubah satuan
-- =============================================================================

-- (j1) Mengubah nama "Susu" menjadi "Susu UHT" (satuan tidak ikut berubah).
-- Hasil yang diharapkan: {"ingredientId": "...", "name": "Susu UHT"}
--   (perhatikan: tidak ada field 'unit' di keluaran, karena fungsi ini hanya
--    mengubah nama).
select public.update_ingredient(
  (select id::text from public.ingredients where name = 'Susu'),
  'Susu UHT',
  (select id from public.profiles where role = 'admin' and is_active limit 1)
) as hasil;

-- (j2) Cek satuan bahan TETAP 'g' (tidak berubah jadi ml/pcs).
-- Hasil yang diharapkan: unit = g, name = 'Susu UHT'
select name, unit, stock_qty from public.ingredients where name = 'Susu UHT';

-- (j3) Pastikan tidak ada cara mengubah satuan lewat fungsi ini: update_ingredient
--     hanya menerima parameter nama. Ini disengaja. Kalau memang ada kebutuhan
--     ganti satuan, buat bahan baru lalu pindahkan resepnya (lihat catatan di
--     file migrasi, bagian update_ingredient).


-- =============================================================================
-- PEMBERITAHUAN AKHIR: cek bahwa log aktivitas tercatat
-- =============================================================================
-- Semua aksi di atas harus menghasilkan baris di activity_logs.
-- Hasil yang diharapkan: ada baris untuk menu.created, menu.updated,
--   menu.deactivated, ingredient.created, stock.restocked, stock.adjusted,
--   recipe.updated.
select action, entity_type, before, after, at
from public.activity_logs
where actor_id = (select id from public.profiles where role = 'admin' and is_active limit 1)
order by at desc
limit 20;

-- =============================================================================
-- PEMBERSIHAN (opsional, jalankan kalau tidak mau data uji tertinggal)
-- =============================================================================
-- Menghapus bahan dan menu uji yang dibuat file ini.
-- CATATAN: kalau bahan "Susu" sudah dipakai di resep menu lain, hapus resepnya
--   lebih dulu (lihat blok di atas untuk cara melihat resep).
-- Tidak menghapus order, log, atau pergerakan stok (semuanya tidak boleh dihapus).
--
-- select 1 from public.recipes as r
--   join public.ingredients as i on i.id = r.ingredient_id
--   where i.name like 'Susu%';
--
-- delete from public.recipes as r
--   using public.ingredients as i
--   where r.ingredient_id = i.id and i.name like 'Susu%';
--
-- delete from public.menu_items where name in ('Kopi Susu', 'Americano');
-- delete from public.ingredients where name like 'Susu%';
