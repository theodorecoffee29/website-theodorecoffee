-- File ini: fungsi database untuk order, bagian 1 (Theodore Coffee V1).
-- Dijalankan manual di Supabase Dashboard > SQL Editor, setelah tabel dan RLS.
-- Sumber aturan: docs/api-contract.md (bagian 1, 2, 4, 6), docs/order-flow.md,
-- docs/data-model.md, dan docs/logging.md.
--
-- Isi file ini hanya fungsi. Belum ada confirm_order, cancel_order, start_order,
-- dan finish_order; itu masuk file migrasi berikutnya.
--
-- KONSEP PENTING — security definer dan revoke:
-- - "security definer" berarti fungsi berjalan memakai hak PEMILIK fungsi
--   (biasanya postgres), bukan hak pemanggil. Jadi walau RLS menutup tabel,
--   fungsi ini tetap bisa membaca dan menulis dengan aman.
-- - "set search_path = ''" mengosongkan daftar schema yang dicari otomatis.
--   Tujuannya supaya tidak ada tabel atau fungsi palsu dari schema lain yang
--   dipanggil diam-diam. Karena search_path kosong, semua nama objek WAJIB
--   ditulis lengkap dengan nama schema-nya (mis. public.orders).
-- - "revoke execute ... from public, anon, authenticated" menutup fungsi dari
--   customer/browser dan akun login biasa. Fungsi ini hanya untuk SERVER yang
--   memakai kunci rahasia service_role, sesuai api-contract bagian 1.

-- ============================================================================
-- 1. wib_today() — tanggal hari ini menurut zona waktu Asia/Jakarta (WIB)
-- ============================================================================
-- Fungsi kecil yang dipakai berkali-kali untuk menentukan "hari" bisnis.
-- PostgreSQL menyimpan waktu dalam UTC. Supaya pergantian hari mengikuti jam
-- Indonesia, waktu UTC dikonversi dulu ke Asia/Jakarta baru diambil tanggalnya.
-- Contoh: 2026-10-07 18:00 UTC = 2026-10-08 01:00 WIB, jadi hari WIB-nya 8.
create or replace function public.wib_today()
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (now() at time zone 'Asia/Jakarta')::date;
end;
$$;

comment on function public.wib_today() is
  'Tanggal hari ini di zona waktu Asia/Jakarta (WIB), dipakai untuk nomor antrean dan laporan harian.';

revoke all on function public.wib_today() from public, anon, authenticated;
grant execute on function public.wib_today() to service_role;

-- ============================================================================
-- 2. menu_item_available(menu_item_id) — apakah menu bisa dipesan
-- ============================================================================
-- Menu tersedia kalau:
--   1) menunya aktif (is_active = true), dan
--   2) stok SEMUA bahan di resepnya cukup untuk minimal satu porsi
--      (stock_qty >= qty_per_portion).
-- Menu tanpa resep (belum diisi takarannya) dianggap tersedia, supaya menu baru
-- tidak otomatis tampil Habis hanya karena resepnya belum dibuat.
-- Fungsi ini mengembalikan false (bukan error) kalau menunya tidak ada.
create or replace function public.menu_item_available(p_menu_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_available boolean;
begin
  select
    m.is_active
    and not exists (
      select 1
      from public.recipes as r
      join public.ingredients as i on i.id = r.ingredient_id
      where r.menu_item_id = m.id
        and i.stock_qty < r.qty_per_portion
    )
  into v_available
  from public.menu_items as m
  where m.id = p_menu_item_id;

  -- Kalau menunya tidak ditemukan, select di atas tidak mengembalikan baris,
  -- sehingga v_available tetap kosong. Anggap tidak tersedia.
  return coalesce(v_available, false);
end;
$$;

comment on function public.menu_item_available(uuid) is
  'True kalau menu aktif dan stok semua bahan resepnya cukup untuk satu porsi. Menu tanpa resep dianggap tersedia.';

revoke all on function public.menu_item_available(uuid) from public, anon, authenticated;
grant execute on function public.menu_item_available(uuid) to service_role;

-- ============================================================================
-- 3. write_activity_log(...) — menulis satu baris ke activity_logs
-- ============================================================================
-- FUNGSI DALAM (helper) yang dipakai fungsi order lain supaya penulisan log
-- hanya lewat satu pintu, sesuai docs/logging.md bagian 6. Aksi order harus
-- tercatat dalam transaksi yang sama dengan perubahannya, jadi log ditulis di
-- sini, bukan dari aplikasi.
-- actor_id kosong (null) kalau pelakunya customer atau sistem.
create or replace function public.write_activity_log(
  p_actor_id uuid,
  p_actor_role public.log_actor_role,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_order_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (
    actor_id, actor_role, action, entity_type, entity_id, order_id,
    before, after, meta
  ) values (
    p_actor_id, p_actor_role, p_action, p_entity_type, p_entity_id, p_order_id,
    p_before, p_after, p_meta
  );
end;
$$;

comment on function public.write_activity_log(uuid, public.log_actor_role, text, text, uuid, uuid, jsonb, jsonb, jsonb) is
  'Fungsi dalam untuk menulis satu baris log aktivitas. Semua fungsi order menulis log lewat fungsi ini.';

revoke all on function public.write_activity_log(uuid, public.log_actor_role, text, text, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.write_activity_log(uuid, public.log_actor_role, text, text, uuid, uuid, jsonb, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- 4. get_menu() — daftar menu aktif untuk layar customer
-- ============================================================================
-- Mengembalikan satu objek jsonb: { "items": [ { id, name, price, available } ] }.
-- Hanya menu aktif yang dikirim (menu nonaktif tidak boleh tampil di customer).
-- "available" false berarti layar menampilkan menu itu sebagai Habis.
create or replace function public.get_menu()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'price', m.price,
        'available', public.menu_item_available(m.id)
      )
      order by m.name
    ),
    '[]'::jsonb
  )
  into v_items
  from public.menu_items as m
  where m.is_active;

  return jsonb_build_object('items', v_items);
end;
$$;

comment on function public.get_menu() is
  'Daftar menu aktif dalam jsonb (id, name, price, available). available false berarti Habis.';

revoke all on function public.get_menu() from public, anon, authenticated;
grant execute on function public.get_menu() to service_role;

-- ============================================================================
-- 5. create_order(customer_name, items, idempotency_key) — buat order online
-- ============================================================================
-- Input items (array jsonb): [{ "menuItemId": "<uuid>", "qty": 1, "note": "..." }]
-- Aturan (api-contract bagian 2 dan 4):
--   - nama 1-50 karakter setelah dipangkas,
--   - 1-20 baris item, qty bilangan bulat 1-99, catatan maksimal 100 karakter,
--   - menu harus ada, aktif, dan stoknya cukup (menu_item_available),
--   - harga SELALU diambil dari public.menu_items, bukan dari klien.
-- Nomor antrean diambil dari queue_counters memakai upsert atomik. Karena satu
-- pernyataan, dua permintaan bersamaan tidak mungkin mendapat nomor yang sama.
-- Kalau idempotency_key sudah dipakai, kembalikan order lama (bukan error).
create or replace function public.create_order(
  p_customer_name text,
  p_items jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name  text;
  v_item_count     integer;
  v_total          integer := 0;
  v_queue_date     date;
  v_queue_number   integer;
  v_order_id       uuid;
  v_status         public.order_status;
  v_item           jsonb;
  v_menu_id_text   text;
  v_menu_id        uuid;
  v_menu_name      text;
  v_menu_price     integer;
  v_menu_available boolean;
  v_qty_text       text;
  v_qty            integer;
  v_note           text;
begin
  -- 5a. Validasi nama customer (dipangkas dulu supaya spasi pinggir tidak dihitung).
  v_customer_name := btrim(p_customer_name);
  if v_customer_name is null
     or char_length(v_customer_name) < 1
     or char_length(v_customer_name) > 50 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'customer_name wajib 1-50 karakter setelah spasi pinggir dipangkas';
  end if;

  -- 5b. idempotency_key wajib pada pembuatan order (api-contract bagian 2).
  if p_idempotency_key is null then
    raise exception 'VALIDATION_FAILED'
      using detail = 'idempotency_key wajib diisi saat membuat order';
  end if;

  -- 5c. Idempotensi: kalau kunci ini sudah pernah dipakai, langsung kembalikan
  --     order yang sama. Ini yang membuat klik ganda tidak menghasilkan dua order.
  select o.id, o.queue_number, o.queue_date, o.status, o.total
  into v_order_id, v_queue_number, v_queue_date, v_status, v_total
  from public.orders as o
  where o.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'order_id', v_order_id,
      'queue_number', v_queue_number,
      'queue_date', v_queue_date,
      'status', v_status,
      'total', v_total
    );
  end if;

  -- 5d. Validasi bentuk daftar item.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'VALIDATION_FAILED' using detail = 'items harus berupa array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'jumlah baris item harus 1 sampai 20';
  end if;

  -- 5e. Validasi tiap item dan hitung total dari harga di database.
  --     v_total direset dulu: select idempotensi di atas mengosongkannya kalau
  --     tidak ada order lama, dan null + angka hasilnya tetap null.
  v_total := 0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VALIDATION_FAILED' using detail = 'setiap item harus berupa objek';
    end if;

    -- menuItemId diperiksa sebagai teks dulu, supaya id yang salah ketik tidak
    -- membuat error cast yang tidak ramah. Pola di bawah adalah format uuid.
    v_menu_id_text := v_item ->> 'menuItemId';
    if v_menu_id_text is null
       or v_menu_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'VALIDATION_FAILED'
        using detail = 'menuItemId harus berupa uuid yang valid';
    end if;

    select m.id, m.name, m.price, public.menu_item_available(m.id)
    into v_menu_id, v_menu_name, v_menu_price, v_menu_available
    from public.menu_items as m
    where m.id = v_menu_id_text::uuid;

    if not found or not v_menu_available then
      raise exception 'MENU_UNAVAILABLE'
        using detail = 'menu ' || v_menu_id_text || ' tidak ditemukan, nonaktif, atau bahannya habis';
    end if;

    v_qty_text := v_item ->> 'qty';
    if v_qty_text is null or v_qty_text !~ '^[0-9]+$' then
      raise exception 'VALIDATION_FAILED' using detail = 'qty harus bilangan bulat 1-99';
    end if;
    v_qty := v_qty_text::integer;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'VALIDATION_FAILED' using detail = 'qty harus bilangan bulat 1-99';
    end if;

    v_note := v_item ->> 'note';
    if v_note is not null and char_length(v_note) > 100 then
      raise exception 'VALIDATION_FAILED' using detail = 'catatan per item maksimal 100 karakter';
    end if;

    v_total := v_total + (v_menu_price * v_qty);
  end loop;

  -- 5f. Ambil nomor antrean secara atomik untuk hari ini (WIB).
  --     Upsert ini menaikkan last_number di baris queue_date hari ini. Kalau
  --     barisnya belum ada, dibuat mulai dari 1. Karena satu pernyataan SQL,
  --     dua permintaan bersamaan tidak bisa mendapat nomor yang sama.
  v_queue_date := public.wib_today();
  insert into public.queue_counters (queue_date, last_number)
  values (v_queue_date, 1)
  on conflict (queue_date)
  do update set last_number = public.queue_counters.last_number + 1
  returning last_number into v_queue_number;

  -- 5g. Simpan order. "on conflict do nothing" menangani balapan idempotensi:
  --     kalau kunci yang sama baru saja dipakai permintaan lain, tidak ada baris
  --     yang dibuat di sini dan v_order_id tetap kosong.
  v_order_id := null;
  v_status := 'menunggu_konfirmasi';
  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total, idempotency_key
  ) values (
    v_queue_date, v_queue_number, v_customer_name, 'online', v_status, v_total, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id, queue_number, queue_date, status, total
  into v_order_id, v_queue_number, v_queue_date, v_status, v_total;

  -- 5h. Kalau tadi bentrok, ambil order yang sudah ada dan kembalikan itu.
  --     (Nomor antrean yang terlanjur diambil akan melompat. Itu tidak masalah,
  --      yang penting tidak ada nomor ganda.)
  if v_order_id is null then
    select o.id, o.queue_number, o.queue_date, o.status, o.total
    into v_order_id, v_queue_number, v_queue_date, v_status, v_total
    from public.orders as o
    where o.idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'order_id', v_order_id,
      'queue_number', v_queue_number,
      'queue_date', v_queue_date,
      'status', v_status,
      'total', v_total
    );
  end if;

  -- 5i. Simpan item order dengan SALINAN nama dan harga saat ini. Salinan ini
  --     (snapshot) menjaga laporan lama tetap benar walau menu nanti diubah.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_menu_id_text := v_item ->> 'menuItemId';
    v_qty := (v_item ->> 'qty')::integer;
    v_note := v_item ->> 'note';

    select m.name, m.price
    into v_menu_name, v_menu_price
    from public.menu_items as m
    where m.id = v_menu_id_text::uuid;

    insert into public.order_items (
      order_id, menu_item_id, name_snapshot, price_snapshot, qty, note, subtotal
    ) values (
      v_order_id, v_menu_id_text::uuid, v_menu_name, v_menu_price,
      v_qty, v_note, v_menu_price * v_qty
    );
  end loop;

  -- 5j. Catat log order.created, pelakunya customer (tanpa akun, actor_id kosong).
  perform public.write_activity_log(
    null,
    'customer'::public.log_actor_role,
    'order.created',
    'order',
    v_order_id,
    v_order_id,
    null,
    jsonb_build_object(
      'status', v_status,
      'total', v_total,
      'queue_number', v_queue_number
    ),
    jsonb_build_object(
      'queue_number', v_queue_number,
      'queue_date', v_queue_date
    )
  );

  -- 5k. Kembalikan data yang dibutuhkan browser untuk halaman status.
  return jsonb_build_object(
    'order_id', v_order_id,
    'queue_number', v_queue_number,
    'queue_date', v_queue_date,
    'status', v_status,
    'total', v_total
  );
end;
$$;

comment on function public.create_order(text, jsonb, uuid) is
  'Membuat order online: validasi input, ambil harga dari menu_items, beri nomor antrean atomik, simpan order dan item, tulis log order.created. Aman terhadap klik ganda lewat idempotency_key.';

revoke all on function public.create_order(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_order(text, jsonb, uuid) to service_role;

-- ============================================================================
-- 6. get_order_status(order_id) — status satu order untuk halaman customer
-- ============================================================================
-- Parameter dibuat text (bukan uuid) supaya ID yang tidak valid pun tetap
-- menghasilkan ORDER_NOT_FOUND, bukan error database mentah, sesuai
-- api-contract bagian 4. Konversi ke uuid dilakukan di dalam dengan penanganan
-- error.
create or replace function public.get_order_status(p_order_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order    record;
  v_items    jsonb;
begin
  -- Ubah teks ke uuid. Kalau formatnya salah, seragamkan jadi ORDER_NOT_FOUND
  -- supaya pesan ke customer sama dengan order yang memang tidak ada.
  begin
    v_order_id := p_order_id::uuid;
  exception
    when invalid_text_representation then
      raise exception 'ORDER_NOT_FOUND' using detail = 'order_id tidak valid';
  end;

  select o.status, o.queue_number, o.queue_date, o.total
  into v_order
  from public.orders as o
  where o.id = v_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order_id ' || p_order_id || ' tidak ditemukan';
  end if;

  -- Ambil item dari snapshot (nama dan kuantitas), tanpa harga sesuai kebutuhan
  -- halaman status customer.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.name_snapshot,
        'qty', oi.qty,
        'note', oi.note
      )
      order by oi.name_snapshot
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items as oi
  where oi.order_id = v_order_id;

  return jsonb_build_object(
    'status', v_order.status,
    'queue_number', v_order.queue_number,
    'queue_date', v_order.queue_date,
    'items', v_items,
    'total', v_order.total
  );
end;
$$;

comment on function public.get_order_status(text) is
  'Status satu order untuk halaman customer: status, queue_number, queue_date, items (name, qty, note), dan total. ID tidak valid atau tidak ada menghasilkan ORDER_NOT_FOUND.';

revoke all on function public.get_order_status(text) from public, anon, authenticated;
grant execute on function public.get_order_status(text) to service_role;
