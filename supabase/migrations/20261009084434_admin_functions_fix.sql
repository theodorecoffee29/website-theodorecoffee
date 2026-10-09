-- File ini: migrasi KOREKSI untuk tiga fungsi Admin.
--
-- Dijalankan setelah 20261008062847_admin_functions.sql. File utama itu TIDAK
-- diubah (sudah terpasang di database development), jadi perbaikannya ditulis
-- di sini sebagai create or replace dengan signature yang sama persis.
--
-- Isi file ini hanya tiga fungsi:
--   1. set_recipe        -> perbaikan cek bahan ganda dan cek bahan ada
--   2. update_menu_item  -> urutan: cek baris ada dulu, baru cek nama unik
--   3. update_ingredient -> urutan: cek baris ada dulu, baru cek nama unik
--
-- Alasan file ini terpisah: docs/api-contract.md bagian 4b hanya menetapkan
-- aturan perilakunya, dan kita sudah mengubah cara implementasinya. Yang
-- diperbaiki di sini adalah cara, bukan aturan.
--
-- KONSEP PENTING (sama seperti file utama):
-- - "security definer" + "set search_path = ''": fungsi berjalan dengan hak
--   pemilik dan semua nama objek ditulis lengkap dengan schema.
-- - Setiap fungsi hanya boleh dipanggil server yang memakai service_role:
--   revoke execute dari public/anon/authenticated, lalu grant hanya ke
--   service_role. Ini diulang di sini karena create or replace mengembalikan
--   hak akses ke keadaan bawaan.
-- - Peran admin dibaca dari public.profiles lewat require_admin, tidak pernah
--   dari kiriman klien.

-- ============================================================================
-- 1. set_recipe(p_menu_item_id, p_lines, p_actor_id, p_meta)
-- ============================================================================
-- PERBAIKAN: cek bahan ganda sebelumnya tidak pernah bekerja.
--
-- Penyebabnya: baris resep dibaca lewat
--     jsonb_to_recordset(p_lines) as b(ingredient_id uuid)
-- lalu dibandingkan lewat b.ingredient_id. jsonb_to_recordset memetakan
-- berdasarkan NAMA KOLOM. Kunci di p_lines adalah "ingredientId" (camelCase),
-- sedangkan kolomnya bernama "ingredient_id", jadi tidak ada yang cocok:
-- b.ingredient_id selalu kosong, count(*) selalu 0, dan bahan ganda tidak
-- pernah terdeteksi. Akibatnya insert berjalan dan gagal diam-diam karena
-- primary key (menu_item_id, ingredient_id) bentrok, dengan pesan error database
-- yang tidak menjelaskan bahannya yang mana.
--
-- Perbaikannya: jsonb_to_recordset ditulis dengan nama kolom yang sama persis
-- dengan kunci jsonb ("ingredientId"), lalu uuid-nya dibaca dari situ. Dengan
-- begitu basename_unique benar-benar dihitung.
--
-- Semua perilaku lain dipertahankan: 0-20 baris, bahan harus ada, qtyPerPortion
-- lebih dari 0, resep kosong diizinkan, penggantian seluruh resep dalam satu
-- transaksi, dan log recipe.updated dengan before/after.
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
  v_role          public.log_actor_role;
  v_id            uuid;
  v_jumlah        integer;
  v_line          jsonb;
  v_ingredient    uuid;
  v_qty           numeric;
  -- Berapa kali satu bahan disebut di dalam lines (untuk cek bahan dobel).
  v_jumlah_bahan  integer;
  v_sebelum       jsonb;
  v_baru          jsonb;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_menu_item_id, 'menuItemId');

  -- Menu harus ada. Recipe punya foreign key ke menu_items, jadi tanpa
  -- pemeriksaan ini pesannya akan jadi error foreign key yang membingungkan.
  if not exists (select 1 from public.menu_items as m where m.id = v_id) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'menu dengan id ' || p_menu_item_id || ' tidak ditemukan';
  end if;

  -- lines harus berupa array JSON. Kalau tidak, panjangnya tidak boleh dihitung.
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

  -- Cek SETIAP baris SEBELUM menghapus resep lama, supaya kalau ada baris yang
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
        using detail = 'bahan dengan id '
          || coalesce(v_line ->> 'ingredientId', 'kosong')
          || ' tidak ditemukan';
    end if;

    -- qtyPerPortion wajib ada dan lebih dari 0.
    begin
      v_qty := (v_line ->> 'qtyPerPortion')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'VALIDATION_FAILED'
          using detail = 'qtyPerPortion pada baris bahan '
            || coalesce(v_line ->> 'ingredientId', 'kosong')
            || ' harus berupa angka';
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION_FAILED'
        using detail = 'qtyPerPortion harus lebih dari 0';
    end if;

    -- Bahan tidak boleh ganda di dalam resep yang sama.
    --
    -- Cara ceknya: hitung berapa kali bahan ini disebut di seluruh array lines.
    -- Kalau lebih dari satu, berarti bahan dobel.
    --
    -- PENTING: nama kolom di jsonb_to_recordset harus PERSIS sama dengan kunci
    -- di jsonb ("ingredientId"), karena pemetaannya berdasarkan nama kolom.
    -- Kalau ditulis "ingredient_id", nilainya selalu kosong dan pemeriksaan ini
    -- tidak pernah menangkap apa pun.
    select count(*)
    into v_jumlah_bahan
    from jsonb_to_recordset(p_lines) as b("ingredientId" uuid)
    where b."ingredientId" = v_ingredient;

    if v_jumlah_bahan > 1 then
      raise exception 'VALIDATION_FAILED'
        using detail = 'bahan '
          || coalesce(v_line ->> 'ingredientId', 'kosong')
          || ' disebut lebih dari sekali di resep';
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
      jsonb_build_object(
        'ingredientId', r.ingredient_id,
        'qtyPerPortion', r.qty_per_portion
      )
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
-- 2. update_menu_item(p_menu_item_id, p_name, p_price, p_actor_id, p_meta)
-- ============================================================================
-- PERBAIKAN: urutan pemeriksaan dibalik.
--
-- Sebelumnya nama unik dicek lebih dulu, lalu baru cek apakah baris menu ada.
-- Akibatnya, untuk id yang tidak ada di database, pesan errornya jadi soal nama
-- ("name ... sudah dipakai") padahal masalah sebenarnya id-nya salah. Itu
-- menyesatkan: Admin mengira menunya bentrok, padahal menunya memang tidak ada.
--
-- Sekarang baris dicek lebih dulu (sekaligus dikunci dengan for update), baru
-- nama uniknya dicek. Nama unik dicek terhadap baris yang benar-benar terkunci,
-- jadi tidak mungkin salah considers id yang tidak ada.
--
-- Semua perilaku lain dipertahankan: harga 1-10.000.000, order lama tidak
-- berubah (harga tersimpan di order_items), dan log menu.updated dengan
-- before/after.
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
  v_role         public.log_actor_role;
  v_id           uuid;
  v_name         text;
  v_price        integer;
  v_sebelum_nama text;
  v_sebelum_harga integer;
begin
  v_role := public.require_admin(p_actor_id);

  -- Id dari teks ke uuid. Format salah jadi VALIDATION_FAILED.
  v_id := public.parse_admin_uuid(p_menu_item_id, 'menuItemId');

  -- BARIS DICEK LEBIH DAHULU. Baris ini juga mengunci baris menu sampai
  -- transaksi selesai, jadi nilai before yang diambil di bawah dan pengecekan
  -- nama unik sama-sama referring ke baris yang terkunci.
  select m.name, m.price
  into v_sebelum_nama, v_sebelum_harga
  from public.menu_items as m
  where m.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'menu dengan id ' || p_menu_item_id || ' tidak ditemukan';
  end if;

  -- Nama dipangkas dan dicek panjangnya (1-60 karakter).
  v_name := public.validate_admin_name(p_name, 'name');

  -- Baru sekarang nama uniknya dicek. p_kecuali_id = v_id supaya baris menu
  -- ini sendiri tidak ikut dianggap bentrok (menu boleh menyimpan nama yang
  -- sama dengan dirinya sendiri).
  perform public.require_unique_name('menu_items', v_name, 'name', v_id);

  -- Harga bilangan bulat 1-10.000.000.
  v_price := public.validate_admin_price(p_price);

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
  'Admin mengubah nama dan harga menu. Order lama tidak berubah karena harga di snapshot saat order dibuat. Baris dicek ada dulu, baru nama unik. Log: menu.updated dengan before/after.';

revoke all on function public.update_menu_item(text, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_menu_item(text, text, integer, uuid, jsonb) to service_role;

-- ============================================================================
-- 3. update_ingredient(p_ingredient_id, p_name, p_actor_id, p_meta)
-- ============================================================================
-- PERBAIKAN: urutan pemeriksaan dibalik, sama seperti update_menu_item.
-- Baris dicek ada dulu (dan dikunci), baru nama uniknya dicek.
--
-- Semua perilaku lain dipertahankan: hanya nama yang bisa diubah, satuan tidak
-- bisa berubah, dan log ingredient.updated hanya memuat nama.
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
  v_role    public.log_actor_role;
  v_id      uuid;
  v_name    text;
  v_sebelum text;
begin
  v_role := public.require_admin(p_actor_id);

  v_id := public.parse_admin_uuid(p_ingredient_id, 'ingredientId');

  -- BARIS DICEK LEBIH DAHULU, sekaligus dikunci sampai transaksi selesai.
  select i.name
  into v_sebelum
  from public.ingredients as i
  where i.id = v_id
  for update;

  if not found then
    raise exception 'VALIDATION_FAILED'
      using detail = 'bahan dengan id ' || p_ingredient_id || ' tidak ditemukan';
  end if;

  -- Nama dipangkas dan dicek panjangnya (1-60 karakter).
  v_name := public.validate_admin_name(p_name, 'name');

  -- Baru sekarang nama uniknya dicek. p_kecuali_id = v_id supaya bahan ini
  -- sendiri tidak ikut dianggap bentrok.
  perform public.require_unique_name('ingredients', v_name, 'name', v_id);

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
  'Admin mengubah nama bahan. Satuan tidak bisa diubah setelah bahan dibuat karena mengubah arti angka stok dan resep. Baris dicek ada dulu, baru nama unik. Log: ingredient.updated.';

revoke all on function public.update_ingredient(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_ingredient(text, text, uuid, jsonb) to service_role;
