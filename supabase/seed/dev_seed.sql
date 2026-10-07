-- ============================================================================
-- HANYA UNTUK DEVELOPMENT. Jangan dijalankan di project production.
-- ============================================================================
--
-- File ini BUKAN migrasi. Letaknya sengaja di supabase/seed/, bukan di
-- supabase/migrations/, supaya tidak ikut `supabase db push`. Isinya hanya
-- data contoh (menu, bahan, resep) untuk dipakai saat mengembangkan aplikasi.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor, tempel seluruh isi file
-- ini, lalu Run. Aman dijalankan berulang kali karena setiap baris punya id
-- tetap dan memakai "on conflict do nothing", jadi data tidak digandakan.
--
-- Tidak ada akun, order, pembayaran, atau log di sini. Akun dibuat lewat login
-- sungguhan supaya id-nya nyambung dengan auth.users, sedangkan order dan log
-- hanya boleh lahir dari alur aplikasi, bukan dari data isian.

-- ============================================================================
-- BAGIAN 1: MENU
-- Menu kopi dan non-kopi beserta harga jualnya. Harga selalu bilangan bulat
-- rupiah (tanpa desimal). id diisi manual dengan pola yang mudah dibaca
-- (aaaaaaaa-0000-4000-8000-00000000000X) supaya resep di Bagian 3 bisa
-- menunjuk menu yang sama tanpa perlu mencari id hasil generate.
-- ============================================================================

insert into public.menu_items (id, name, price) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Americano',      18000),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Es Kopi Susu',   20000),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Latte',          22000),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Cappuccino',     22000),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'Teh',            12000),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'Coklat',         18000),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'Espresso',       15000),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'Es Teh Lemon',   13000)
on conflict (id) do nothing;

-- ============================================================================
-- BAGIAN 2: BAHAN DAN STOK AWAL
-- Enam bahan dengan satuan mengikuti enum ingredient_unit (g / ml / pcs).
-- Stok awal sengaja besar supaya cukup untuk puluhan porsi: misalnya biji kopi
-- 5.000 g cukup untuk ratusan gelas, susu 10.000 ml sekitar 70 porsi latte.
-- Stok boleh minus, jadi angka ini hanya titik awal, bukan batas.
-- id memakai pola bbbbbbbb-0000-4000-8000-00000000000X.
-- ============================================================================

insert into public.ingredients (id, name, unit, stock_qty) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Biji Kopi',     'g',   5000),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Susu',          'ml', 10000),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'Gula Cair',     'ml',  5000),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'Gelas',         'pcs',  500),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'Sirup Coklat',  'ml',  3000),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'Teh',           'g',   2000)
on conflict (id) do nothing;

-- ============================================================================
-- BAGIAN 3: RESEP
-- Takaran tiap bahan untuk SATU porsi menu. qty_per_portion bertipe
-- numeric(12,3), jadi boleh pecahan (misalnya 7.5 gram biji kopi) tanpa
-- dibulatkan. Kunci tabel resep adalah gabungan (menu_item_id, ingredient_id),
-- jadi konfliknya juga memakai pasangan kolom itu.
-- ============================================================================

insert into public.recipes (menu_item_id, ingredient_id, qty_per_portion) values
  -- Americano: kopi + gelas
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 7.5),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Es Kopi Susu: kopi + susu + gula + gelas
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 7.5),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 120),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000003', 20),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Latte: kopi + susu + gelas
  ('aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 9),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 150),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Cappuccino: kopi + susu + gelas
  ('aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', 9),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002', 120),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Teh: teh + gula + gelas
  ('aaaaaaaa-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000006', 5),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000003', 15),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Coklat: sirup coklat + susu + gelas (takaran pecahan 0.5 gelas sebagai contoh)
  ('aaaaaaaa-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000005', 30),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000002', 100),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Espresso: kopi + gelas
  ('aaaaaaaa-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000001', 9),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000004', 1),

  -- Es Teh Lemon: teh + gula + gelas
  ('aaaaaaaa-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000006', 5),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000003', 20),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000004', 1)
on conflict (menu_item_id, ingredient_id) do nothing;
