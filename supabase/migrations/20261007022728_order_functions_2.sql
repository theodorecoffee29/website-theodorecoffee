-- File ini: fungsi database untuk order, bagian 2 (Theodore Coffee V1).
-- Dijalankan manual di Supabase Dashboard > SQL Editor, setelah bagian 1
-- (20261007013910_order_functions_1.sql). Sumber aturan: docs/api-contract.md,
-- docs/Order-flow.md, docs/data-model.md, docs/pemissions.md, docs/logging.md.
--
-- Isi file ini: confirm_order, create_manual_order, start_order, finish_order,
-- cancel_order, plus beberapa fungsi pembantu yang dipakai bersama.
--
-- KONSEP PENTING:
-- - "security definer" + "set search_path = ''": fungsi berjalan dengan hak
--   pemilik dan semua nama objek ditulis lengkap dengan schema, supaya tidak
--   ada tabel/fungsi palsu yang ikut terpanggil. Lihat catatan di bagian 1.
-- - "revoke ... from public, anon, authenticated" + "grant ... to service_role":
--   fungsi hanya boleh dipanggil server yang memakai kunci rahasia service_role.
--   Customer dan akun login tidak boleh memanggilnya lewat API.
-- - "for update" mengunci satu baris order sampai transaksi selesai. Ini yang
--   membuat dua aksi bersamaan (mis. Konfirmasi vs Batalkan) hanya menghasilkan
--   satu pemenang, sesuai docs/Order-flow.md bagian 5.
-- - Stok BOLEH minus (docs/data-model.md aturan 4). Kekurangan stok saat
--   konfirmasi hanya memicu peringatan dan log, bukan error, karena customer
--   sudah membayar dan stok fisik bisa selisih.

-- ============================================================================
-- FUNGSI PEMBANTU
-- ============================================================================

-- parse_order_id(p_order_id): mengubah teks menjadi uuid.
-- Kalau formatnya bukan uuid, seragamkan jadi ORDER_NOT_FOUND supaya pesan ke
-- pengguna tidak membocorkan error database mentah (api-contract bagian 4).
create or replace function public.parse_order_id(p_order_id text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  begin
    v_order_id := p_order_id::uuid;
  exception
    when invalid_text_representation then
      raise exception 'ORDER_NOT_FOUND' using detail = 'order_id tidak valid';
  end;
  return v_order_id;
end;
$$;

comment on function public.parse_order_id(text) is
  'Mengubah id order dari teks ke uuid. Format salah diubah menjadi error ORDER_NOT_FOUND.';

revoke all on function public.parse_order_id(text) from public, anon, authenticated;
grant execute on function public.parse_order_id(text) to service_role;

-- require_staff(p_actor_id, p_allowed_roles): memastikan pelakunya staf aktif
-- yang berperan sesuai, lalu mengembalikan perannya.
-- Peran SELALU dibaca dari tabel profiles, tidak pernah dari kiriman klien.
-- Akun yang dinonaktifkan langsung kehilangan aksesnya tanpa mengubah fungsi.
create or replace function public.require_staff(
  p_actor_id uuid,
  p_allowed_roles public.app_role[]
)
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if p_actor_id is null then
    raise exception 'FORBIDDEN' using detail = 'aksi ini hanya untuk staf yang sudah login';
  end if;

  select p.role
  into v_role
  from public.profiles as p
  where p.id = p_actor_id
    and p.is_active;

  if not found then
    raise exception 'FORBIDDEN' using detail = 'akun tidak ditemukan atau sudah dinonaktifkan';
  end if;

  if not (v_role = any(p_allowed_roles)) then
    raise exception 'FORBIDDEN' using detail = 'peran ' || v_role::text || ' tidak boleh melakukan aksi ini';
  end if;

  return v_role;
end;
$$;

comment on function public.require_staff(uuid, public.app_role[]) is
  'Membaca peran staf dari tabel profiles dan memastikan akun aktif serta berperan sesuai. Menolak dengan FORBIDDEN kalau tidak.';

revoke all on function public.require_staff(uuid, public.app_role[]) from public, anon, authenticated;
grant execute on function public.require_staff(uuid, public.app_role[]) to service_role;

-- validate_customer_name(p_customer_name): memangkas spasi pinggir dan
-- memastikan panjangnya 1-50 karakter, lalu mengembalikan nama yang sudah bersih.
create or replace function public.validate_customer_name(p_customer_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(p_customer_name);
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 50 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'customer_name wajib 1-50 karakter setelah spasi pinggir dipangkas';
  end if;
  return v_name;
end;
$$;

comment on function public.validate_customer_name(text) is
  'Memangkas dan memvalidasi nama customer (1-50 karakter). Dipakai create_manual_order.';

revoke all on function public.validate_customer_name(text) from public, anon, authenticated;
grant execute on function public.validate_customer_name(text) to service_role;

-- validate_order_items(p_items): memeriksa array item dan mengembalikan baris
-- yang sudah tervalidasi: menu_item_id, name_snapshot, price_snapshot, qty, note.
-- Validasi: 1-20 baris, menuItemId uuid valid, menu ada/aktif/stok cukup,
-- qty bilangan bulat 1-99, catatan maks 100 karakter. Harga diambil dari
-- public.menu_items (tidak pernah dipercaya dari klien).
-- Dibuat sebagai fungsi agar create_manual_order tidak menyalin kode validasi.
create or replace function public.validate_order_items(p_items jsonb)
returns table (
  menu_item_id    uuid,
  name_snapshot   text,
  price_snapshot  integer,
  qty             integer,
  note            text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'VALIDATION_FAILED' using detail = 'items harus berupa array';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'VALIDATION_FAILED' using detail = 'jumlah baris item harus 1 sampai 20';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VALIDATION_FAILED' using detail = 'setiap item harus berupa objek';
    end if;

    v_menu_id_text := v_item ->> 'menuItemId';
    if v_menu_id_text is null
       or v_menu_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'VALIDATION_FAILED' using detail = 'menuItemId harus berupa uuid yang valid';
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

    return query select v_menu_id, v_menu_name, v_menu_price, v_qty, v_note;
  end loop;
end;
$$;

comment on function public.validate_order_items(jsonb) is
  'Memvalidasi array item order dan mengembalikan baris siap simpan (nama dan harga dari menu_items). Dipakai create_manual_order.';

revoke all on function public.validate_order_items(jsonb) from public, anon, authenticated;
grant execute on function public.validate_order_items(jsonb) to service_role;

-- apply_order_confirmation(...): efek samping konfirmasi yang dipakai bersama
-- oleh confirm_order dan create_manual_order. Menganggap order SUDAH berstatus
-- antrean dan kolom confirmed_* sudah diisi oleh pemanggil. Yang dilakukan:
--   1) catat pembayaran,
--   2) kurangi stok tiap bahan (qty item x qty_per_portion, dijumlahkan per bahan),
--   3) catat stock_movements bertipe order_confirm,
--   4) tulis log order.confirmed, payment.recorded, stock.deducted, stock.negative.
-- Bahan dikunci berurutan menurut id agar dua konfirmasi bersamaan tidak saling
-- mengunci (deadlock).
create or replace function public.apply_order_confirmation(
  p_order_id       uuid,
  p_payment_method public.payment_method,
  p_actor_id       uuid,
  p_actor_role     public.log_actor_role,
  p_before         jsonb,
  p_queue_number   integer,
  p_meta           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total           integer;
  v_payment_id      uuid;
  v_usage           record;
  v_ingredient_name text;
  v_stock_after     numeric(12, 3);
  v_summary         jsonb := '[]'::jsonb;
  v_warnings        jsonb := '[]'::jsonb;
  v_warning         jsonb;
  v_log_meta        jsonb;
begin
  v_log_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('queue_number', p_queue_number);

  select o.total into v_total from public.orders as o where o.id = p_order_id;

  -- 1) Pembayaran. amount selalu dari total order di database, bukan kiriman klien.
  insert into public.payments (order_id, method, amount, recorded_by)
  values (p_order_id, p_payment_method, v_total, p_actor_id)
  returning id into v_payment_id;

  perform public.write_activity_log(
    p_actor_id, p_actor_role, 'order.confirmed', 'order', p_order_id, p_order_id,
    p_before,
    jsonb_build_object('status', 'antrean', 'payment_method', p_payment_method, 'queue_number', p_queue_number),
    v_log_meta
  );

  perform public.write_activity_log(
    p_actor_id, p_actor_role, 'payment.recorded', 'payment', v_payment_id, p_order_id,
    null,
    jsonb_build_object('method', p_payment_method, 'amount', v_total),
    coalesce(p_meta, '{}'::jsonb)
  );

  -- 2) Kurangi stok. Kunci baris bahan berurutan menurut id.
  for v_usage in
    select r.ingredient_id as ingredient_id,
           sum(oi.qty * r.qty_per_portion) as used_qty
    from public.order_items as oi
    join public.recipes as r on r.menu_item_id = oi.menu_item_id
    where oi.order_id = p_order_id
    group by r.ingredient_id
    order by r.ingredient_id
  loop
    update public.ingredients as i
    set stock_qty = i.stock_qty - v_usage.used_qty
    where i.id = v_usage.ingredient_id
    returning i.name, i.stock_qty into v_ingredient_name, v_stock_after;

    -- 3) Jejak pergerakan stok.
    insert into public.stock_movements (
      ingredient_id, order_id, type, qty_change, stock_after, created_by, note
    ) values (
      v_usage.ingredient_id, p_order_id, 'order_confirm', -v_usage.used_qty, v_stock_after, p_actor_id,
      'Pengurangan otomatis saat konfirmasi order'
    );

    v_summary := v_summary || jsonb_build_object(
      'ingredient_id', v_usage.ingredient_id,
      'ingredient_name', v_ingredient_name,
      'qty_change', -v_usage.used_qty,
      'stock_after', v_stock_after
    );

    -- Stok minus bukan error, hanya peringatan (dikembalikan ke pemanggil).
    if v_stock_after < 0 then
      v_warnings := v_warnings || jsonb_build_object(
        'ingredient_id', v_usage.ingredient_id,
        'ingredient_name', v_ingredient_name,
        'stock_after', v_stock_after
      );
    end if;
  end loop;

  if jsonb_array_length(v_summary) > 0 then
    perform public.write_activity_log(
      p_actor_id, p_actor_role, 'stock.deducted', 'order', p_order_id, p_order_id,
      null,
      jsonb_build_object('ingredients', v_summary),
      coalesce(p_meta, '{}'::jsonb)
    );
  end if;

  for v_warning in select value from jsonb_array_elements(v_warnings)
  loop
    perform public.write_activity_log(
      p_actor_id, p_actor_role, 'stock.negative', 'ingredient',
      (v_warning ->> 'ingredient_id')::uuid, p_order_id,
      null,
      jsonb_build_object(
        'ingredient_name', v_warning ->> 'ingredient_name',
        'stock_after', v_warning -> 'stock_after'
      ),
      coalesce(p_meta, '{}'::jsonb)
    );
  end loop;

  return jsonb_build_object('payment_id', v_payment_id, 'stock_warnings', v_warnings);
end;
$$;

comment on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb) is
  'Efek samping konfirmasi yang dipakai confirm_order dan create_manual_order: catat pembayaran, kurangi stok, tulis stock_movements dan log.';

revoke all on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb)
  to service_role;

-- ============================================================================
-- 1. confirm_order(p_order_id, p_payment_method, p_actor_id, p_meta)
-- ============================================================================
-- Hanya cashier atau admin. Satu transaksi:
--   kunci baris order -> status harus menunggu_konfirmasi -> catat pembayaran
--   -> kurangi stok -> ubah status ke antrean -> tulis log.
-- Kalau satu langkah gagal, semuanya batal (raise exception membatalkan transaksi).
create or replace function public.confirm_order(
  p_order_id       text,
  p_payment_method public.payment_method,
  p_actor_id       uuid,
  p_meta           jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_role     public.app_role;
  v_log_role     public.log_actor_role;
  v_order_id     uuid;
  v_old_status   public.order_status;
  v_queue_number integer;
  v_result       jsonb;
begin
  v_app_role := public.require_staff(p_actor_id, ARRAY['cashier'::public.app_role, 'admin'::public.app_role]);
  v_log_role := v_app_role::text::public.log_actor_role;

  if p_payment_method is null then
    raise exception 'VALIDATION_FAILED' using detail = 'payment_method wajib diisi (qris atau tunai)';
  end if;

  v_order_id := public.parse_order_id(p_order_id);

  select o.status, o.queue_number
  into v_old_status, v_queue_number
  from public.orders as o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order ' || p_order_id || ' tidak ditemukan';
  end if;

  if v_old_status <> 'menunggu_konfirmasi' then
    raise exception 'ORDER_STATUS_CHANGED' using detail = 'order tidak lagi menunggu konfirmasi';
  end if;

  update public.orders
  set status = 'antrean',
      confirmed_at = now(),
      confirmed_by = p_actor_id
  where id = v_order_id
    and status = 'menunggu_konfirmasi';

  v_result := public.apply_order_confirmation(
    v_order_id,
    p_payment_method,
    p_actor_id,
    v_log_role,
    jsonb_build_object('status', 'menunggu_konfirmasi'),
    v_queue_number,
    p_meta
  );

  return jsonb_build_object(
    'status', 'antrean',
    'queue_number', v_queue_number,
    'stock_warnings', v_result -> 'stock_warnings'
  );
end;
$$;

comment on function public.confirm_order(text, public.payment_method, uuid, jsonb) is
  'Konfirmasi order (cashier/admin): catat pembayaran, kurangi stok, ubah status ke antrean, tulis log. Stok minus hanya menjadi stock_warnings.';

revoke all on function public.confirm_order(text, public.payment_method, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_order(text, public.payment_method, uuid, jsonb) to service_role;

-- ============================================================================
-- 2. create_manual_order(...) — input order oleh Cashier, langsung dikonfirmasi
-- ============================================================================
-- Hanya cashier atau admin. Order dibuat LANGSUNG berstatus antrean (tidak
-- pernah menunggu_konfirmasi), source = cashier, lalu efek konfirmasi dijalankan
-- dalam transaksi yang sama. Validasi item memakai validate_order_items.
-- p_occurred_at (opsional) untuk input belakangan; hanya boleh di hari ini (WIB)
-- dan tidak di masa depan (docs/Order-flow.md bagian 5).
create or replace function public.create_manual_order(
  p_customer_name   text,
  p_items           jsonb,
  p_payment_method  public.payment_method,
  p_occurred_at     timestamptz,
  p_idempotency_key uuid,
  p_actor_id        uuid,
  p_meta            jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_role      public.app_role;
  v_log_role      public.log_actor_role;
  v_customer_name text;
  v_total         integer;
  v_occurred_at   timestamptz;
  v_is_manual_time boolean;
  v_queue_date    date;
  v_queue_number  integer;
  v_order_id      uuid;
  v_status        public.order_status;
  v_result        jsonb;
begin
  v_app_role := public.require_staff(p_actor_id, ARRAY['cashier'::public.app_role, 'admin'::public.app_role]);
  v_log_role := v_app_role::text::public.log_actor_role;

  if p_payment_method is null then
    raise exception 'VALIDATION_FAILED' using detail = 'payment_method wajib diisi (qris atau tunai)';
  end if;

  -- is_manual_time harus direset tiap pemanggilan (variabel fungsi bisa
  -- menyimpan nilai dari pemanggilan sebelumnya pada sesi yang sama).
  v_is_manual_time := false;

  v_customer_name := public.validate_customer_name(p_customer_name);

  if p_idempotency_key is null then
    raise exception 'VALIDATION_FAILED' using detail = 'idempotency_key wajib diisi saat membuat order';
  end if;

  -- Idempotensi: kalau kunci sudah dipakai, kembalikan order lama tanpa efek ganda.
  select o.id, o.status, o.queue_number
  into v_order_id, v_status, v_queue_number
  from public.orders as o
  where o.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'order_id', v_order_id,
      'status', v_status,
      'queue_number', v_queue_number,
      'stock_warnings', '[]'::jsonb
    );
  end if;

  -- Validasi item dan hitung total dari harga menu (bukan dari klien).
  select coalesce(sum(v.price_snapshot * v.qty), 0)
  into v_total
  from public.validate_order_items(p_items) as v;

  -- Waktu kejadian manual hanya boleh di hari berjalan (WIB) dan tidak di masa depan.
  if p_occurred_at is null then
    v_occurred_at := now();
  else
    if (p_occurred_at at time zone 'Asia/Jakarta')::date <> public.wib_today()
       or p_occurred_at > now() then
      raise exception 'VALIDATION_FAILED'
        using detail = 'occurred_at harus di hari ini (WIB) dan tidak di masa depan';
    end if;
    v_occurred_at := p_occurred_at;
    v_is_manual_time := true;
  end if;

  -- Nomor antrean atomik untuk hari ini (WIB).
  v_queue_date := public.wib_today();
  insert into public.queue_counters (queue_date, last_number)
  values (v_queue_date, 1)
  on conflict (queue_date)
  do update set last_number = public.queue_counters.last_number + 1
  returning last_number into v_queue_number;

  -- Order langsung antrean, sudah terkonfirmasi (confirmed_at/by terisi).
  v_order_id := null;
  v_status := 'antrean';
  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    occurred_at, is_manual_time, idempotency_key, confirmed_at, confirmed_by
  ) values (
    v_queue_date, v_queue_number, v_customer_name, 'cashier', v_status, v_total,
    v_occurred_at, v_is_manual_time, p_idempotency_key, now(), p_actor_id
  )
  on conflict (idempotency_key) do nothing
  returning id, status, queue_number
  into v_order_id, v_status, v_queue_number;

  -- Balapan idempotensi: kunci dipakai barusan oleh permintaan lain.
  if v_order_id is null then
    select o.id, o.status, o.queue_number
    into v_order_id, v_status, v_queue_number
    from public.orders as o
    where o.idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'order_id', v_order_id,
      'status', v_status,
      'queue_number', v_queue_number,
      'stock_warnings', '[]'::jsonb
    );
  end if;

  -- Simpan item dengan snapshot nama dan harga.
  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, price_snapshot, qty, note, subtotal
  )
  select v_order_id, v.menu_item_id, v.name_snapshot, v.price_snapshot,
         v.qty, v.note, v.price_snapshot * v.qty
  from public.validate_order_items(p_items) as v;

  -- order.created dicatat lebih dulu, lalu efek konfirmasi mencatat order.confirmed dst.
  perform public.write_activity_log(
    p_actor_id, v_log_role, 'order.created', 'order', v_order_id, v_order_id,
    null,
    jsonb_build_object('status', v_status, 'source', 'cashier', 'total', v_total, 'queue_number', v_queue_number),
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('queue_number', v_queue_number)
  );

  v_result := public.apply_order_confirmation(
    v_order_id,
    p_payment_method,
    p_actor_id,
    v_log_role,
    null,
    v_queue_number,
    p_meta
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', v_status,
    'queue_number', v_queue_number,
    'stock_warnings', v_result -> 'stock_warnings'
  );
end;
$$;

comment on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb) is
  'Input order oleh cashier/admin: order langsung antrean, sekaligus catat pembayaran dan kurangi stok. Mendukung waktu manual dan idempotency_key.';

revoke all on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb)
  to service_role;

-- ============================================================================
-- 3. start_order(p_order_id, p_actor_id, p_meta) — Barista menekan Mulai
-- ============================================================================
-- Hanya barista. Update bersyarat antrean -> dikerjakan. Karena update-nya
-- bersyarat (dan baris dikunci for update), dua barista yang menekan Mulai
-- bersamaan hanya menghasilkan satu pemenang.
create or replace function public.start_order(
  p_order_id text,
  p_actor_id uuid,
  p_meta     jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log_role   public.log_actor_role;
  v_order_id   uuid;
  v_old_status public.order_status;
begin
  v_log_role := public.require_staff(p_actor_id, ARRAY['barista'::public.app_role])::text::public.log_actor_role;
  v_order_id := public.parse_order_id(p_order_id);

  select o.status
  into v_old_status
  from public.orders as o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order ' || p_order_id || ' tidak ditemukan';
  end if;

  if v_old_status <> 'antrean' then
    raise exception 'ORDER_STATUS_CHANGED' using detail = 'order tidak berada di antrean';
  end if;

  update public.orders
  set status = 'dikerjakan',
      started_at = now(),
      started_by = p_actor_id
  where id = v_order_id
    and status = 'antrean';

  perform public.write_activity_log(
    p_actor_id, v_log_role, 'order.started', 'order', v_order_id, v_order_id,
    jsonb_build_object('status', 'antrean'),
    jsonb_build_object('status', 'dikerjakan'),
    coalesce(p_meta, '{}'::jsonb)
  );

  return jsonb_build_object('status', 'dikerjakan');
end;
$$;

comment on function public.start_order(text, uuid, jsonb) is
  'Barista menekan Mulai: ubah status antrean menjadi dikerjakan dan tulis log order.started.';

revoke all on function public.start_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_order(text, uuid, jsonb) to service_role;

-- ============================================================================
-- 4. finish_order(p_order_id, p_actor_id, p_meta) — Barista menekan Selesai
-- ============================================================================
-- Hanya barista. Update bersyarat dikerjakan -> selesai. Selesai tidak bisa
-- ditekan sebelum Mulai karena statusnya harus dikerjakan.
create or replace function public.finish_order(
  p_order_id text,
  p_actor_id uuid,
  p_meta     jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log_role   public.log_actor_role;
  v_order_id   uuid;
  v_old_status public.order_status;
begin
  v_log_role := public.require_staff(p_actor_id, ARRAY['barista'::public.app_role])::text::public.log_actor_role;
  v_order_id := public.parse_order_id(p_order_id);

  select o.status
  into v_old_status
  from public.orders as o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order ' || p_order_id || ' tidak ditemukan';
  end if;

  if v_old_status <> 'dikerjakan' then
    raise exception 'ORDER_STATUS_CHANGED' using detail = 'order belum dikerjakan atau sudah selesai';
  end if;

  update public.orders
  set status = 'selesai',
      finished_at = now(),
      finished_by = p_actor_id
  where id = v_order_id
    and status = 'dikerjakan';

  perform public.write_activity_log(
    p_actor_id, v_log_role, 'order.finished', 'order', v_order_id, v_order_id,
    jsonb_build_object('status', 'dikerjakan'),
    jsonb_build_object('status', 'selesai'),
    coalesce(p_meta, '{}'::jsonb)
  );

  return jsonb_build_object('status', 'selesai');
end;
$$;

comment on function public.finish_order(text, uuid, jsonb) is
  'Barista menekan Selesai: ubah status dikerjakan menjadi selesai dan tulis log order.finished.';

revoke all on function public.finish_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finish_order(text, uuid, jsonb) to service_role;

-- ============================================================================
-- 5. cancel_order(p_order_id, p_actor_id, p_meta) — Batalkan order
-- ============================================================================
-- p_actor_id null = customer. Customer hanya boleh saat menunggu_konfirmasi.
-- Cashier/Admin boleh saat menunggu_konfirmasi atau antrean. Barista ditolak
-- FORBIDDEN. Kalau status antrean (sudah dikonfirmasi), dalam satu transaksi:
-- tandai pembayaran batal, kembalikan stok, keluarkan order dari antrean.
create or replace function public.cancel_order(
  p_order_id text,
  p_actor_id uuid,
  p_meta     jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_role        public.app_role;
  v_log_role        public.log_actor_role;
  v_cancel_role     public.order_cancel_role;
  v_cancelled_by    uuid;
  v_is_customer     boolean;
  v_order_id        uuid;
  v_old_status      public.order_status;
  v_queue_number    integer;
  v_payment_id      uuid;
  v_usage           record;
  v_ingredient_name text;
  v_stock_after     numeric(12, 3);
  v_summary         jsonb := '[]'::jsonb;
begin
  v_order_id := public.parse_order_id(p_order_id);

  select o.status, o.queue_number
  into v_old_status, v_queue_number
  from public.orders as o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order ' || p_order_id || ' tidak ditemukan';
  end if;

  -- Tentukan pelaku. Customer tidak punya akun (p_actor_id null).
  if p_actor_id is null then
    v_is_customer := true;
    v_log_role := 'customer'::public.log_actor_role;
    v_cancel_role := 'customer'::public.order_cancel_role;
    v_cancelled_by := null;
  else
    v_is_customer := false;
    -- require_staff menolak barista dan akun nonaktif dengan FORBIDDEN.
    v_app_role := public.require_staff(p_actor_id, ARRAY['cashier'::public.app_role, 'admin'::public.app_role]);
    v_log_role := v_app_role::text::public.log_actor_role;
    v_cancel_role := case
      when v_app_role = 'admin' then 'admin'::public.order_cancel_role
      else 'cashier'::public.order_cancel_role
    end;
    v_cancelled_by := p_actor_id;
  end if;

  -- Cek transisi yang diizinkan.
  if v_is_customer then
    if v_old_status <> 'menunggu_konfirmasi' then
      raise exception 'ORDER_STATUS_CHANGED'
        using detail = 'customer hanya bisa membatalkan saat menunggu konfirmasi';
    end if;
  else
    if v_old_status not in ('menunggu_konfirmasi', 'antrean') then
      raise exception 'ORDER_STATUS_CHANGED'
        using detail = 'order sudah dikerjakan, selesai, atau dibatalkan';
    end if;
  end if;

  -- Kalau sudah dikonfirmasi (antrean): batalkan pembayaran dan kembalikan stok.
  if v_old_status = 'antrean' then
    update public.payments
    set voided_at = now(),
        voided_by = p_actor_id
    where order_id = v_order_id
      and voided_at is null
    returning id into v_payment_id;

    for v_usage in
      select r.ingredient_id as ingredient_id,
             sum(oi.qty * r.qty_per_portion) as used_qty
      from public.order_items as oi
      join public.recipes as r on r.menu_item_id = oi.menu_item_id
      where oi.order_id = v_order_id
      group by r.ingredient_id
      order by r.ingredient_id
    loop
      update public.ingredients as i
      set stock_qty = i.stock_qty + v_usage.used_qty
      where i.id = v_usage.ingredient_id
      returning i.name, i.stock_qty into v_ingredient_name, v_stock_after;

      insert into public.stock_movements (
        ingredient_id, order_id, type, qty_change, stock_after, created_by, note
      ) values (
        v_usage.ingredient_id, v_order_id, 'order_cancel_restore', v_usage.used_qty, v_stock_after, p_actor_id,
        'Pengembalian otomatis saat pembatalan order'
      );

      v_summary := v_summary || jsonb_build_object(
        'ingredient_id', v_usage.ingredient_id,
        'ingredient_name', v_ingredient_name,
        'qty_change', v_usage.used_qty,
        'stock_after', v_stock_after
      );
    end loop;
  end if;

  -- Ubah status (bersyarat) dan isi kolom pembatalan.
  update public.orders
  set status = 'dibatalkan',
      cancelled_at = now(),
      cancelled_by_role = v_cancel_role,
      cancelled_by = v_cancelled_by
  where id = v_order_id
    and status = v_old_status;

  -- Log: order.cancelled selalu; payment.voided & stock.restored hanya kalau
  -- order sebelumnya sudah dikonfirmasi.
  perform public.write_activity_log(
    p_actor_id, v_log_role, 'order.cancelled', 'order', v_order_id, v_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'dibatalkan', 'cancelled_by_role', v_cancel_role),
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('queue_number', v_queue_number)
  );

  if v_old_status = 'antrean' then
    if v_payment_id is not null then
      perform public.write_activity_log(
        p_actor_id, v_log_role, 'payment.voided', 'payment', v_payment_id, v_order_id,
        null,
        jsonb_build_object('voided', true),
        coalesce(p_meta, '{}'::jsonb)
      );
    end if;

    if jsonb_array_length(v_summary) > 0 then
      perform public.write_activity_log(
        p_actor_id, v_log_role, 'stock.restored', 'order', v_order_id, v_order_id,
        null,
        jsonb_build_object('ingredients', v_summary),
        coalesce(p_meta, '{}'::jsonb)
      );
    end if;
  end if;

  return jsonb_build_object('status', 'dibatalkan');
end;
$$;

comment on function public.cancel_order(text, uuid, jsonb) is
  'Batalkan order: customer hanya saat menunggu konfirmasi, cashier/admin sampai antrean, barista ditolak. Order antrean: pembayaran di-void dan stok dikembalikan.';

revoke all on function public.cancel_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cancel_order(text, uuid, jsonb) to service_role;
