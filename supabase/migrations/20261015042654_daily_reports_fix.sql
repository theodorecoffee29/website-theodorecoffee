-- ============================================================================
-- Perbaikan laporan harian (koreksi 2 bagian)
-- ============================================================================
-- Sumber aturan: docs/api-contract.md bagian 4c.
-- Migrasi lama (20261013025950_daily_reports.sql) TIDAK diubah. Semua
-- perubahan ditulis di file baru ini dengan create or replace, signature
-- fungsi tetap sama persis, dan revoke/grant diulang untuk setiap fungsi.
--
-- 1. build_daily_report(date): ingredientUsage
--    - KESALAHAN: ingredientUsage.used menambahkan order_cancel_restore
--      (qty_change positif) ke pemakaian, padahal pengembalian itu harus
--      DIKURANGKAN dari pemakaian. Contoh: confirm -100, -50, -20 lalu
--      restore +20 menghasilkan 190, padahal pemakaian bersih 150.
--    - PERBAIKAN: dipakai = -(jumlah qty_change order_confirm
--      + jumlah qty_change order_cancel_restore) pada hari itu menurut WIB,
--      persis rumus dokumen: pengurangan karena pesanan dikurangi
--      pengembalian karena pembatalan.
--    - KONSISTEN: join ke stock_movements ikut disaring ke kedua jenis gerak
--      itu, supaya bahan yang tidak punya pemakaian/pengembalian pada hari itu
--      (mis. hanya restock atau adjustment) tidak muncul dengan used = 0.
--      stockAtEnd tidak berubah: tetap movements terakhir sampai akhir hari.
--
-- 2. save_missing_reports(uuid)
--    - KESALAHAN: batas akhir memakai least(kemarin, tanggal order paling awal),
--      jadi rentang hanya berisi SATU tanggal (yang paling awal) dan semua hari
--      berikutnya yang belum tersimpan tidak pernah disimpan.
--    - PERBAIKAN: rentang dari tanggal order paling awal sampai kemarin, sesuai
--      docs/api-contract.md bagian 4c. Kalau belum ada order, atau tanggal paling
--      awal sudah di masa depan, while loop tidak dijalankan sama sekali.
--      Perilaku lain (require_staff, idempoten lewat save_daily_report, sumber
--      'catch_up') tidak berubah.

-- ============================================================================
-- 1. build_daily_report(p_date) -> jsonb (create or replace, signature sama)
-- ============================================================================
create or replace function public.build_daily_report(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_awal        timestamptz;
  v_akhir       timestamptz;
  v_totals      jsonb;
  v_by_source   jsonb;
  v_by_payment  jsonb;
  v_top_menu    jsonb;
  v_bahan       jsonb;
  v_orders      jsonb;
begin
  if p_date is null then
    raise exception 'VALIDATION_FAILED' using detail = 'tanggal laporan wajib diisi';
  end if;

  -- Batas hari menurut zona waktu WIB.
  v_akhir := ((p_date + 1)::timestamp) at time zone 'Asia/Jakarta';
  v_awal  := (p_date::timestamp) at time zone 'Asia/Jakarta';

  ---------------------------------------------------------------------------
  -- totals
  ---------------------------------------------------------------------------
  select jsonb_build_object(
    'orderCount', (
      select count(*)
      from public.orders as o
      where o.queue_date = p_date
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and exists (
          select 1
          from public.payments as pay
          where pay.order_id = o.id
            and pay.voided_at is null
        )
    ),
    'sales', coalesce((
      select sum(pay.amount)
      from public.payments as pay
      join public.orders as o on o.id = pay.order_id
      where o.queue_date = p_date
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and pay.voided_at is null
    ), 0),
    'cancelledCount', (
      select count(*)
      from public.orders as o
      where o.queue_date = p_date
        and o.status = 'dibatalkan'::public.order_status
    ),
    'unfinishedCount', (
      select count(*)
      from public.orders as o
      where o.queue_date = p_date
        and o.status = 'menunggu_konfirmasi'::public.order_status
    )
  )
  into v_totals;

  ---------------------------------------------------------------------------
  -- bySource
  ---------------------------------------------------------------------------
  select jsonb_build_object(
    'online', (
      select jsonb_build_object(
        'count', count(*),
        'amount', coalesce(sum(pay.amount), 0)
      )
      from public.payments as pay
      join public.orders as o on o.id = pay.order_id
      where o.queue_date = p_date
        and o.source = 'online'::public.order_source
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and pay.voided_at is null
    ),
    'cashier', (
      select jsonb_build_object(
        'count', count(*),
        'amount', coalesce(sum(pay.amount), 0)
      )
      from public.payments as pay
      join public.orders as o on o.id = pay.order_id
      where o.queue_date = p_date
        and o.source = 'cashier'::public.order_source
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and pay.voided_at is null
    )
  )
  into v_by_source;

  ---------------------------------------------------------------------------
  -- byPaymentMethod
  ---------------------------------------------------------------------------
  select jsonb_build_object(
    'qris', (
      select jsonb_build_object(
        'count', count(*),
        'amount', coalesce(sum(pay.amount), 0)
      )
      from public.payments as pay
      join public.orders as o on o.id = pay.order_id
      where o.queue_date = p_date
        and pay.method = 'qris'::public.payment_method
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and pay.voided_at is null
    ),
    'tunai', (
      select jsonb_build_object(
        'count', count(*),
        'amount', coalesce(sum(pay.amount), 0)
      )
      from public.payments as pay
      join public.orders as o on o.id = pay.order_id
      where o.queue_date = p_date
        and pay.method = 'tunai'::public.payment_method
        and o.status in (
          'antrean'::public.order_status,
          'dikerjakan'::public.order_status,
          'selesai'::public.order_status
        )
        and pay.voided_at is null
    )
  )
  into v_by_payment;

  ---------------------------------------------------------------------------
  -- topMenu
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', x.name,
      'qty', x.qty,
      'amount', x.amount
    )
    order by x.qty desc, x.name
  ), '[]'::jsonb)
  into v_top_menu
  from (
    select
      oi.name_snapshot as name,
      sum(oi.qty) as qty,
      sum(oi.subtotal) as amount
    from public.order_items as oi
    join public.orders as o on o.id = oi.order_id
    where o.queue_date = p_date
      and o.status in (
        'antrean'::public.order_status,
        'dikerjakan'::public.order_status,
        'selesai'::public.order_status
      )
      and exists (
        select 1
        from public.payments as pay
        where pay.order_id = o.id
          and pay.voided_at is null
      )
    group by oi.name_snapshot
    order by sum(oi.qty) desc, oi.name_snapshot
    limit 10
  ) as x;

  ---------------------------------------------------------------------------
  -- ingredientUsage: pemakaian bahan dan sisa stok akhir hari.
  -- Hanya bahan yang punya order_confirm atau order_cancel_restore pada
  -- hari itu (WIB) yang masuk.
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', x.name,
      'unit', x.unit,
      'used', x.used,
      'stockAtEnd', x.stock_at_end
    )
    order by x.name
  ), '[]'::jsonb)
  into v_bahan
  from (
    select
      i.name as name,
      i.unit as unit,
      -- PERBAIKAN: pemakaian bersih = -(jumlah qty_change order_confirm
      -- + jumlah qty_change order_cancel_restore). qty_change order_confirm
      -- negatif dan order_cancel_restore positif, jadi satu tanda dikurangkan
      -- untuk keduanya: confirm -100, -50, -20 lalu restore +20 = 150.
      -- join di bawah sudah menyaring kedua jenis itu, jadi else 0 tidak
      -- pernah dipakai untuk movements lain.
      coalesce(sum(-sm.qty_change), 0) as used,
      -- Sisa stok akhir hari itu: nilai setelah pergerakan terakhir sampai akhir
      -- hari. Kalau belum ada pergerakan sama sekali, pakai stok sekarang.
      coalesce(
        (
          select sm2.stock_after
          from public.stock_movements as sm2
          where sm2.ingredient_id = i.id
            and sm2.created_at < v_akhir
          order by sm2.created_at desc, sm2.id desc
          limit 1
        ),
        i.stock_qty
      ) as stock_at_end
    from public.ingredients as i
    join public.stock_movements as sm
      on sm.ingredient_id = i.id
      and sm.created_at >= v_awal
      and sm.created_at < v_akhir
      and sm.type in (
        'order_confirm'::public.stock_movement_type,
        'order_cancel_restore'::public.stock_movement_type
      )
    group by i.id, i.name, i.unit, i.stock_qty
  ) as x;

  ---------------------------------------------------------------------------
  -- orders
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orderId', o.id,
      'queueNumber', o.queue_number,
      'customerName', o.customer_name,
      'source', o.source,
      'paymentMethod', pay.method,
      'status', o.status,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', oi.name_snapshot,
            'qty', oi.qty,
            'note', oi.note
          )
          order by oi.id
        )
        from public.order_items as oi
        where oi.order_id = o.id
      ), '[]'::jsonb),
      'total', o.total,
      'confirmedAt', o.confirmed_at,
      'isManualTime', o.is_manual_time,
      'cancelReason', o.cancel_reason
    )
    order by o.queue_number
  ), '[]'::jsonb)
  into v_orders
  from public.orders as o
  left join public.payments as pay on pay.order_id = o.id
  where o.queue_date = p_date;

  return jsonb_build_object(
    'date', p_date::text,
    'totals', v_totals,
    'bySource', v_by_source,
    'byPaymentMethod', v_by_payment,
    'topMenu', v_top_menu,
    'ingredientUsage', v_bahan,
    'orders', v_orders
  );
end;
$$;

comment on function public.build_daily_report(date) is
  'Membangun isi laporan satu hari sesuai docs/api-contract.md bagian 4c. Hanya membaca. Order terhitung = antrean, dikerjakan, atau selesai dengan pembayaran tidak di-void. ingredientUsage.used = pengurangan order_confirm dikurangi pengembalian order_cancel_restore pada hari itu (WIB).';

revoke all on function public.build_daily_report(date) from public, anon, authenticated;
grant execute on function public.build_daily_report(date) to service_role;

-- ============================================================================
-- 2. save_missing_reports(p_actor_id) -> jsonb (create or replace, signature sama)
-- ============================================================================
create or replace function public.save_missing_reports(p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tanggal_awal date;
  v_sampai       date;
  v_hari_kemarin date;
  v_sudah_simpan integer := 0;
  v_hasil        jsonb;
  v_tanggal      date;
begin
  perform public.require_staff(
    p_actor_id,
    ARRAY['cashier'::public.app_role, 'admin'::public.app_role]
  );

  -- Tanggal order paling awal. Kalau nol, tidak ada yang perlu disimpan.
  select min(o.queue_date) into v_tanggal_awal
  from public.orders as o;

  if v_tanggal_awal is null then
    return jsonb_build_object('savedCount', 0);
  end if;

  v_hari_kemarin := public.wib_today() - 1;

  -- PERBAIKAN: batas akhir adalah KEMARIN, bukan least(kemarin, tanggal paling
  -- awal). Versi lama membuat rentang hanya satu tanggal, jadi hari-hari
  -- berikutnya yang belum tersimpan tidak pernah disimpan.
  v_sampai := v_hari_kemarin;

  -- Kalau tanggal order paling awal sudah di masa depan, while di bawah tidak
  -- dijalankan sama sekali.
  v_tanggal := v_tanggal_awal;
  while v_tanggal <= v_sampai loop
    v_hasil := public.save_daily_report(v_tanggal, 'catch_up');
    if coalesce((v_hasil ->> 'created')::boolean, false) then
      v_sudah_simpan := v_sudah_simpan + 1;
    end if;
    v_tanggal := v_tanggal + 1;
  end loop;

  return jsonb_build_object('savedCount', v_sudah_simpan);
end;
$$;

comment on function public.save_missing_reports(uuid) is
  'Menyimpan laporan semua hari yang belum tersimpan, dari tanggal order paling awal sampai kemarin. Hanya Cashier dan Admin. Dipakai sebagai cadangan kalau pg_cron gagal.';

revoke all on function public.save_missing_reports(uuid) from public, anon, authenticated;
grant execute on function public.save_missing_reports(uuid) to service_role;