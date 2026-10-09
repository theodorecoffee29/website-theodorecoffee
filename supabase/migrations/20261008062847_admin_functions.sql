-- File ini: fungsi database untuk Admin (menu, resep, dan stok).
--
-- Dijalankan manual di Supabase Dashboard > SQL Editor, setelah file migrasi
-- sebelumnya (tables, rls, order_functions_1, order_functions_2).
-- Sumber aturan: docs/api-contract.md bagian 4b, docs/data-model.md,
-- docs/pemissions.md, docs/logging.md.
--
-- Isi file ini: create_menu_item, update_menu_item, set_menu_active,
-- set_recipe, create_ingredient, update_ingredient, restock_ingredient,
-- adjust_stock, plus beberapa fungsi pembantu yang dipakai bersama.
--
-- KONSEP PENTING:
-- - "security definer" + "set search_path = ''": fungsi berjalan dengan hak
--   pemilik dan semua nama objek ditulis lengkap dengan schema, supaya tidak
--   ada tabel/fungsi palsu yang ikut terpanggil. Lihat catatan di bagian 1.
-- - "revoke ... from public, anon, authenticated" + "grant ... to service_role":
--   fungsi hanya boleh dipanggil server yang memakai kunci rahasia service_role.
--   Customer dan akun login tidak boleh memanggilnya lewat API.
-- - "for update" mengunci satu baris bahan sampai transaksi selesai. Ini yang
--   membuat dua Admin yang menambah stok bersamaan tidak saling menimpa
--   (lihat bagian PERUBAHAN STOK di bawah).
--
-- ATURAN YANG BERLAKU UNTUK SEMUA FUNGSI DI FILE INI:
-- - Hanya admin. Peran dibaca dari tabel public.profiles (bukan dari kiriman
--   klien), dan akun harus aktif.
-- - Semua kesalahan lain memakai raise exception dengan message
--   'VALIDATION_FAILED' dan detail yang menjelaskan penyebabnya. Ini supaya
--   server bisa memetakan message-nya ke tipe error yang sudah ada
--   (docs/api-contract.md bagian 6).
-- - Id masuk bertipe text, diubah ke uuid di dalam fungsi. Id yang formatnya
--   salah menjadi VALIDATION_FAILED, bukan error database yang mentah.
-- - Kembalian jsonb dengan kunci camelCase.

-- ============================================================================
-- FUNGSI PEMBANTU
-- ============================================================================

-- parse_admin_uuid(p_teks, p_nama_field): mengubah teks menjadi uuid.
--
-- Kenapa perlu: id dari server masih berupa teks (mengikuti kontrak), sementara
-- kolom di database bertipe uuid. Kalau teksnya bukan uuid, error bawaan
-- PostgreSQL ("invalid input syntax for type uuid") akan sampai ke server dan
-- bocorkan detail database. Fungsi ini mengubahnya jadi VALIDATION_FAILED yang
-- menyebutkan nama fieldnya, supaya pesannya jelas.
create or replace function public.parse_admin_uuid(p_teks text, p_nama_field text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uuid uuid;
begin
  -- Teks kosong atau null tidak mungkin jadi uuid yang benar.
  if p_teks is null or btrim(p_teks) = '' then
    raise exception 'VALIDATION_FAILED'
      using detail = p_nama_field || ' wajib diisi';
  end if;

  begin
    v_uuid := btrim(p_teks)::uuid;
  exception
    when invalid_text_representation then
      raise exception 'VALIDATION_FAILED'
        using detail = p_nama_field || ' harus berupa uuid yang valid';
  end;

  return v_uuid;
end;
$$;

comment on function public.parse_admin_uuid(text, text) is
  'Mengubah id dari teks ke uuid. Format salah menghasilkan VALIDATION_FAILED yang menyebut nama fieldnya.';

revoke all on function public.parse_admin_uuid(text, text) from public, anon, authenticated;
grant execute on function public.parse_admin_uuid(text, text) to service_role;

-- require_admin(p_actor_id): memastikan pelakunya admin yang aktif, lalu
-- mengembalikan peran dalam bentuk log_actor_role untuk dipakai write_activity_log.
--
-- Peran SELALU dibaca dari tabel public.profiles, tidak pernah dari kiriman
-- klien. Akun yang dinonaktifkan langsung kehilangan aksesnya tanpa mengubah
-- kode fungsi ini.
--
-- Pola ini sama dengan require_staff di order_functions_2, khusus untuk admin.
create or replace function public.require_admin(p_actor_id uuid)
returns public.log_actor_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if p_actor_id is null then
    raise exception 'FORBIDDEN'
      using detail = 'aksi ini hanya untuk admin yang sudah login';
  end if;

  select p.role
  into v_role
  from public.profiles as p
  where p.id = p_actor_id
    and p.is_active;

  if not found then
    raise exception 'FORBIDDEN'
      using detail = 'akun tidak ditemukan atau sudah dinonaktifkan';
  end if;

  if v_role <> 'admin' then
    raise exception 'FORBIDDEN'
      using detail = 'peran ' || v_role::text || ' tidak boleh mengelola menu, resep, dan stok';
  end if;

  -- app_role ('admin') diubah ke log_actor_role ('admin') supaya bisa langsung
  -- dipakai oleh write_activity_log.
  return v_role::text::public.log_actor_role;
end;
$$;

comment on function public.require_admin(uuid) is
  'Memastikan pelaku admin yang aktif dan mengembalikan perannya untuk log. Menolak dengan FORBIDDEN kalau bukan admin.';

revoke all on function public.require_admin(uuid) from public, anon, authenticated;
grant execute on function public.require_admin(uuid) to service_role;

-- validate_admin_name(p_nama): memangkas spasi pinggir dan memastikan panjangnya
-- 1-60 karakter.
--
-- Pola ini sama dengan validate_customer_name di order_functions_2 (yang batasnya
-- 50 karakter untuk nama customer). Nama menu dan nama bahan batasnya 60.
create or replace function public.validate_admin_name(p_nama text, p_nama_field text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(p_nama);

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'VALIDATION_FAILED'
      using detail = p_nama_field || ' wajib 1-60 karakter setelah spasi pinggir dipangkas';
  end if;

  return v_name;
end;
$$;

comment on function public.validate_admin_name(text, text) is
  'Memangkas dan memvalidasi nama (1-60 karakter) untuk menu dan bahan.';

revoke all on function public.validate_admin_name(text, text) from public, anon, authenticated;
grant execute on function public.validate_admin_name(text, text) to service_role;

-- validate_admin_price(p_price): memastikan harga bilangan bulat 1-10.000.000.
--
-- Batas atas 10 juta supaya harga yang salah ketik (mis. 100000000) tidak
-- langsung dipakai di laporan.
create or replace function public.validate_admin_price(p_price integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_price is null then
    raise exception 'VALIDATION_FAILED' using detail = 'price wajib diisi';
  end if;

  if p_price < 1 or p_price > 10000000 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'price harus bilangan bulat antara 1 dan 10.000.000';
  end if;

  return p_price;
end;
$$;

comment on function public.validate_admin_price(integer) is
  'Memastikan harga bilangan bulat antara 1 dan 10.000.000 rupiah.';

revoke all on function public.validate_admin_price(integer) from public, anon, authenticated;
grant execute on function public.validate_admin_price(integer) to service_role;

-- require_unique_name(p_tabel, p_nama, p_nama_field): memastikan nama belum dipakai
-- oleh baris lain, TANPA membedakan huruf besar dan kecil.
--
-- Kenapa tidak mengandalkan unique index saja: unique index pasti menolak, tapi
-- pesannya berbahasa Inggris dan tidak menyebut nama fieldnya. Fungsi ini
-- memeriksa lebih dulu supaya pesannya jelas ("nama sudah dipakai"), dan
-- unique index tetap dipasang sebagai pengaman terakhir untuk-tabrakan yang
-- terjadi pada saat bersamaan.
--
-- p_tabel hanya dipakai dari kode fungsi ini, bukan dari klien, jadi aman
-- dipakai sebagai nama tabel pada kueri.
create or replace function public.require_unique_name(
  p_tabel text,
  p_nama text,
  p_nama_field text,
  p_kecuali_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  -- Dua kueri terpisah (satu per tabel) supaya nama tabel tidak datang dari
  -- input pengguna. Kalau nanti ada tabel lain yang perlu aturan sama, tinggal
  -- ditambah cabangnya.
  if p_tabel = 'menu_items' then
    select count(*) into v_jumlah
    from public.menu_items as m
    where lower(m.name) = lower(p_nama)
      and (p_kecuali_id is null or m.id <> p_kecuali_id);

  elsif p_tabel = 'ingredients' then
    select count(*) into v_jumlah
    from public.ingredients as i
    where lower(i.name) = lower(p_nama)
      and (p_kecuali_id is null or i.id <> p_kecuali_id);

  else
    -- Tidak akan terjadi: nama tabel ditulis di dalam kode fungsi.
    raise exception 'VALIDATION_FAILED'
      using detail = 'tabel ' || coalesce(p_tabel, 'kosong') || ' tidak dikenal';
  end if;

  if v_jumlah > 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = p_nama_field || ' "' || p_nama || '" sudah dipakai (huruf besar/kecil tidak dibedakan)';
  end if;
end;
$$;

comment on function public.require_unique_name(text, text, text, uuid) is
  'Memastikan nama menu atau bahan belum dipakai oleh baris lain, tidak membedakan huruf besar dan kecil.';

revoke all on function public.require_unique_name(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.require_unique_name(text, text, text, uuid) to service_role;

-- ============================================================================
-- UNIQUE INDEX PADA lower(name)
-- ============================================================================
--
-- Ini pengaman lapis kedua untuk nama menu dan nama bahan. Lapis pertama sudah
-- ada di require_unique_name (pesan error yang jelas). Index ini menutup
-- kemungkinan dua Admin membuat nama yang sama pada saat bersamaan.
--
-- upper/lower dipakai karena uniqueness harus berlaku untuk "Kopi Susu" dan
-- "kopi susu" yang dianggap nama sama.

-- Kalau ternyata masih ada nama yang ganda (mis. dari data contoh), indeks ini
-- akan gagal dibuat. Pesan exception di bawah diganti supaya lebih jelas apa
-- yang harus dibetulkan, dan tidak muncul sebagai error index yang membingungkan.
do $$
declare
  v_ganda text;
begin
  select string_agg(nama_doublet, ', ')
  into v_ganda
  from (
    select lower(name) as nama_doublet
    from public.menu_items
    group by lower(name)
    having count(*) > 1
  ) as daftar_ganda;

  if v_ganda is not null then
    raise exception 'VALIDATION_FAILED'
      using detail = 'tidak bisa membuat unique index menu_items: nama ini dipakai lebih dari satu menu: ' || v_ganda;
  end if;
end;
$$;

create unique index menu_items_name_lower_uniq on public.menu_items (lower(name));

do $$
declare
  v_ganda text;
begin
  select string_agg(nama_doublet, ', ')
  into v_ganda
  from (
    select lower(name) as nama_doublet
    from public.ingredients
    group by lower(name)
    having count(*) > 1
  ) as daftar_ganda;

  if v_ganda is not null then
    raise exception 'VALIDATION_FAILED'
      using detail = 'tidak bisa membuat unique index ingredients: nama ini dipakai lebih dari satu bahan: ' || v_ganda;
  end if;
end;
$$;

create unique index ingredients_name_lower_uniq on public.ingredients (lower(name));

-- ============================================================================
-- 1. create_menu_item(p_name, p_price, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Membuat menu baru yang LANGSUNG AKTIF (docs/api-contract bagian
-- 4b). Satu transaksi: insert menu + tulis log menu.created.
create or replace function public.create_menu_item(
  p_name     text,
  p_price    integer,
  p_actor_id uuid,
  p_meta     jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.log_actor_role;
  v_name       text;
  v_price      integer;
  v_menu_id    uuid;
  v_menu_name  text;
  v_menu_price integer;
begin
  -- Peran dicek lebih dulu, sebelum ada data yang disentuh.
  v_role := public.require_admin(p_actor_id);

  -- Nama dipangkas dan dicek panjangnya (1-60 karakter).
  v_name := public.validate_admin_name(p_name, 'name');

  -- Nama harus unik tanpa membedakan huruf besar/kecil.
  perform public.require_unique_name('menu_items', v_name, 'name', null);

  -- Harga bilangan bulat 1-10.000.000.
  v_price := public.validate_admin_price(p_price);

  -- Menu baru selalu aktif, jadi is_active tidak diisi (pakai bawaan true).
  insert into public.menu_items (name, price)
  values (v_name, v_price)
  returning id into v_menu_id;

  -- Log: apa yang berubah. before kosong karena ini pembuatan baru.
  perform public.write_activity_log(
    p_actor_id, v_role, 'menu.created', 'menu_item', v_menu_id, null,
    null,
    jsonb_build_object('name', v_name, 'price', v_price, 'isActive', true),
    p_meta
  );

  return jsonb_build_object('menuItemId', v_menu_id, 'name', v_name, 'price', v_price, 'isActive', true);
end;
$$;

comment on function public.create_menu_item(text, integer, uuid, jsonb) is
  'Admin membuat menu baru. Nama unik tanpa membedakan huruf besar/kecil. Menu langsung aktif. Log: menu.created.';

revoke all on function public.create_menu_item(text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_menu_item(text, integer, uuid, jsonb) to service_role;

-- ============================================================================
-- 2. update_menu_item(p_menu_item_id, p_name, p_price, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Mengubah nama dan harga menu.
--
-- PENTING: mengubah harga menu TIDAK mengubah order lama. Harga di
-- order_items disalin saat order dibuat (name_snapshot/price_snapshot,
-- docs/data-model.md bagian 3 aturan 6), jadi laporan lama tetap memakai harga
-- yang benar saat pesanan dibuat.
create or replace function public.update_menu_item(
  p_menu_item_id text,
  p_name        text,
  p_price       integer,
  p_actor_id    uuid,
  p_meta        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        public.log_actor_role;
  v_id          uuid;
  v_name        text;
  v_price       integer;
  v_sebelum_nama text;
  v_sebelum_harga integer;
begin
  v_role := public.require_admin(p_actor_id);

  -- Id dari teks ke uuid. Format salah jadi VALIDATION_FAILED.
  v_id := public.parse_admin_uuid(p_menu_item_id, 'menuItemId');

  v_name := public.validate_admin_name(p_name, 'name');

  -- Nama unik, tapi baris menu itu sendiri tidak ikut dianggap bentrok
  -- (p_kecuali_id = v_id), supaya menu boleh menyimpan nama yang sama dengan
  -- dirinya sendiri.
  perform public.require_unique_name('menu_items', v_name, 'name', v_id);

  v_price := public.validate_admin_price(p_price);

  -- Kunci baris ini supaya nilai before yang diambil tidak berubah di tengah
  -- (mis. ada dua Admin yang menyimpan menu yang sama pada saat bersamaan).
  select m.name, m.price
  into v_sebelum_nama, v_sebelum_harga
  from public.menu_items as m
  where m.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'menu dengan id ' || p_menu_item_id || ' tidak ditemukan';
  end if;

  update public.menu_items
  set name = v_name,
      price = v_price
  where id = v_id;

  -- Log dengan before/after supaya Admin bisa melihat apa yang berubah.
  perform public.write_activity_log(
    p_actor_id, v_role, 'menu.updated', 'menu_item', v_id, null,
    jsonb_build_object('name', v_sebelum_nama, 'price', v_sebelum_harga),
    jsonb_build_object('name', v_name, 'price', v_price),
    p_meta
  );

  return jsonb_build_object('menuItemId', v_id, 'name', v_name, 'price', v_price);
end;
$$;

comment on function public.update_menu_item(text, text, integer, uuid, jsonb) is
  'Admin mengubah nama dan harga menu. Order lama tidak berubah karena harga di snapshot saat order dibuat. Log: menu.updated dengan before/after.';

revoke all on function public.update_menu_item(text, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_menu_item(text, text, integer, uuid, jsonb) to service_role;

-- ============================================================================
-- 3. set_menu_active(p_menu_item_id, p_is_active, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Mengaktifkan atau menonaktifkan menu.
--
-- Menu TIDAK PERNAH dihapus (docs/data-model.md aturan 5), karena order lama
-- masih merujuknya dan laporan harus tetap bisa dibaca. Menonaktifkan hanya
-- menyembunyikannya dari menu customer (get_menu hanya mengambil is_active).
create or replace function public.set_menu_active(
  p_menu_item_id text,
  p_is_active    boolean,
  p_actor_id     uuid,
  p_meta         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        public.log_actor_role;
  v_id          uuid;
  v_sebelum     boolean;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_menu_item_id, 'menuItemId');

  -- is_active wajib diisi, kalau tidak tidak jelas mau diaktifkan atau tidak.
  if p_is_active is null then
    raise exception 'VALIDATION_FAILED' using detail = 'isActive wajib diisi';
  end if;

  select m.is_active
  into v_sebelum
  from public.menu_items as m
  where m.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'menu dengan id ' || p_menu_item_id || ' tidak ditemukan';
  end if;

  update public.menu_items
  set is_active = p_is_active
  where id = v_id;

  -- Dua nama aksi berbeda, sesuai status barunya: dinonaktifkan memakai
  -- menu.deactivated, diaktifkan kembali memakai menu.updated.
  perform public.write_activity_log(
    p_actor_id, v_role,
    case when p_is_active then 'menu.updated' else 'menu.deactivated' end,
    'menu_item', v_id, null,
    jsonb_build_object('isActive', v_sebelum),
    jsonb_build_object('isActive', p_is_active),
    p_meta
  );

  return jsonb_build_object('menuItemId', v_id, 'isActive', p_is_active);
end;
$$;

comment on function public.set_menu_active(text, boolean, uuid, jsonb) is
  'Admin mengaktifkan atau menonaktifkan menu. Menu tidak pernah dihapus. Log: menu.deactivated saat dinonaktifkan, menu.updated saat diaktifkan lagi.';

revoke all on function public.set_menu_active(text, boolean, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_menu_active(text, boolean, uuid, jsonb) to service_role;

-- ============================================================================
-- 4. set_recipe(p_menu_item_id, p_lines, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Mengganti SELURUH resep satu menu dalam satu transaksi.
--
-- Yang diperiksa:
--   - 0 sampai 20 baris (resep kosong diizinkan: menu dianggap selalu tersedia),
--   - bahan tidak boleh ganda di dalam resep yang sama,
--   - setiap bahan harus ada di tabel ingredients,
--   - qtyPerPortion lebih dari 0.
--
-- Cara ganti: ambil resep lama sebagai before, hapus semua, insert yang baru.
-- Semua dalam satu transaksi, jadi tidak pernah ada keadaan setengah jadi (resep
-- lama sudah terhapus tapi yang baru belum masuk) kalau ada kesalahan.
create or replace function public.set_recipe(
  p_menu_item_id text,
  p_lines       jsonb,
  p_actor_id    uuid,
  p_meta        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.log_actor_role;
  v_id         uuid;
  v_jumlah     integer;
  v_line       jsonb;
  v_ingredient uuid;
  v_qty        numeric;
  -- Berapa kali satu bahan disebut di dalam lines (untuk cek bahan dobel).
  v_jumlah_bahan integer;
  v_sebelum    jsonb;
  v_baru       jsonb;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_menu_item_id, 'menuItemId');

  -- Menu harus ada. Recipe punya foreign key ke menu_items, jadi tanpa
  -- pemeriksaan ini pesannya akan jadi error foreign key yang membingungkan.
  if not exists (select 1 from public.menu_items as m where m.id = v_id) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'menu dengan id ' || p_menu_item_id || ' tidak ditemukan';
  end if;

  -- lines harus berupa array JSON. Kalau tidak, p_jumlah tidak boleh dihitung.
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'VALIDATION_FAILED'
      using detail = 'lines harus berupa array dari baris resep';
  end if;

  v_jumlah := jsonb_array_length(p_lines);

  -- Batas 20 baris resep.
  if v_jumlah > 20 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'resep maksimal 20 baris';
  end if;

  -- Resep lama diambil lebih dulu untuk logged before.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ingredientId', r.ingredient_id,
        'qtyPerPortion', r.qty_per_portion
      )
      order by r.ingredient_id
    ),
    '[]'::jsonb
  )
  into v_sebelum
  from public.recipes as r
  where r.menu_item_id = v_id;

  -- Cek setiap baris SEBELUM menghapus resep lama, supaya kalau ada baris yang
  -- salah tidak ada data yang berubah sama sekali.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    -- ingredientId wajib ada dan formatnya uuid.
    v_ingredient := public.parse_admin_uuid(
      v_line ->> 'ingredientId',
      'ingredientId'
    );

    -- Bahan harus ada. Kalau tidak, insert akan gagal dengan error foreign key
    -- yang tidak ramah.
    if not exists (
      select 1 from public.ingredients as i where i.id = v_ingredient
    ) then
      raise exception 'VALIDATION_FAILED'
        using detail = 'bahan dengan id ' || coalesce(v_line ->> 'ingredientId', 'kosong') || ' tidak ditemukan';
    end if;

    -- qtyPerPortion wajib ada dan lebih dari 0.
    begin
      v_qty := (v_line ->> 'qtyPerPortion')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'VALIDATION_FAILED'
          using detail = 'qtyPerPortion pada baris bahan ' || coalesce(v_line ->> 'ingredientId', 'kosong') || ' harus berupa angka';
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION_FAILED'
        using detail = 'qtyPerPortion harus lebih dari 0';
    end if;

-- Bahan tidak boleh ganda di dalam resep yang sama.
    --
    -- Cara ceknya: hitung berapa kali bahan ini disebut di seluruh array lines.
    -- Kalau lebih dari satu, berarti bahan dobel. Ini diperiksa lewat array
    -- yang sudah dibaca, supaya tidak perlu bergantung pada batasan unik
    -- database (yang pesan errornya tidak menjelaskan bahannya yang mana).
    select count(*)
    into v_jumlah_bahan
    from jsonb_to_recordset(p_lines) as b(ingredient_id uuid)
    where b.ingredient_id = v_ingredient;

    if v_jumlah_bahan > 1 then
      raise exception 'VALIDATION_FAILED'
        using detail = 'bahan ' || coalesce(v_line ->> 'ingredientId', 'kosong') || ' disebut lebih dari sekali di resep';
    end if;
  end loop;

  -- Semua baris valid: sekarang boleh menulis.
  delete from public.recipes where menu_item_id = v_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_ingredient := public.parse_admin_uuid(v_line ->> 'ingredientId', 'ingredientId');
    v_qty := (v_line ->> 'qtyPerPortion')::numeric;

    insert into public.recipes (menu_item_id, ingredient_id, qty_per_portion)
    values (v_id, v_ingredient, v_qty);
  end loop;

  -- Resep baru (untuk logged after), diambil dari database supaya yang ditulis
  -- benar-benar yang tersimpan.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('ingredientId', r.ingredient_id, 'qtyPerPortion', r.qty_per_portion)
      order by r.ingredient_id
    ),
    '[]'::jsonb
  )
  into v_baru
  from public.recipes as r
  where r.menu_item_id = v_id;

  perform public.write_activity_log(
    p_actor_id, v_role, 'recipe.updated', 'recipe', v_id, null,
    v_sebelum, v_baru,
    p_meta
  );

  return jsonb_build_object('menuItemId', v_id, 'lines', v_baru);
end;
$$;

comment on function public.set_recipe(text, jsonb, uuid, jsonb) is
  'Admin mengganti seluruh resep satu menu dalam satu transaksi. 0-20 baris, bahan tidak boleh ganda dan harus ada, qtyPerPortion lebih dari 0. Log: recipe.updated dengan before/after.';

revoke all on function public.set_recipe(text, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_recipe(text, jsonb, uuid, jsonb) to service_role;

-- ============================================================================
-- 5. create_ingredient(p_name, p_unit, p_initial_stock, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Membuat bahan baku baru.
--
-- Kalau stok awal lebih dari 0, dicatat sebagai pergerakan bertipe restock
-- (docs/api-contract bagian 4b), supaya riwayat stok terisi sejak awal dan
-- Admin bisa menelusurinya.
-- CATATAN TENTANG URUTAN PARAMETER: di PostgreSQL, begitu satu parameter punya
-- nilai bawaan, semua parameter setelahnya WAJIB juga punya nilai bawaan.
-- Karena itu p_actor_id (wajib) ditulis sebelum p_initial_stock (opsional), dan
-- p_meta ada di paling akhir. Kalau urutannya dibalik, PostgreSQL menolak
-- membuat fungsi ini.
create or replace function public.create_ingredient(
  p_name          text,
  p_unit          public.ingredient_unit,
  p_actor_id      uuid,
  p_meta          jsonb default '{}'::jsonb,
  p_initial_stock numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.log_actor_role;
  v_name     text;
  v_stock    numeric;
  v_ingredient_id uuid;
begin
  v_role := public.require_admin(p_actor_id);

  v_name := public.validate_admin_name(p_name, 'name');
  perform public.require_unique_name('ingredients', v_name, 'name', null);

  -- Satuan wajib diisi. Enum di database sudah menolak nilai di luar g/ml/pcs,
  -- tapi pesan errornya tidak ramah, jadi dicek di sini.
  if p_unit is null then
    raise exception 'VALIDATION_FAILED'
      using detail = 'unit wajib diisi (g, ml, atau pcs)';
  end if;

  -- Stok awal: kalau tidak diisi, dianggap 0.
  v_stock := coalesce(p_initial_stock, 0);

  -- Stok awal tidak boleh negatif (stok minus hanya muncul dari pemakaian atau
  -- dari koreksi yang salah).
  if v_stock < 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'initialStock tidak boleh negatif';
  end if;

  insert into public.ingredients (name, unit, stock_qty)
  values (v_name, p_unit, v_stock)
  returning id into v_ingredient_id;

  perform public.write_activity_log(
    p_actor_id, v_role, 'ingredient.created', 'ingredient', v_ingredient_id, null,
    null,
    jsonb_build_object('name', v_name, 'unit', p_unit, 'stockQty', v_stock),
    p_meta
  );

  -- Ada stok awal: catat sebagai pergerakan restock, supaya ada jejaknya.
  if v_stock > 0 then
    insert into public.stock_movements (
      ingredient_id, order_id, type, qty_change, stock_after, created_by, note
    ) values (
      v_ingredient_id, null, 'restock', v_stock, v_stock, p_actor_id,
      'Stok awal saat bahan dibuat'
    );

    perform public.write_activity_log(
      p_actor_id, v_role, 'stock.restocked', 'ingredient', v_ingredient_id, null,
      jsonb_build_object('stockQty', 0),
      jsonb_build_object('stockQty', v_stock),
      p_meta
    );
  end if;

  return jsonb_build_object(
    'ingredientId', v_ingredient_id,
    'name', v_name,
    'unit', p_unit,
    'stockQty', v_stock
  );
end;
$$;

comment on function public.create_ingredient(text, public.ingredient_unit, uuid, jsonb, numeric) is
  'Admin membuat bahan baku. Stok awal lebih dari 0 dicatat sebagai pergerakan restock. Log: ingredient.created, plus stock.restocked kalau ada stok awal. Urutan parameter: p_actor_id dan p_meta dulu, baru p_initial_stock (karena yang punya nilai bawaan harus paling akhir).';

revoke all on function public.create_ingredient(text, public.ingredient_unit, uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.create_ingredient(text, public.ingredient_unit, uuid, jsonb, numeric) to service_role;

-- ============================================================================
-- 6. update_ingredient(p_ingredient_id, p_name, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Mengubah NAMA bahan saja.
--
-- KENAPA SATUAN TIDAK BISA DIUBAH: satuan (g/ml/pcs) adalah arti dari angka
-- stok. Kalau satuan diubah dari gram ke pcs tanpa mengubah angkanya, angka 2000
-- yang sebelumnya berarti 2 kg jadi berarti 2000 pcs, dan seluruh resep yang
-- memakainya jadi salah diam-diam. Karena itu satuan dikunci sejak bahan dibuat.
-- Kalau memang satuan salah, buat bahan baru lalu pindahkan resepnya.
create or replace function public.update_ingredient(
  p_ingredient_id text,
  p_name         text,
  p_actor_id     uuid,
  p_meta         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        public.log_actor_role;
  v_id          uuid;
  v_name        text;
  v_sebelum     text;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_ingredient_id, 'ingredientId');
  v_name := public.validate_admin_name(p_name, 'name');
  perform public.require_unique_name('ingredients', v_name, 'name', v_id);

  -- Baris dikunci supaya nilai before tidak berubah di tengah.
  select i.name
  into v_sebelum
  from public.ingredients as i
  where i.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'bahan dengan id ' || p_ingredient_id || ' tidak ditemukan';
  end if;

  update public.ingredients
  set name = v_name
  where id = v_id;

  -- Hanya nama yang dicatat. Satuan sengaja tidak ada di before/after karena
  -- tidak pernah berubah lewat fungsi ini.
  perform public.write_activity_log(
    p_actor_id, v_role, 'ingredient.updated', 'ingredient', v_id, null,
    jsonb_build_object('name', v_sebelum),
    jsonb_build_object('name', v_name),
    p_meta
  );

  return jsonb_build_object('ingredientId', v_id, 'name', v_name);
end;
$$;

comment on function public.update_ingredient(text, text, uuid, jsonb) is
  'Admin mengubah nama bahan. Satuan tidak bisa diubah setelah bahan dibuat karena mengubah arti angka stok dan resep. Log: ingredient.updated.';

revoke all on function public.update_ingredient(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_ingredient(text, text, uuid, jsonb) to service_role;

-- ============================================================================
-- 7. restock_ingredient(p_ingredient_id, p_qty, p_note, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Menambah stok bahan.
--
-- PERUBAHAN STOK DI SELURUH FILE INI:
--   1. Baris bahan dikunci dengan "for update". Ini penting: kalau dua Admin
--      menambah stok bersamaan tanpa penguncian, keduanya membaca stok lama
--      yang sama lalu menimpanya, dan salah satu penambahan hilang diam-diam.
--      for update membuat yang kedua menunggu sampai yang pertama selesai, lalu
--      membaca stok yang SUDAH diperbarui.
--   2. stock_after diisi dari baris yang baru di-update, bukan dihitung manual,
--      supaya yang tertulis di stock_movements sama dengan stok yang tersimpan.
--   3. Semua dalam satu transaksi. Kalau ada langkah yang gagal, perubahan stok
--      dan pencatatannya dibatalkan bersama.
create or replace function public.restock_ingredient(
  p_ingredient_id text,
  p_qty           numeric,
  p_note          text,
  p_actor_id      uuid,
  p_meta          jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role         public.log_actor_role;
  v_id           uuid;
  v_qty          numeric;
  v_note         text;
  v_sebelum      numeric;
  v_setelah      numeric;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_ingredient_id, 'ingredientId');

  -- qty lebih dari 0. Restock berarti menambah, jadi nol atau negatif tidak
  -- masuk akal di sini (untuk mengoreksi ke jumlah tertentu, pakai
  -- adjust_stock).
  if p_qty is null then
    raise exception 'VALIDATION_FAILED' using detail = 'qty wajib diisi';
  end if;

  begin
    v_qty := p_qty;
  exception
    when numeric_value_out_of_range then
      raise exception 'VALIDATION_FAILED' using detail = 'qty di luar batas angka';
  end;

  if v_qty <= 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'qty harus lebih dari 0';
  end if;

  -- Catatan opsional, maksimal 100 karakter (api-contract bagian 4b).
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 100 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'note maksimal 100 karakter';
  end if;

  -- Kunci baris bahan (lihat catatan PERUBAHAN STOK di atas).
  select i.stock_qty
  into v_sebelum
  from public.ingredients as i
  where i.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'bahan dengan id ' || p_ingredient_id || ' tidak ditemukan';
  end if;

  update public.ingredients
  set stock_qty = v_sebelum + v_qty
  where id = v_id
  returning stock_qty into v_setelah;

  insert into public.stock_movements (
    ingredient_id, order_id, type, qty_change, stock_after, created_by, note
  ) values (
    v_id, null, 'restock', v_qty, v_setelah, p_actor_id, v_note
  );

  perform public.write_activity_log(
    p_actor_id, v_role, 'stock.restocked', 'ingredient', v_id, null,
    jsonb_build_object('stockQty', v_sebelum, 'qty', v_qty),
    jsonb_build_object('stockQty', v_setelah),
    p_meta
  );

  return jsonb_build_object(
    'ingredientId', v_id,
    'stockQty', v_setelah,
    'qtyChange', v_qty
  );
end;
$$;

comment on function public.restock_ingredient(text, numeric, text, uuid, jsonb) is
  'Admin menambah stok bahan. Baris bahan dikunci for update, pergerakan restock dicatat dengan stock_after yang benar. Log: stock.restocked.';

revoke all on function public.restock_ingredient(text, numeric, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.restock_ingredient(text, numeric, text, uuid, jsonb) to service_role;

-- ============================================================================
-- 8. adjust_stock(p_ingredient_id, p_new_qty, p_reason, p_actor_id, p_meta)
-- ============================================================================
-- Hanya admin. Mengoreksi stok ke jumlah hasil hitung fisik.
--
-- Berbeda dengan restock: yang dimasukkan di sini adalah HASIL HITUNG (newQty),
-- bukan jumlah tambahan. Jadi selisihnya dihitung di dalam fungsi
-- (newQty - stok sekarang) dan selisih itulah yang dicatat sebagai qty_change
-- (bisa positif atau negatif).
--
-- Fungsi ini juga dipakai untuk mengembalikan stok yang minus ke angka
-- sebenarnya: aturan "stok boleh minus" (docs/data-model.md aturan 4) hanya
-- boleh dipakai untuk mencatat selisih sementara, dan Admin harus
-- mengoreksinya lewat fungsi ini.
--
-- Alasan (p_reason) wajib diisi supaya log bisa menjelaskan kenapa stok
-- berubah. Tanpa alasan, riwayat stok jadi tidak bisa ditelusuri.
create or replace function public.adjust_stock(
  p_ingredient_id text,
  p_new_qty       numeric,
  p_reason        text,
  p_actor_id      uuid,
  p_meta          jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.log_actor_role;
  v_id         uuid;
  v_new_qty    numeric;
  v_reason     text;
  v_sebelum    numeric;
  v_selisih    numeric;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_ingredient_id, 'ingredientId');

  -- newQty wajib diisi dan 0 atau lebih (hasil hitung fisik tidak bisa minus).
  if p_new_qty is null then
    raise exception 'VALIDATION_FAILED' using detail = 'newQty wajib diisi';
  end if;

  if p_new_qty < 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'newQty tidak boleh negatif (hasil hitung fisik 0 atau lebih)';
  end if;

  -- Alasan wajib 1-100 karakter (api-contract bagian 4b).
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 1 or char_length(v_reason) > 100 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'reason wajib diisi, maksimal 100 karakter';
  end if;

  -- Kunci baris bahan (lihat catatan PERUBAHAN STOK di file ini).
  select i.stock_qty
  into v_sebelum
  from public.ingredients as i
  where i.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'bahan dengan id ' || p_ingredient_id || ' tidak ditemukan';
  end if;

  -- Selisih antara hasil hitung dan stok yang tercatat di sistem.
  v_selisih := p_new_qty - v_sebelum;

  -- Kalau selisihnya nol, tidak ada yang perlu dicatat. Tabel stock_movements
  -- melarang qty_change = 0 (supaya riwayat tidak berisi baris yang tidak
  -- berarti), jadi penyesuaian tanpa perubahan sengaja ditolak.
  if v_selisih = 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'stok bahan sudah ' || v_sebelum::text || ', tidak ada yang perlu dikoreksi';
  end if;

  update public.ingredients
  set stock_qty = p_new_qty
  where id = v_id;

  insert into public.stock_movements (
    ingredient_id, order_id, type, qty_change, stock_after, created_by, note
  ) values (
    v_id, null, 'adjustment', v_selisih, p_new_qty, p_actor_id, v_reason
  );

  -- Alasan disimpan di meta dan di note pergerakan, supaya alasan koreksi
  -- selalu ikut tersimpan bersama perubahannya.
  perform public.write_activity_log(
    p_actor_id, v_role, 'stock.adjusted', 'ingredient', v_id, null,
    jsonb_build_object('stockQty', v_sebelum),
    jsonb_build_object('stockQty', p_new_qty, 'qtyChange', v_selisih),
    p_meta || jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object(
    'ingredientId', v_id,
    'stockQty', p_new_qty,
    'qtyChange', v_selisih
  );
end;
$$;

comment on function public.adjust_stock(text, numeric, text, uuid, jsonb) is
  'Admin mengoreksi stok ke hasil hitung fisik. Selisih dicatat sebagai pergerakan adjustment. Dipakai juga untuk mengembalikan stok minus ke angka sebenarnya. Log: stock.adjusted dengan alasan.';

revoke all on function public.adjust_stock(text, numeric, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.adjust_stock(text, numeric, text, uuid, jsonb) to service_role;