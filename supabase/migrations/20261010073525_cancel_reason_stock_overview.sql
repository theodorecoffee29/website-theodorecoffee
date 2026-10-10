-- File ini: alasan pembatalan order dan ringkasan sisa stok (Theodore Coffee V1).
-- Sumber aturan: docs/Order-flow.md (AC 21-24 dan bagian 7 ayat 5),
-- docs/api-contract.md (bagian 2, 4, dan 4b), docs/data-model.md (tabel orders),
-- docs/logging.md (bagian 2-6).
--
-- Isi file ini:
--   1. Tipe enum order_cancel_reason + dua kolom baru di tabel orders
--   2. cancel_order  (dipakai ulang: signature berubah, alasannya baru)
--   3. get_order_status (dipakai ulang: signature sama, keluaran tambah 2 kunci)
--   4. get_stock_overview (baru: sisa porsi per menu dan sisa bahan)
--
-- KONSEP PENTING:
-- - "security definer" + "set search_path = ''": fungsi berjalan dengan hak
--   pemilik dan semua nama objek ditulis lengkap dengan schema.
-- - "revoke ... from public, anon, authenticated" + "grant ... to service_role":
--   fungsi hanya boleh dipanggil server yang memakai kunci service_role.
-- - Penyebab kenapa pembatalan oleh CUSTOMER diisi otomatis ada di bagian 2.

-- ============================================================================
-- 1. Tipe enum alasan pembatalan dan kolom baru di orders
-- ============================================================================
-- Alasan disimpan sebagai enum, bukan teks bebas, supaya laporan bisa
-- mengelompokkan pembatalan dan tidak bisa salah ketik. Pilihan ini mengikuti
-- keputusan di docs/Order-flow.md bagian 7 ayat 5.
create type public.order_cancel_reason as enum (
  'stok_habis',
  'pembayaran_tidak_diterima',
  'diminta_customer',
  'pesanan_ganda',
  'salah_input',
  'lainnya'
);

comment on type public.order_cancel_reason is
  'Alasan pembatalan order oleh staf, dan alasan otomatis untuk pembatalan oleh customer.';

-- Kedua kolom boleh kosong. Order lama dan baris data tes tidak punya alasan,
-- jadi kolomnya TIDAK dibuat wajib (kalau wajib, menambah kolom ini akan gagal
-- untuk semua baris yang sudah ada).
alter table public.orders
  add column cancel_reason public.order_cancel_reason,
  add column cancel_note text;

-- Catatan dibuang spasi pinggir oleh cancel_order, dan yang kosong disimpan
-- sebagai null. Constraint ini menangkap dua hal: catatan yang terlalu
-- panjang, dan catatan yang isinya cuma spasi tapi lolos dari pemangkasan.
alter table public.orders
  add constraint orders_cancel_note_panjang_check
  check (
    cancel_note is null
    or btrim(cancel_note) = ''
    or char_length(cancel_note) <= 100
  );

comment on column public.orders.cancel_reason is
  'Alasan pembatalan. Kosong untuk order yang tidak dibatalkan, untuk data lama, dan untuk data tes.';
comment on column public.orders.cancel_note is
  'Catatan alasan pembatalan, maksimal 100 karakter. Wajib kalau cancel_reason = lainnya.';

-- ============================================================================
-- 2. cancel_order(p_order_id, p_actor_id, p_reason, p_note, p_meta)
-- ============================================================================
-- Signature berubah karena dua parameter baru, jadi versi lama dibuang dulu
-- supaya tidak ada dua fungsi dengan nama sama (lihat blok drop di bawah).
--
-- KENAPA ALASAN PEMBATALAN CUSTOMER DIISI OTOMATIS:
--   Customer tidak punya akun dan tidak punya tempat untuk memilih alasan saat
--   menekan tombol Batal di halamannya. Kalau alasan dicek tanpa nilai, order
--   miliknya sendiri tidak akan bisa dibatalkan. Jadi untuk customer
--   (p_actor_id null) alasan selalu diisi 'diminta_customer' dan p_reason serta
--   p_note yang dikirim DIABAIKAN, bukan ditolak. Ini juga sesuai
--   docs/Order-flow.md bagian 7 ayat 5: customer melihat "Dibatalkan oleh
--   kamu".
--
-- Untuk staf, p_reason wajib karena Cashier/Admin yang memutuskan, dan
-- alasan 'lainnya' wajib p_note supaya tahu detailnya (docs/api-contract.md
-- bagian 2).
drop function if exists public.cancel_order(text, uuid, jsonb);

create function public.cancel_order(
  p_order_id text,
  p_actor_id uuid,
  p_reason  public.order_cancel_reason default null,
  p_note    text default null,
  p_meta    jsonb default '{}'::jsonb
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
  -- Alasan dan catatan yang benar-benar disimpan.
  v_reason          public.order_cancel_reason;
  v_note            text;
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

  ---------------------------------------------------------------------------
  -- Alasan dan catatan pembatalan.
  -- ---------------------------------------------------------------------------
  if v_is_customer then
    -- Alasan customer selalu sama, dan kiriman dari klien diabaikan.
    v_reason := 'diminta_customer'::public.order_cancel_reason;
    v_note := null;
  else
    if p_reason is null then
      raise exception 'VALIDATION_FAILED'
        using detail = 'reason wajib diisi saat pembatalan oleh staf '
          '(stok_habis, pembayaran_tidak_diterima, diminta_customer, pesanan_ganda, salah_input, lainnya)';
    end if;

    v_reason := p_reason;

    -- Catatan dipangkas spasi pinggir. Yang jadi kosong disimpan sebagai null,
    -- supaya tidak ada "") yang tersimpan dan membingungkan saat dibaca.
    v_note := nullif(btrim(p_note), '');

    if v_note is not null and char_length(v_note) > 100 then
      raise exception 'VALIDATION_FAILED'
        using detail = 'note maksimal 100 karakter';
    end if;

    -- "lainnya" tanpa catatan tidak menjelaskan apa pun, jadi wajib diisi.
    if v_reason = 'lainnya'::public.order_cancel_reason and v_note is null then
      raise exception 'VALIDATION_FAILED'
        using detail = 'note wajib diisi 1-100 karakter kalau reason = lainnya';
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
      cancelled_by = v_cancelled_by,
      cancel_reason = v_reason,
      cancel_note = v_note
  where id = v_order_id
    and status = v_old_status;

  -- Log: order.cancelled selalu; payment.voided & stock.restored hanya kalau
  -- order sebelumnya sudah dikonfirmasi.
  perform public.write_activity_log(
    p_actor_id, v_log_role, 'order.cancelled', 'order', v_order_id, v_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', 'dibatalkan',
      'cancelled_by_role', v_cancel_role,
      'cancel_reason', v_reason,
      'cancel_note', v_note
    ),
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

comment on function public.cancel_order(text, uuid, public.order_cancel_reason, text, jsonb) is
  'Batalkan order. Customer (p_actor_id null) otomatis alasan diminta_customer; staf wajib memilih reason, dan reason lainnya wajib note 1-100 karakter. Order antrean: pembayaran di-void dan stok dikembalikan.';

revoke all on function public.cancel_order(text, uuid, public.order_cancel_reason, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.cancel_order(text, uuid, public.order_cancel_reason, text, jsonb)
  to service_role;

-- ============================================================================
-- 3. get_order_status(p_order_id)
-- ============================================================================
-- Signature SAMA persis, jadi cukup create or replace (tidak ada overload baru
-- dan tidak perlu drop). Issuanya cuma satu: untuk order yang dibatalkan,
-- jsonb-nya ditambah kunci cancelReason dan cancelNote supaya customer bisa
-- menampilkan "Dibatalkan karena: ...". Untuk order lain kedua kunci itu TIDAK
-- ada, sesuai docs/api-contract.md bagian 4 (ditulis dengan tanda tanya, bukan
-- selalu ada). Semua isi lain dipertahankan persis.
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
  v_hasil    jsonb;
begin
  -- Ubah teks ke uuid. Kalau formatnya salah, seragamkan jadi ORDER_NOT_FOUND
  -- supaya pesan ke customer sama dengan order yang memang tidak ada.
  begin
    v_order_id := p_order_id::uuid;
  exception
    when invalid_text_representation then
      raise exception 'ORDER_NOT_FOUND' using detail = 'order_id tidak valid';
  end;

  select o.status, o.queue_number, o.queue_date, o.total, o.cancel_reason, o.cancel_note
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

  v_hasil := jsonb_build_object(
    'status', v_order.status,
    'queue_number', v_order.queue_number,
    'queue_date', v_order.queue_date,
    'items', v_items,
    'total', v_order.total
  );

  -- Alasan dan catatan hanya ada untuk order yang dibatalkan.
  if v_order.status = 'dibatalkan'::public.order_status then
    v_hasil := v_hasil || jsonb_build_object(
      'cancelReason', v_order.cancel_reason::text,
      'cancelNote', v_order.cancel_note
    );
  end if;

  return v_hasil;
end;
$$;

comment on function public.get_order_status(text) is
  'Status satu order untuk halaman customer: status, queue_number, queue_date, items (name, qty, note), dan total. Untuk order dibatalkan ditambah cancelReason dan cancelNote. ID tidak valid atau tidak ada menghasilkan ORDER_NOT_FOUND.';

revoke all on function public.get_order_status(text) from public, anon, authenticated;
grant execute on function public.get_order_status(text) to service_role;

-- ============================================================================
-- 4. get_stock_overview(p_actor_id)
-- ============================================================================
-- Ringkasan sisa stok untuk Cashier, Barista, dan Admin (hanya baca).
--
-- Sisa porsi satu menu = bahan yang paling menentukan:floor(stok / takaran),
-- lalu ambil yang terkecil. Stok minus dihitung 0 porsi, bukan angka negatif,
-- supaya tampilan "sisa porsi" tidak pernah negatif dan tidak sama artinya
-- "sisa bahan" yang memang boleh minus.
--
-- Konsisten dengan menu_item_available: menu dianggap Habis kalau ADA bahan
-- dengan stok lebih kecil dari satu takaran, dan itu persis kondisi portionsLeft
-- = 0. Menu tanpa resep tidak punya bahan, jadi portionsLeft null (menu selalu
-- tersedia).
--
-- Satu query untuk seluruh data (bukan satu pemanggilan per menu), karena
-- fungsi ini dipanggil berkala untuk memperbarui tampilan.
create or replace function public.get_stock_overview(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hasil jsonb;
begin
  -- Peran dibaca dari tabel profiles, bukan dari kiriman klien. require_staff
  -- menolak akun null, akun nonaktif, dan peran lain dengan FORBIDDEN.
  perform public.require_staff(
    p_actor_id,
    ARRAY['cashier'::public.app_role, 'barista'::public.app_role, 'admin'::public.app_role]
  );

  with porsi_bahan as (
    -- Sisa porsi dari satu bahan. floor() membulatkan ke bawah (5000 / 18 =
    -- 277,7 -> 277). greatest() mengubah stok minus jadi 0.
    select r.menu_item_id as menu_item_id,
           greatest(floor(i.stock_qty / r.qty_per_portion), 0) as porsi
    from public.recipes as r
    join public.ingredients as i on i.id = r.ingredient_id
  ),
  porsi_menu as (
    -- Dari semua bahan satu menu, ambil yang paling sedikit: itulah yang
    -- menentukan menu ini masih bisa dibuat berapa porsi.
    select p.menu_item_id as menu_item_id,
           min(p.porsi) as porsi
    from porsi_bahan as p
    group by p.menu_item_id
  )
  select jsonb_build_object(
    'menus', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'menuItemId', m.id,
            'name', m.name,
            'portionsLeft', pm.porsi
          )
          order by m.name
        ),
        '[]'::jsonb
      )
      from public.menu_items as m
      left join porsi_menu as pm on pm.menu_item_id = m.id
      where m.is_active
    ),
    'ingredients', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ingredientId', i.id,
            'name', i.name,
            'unit', i.unit,
            'stockQty', i.stock_qty,
            -- stock_qty kolomnya not null, jadi ini tidak pernah null.
            'isNegative', i.stock_qty < 0
          )
          order by i.name
        ),
        '[]'::jsonb
      )
      from public.ingredients as i
    )
  )
  into v_hasil;

  return v_hasil;
end;
$$;

comment on function public.get_stock_overview(uuid) is
  'Ringkasan sisa stok untuk cashier, barista, dan admin: sisa porsi per menu aktif (null kalau tanpa resep) dan sisa bahan. Tanpa harga dan pembayaran. Hanya membaca.';

revoke all on function public.get_stock_overview(uuid) from public, anon, authenticated;
grant execute on function public.get_stock_overview(uuid) to service_role;
