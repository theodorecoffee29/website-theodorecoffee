-- File ini: fungsi database untuk fitur "stok tidak cukup" (Theodore Coffee V1).
-- Sumber aturan: docs/api-contract.md, docs/Order-flow.md, docs/data-model.md,
-- docs/pemissions.md, docs/logging.md.
--
-- Isi file ini:
--   1. ingredient_usage_for_order  (pembantu: kebutuhan bahan satu order)
--   2. order_stock_check           (pembacaan: satu order)
--   3. pending_orders_stock_check  (pembacaan: semua order menunggu konfirmasi)
--   4. apply_order_confirmation    (dipakai ulang: signature berubah)
--   5. confirm_order               (dipakai ulang: signature berubah)
--   6. create_manual_order         (dipakai ulang: signature berubah)
--
-- KONSEP PENTING:
-- - confirm_order dan create_manual_order sekarang punya parameter baru
--   p_allow_negative_stock (boolean, default false). Kalau false, konfirmasi
--   dengan stok kurang DITOLAK dengan STOCK_INSUFFICIENT dan seluruh transaksi
--   dibatalkan (tidak ada pembayaran, tidak ada perubahan status, tidak ada
--   pergerakan stok). Kalau true, stok boleh minus seperti sebelumnya.
--
-- - Pemeriksaan stok dilakukan DI DALAM transaksi yang sama dengan penguncian
--   baris bahan ("for update"). Kalau pemeriksaannya dilakukan di luar
--   penguncian, dua konfirmasi bersamaan untuk stok terakhir bisa sama-sama
--   melihat stok masih cukup, lalu keduanya mengurangi stok (menjadi minus).
--   Dengan mengunci lebih dulu, konfirmasi kedua menunggu, lalu membaca stok
--   yang sudah dikurangi dan baru ditolak, jadi hanya satu yang berhasil.
--
-- - Baris bahan SELALU dikunci berurutan menurut id di kedua fungsi pemanggil,
--   supaya dua konfirmasi bersamaan tidak saling menunggu (deadlock).
--
-- - "security definer" + "set search_path = ''": fungsi berjalan dengan hak
--   pemilik dan semua nama objek ditulis lengkap dengan schema.
-- - "revoke ... from public, anon, authenticated" + "grant ... to service_role":
--   fungsi hanya boleh dipanggil server yang memakai kunci service_role.
--
-- CATATAN MIGRASI: parameter bertipe default harus berada di bagian akhir daftar
-- parameter. Menambah parameter baru selalu membuat fungsi BARU (overload),
-- jadi versi lama dibuang (drop) lebih dulu supaya tidak ada dua versi dengan
-- nama sama yang berbeda signature.

-- ============================================================================
-- 1. ingredient_usage_for_order(p_order_id)
-- ============================================================================
-- Menghitung kebutuhan bahan untuk satu order: jumlahkan qty item x
-- qty_per_portion dari resepnya, dijumlahkan per bahan.
--
-- Menu tanpa resep tidak muncul di hasil, jadi tidak butuh bahan apa pun
-- (set_recipe juga memperbolehkan resep kosong, lihat docs/api-contract.md 4b).
--
-- Fungsi ini hanya MEMBACA (stable, tanpa for update) supaya bisa dipakai oleh
-- order_stock_check dan pending_orders_stock_check tanpa mengunci apa pun.
create or replace function public.ingredient_usage_for_order(p_order_id uuid)
returns table (
  ingredient_id uuid,
  needed        numeric(12, 3)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select r.ingredient_id,
         sum(oi.qty * r.qty_per_portion)::numeric(12, 3)
  from public.order_items as oi
  join public.recipes as r
    on r.menu_item_id = oi.menu_item_id
  where oi.order_id = p_order_id
  group by r.ingredient_id
  order by r.ingredient_id;
end;
$$;

comment on function public.ingredient_usage_for_order(uuid) is
  'Kebutuhan bahan satu order (qty item x qty_per_portion, dijumlahkan per bahan). Hanya membaca, tanpa mengunci baris.';

revoke all on function public.ingredient_usage_for_order(uuid) from public, anon, authenticated;
grant execute on function public.ingredient_usage_for_order(uuid) to service_role;

-- ============================================================================
-- 2. order_stock_check(p_order_id)
-- ============================================================================
-- Meneriksa apakah stok bahan SAAT INI cukup untuk satu order, tanpa mengunci
-- apa pun. Dipakai untuk menampilkan peringatan atau tombol nonaktif sebelum
-- Cashier menekan Konfirmasi, jadi harusnya murah dan bebas efek samping.
create or replace function public.order_stock_check(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_need        record;
  v_nama        text;
  v_tersedia    numeric(12, 3);
  v_kurang      jsonb := '[]'::jsonb;
  v_cukup       boolean;
begin
  for v_need in
    select u.ingredient_id, u.needed
    from public.ingredient_usage_for_order(p_order_id) as u
  loop
    select i.name, i.stock_qty
    into v_nama, v_tersedia
    from public.ingredients as i
    where i.id = v_need.ingredient_id;

    -- Stok boleh minus, jadi yang dibandingkan selalu "kurang dari kebutuhan".
    if v_tersedia < v_need.needed then
      v_kurang := v_kurang || jsonb_build_object(
        'ingredientId', v_need.ingredient_id,
        'ingredientName', v_nama,
        'needed', v_need.needed,
        'available', v_tersedia
      );
    end if;
  end loop;

  v_cukup := (jsonb_array_length(v_kurang) = 0);

  return jsonb_build_object(
    'sufficient', v_cukup,
    'shortages', v_kurang
  );
end;
$$;

comment on function public.order_stock_check(uuid) is
  'Cek kecukupan stok bahan untuk satu order tanpa mengunci baris. Mengembalikan { sufficient, shortages }.';

revoke all on function public.order_stock_check(uuid) from public, anon, authenticated;
grant execute on function public.order_stock_check(uuid) to service_role;

-- ============================================================================
-- 3. pending_orders_stock_check()
-- ============================================================================
-- Cek kecukupan stok untuk SEMUA order berstatus menunggu_konfirmasi hari ini
-- (WIB) dalam SATU query, lalu mengembalikan array per order.
--
-- Kenapa satu query: fungsi ini dipanggil setiap 2 detik oleh layar Cashier.
-- Kalau memanggil order_stock_check satu kali per order, jumlah query akan
-- bertambah seiring bertambahnya antrean, dan layar bisa ikut melambat.
--
-- Order yang tidak punya bahan (menu tanpa resep) tidak muncul di daftar
-- "shortages", jadi otomatis dianggap cukup.
create or replace function public.pending_orders_stock_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hasil jsonb;
begin
  -- Satu query, dibangun dari beberapa CTE (WITH) yang saling membaca.
  with kebutuhan as (
    select oi.order_id                as order_id,
           r.ingredient_id            as ingredient_id,
           sum(oi.qty * r.qty_per_portion)::numeric(12, 3) as needed
    from public.orders as o
    join public.order_items as oi
      on oi.order_id = o.id
    join public.recipes as r
      on r.menu_item_id = oi.menu_item_id
    where o.status = 'menunggu_konfirmasi'
      and o.queue_date = public.wib_today()
    group by oi.order_id, r.ingredient_id
  ),
  kurang as (
    select k.order_id as order_id,
           jsonb_build_object(
             'ingredientId', k.ingredient_id,
             'ingredientName', i.name,
             'needed', k.needed,
             'available', i.stock_qty
           ) as butir
    from kebutuhan as k
    join public.ingredients as i
      on i.id = k.ingredient_id
    where i.stock_qty < k.needed
  ),
  per_order as (
    select o.id as order_id,
           coalesce(
             (
               select jsonb_agg(k.butir order by k.butir ->> 'ingredientName')
               from kurang as k
               where k.order_id = o.id
             ),
             '[]'::jsonb
           ) as daftar_kurang
    from public.orders as o
    where o.status = 'menunggu_konfirmasi'
      and o.queue_date = public.wib_today()
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'orderId', p.order_id,
               'sufficient', (jsonb_array_length(p.daftar_kurang) = 0),
               'shortages', p.daftar_kurang
             )
             order by p.order_id
           ),
           '[]'::jsonb
         )
  into v_hasil
  from per_order as p;

  return v_hasil;
end;
$$;

comment on function public.pending_orders_stock_check() is
  'Cek kecukupan stok untuk semua order menunggu_konfirmasi hari ini (WIB) dalam satu query. Mengembalikan array per order.';

revoke all on function public.pending_orders_stock_check() from public, anon, authenticated;
grant execute on function public.pending_orders_stock_check() to service_role;

-- ============================================================================
-- BUANG VERSI LAMA (signature berubah)
-- ============================================================================
-- Menambah parameter baru membuat fungsi BARU dengan nama sama tapi signature
-- berbeda (overload), bukan mengganti yang lama. Kalau dibiarkan, ada dua versi
-- confirm_order dan pemanggilnya bisa diam-diam memakai versi yang salah.
-- Jadi versi lama dibuang eksplisit dengan signature persisnya, lalu dibuat
-- ulang versi baru.
--
-- URUTAN WAJIB: pemanggil dibuang lebih dulu (confirm_order, create_manual_order),
-- baru apply_order_confirmation yang mereka panggil. Kalau dibalik, PostgreSQL
-- menolak dengan "cannot drop function because other objects depend on it".
--
-- "if exists" dipakai supaya file ini tetap bisa dijalankan di database yang
-- somehow belum punya salah satu fungsi itu.
drop function if exists public.confirm_order(text, public.payment_method, uuid, jsonb);
drop function if exists public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb);
drop function if exists public.apply_order_confirmation(
  uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb
);

-- ============================================================================
-- 4. apply_order_confirmation(..., p_allow_negative_stock)
-- ============================================================================
-- PENTING: ketiga fungsi yang diganti signature-nya dibuang lebih dulu pada
-- bagian "BUANG VERSI LAMA" di atas, baru dibuat ulang di sini dan di bawah.
-- Urutan itu wajib: confirm_order dan create_manual_order MEMANGGIL
-- apply_order_confirmation, jadi fungsi pemanggil harus dibuang lebih dulu.
-- Kalau urutan dibalik, PostgreSQL menolak dengan pesan "cannot drop function
-- because other objects depend on it" dan seluruh migrasi gagal.
-- Efek samping konfirmasi yang dipakai bersama oleh confirm_order dan
-- create_manual_order. Menganggap order SUDAH berstatus antrean dan kolom
-- confirmed_* sudah diisi oleh pemanggil. Yang dilakukan:
--   1) kunci baris bahan yang dibutuhkan lalu cek kecukupan stok,
--   2) catat pembayaran,
--   3) kurangi stok tiap bahan,
--   4) catat stock_movements bertipe order_confirm,
--   5) tulis log order.confirmed, payment.recorded, stock.deducted,
--      stock.negative.
--
-- Signature berubah karena ada parameter baru, jadi versi lamanya sudah dibuang
-- di bagian "BUANG VERSI LAMA" di atas.
create function public.apply_order_confirmation(
  p_order_id              uuid,
  p_payment_method        public.payment_method,
  p_actor_id              uuid,
  p_actor_role            public.log_actor_role,
  p_before                jsonb,
  p_queue_number          integer,
  p_meta                  jsonb,
  p_allow_negative_stock  boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total           integer;
  v_payment_id      uuid;
  v_need            record;
  v_usage           record;
  v_nama            text;
  v_stok            numeric(12, 3);
  v_stock_after     numeric(12, 3);
  v_kurang          jsonb := '[]'::jsonb;
  v_summary         jsonb := '[]'::jsonb;
  v_warnings        jsonb := '[]'::jsonb;
  v_warning         jsonb;
  v_log_meta        jsonb;
  v_stock_neg_meta   jsonb;
  v_boleh_minus     boolean;
begin
  v_log_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('queue_number', p_queue_number);

  -- NULL diperlakukan sama dengan false (tidak boleh stok minus). Kalau
  -- ditulis "not p_allow_negative_stock" dan nilainya NULL, hasilnya NULL dan
  -- blokirnya malah tidak terjadi, sehingga stok minus bisa lolos tanpa izin.
  v_boleh_minus := coalesce(p_allow_negative_stock, false);

  -- Meta untuk log stock.negative. Kalau stok minus diterima karena Cashier
  -- menyetujuinya (p_allow_negative_stock), tandai supaya Admin tahu minus itu
  -- keputusan sadar, bukan kelalaian.
  v_stock_neg_meta := coalesce(p_meta, '{}'::jsonb);
  if v_boleh_minus then
    v_stock_neg_meta := v_stock_neg_meta || jsonb_build_object('stock_override', true);
  end if;

  ---------------------------------------------------------------------------
  -- 1) Kunci baris bahan, lalu cek kecukupan stok.
  -- ---------------------------------------------------------------------------
  -- Pemeriksaan ini WAJIB di dalam transaksi yang sama dengan penguncian.
  -- Kalau stoknya dicek sebelum dikunci (atau di fungsi terpisah), dua
  -- konfirmasi bersamaan bisa sama-sama melihat stok masih cukup.
  select o.total into v_total from public.orders as o where o.id = p_order_id;

  for v_need in
    select u.ingredient_id, u.needed
    from public.ingredient_usage_for_order(p_order_id) as u
  loop
    -- "for update" mengunci baris bahan sampai transaksi selesai. Baris dikunci
    -- berurutan menurut id (ingredient_usage_for_order mengurutkan), supaya
    -- dua konfirmasi bersamaan tidak deadlock.
    select i.name, i.stock_qty
    into v_nama, v_stok
    from public.ingredients as i
    where i.id = v_need.ingredient_id
    for update;

    if not found then
      raise exception 'INTERNAL_ERROR'
        using detail = 'bahan ' || v_need.ingredient_id::text || ' tidak ada saat konfirmasi';
    end if;

    if v_stok < v_need.needed then
      v_kurang := v_kurang || jsonb_build_object(
        'ingredientName', v_nama,
        'needed', v_need.needed,
        'available', v_stok
      );
    end if;
  end loop;

  -- Tolak kalau ada bahan kurang dan Cashier belum menyetujui stok minus.
  -- raise exception membatalkan SELURUH transaksi, jadi pembayaran yang sudah
  -- dicatat, perubahan status, dan pergerakan stok ikut batal.
  if jsonb_array_length(v_kurang) > 0 and not v_boleh_minus then
    raise exception 'STOCK_INSUFFICIENT'
      using detail = v_kurang::text;
  end if;

  ---------------------------------------------------------------------------
  -- 2) Pembayaran. amount selalu dari total order di database.
  ---------------------------------------------------------------------------
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

  ---------------------------------------------------------------------------
  -- 3) Kurangi stok. Baris bahan sudah terkunci dari langkah 1.
  -- ---------------------------------------------------------------------------
  for v_usage in
    select u.ingredient_id as ingredient_id, u.needed as used_qty
    from public.ingredient_usage_for_order(p_order_id) as u
  loop
    update public.ingredients as i
    set stock_qty = i.stock_qty - v_usage.used_qty
    where i.id = v_usage.ingredient_id
    returning i.name, i.stock_qty into v_nama, v_stock_after;

    -------------------------------------------------------------------------
    -- 4) Jejak pergerakan stok.
    -------------------------------------------------------------------------
    insert into public.stock_movements (
      ingredient_id, order_id, type, qty_change, stock_after, created_by, note
    ) values (
      v_usage.ingredient_id, p_order_id, 'order_confirm', -v_usage.used_qty, v_stock_after, p_actor_id,
      'Pengurangan otomatis saat konfirmasi order'
    );

    v_summary := v_summary || jsonb_build_object(
      'ingredient_id', v_usage.ingredient_id,
      'ingredient_name', v_nama,
      'qty_change', -v_usage.used_qty,
      'stock_after', v_stock_after
    );

    -- Stok minus: kalau tidak diizinkan, pemeriksaan stok di atas sudah menolak
    -- lebih dulu, jadi di sini hanya mungkin terjadi saat Cashier
    -- menyetujuinya (p_allow_negative_stock).
    if v_stock_after < 0 then
      v_warnings := v_warnings || jsonb_build_object(
        'ingredient_id', v_usage.ingredient_id,
        'ingredient_name', v_nama,
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
      v_stock_neg_meta
    );
  end loop;

  return jsonb_build_object('payment_id', v_payment_id, 'stock_warnings', v_warnings);
end;
$$;

comment on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb, boolean) is
  'Efek samping konfirmasi bersama: kunci bahan, cek stok (tolak STOCK_INSUFFICIENT kecuali diizinkan), catat pembayaran, kurangi stok, dan tulis log.';

revoke all on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_order_confirmation(uuid, public.payment_method, uuid, public.log_actor_role, jsonb, integer, jsonb, boolean)
  to service_role;

-- ============================================================================
-- 5. confirm_order(..., p_allow_negative_stock)
-- ============================================================================
-- Hanya cashier atau admin. Satu transaksi:
--   kunci baris order -> status harus menunggu_konfirmasi -> kunci bahan dan
--   cek stok -> catat pembayaran -> kurangi stok -> ubah status ke antrean
--   -> tulis log.
-- Kalau stok kurang dan p_allow_negative_stock false, fungsi berhenti dengan
-- STOCK_INSUFFICIENT dan semua perubahan dibatalkan.
-- Versi lamanya sudah dibuang di bagian "BUANG VERSI LAMA" di atas.
create function public.confirm_order(
  p_order_id              text,
  p_payment_method        public.payment_method,
  p_actor_id              uuid,
  p_meta                  jsonb default '{}'::jsonb,
  p_allow_negative_stock  boolean default false
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
    p_meta,
    p_allow_negative_stock
  );

  return jsonb_build_object(
    'status', 'antrean',
    'queue_number', v_queue_number,
    'stock_warnings', v_result -> 'stock_warnings'
  );
end;
$$;

comment on function public.confirm_order(text, public.payment_method, uuid, jsonb, boolean) is
  'Konfirmasi order (cashier/admin). Menolak STOCK_INSUFFICIENT kalau stok kurang dan p_allow_negative_stock false.';

revoke all on function public.confirm_order(text, public.payment_method, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.confirm_order(text, public.payment_method, uuid, jsonb, boolean) to service_role;

-- ============================================================================
-- 6. create_manual_order(..., p_allow_negative_stock)
-- ============================================================================
-- Hanya cashier atau admin. Order dibuat LANGSUNG berstatus antrean, source =
-- cashier, lalu efek konfirmasi dijalankan dalam transaksi yang sama.
-- Signature berubah karena ada parameter baru, jadi versi lamanya sudah dibuang
-- di bagian "BUANG VERSI LAMA" di atas.
create function public.create_manual_order(
  p_customer_name         text,
  p_items                 jsonb,
  p_payment_method        public.payment_method,
  p_occurred_at           timestamptz,
  p_idempotency_key       uuid,
  p_actor_id              uuid,
  p_meta                  jsonb default '{}'::jsonb,
  p_allow_negative_stock  boolean default false
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
    p_meta,
    p_allow_negative_stock
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', v_status,
    'queue_number', v_queue_number,
    'stock_warnings', v_result -> 'stock_warnings'
  );
end;
$$;

comment on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb, boolean) is
  'Input order oleh cashier/admin: order langsung antrean, catat pembayaran dan kurangi stok. Menolak STOCK_INSUFFICIENT kecuali p_allow_negative_stock true.';

revoke all on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.create_manual_order(text, jsonb, public.payment_method, timestamptz, uuid, uuid, jsonb, boolean)
  to service_role;
