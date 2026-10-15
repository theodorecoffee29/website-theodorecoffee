-- File ini: laporan harian dan Riwayat (tabel daily_reports).
--
-- Sumber aturan: docs/api-contract.md bagian 4c (isi dan aturan laporan),
-- docs/data-model.md bagian 2 (tabel daily_reports) dan bagian 3 (aturan data),
-- docs/order-flow.md bagian 5 dan 6, docs/logging.md bagian 2 sampai 6.
--
-- Isi file ini:
--   1. Satu kolom id di daily_reports (dokumen menulisnya, tabel lama belum punya).
--   2. build_daily_report(date)          -> membangun isi laporan (hanya membaca)
--   3. save_daily_report(date, source)   -> menyimpan laporan ke Riwayat
--   4. save_missing_reports(actor)       -> menyimpan semua hari yang terlewat
--   5. get_today_report(actor)           -> laporan hari ini (live)
--   6. list_reports(actor)               -> daftar Riwayat
--   7. get_report(actor, id)             -> isi satu laporan tersimpan
--   8. cancel_order                      -> ditambah penolakan pembatalan
--                                           setelah laporan hari itu tersimpan
--   9. Jadwal pg_cron                    -> menyimpan laporan tiap pagi
--
-- KONSEP PENTING:
-- - "Hari" bisnis memakai zona waktu WIB. PostgreSQL menyimpan waktu dalam UTC,
--   jadi batas hari yang dicari (awal dan akhir hari) dihitung dulu dalam WIB
--   lalu dikonversi ke timestamptz. Tanpa ini, laporan bisa salah masuk ke
--   tanggal milik customer yang berada di zona waktu server.
-- - Order TERHITUNG = status antrean, dikerjakan, atau selesai, DAN punya
--   pembayaran yang belum di-void. Order dibatalkan dan order yang masih
--   menunggu konfirmasi tidak masuk perhitungan penjualan.
-- - Riwayat tidak boleh berubah. Laporan yang sudah tersimpan tidak pernah
--   ditulis ulang, dan pembatalan order dari hari yang sudah tersimpan ditolak.
--
-- Semua fungsi memakai security definer + set search_path = '' supaya berjalan
-- dengan hak pemilik dan semua nama objek ditulis lengkap dengan schema.
-- revoke ... from public, anon, authenticated + grant ... to service_role
-- dilakukan untuk SETIAP fungsi, supaya hanya server yang bisa memanggil.

-- ============================================================================
-- 0. Kolom id di daily_reports
-- ============================================================================
-- docs/data-model.md menyebut daily_reports punya kolom id (uuid) yang dipakai
-- sebagai entity_id di log report.saved. Tabel yang dibuat di migrasi tabel
-- (20261006020347_tables.sql) belum punya kolom itu, jadi ditambahkan di sini.
-- Migrasi lama TIDAK diubah: perubahan selalu lewat file migrasi baru.
alter table public.daily_reports
  add column id uuid not null default gen_random_uuid();

comment on column public.daily_reports.id is
  'Id unik laporan. Dipakai sebagai entity_id di log aktivitas report.saved.';

-- ============================================================================
-- 1. build_daily_report(p_date) -> jsonb
-- ============================================================================
-- Membangun isi laporan satu hari sesuai docs/api-contract.md bagian 4c.
-- Fungsi INTERNAL: tidak dipanggil langsung dari aplikasi, hanya dipakai oleh
-- save_daily_report dan get_today_report. Tidak menulis apa pun ke database.
--
-- KENAPA FUNGSI INI MENERIMA TANGGAL, BUKAN SELALU "HARI INI":
--   Jadwal pg_cron berjalan pukul 00.05 WIB untuk menyimpan laporan HARI KEMARIN.
--   Kalau laporan dibangun dari "hari ini", isinya akan kosong. Dengan menerima
--   tanggal, jadwal bisa terlambat beberapa jam (server mati, cron tidak jalan)
--   tanpa mengubah hasil: tanggal yang sama akan menghasilkan laporan yang sama.
--
-- ORDER TERHITUNG (hanya ini yang masuk orderCount, sales, bySource,
-- byPaymentMethod, dan topMenu):
--   status IN (antrean, dikerjakan, selesai) DAN punya pembayaran dengan
--   voided_at kosong. Order dibatalkan tidak dihitung, dan order yang pembayarannya
--   sudah di-void juga tidak dihitung (docs/api-contract.md bagian 4c).
--
-- ingredientUsage.used: besaran bahan yang benar-benar terpakai pada hari itu,
--   yaitu jumlah pengurangan (order_confirm, qty_change negatif) dikurangi
--   jumlah yang dikembalikan (order_cancel_restore, qty_change positif).
--   Gerak stok lain (restock, adjustment) tidak dihitung sebagai pemakaian.
-- stockAtEnd: stock_after dari pergerakan terakhir bahan itu sampai akhir hari
--   itu (WIB). Kalau bahan belum punya pergerakan sama sekali sampai saat itu,
--   dipakai stock_qty sekarang, karena itu memang satu-satunya angka yang ada.
-- Hanya bahan yang punya pergerakan pada hari itu yang masuk ingredientUsage.
create or replace function public.build_daily_report(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Batas hari dalam WIB yang sudah dikonversi ke timestamptz.
  -- v_awal = 00.00.00 WIB tanggal itu, v_akhir = 00.00.00 WIB tanggal berikutnya.
  -- memakai < v_akhir supaya pergerakan tepat tengah malam tidak terlewat.
  v_awal        timestamptz;
  v_akhir       timestamptz;
  -- Bagian-bagian laporan, digabung jadi satu objek jsonb di akhir.
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
  -- totals: jumlah order terhitung, penjualan, order batal, dan order yang
  -- masih menunggu konfirmasi.
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
  -- bySource: order terhitung menurut asal order (online atau cashier).
  -- Kunci online dan cashier selalu ada walau nol, supaya tampilan tidak perlu
  -- mengatur ulang tiap hari.
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
  -- byPaymentMethod: order terhitung menurut metode bayar.
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
  -- topMenu: 10 menu teratas menurut jumlah porsi pada order terhitung.
  -- Jumlah dan nominal diambil dari order_items (snapshot harga saat dipesan),
  -- jadi laporan lama tidak ikut berubah kalau harga menu diganti.
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
  -- Hanya bahan yang punya pergerakan stok pada hari itu (WIB) yang masuk.
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
      -- Pemakaian = besaran pengurangan dikurangi besaran yang dikembalikan.
      -- qty_change untuk order_confirm negatif, jadi tandanya dibalik dulu.
      -- coalesce dipakai supaya bahan yang hanya punya satu jenis gerak tetap
      -- menghasilkan angka, bukan null.
      coalesce(sum(
        case
          when sm.type = 'order_confirm'::public.stock_movement_type then -sm.qty_change
          when sm.type = 'order_cancel_restore'::public.stock_movement_type then sm.qty_change
          else 0
        end
      ), 0) as used,
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
    group by i.id, i.name, i.unit, i.stock_qty
  ) as x;

  ---------------------------------------------------------------------------
  -- orders: semua order hari itu, termasuk yang dibatalkan, urut menurut
  -- nomor antrean. Laporan boleh memuat nama customer dan total karena yang
  -- boleh membacanya sudah Cashier atau Admin (docs/api-contract.md bagian 4c).
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orderId', o.id,
      'queueNumber', o.queue_number,
      'customerName', o.customer_name,
      'source', o.source,
      -- Metode bayar kosong kalau order belum dibayar (mis. masih menunggu
      -- konfirmasi atau dibatalkan sebelum konfirmasi).
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
  -- Pembayaran dibuat dengan join kiri supaya order yang belum dibayar tetap
  -- muncul di daftar order.
  left join public.payments as pay on pay.order_id = o.id
  where o.queue_date = p_date;

  -- Gabungkan semua bagian jadi satu objek laporan.
  -- jsonb_build_object menghasilkan JSON yang valid; angka numeric (mis. sales
  -- dan used) tetap ditulis sebagai angka, bukan teks.
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
  'Membangun isi laporan satu hari sesuai docs/api-contract.md bagian 4c. Hanya membaca. Order terhitung = antrean, dikerjakan, atau selesai dengan pembayaran tidak di-void.';

revoke all on function public.build_daily_report(date) from public, anon, authenticated;
grant execute on function public.build_daily_report(date) to service_role;

-- ============================================================================
-- 2. save_daily_report(p_date, p_source) -> jsonb
-- ============================================================================
-- Menyimpan laporan satu hari ke tabel daily_reports (Riwayat). Dipanggil
-- pg_cron tiap pagi untuk hari kemarin, dan oleh save_missing_reports sebagai
-- cadangan.
--
-- ATURAN:
-- - Hanya tanggal SEBELUM hari ini (WIB). Laporan hari ini masih berubah terus
--   (order baru masuk, order dibatalkan), jadi belum boleh dikunci. Tanggal hari
--   ini atau masa depan ditolak dengan VALIDATION_FAILED.
-- - Idempotent: kalau baris untuk tanggal itu sudah ada, TIDAK diubah dan
--   created = false. Ini yang membuat jadwal harian dan save_missing_reports
--   boleh dipanggil berulang tanpa merusak Riwayat.
-- - Log report.saved ditulis HANYA kalau baris baru benar-benar terbentuk,
--   supaya satu hari tidak punya banyak catatan log.
create or replace function public.save_daily_report(
  p_date date,
  p_source text default 'cron'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hari_ini   date;
  v_report_id  uuid;
  v_isi        jsonb;
begin
  if p_date is null then
    raise exception 'VALIDATION_FAILED' using detail = 'tanggal laporan wajib diisi';
  end if;

  v_hari_ini := public.wib_today();

  -- Laporan hanya boleh untuk hari yang sudah lewat.
  if p_date >= v_hari_ini then
    raise exception 'VALIDATION_FAILED'
      using detail = 'laporan hanya boleh disimpan untuk hari yang sudah lewat (sebelum ' || v_hari_ini::text || ')';
  end if;

  -- Bangun isinya lebih dulu. Kalau ada error, tidak ada baris yang tertinggal.
  v_isi := public.build_daily_report(p_date);

  -- Simpan. on conflict do nothing berarti baris yang sudah ada dibiarkan
  -- apa adanya; returning hanya memberi baris kalau baris baru benar-benar
  -- dibuat, dan itu dipakai untuk memutuskan apakah log ditulis atau tidak.
  insert into public.daily_reports (report_date, data)
  values (p_date, v_isi)
  on conflict (report_date) do nothing
  returning id into v_report_id;

  -- v_report_id null berarti baris sudah ada sebelumnya: tidak ada perubahan,
  -- jadi tidak ada log.
  if v_report_id is not null then
    -- Pelakunya sistem, jadi actor_id kosong (docs/logging.md bagian 3).
    perform public.write_activity_log(
      null,
      'system'::public.log_actor_role,
      'report.saved',
      'report',
      v_report_id,
      null,
      null,
      jsonb_build_object('date', p_date::text),
      jsonb_build_object('source', coalesce(p_source, 'cron'))
    );
  end if;

  return jsonb_build_object(
    'reportId', v_report_id,
    'created', v_report_id is not null
  );
end;
$$;

comment on function public.save_daily_report(date, text) is
  'Menyimpan laporan satu hari ke Riwayat. Hanya tanggal sebelum hari ini (WIB). Idempotent: baris yang sudah ada tidak diubah. Log report.saved hanya ditulis untuk baris baru.';

revoke all on function public.save_daily_report(date, text) from public, anon, authenticated;
grant execute on function public.save_daily_report(date, text) to service_role;

-- ============================================================================
-- 3. save_missing_reports(p_actor_id) -> jsonb
-- ============================================================================
-- Cadangan: menyimpan semua hari yang belum punya laporan, dari tanggal order
-- paling awal sampai kemarin. Dipanggil saat Cashier/Admin membuka Riwayat,
-- untuk jaga-jaga kalau pg_cron sempat gagal.
--
-- Peran dibaca dari tabel profiles lewat require_staff, sama seperti fungsi
-- staf lain. Kalau tidak ada order sama sekali, tidak ada yang disimpan.
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
  v_sampai := least(v_hari_kemarin, v_tanggal_awal);

  -- Satu per satu dari tanggal paling awal sampai kemarin. Tanggal yang sudah
  -- punya laporan dilewati (save_daily_report tidak mengubahnya).
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

-- ============================================================================
-- 4. get_today_report(p_actor_id) -> jsonb
-- ============================================================================
-- Laporan hari ini (WIB). BUKAN laporan yang tersimpan: isinya masih berubah
-- terus selama booth buka, jadi ditandai dengan kunci live = true supaya
-- tampilan tahu angka ini belum final.
create or replace function public.get_today_report(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(
    p_actor_id,
    ARRAY['cashier'::public.app_role, 'admin'::public.app_role]
  );

  return public.build_daily_report(public.wib_today())
    || jsonb_build_object('live', true);
end;
$$;

comment on function public.get_today_report(uuid) is
  'Laporan hari ini (WIB) yang masih live, ditandai dengan kunci live = true. Hanya Cashier dan Admin.';

revoke all on function public.get_today_report(uuid) from public, anon, authenticated;
grant execute on function public.get_today_report(uuid) to service_role;

-- ============================================================================
-- 5. list_reports(p_actor_id) -> jsonb
-- ============================================================================
-- Daftar Riwayat: id laporan, tanggal, waktu disimpan, dan ringkasan total.
-- Terbaru dulu, supaya hari yang paling baru langsung terlihat tanpa menggulir.
create or replace function public.list_reports(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reports jsonb;
begin
  perform public.require_staff(
    p_actor_id,
    ARRAY['cashier'::public.app_role, 'admin'::public.app_role]
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'reportId', r.id,
      'date', r.report_date::text,
      'generatedAt', r.generated_at,
      -- Ringkasan total diambil dari dalam data, supaya daftar Riwayat tidak
      -- perlu menghitung ulang penjualan.
      'totals', r.data -> 'totals'
    )
    order by r.report_date desc
  ), '[]'::jsonb)
  into v_reports
  from public.daily_reports as r;

  return jsonb_build_object('reports', v_reports);
end;
$$;

comment on function public.list_reports(uuid) is
  'Daftar Riwayat: id, tanggal, waktu disimpan, dan ringkasan total. Terbaru dulu. Hanya Cashier dan Admin.';

revoke all on function public.list_reports(uuid) from public, anon, authenticated;
grant execute on function public.list_reports(uuid) to service_role;

-- ============================================================================
-- 6. get_report(p_actor_id, p_report_id) -> jsonb
-- ============================================================================
-- Isi satu laporan yang sudah tersimpan (snapshot).
--
-- Id yang bukan uuid dan id yang tidak ada sengaja diberi error yang sama
-- (VALIDATION_FAILED dengan detail "laporan tidak ditemukan"). Alasannya:
-- pesan yang berbeda akan memberi tahu pemanggil bahwa sebuah id pernah ada,
-- padahal halaman ini tidak perlu membocorkan itu.
create or replace function public.get_report(
  p_actor_id uuid,
  p_report_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_report    record;
begin
  perform public.require_staff(
    p_actor_id,
    ARRAY['cashier'::public.app_role, 'admin'::public.app_role]
  );

  begin
    v_id := p_report_id::uuid;
  exception
    when invalid_text_representation then
      raise exception 'VALIDATION_FAILED' using detail = 'laporan tidak ditemukan';
  end;

  select r.id, r.report_date, r.generated_at, r.data
  into v_report
  from public.daily_reports as r
  where r.id = v_id;

  if not found then
    raise exception 'VALIDATION_FAILED' using detail = 'laporan tidak ditemukan';
  end if;

  return jsonb_build_object(
    'reportId', v_report.id,
    'date', v_report.report_date::text,
    'generatedAt', v_report.generated_at,
    'data', v_report.data
  );
end;
$$;

comment on function public.get_report(uuid, text) is
  'Isi satu laporan tersimpan: id, tanggal, waktu disimpan, dan data. Id tidak valid atau tidak ada menghasilkan VALIDATION_FAILED dengan detail "laporan tidak ditemukan". Hanya Cashier dan Admin.';

revoke all on function public.get_report(uuid, text) from public, anon, authenticated;
grant execute on function public.get_report(uuid, text) to service_role;

-- ============================================================================
-- 7. cancel_order (create or replace, signature sama)
-- ============================================================================
-- Fungsi ini sudah ada di migrasi 20261010073525_cancel_reason_stock_overview.sql.
-- Di sini isinya disalin UTUH dan hanya ditambah satu pemeriksaan:
-- pembatalan ditolak kalau laporan hari order itu sudah tersimpan.
--
-- KENAPA PEMBATALAN SETELAH HARI DITUTUP DITOLAK:
--   Riwayat tidak boleh berubah setelah tersimpan (docs/api-contract.md bagian 4c).
--   Kalau pembatalan diteruskan, stok dan pembayaran dikembalikan padahal
--   laporan yang sudah dicetak atau disimpan tidak ikut berubah, jadi laporan
--   lama dan database tidak akan cocok. Menolak lebih aman daripada menyimpan
--   angka yang diam-diam tidak benar.
--
-- Pemeriksaan diletakkan SETELAH baris order dikunci (for update) dan SETELAH
-- dipastikan order ada, tapi SEBELUM ada perubahan apa pun (belum ada pembayaran
-- yang di-void, stok yang dikembalikan, atau status yang diubah).
create or replace function public.cancel_order(
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
  v_queue_date      date;
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

  select o.status, o.queue_number, o.queue_date
  into v_old_status, v_queue_number, v_queue_date
  from public.orders as o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = 'order ' || p_order_id || ' tidak ditemukan';
  end if;

  -- BARU: laporan hari itu sudah tersimpan, jadi pembatalan tidak boleh
  -- mengubah angka yang sudah dikunci di Riwayat.
  if exists (
    select 1
    from public.daily_reports as dr
    where dr.report_date = v_queue_date
  ) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'laporan hari itu sudah tersimpan';
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
  ---------------------------------------------------------------------------
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
  'Batalkan order. Customer (p_actor_id null) otomatis alasan diminta_customer; staf wajib memilih reason, dan reason lainnya wajib note 1-100 karakter. Order antrean: pembayaran di-void dan stok dikembalikan. Ditolak dengan VALIDATION_FAILED kalau laporan hari order itu sudah tersimpan.';

revoke all on function public.cancel_order(text, uuid, public.order_cancel_reason, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.cancel_order(text, uuid, public.order_cancel_reason, text, jsonb)
  to service_role;

-- ============================================================================
-- 8. Jadwal pg_cron
-- ============================================================================
-- Laporan kemarin disimpan tiap hari pukul 17.05 UTC = 00.05 WIB. Jam 00.05
-- dipilih supaya semua order Jumat malam sudah tercatat dan tidak ada transaksi
-- yang masih berjalan saat hari berganti.
--
-- Ekstensi pg_cron sengaja TIDAK dibuat di migrasi ini. Extensi hanya bisa
-- dipasang lewat Dashboard atau ALTER DATABASE, dan keputusannya ada di
-- tangan pengguna. Kalau pg_cron belum terpasang, blok ini hanya memberi
-- pemberitahuan dan tidak menggagalkan migrasi.
do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    -- Kalau job dengan nama sama pernah dibuat (mis. migrasi dijalankan ulang),
    -- job lamanya dibuang dulu supaya tidak ada dua jadwal yang sama.
    if exists (
      select 1
      from cron.job
      where jobname = 'save_daily_report_nightly'
    ) then
      perform cron.unschedule('save_daily_report_nightly');
    end if;

    perform cron.schedule(
      'save_daily_report_nightly',
      '5 17 * * *',
      'select public.save_daily_report(public.wib_today() - 1)'
    );
  else
    raise notice
      'pg_cron belum terpasang, jadi jadwal penyimpanan laporan harian BELUM dibuat. Aktifkan ekstensi pg_cron (Supabase Dashboard > Database > Extensions), lalu pasang jadwal ini secara manual: select cron.schedule(''save_daily_report_nightly'', ''5 17 * * *, ''select public.save_daily_report(public.wib_today() - 1)'');';
  end if;
end;
$$;