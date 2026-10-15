-- =============================================================================
-- PERINGATAN BESAR: FILE INI HANYA UNTUK PENGEMBANGAN (development).
-- =============================================================================
--
-- File ini BUKAN migrasi. File ini tidak pernah dijalankan oleh
-- `supabase db push` dan tidak boleh ikut ke database production.
-- Isinya hanya SATU blok DO yang menjalankan seluruh pemeriksaan laporan
-- harian dan Riwayat, untuk dijalankan sendiri di Supabase Dashboard > SQL Editor.
--
-- CARA MEMAKAI:
--   1. Buka Supabase Dashboard > SQL Editor (project DEVELOPMENT).
--   2. Pastikan migrasi 20261013025950_daily_reports.sql sudah dijalankan.
--   3. Blokir seluruh isi file ini, lalu tekan Run. JANGAN menjalankan
--      per baris: seluruh pemeriksaan harus jalan dalam satu blok.
--   4. Hasilnya muncul sebagai ERROR yang memuat ringkasan semua pemeriksaan.
--      Itu normal, bukan kegagalan.
--
-- KENAPA HASILNYA ERROR:
--   Blok ini sengaja raise exception di akhir dengan teks ringkasan. Exception
--   itu membuat PostgreSQL MEMBATALKAN seluruh perubahan di dalam blok
--   (rollback). Jadi tidak ada sisa data tes di database: tidak ada menu
--   "Tes", tidak ada bahan "Tes", tidak ada order, tidak ada laporan harian
--   baru, dan tidak ada log aktivitas.
--
-- CATATAN SOAL DATA TES:
--   Data tes dibuat dengan insert langsung ke orders, order_items, payments, dan
--   stock_movements untuk tanggal 400 HARI LALU (jauh di masa lalu, memakai
--   wib_today() - 400), supaya tidak bentrok dengan data nyata. Nomor antrean
--   tes juga memakai angka besar (9001 ke atas) supaya tidak pernah sama dengan
--   nomor antrean hari itu.
--
--   Stok bahan sengaja diubah langsung lewat INSERT ke stock_movements.
--   Tidak ada fungsi admin yang bisa membuat pergerakan stok pada tanggal
--   lama, dan laporan justru diuji dari jejak pergerakan itu.

do $$
declare
  -- Akhiran unik supaya nama tes tidak pernah bentrok.
  v_sufiks       text;

  -- Nama objek tes.
  v_nama_bahan_a text;
  v_nama_bahan_b text;
  v_nama_menu_1  text;
  v_nama_menu_2  text;

  -- Tanggal dan waktu data tes (WIB, 400 hari lalu).
  v_tanggal_uji  date;
  -- Dua tanggal tambahan (399 dan 398 hari lalu) yang dipakai HANYA oleh
  -- pemeriksaan (g). Dipakai supaya ada dua hari yang belum pernah disimpan
  -- laporannya saat save_missing_reports dipanggil.
  v_tanggal_uji_2 date;
  v_tanggal_uji_3 date;
  -- Waktu 10.00 WIB pada tanggal uji, dipakai untuk semua kolom waktu.
  v_waktu_uji    timestamptz;

  -- Id akun dari public.profiles.
  v_admin        uuid;
  v_cashier      uuid;
  v_barista      uuid;
  -- Actor staf yang dipakai kalau Cashier tidak ada.
  v_aktor        uuid;

  -- Id objek tes.
  v_bahan_a      uuid;
  v_bahan_b      uuid;
  v_menu_1       uuid;
  v_menu_2       uuid;

  -- Id order tes. A dan B terhitung, C dan E dibatalkan, D masih menunggu.
  v_order_a      uuid;
  v_order_b      uuid;
  v_order_c      uuid;
  v_order_d      uuid;
  v_order_e      uuid;
  v_order_hari_ini uuid;
  -- Dua order untuk tanggal uji 2 dan 3 (dipakai pemeriksaan (g)).
  v_order_f      uuid;
  v_order_g      uuid;

  -- Angka yang dibandingkan antar pemeriksaan.
  v_jumlah       integer;
  v_jumlah_log   integer;
  v_jumlah_order integer;
  v_sales        numeric;
  v_dibuat       boolean;
  v_dibuat_lagi  boolean;
  v_qty_1        integer;
  v_qty_2        integer;
  v_nilai_1      numeric;
  v_nilai_2      numeric;
  -- Angka pemakaian bahan dan sisa stok akhir hari. Dibaca sebagai NUMERIC,
  -- bukan teks: kolomnya numeric(12,3), jadi PostgreSQL bisa menulisnya
  -- "150.000" dan perbandingan dengan teks "150" akan salah.
  v_bahan_a_pakai  numeric;
  v_bahan_a_sisa  numeric;
  v_bahan_b_pakai numeric;
  v_bahan_b_sisa  numeric;
  -- Potongan hitungan manual di pemeriksaan (d), supaya penyebab angka yang
  -- salah bisa dibaca langsung dari baris hasil tes.
  v_pengurangan   numeric;
  v_pengembalian  numeric;
  v_hitung_manual numeric;
  -- Teks daftar pergerakan stok bahan A (dicetak di baris hasil (d)).
  v_riwayat_bahan_a text;
  v_bola_lolos   integer;
  -- Angka rentang yang dilihat save_missing_reports (pemeriksaan g).
  v_tanggal_awal_min date;
  v_banyak_tanggal  integer;
  v_tanggal_dalam_rentang boolean;
  -- True kalau ekstensi pg_cron terpasang di project ini.
  v_pg_cron_ada  boolean;

  -- Id laporan hasil simpan (dipakai di beberapa pemeriksaan).
  v_report_id    uuid;

  -- Wadah hasil jsonb dan teks.
  v_laporan      jsonb;
  v_hasil        jsonb;
  v_hasil_kedua  jsonb;
  v_teks         text;
  v_teks_2       text;
  v_nilai_teks   text;
  v_bola         boolean;

  -- Penampung hasil satu pemeriksaan.
  v_nama_cek     text;
  v_didapat      text;
  v_lolos        boolean;

  -- Isi exception yang ditangkap, supaya pesan, detail, dan konteks bisa
  -- dicetak apa adanya kalau tes GAGAL.
  v_pesan        text;
  v_detail       text;
  v_konteks      text;

  -- Daftar hasil seluruh pemeriksaan, dan penghitungnya.
  v_daftar_hasil text[] := array[]::text[];
  v_total        integer := 0;
  v_jumlah_lolos integer := 0;
  v_jumlah_gagal integer := 0;
  v_jumlah_lewati integer := 0;
begin
  ---------------------------------------------------------------------------
  -- PERSIAPAN
  ---------------------------------------------------------------------------

  v_sufiks := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_nama_bahan_a := 'Tes Bahan Laporan A ' || v_sufiks;
  v_nama_bahan_b := 'Tes Bahan Laporan B ' || v_sufiks;
  v_nama_menu_1 := 'Tes Menu Laporan 1 ' || v_sufiks;
  v_nama_menu_2 := 'Tes Menu Laporan 2 ' || v_sufiks;

  -- 400 hari lalu: hampir pasti tidak ada data nyata di tanggal ini.
  v_tanggal_uji := public.wib_today() - 400;
  -- Dua tanggal untuk pemeriksaan (g): 399 dan 398 hari lalu.
  v_tanggal_uji_2 := public.wib_today() - 399;
  v_tanggal_uji_3 := public.wib_today() - 398;
  -- 10.00 WIB pada tanggal uji. WAKTU DIKONVERSI KE timestamptz lewat
  -- "at time zone", supaya benar-benar 10.00 WIB dan bukan 10.00 UTC.
  v_waktu_uji := (v_tanggal_uji::timestamp + interval '10 hours')
    at time zone 'Asia/Jakarta';

  -- Akun dari tabel profil. Yang tidak ada ditandai DILEWATI, bukan gagal.
  select p.id into v_admin
  from public.profiles as p
  where p.role = 'admin' and p.is_active
  order by p.created_at
  limit 1;

  if v_admin is null then
    raise exception '%',
      'RINGKASAN TES (semua perubahan dibatalkan):' || E'\n' ||
      'GAGAL menjalankan tes: tidak ada akun admin AKTIF di public.profiles.' || E'\n' ||
      'Buat akun admin lebih dulu, lalu jalankan ulang file ini.';
  end if;

  select p.id into v_cashier
  from public.profiles as p
  where p.role = 'cashier' and p.is_active
  order by p.created_at
  limit 1;

  select p.id into v_barista
  from public.profiles as p
  where p.role = 'barista' and p.is_active
  order by p.created_at
  limit 1;

  v_aktor := coalesce(v_cashier, v_admin);

  ---------------------------------------------------------------------------
  -- DATA TES
  ---------------------------------------------------------------------------
  -- Ringkasan yang harus muncul di laporan tanggal uji:
  --   Order A: online, selesai, bayar QRIS 60000 (terhitung)
  --   Order B: cashier, selesai, bayar tunai 20000 (terhitung)
  --   Order C: online, dibatalkan setelah konfirmasi, bayar 10000 di-void
  --   Order D: cashier, masih menunggu konfirmasi, belum bayar
  --   Order E: cashier, dibatalkan setelah konfirmasi, bayar 30000 di-void
  -- Jadi: orderCount 2, sales 80000, cancelledCount 2, unfinishedCount 1.

  -- Bahan dan menu.
  insert into public.ingredients (name, unit, stock_qty)
  values (v_nama_bahan_a, 'g', 820)
  returning id into v_bahan_a;

  insert into public.ingredients (name, unit, stock_qty)
  values (v_nama_bahan_b, 'pcs', 15)
  returning id into v_bahan_b;

  insert into public.menu_items (name, price)
  values (v_nama_menu_1, 10000)
  returning id into v_menu_1;

  insert into public.menu_items (name, price)
  values (v_nama_menu_2, 20000)
  returning id into v_menu_2;

  -- Lima order pada tanggal uji. Nomor antrean 9001 ke atas supaya tidak
  -- pernah bentrok dengan nomor antrean hari itu.
  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by
  ) values (
    v_tanggal_uji, 9001, 'Tes Customer A ' || v_sufiks, 'online', 'selesai', 60000,
    v_waktu_uji, v_waktu_uji, v_waktu_uji, v_admin
  )
  returning id into v_order_a;

  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by
  ) values (
    v_tanggal_uji, 9002, 'Tes Customer B ' || v_sufiks, 'cashier', 'selesai', 20000,
    v_waktu_uji, v_waktu_uji, v_waktu_uji, v_admin
  )
  returning id into v_order_b;

  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by, cancelled_at,
    cancelled_by_role, cancel_reason
  ) values (
    v_tanggal_uji, 9003, 'Tes Customer C ' || v_sufiks, 'online', 'dibatalkan', 10000,
    v_waktu_uji, v_waktu_uji, v_waktu_uji, v_admin, v_waktu_uji,
    'cashier', 'stok_habis'
  )
  returning id into v_order_c;

  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at
  ) values (
    v_tanggal_uji, 9004, 'Tes Customer D ' || v_sufiks, 'cashier',
    'menunggu_konfirmasi', 20000,
    v_waktu_uji, v_waktu_uji
  )
  returning id into v_order_d;

  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by, cancelled_at,
    cancelled_by_role, cancel_reason
  ) values (
    v_tanggal_uji, 9005, 'Tes Customer E ' || v_sufiks, 'cashier', 'dibatalkan', 20000,
    v_waktu_uji, v_waktu_uji, v_waktu_uji, v_admin, v_waktu_uji,
    'cashier', 'pesanan_ganda'
  )
  returning id into v_order_e;

  -- Satu order untuk HARI INI, dipakai di pemeriksaan laporan hari ini.
  -- Nomor antrean 9006 supaya tidak bentrok dengan order lain hari ini.
  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by
  ) values (
    public.wib_today(), 9006, 'Tes Customer Hari Ini ' || v_sufiks, 'online',
    'selesai', 10000,
    now(), now(), now(), v_admin
  )
  returning id into v_order_hari_ini;

  -- Dua order lagi di tanggal 399 dan 398 hari lalu. Tuannya satu-satunya:
  -- menyediakan dua hari yang belum pernah disimpan laporannya, supaya
  -- save_missing_reports (pemeriksaan g) punya "hari yang hilang" tanpa perlu
  -- menghapus baris daily_reports (tabel itu tidak boleh diubah atau dihapus).
  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by
  ) values (
    v_tanggal_uji_2, 9007, 'Tes Customer F ' || v_sufiks, 'online', 'selesai', 10000,
    (v_tanggal_uji_2::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    (v_tanggal_uji_2::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    (v_tanggal_uji_2::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    v_admin
  )
  returning id into v_order_f;

  insert into public.orders (
    queue_date, queue_number, customer_name, source, status, total,
    created_at, occurred_at, confirmed_at, confirmed_by
  ) values (
    v_tanggal_uji_3, 9008, 'Tes Customer G ' || v_sufiks, 'cashier', 'selesai', 20000,
    (v_tanggal_uji_3::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    (v_tanggal_uji_3::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    (v_tanggal_uji_3::timestamp + interval '10 hours') at time zone 'Asia/Jakarta',
    v_admin
  )
  returning id into v_order_g;

  -- Item order. Harga dan nama disalin (snapshot) supaya laporan tidak
  -- bergantung pada menu_items.
  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, price_snapshot, qty, note, subtotal
  ) values
    (v_order_a, v_menu_1, v_nama_menu_1, 10000, 2, null, 20000),
    (v_order_a, v_menu_2, v_nama_menu_2, 20000, 2, 'less sugar', 40000),
    (v_order_b, v_menu_2, v_nama_menu_2, 20000, 1, null, 20000),
    (v_order_c, v_menu_1, v_nama_menu_1, 10000, 1, null, 10000),
    (v_order_d, v_menu_2, v_nama_menu_2, 20000, 1, null, 20000),
    (v_order_e, v_menu_2, v_nama_menu_2, 20000, 1, null, 20000),
    (v_order_f, v_menu_1, v_nama_menu_1, 10000, 1, null, 10000),
    (v_order_g, v_menu_2, v_nama_menu_2, 20000, 1, null, 20000);

  -- Pembayaran. Order C dan E sudah dibayar lalu dibatalkan, jadi pembayarannya
  -- ditandai batal (voided_at terisi) dan tidak boleh dihitung di laporan.
  insert into public.payments (order_id, method, amount, recorded_by, recorded_at)
  values (v_order_a, 'qris', 60000, v_admin, v_waktu_uji);

  insert into public.payments (order_id, method, amount, recorded_by, recorded_at)
  values (v_order_b, 'tunai', 20000, v_admin, v_waktu_uji);

  insert into public.payments (
    order_id, method, amount, recorded_by, recorded_at, voided_at, voided_by
  ) values
    (v_order_c, 'qris', 10000, v_admin, v_waktu_uji, v_waktu_uji, v_admin),
    (v_order_e, 'tunai', 30000, v_admin, v_waktu_uji, v_waktu_uji, v_admin),
    (v_order_hari_ini, 'qris', 10000, v_admin, now(), null, null);

  -- Pembayaran untuk dua tanggal tambahan (dipakai pemeriksaan g). Keduanya
  -- tidak di-void, jadi ordernya terhitung di laporan tanggalnya.
  insert into public.payments (order_id, method, amount, recorded_by, recorded_at)
  values
    (v_order_f, 'qris', 10000, v_admin,
      (v_tanggal_uji_2::timestamp + interval '10 hours') at time zone 'Asia/Jakarta'),
    (v_order_g, 'tunai', 20000, v_admin,
      (v_tanggal_uji_3::timestamp + interval '10 hours') at time zone 'Asia/Jakarta');

  -- Pergerakan stok pada tanggal uji (semua di dalam hari itu menurut WIB).
  -- Bahan A: berkurang 100 (order A), 50 (order B), 20 (order C), lalu 20
  -- dikembalikan saat order C dibatalkan. Pemakaian yang dihitung laporan
  -- adalah besaran: (100 + 50 + 20) - 20 = 150. Sisa akhir hari itu 850.
  -- Bahan B: berkurang 5 (order B). Pemakaian 5, sisa akhir hari itu 15.
  insert into public.stock_movements (
    ingredient_id, order_id, type, qty_change, stock_after, created_by, created_at
  ) values
    (v_bahan_a, v_order_a, 'order_confirm', -100, 900, v_admin, v_waktu_uji),
    (v_bahan_a, v_order_b, 'order_confirm', -50, 850, v_admin,
      v_waktu_uji + interval '30 minutes'),
    (v_bahan_a, v_order_c, 'order_confirm', -20, 830, v_admin,
      v_waktu_uji + interval '60 minutes'),
    (v_bahan_a, v_order_c, 'order_cancel_restore', 20, 850, v_admin,
      v_waktu_uji + interval '90 minutes'),
    (v_bahan_b, v_order_b, 'order_confirm', -5, 15, v_admin, v_waktu_uji);

  -- Satu pergerakan pada HARI INI untuk bahan A. Ini harus TIDAK ikut dihitung
  -- di laporan tanggal uji, dan tidak boleh mengubah stockAtEnd hari itu.
  insert into public.stock_movements (
    ingredient_id, order_id, type, qty_change, stock_after, created_by, created_at
  ) values (v_bahan_a, v_order_hari_ini, 'order_confirm', -30, 820, v_admin, now());

  ---------------------------------------------------------------------------
  -- (a) totals hanya menghitung order terhitung
  ---------------------------------------------------------------------------
  v_nama_cek := '(a) totals hanya menghitung order terhitung';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    v_laporan := public.build_daily_report(v_tanggal_uji);

    v_jumlah_order := (v_laporan -> 'totals' ->> 'orderCount')::integer;
    v_sales := (v_laporan -> 'totals' ->> 'sales')::numeric;
    v_jumlah := (v_laporan -> 'totals' ->> 'cancelledCount')::integer;
    v_qty_1 := (v_laporan -> 'totals' ->> 'unfinishedCount')::integer;

    -- Daftar order harus memuat kelima order hari itu, termasuk yang dibatalkan
    -- dan yang masih menunggu konfirmasi.
    v_qty_2 := jsonb_array_length(v_laporan -> 'orders');

    v_didapat := format(
      'orderCount = %s (harap 2), sales = %s (harap 80000), cancelledCount = %s (harap 2), unfinishedCount = %s (harap 1), jumlah order di daftar = %s (harap 5)',
      v_jumlah_order, v_sales, v_jumlah, v_qty_1, v_qty_2
    );

    v_lolos := (
      v_jumlah_order = 2
      and v_sales = 80000
      and v_jumlah = 2
      and v_qty_1 = 1
      and v_qty_2 = 5
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'orderCount 2, sales 80000, cancelledCount 2, unfinishedCount 1, 5 baris order',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (b) bySource dan byPaymentMethod
  ---------------------------------------------------------------------------
  v_nama_cek := '(b) bySource dan byPaymentMethod benar';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Laporan dibangun ulang di sini supaya pemeriksaan ini tidak bergantung
    -- pada hasil pemeriksaan sebelumnya.
    v_laporan := public.build_daily_report(v_tanggal_uji);

    v_teks := (v_laporan -> 'bySource' -> 'online' ->> 'count')::text
      || '/' || (v_laporan -> 'bySource' -> 'online' ->> 'amount')::text;
    v_teks_2 := (v_laporan -> 'bySource' -> 'cashier' ->> 'count')::text
      || '/' || (v_laporan -> 'bySource' -> 'cashier' ->> 'amount')::text;
    v_nilai_teks := (v_laporan -> 'byPaymentMethod' -> 'qris' ->> 'count')::text
      || '/' || (v_laporan -> 'byPaymentMethod' -> 'qris' ->> 'amount')::text;
    v_lolos := coalesce(
      (v_laporan -> 'bySource' -> 'online' ->> 'count')::integer, -1) = 1
      and coalesce(
        (v_laporan -> 'bySource' -> 'online' ->> 'amount')::numeric, -1) = 60000
      and coalesce(
        (v_laporan -> 'bySource' -> 'cashier' ->> 'count')::integer, -1) = 1
      and coalesce(
        (v_laporan -> 'bySource' -> 'cashier' ->> 'amount')::numeric, -1) = 20000
      and coalesce(
        (v_laporan -> 'byPaymentMethod' -> 'qris' ->> 'count')::integer, -1) = 1
      and coalesce(
        (v_laporan -> 'byPaymentMethod' -> 'qris' ->> 'amount')::numeric, -1) = 60000
      and coalesce(
        (v_laporan -> 'byPaymentMethod' -> 'tunai' ->> 'count')::integer, -1) = 1
      and coalesce(
        (v_laporan -> 'byPaymentMethod' -> 'tunai' ->> 'amount')::numeric, -1) = 20000;

    v_didapat := format(
      'bySource online = %s, cashier = %s | byPaymentMethod qris = %s, tunai = %s (format count/amount)',
      v_teks, v_teks_2, v_nilai_teks,
      (v_laporan -> 'byPaymentMethod' -> 'tunai' ->> 'count')::text
        || '/' || (v_laporan -> 'byPaymentMethod' -> 'tunai' ->> 'amount')::text
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'online 1/60000, cashier 1/20000, qris 1/60000, tunai 1/20000',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (c) topMenu urut menurut qty
  ---------------------------------------------------------------------------
  v_nama_cek := '(c) topMenu urut menurut jumlah porsi';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Laporan dibangun ulang di sini supaya pemeriksaan ini mandiri.
    v_laporan := public.build_daily_report(v_tanggal_uji);

    -- Menu 2 terpakai 3 porsi (order A 2 porsi + order B 1 porsi), menu 1
    -- terpakai 2 porsi. Jadi menu 2 harus di urutan pertama.
    v_teks := v_laporan -> 'topMenu' -> 0 ->> 'name';
    v_qty_1 := (v_laporan -> 'topMenu' -> 0 ->> 'qty')::integer;
    v_nilai_1 := (v_laporan -> 'topMenu' -> 0 ->> 'amount')::numeric;
    v_teks_2 := v_laporan -> 'topMenu' -> 1 ->> 'name';
    v_qty_2 := (v_laporan -> 'topMenu' -> 1 ->> 'qty')::integer;
    v_nilai_2 := (v_laporan -> 'topMenu' -> 1 ->> 'amount')::numeric;

    v_didapat := format(
      'pertama = %s qty %s nominal %s | kedua = %s qty %s nominal %s | jumlah menu = %s',
      v_teks, v_qty_1, v_nilai_1, v_teks_2, v_qty_2, v_nilai_2,
      jsonb_array_length(v_laporan -> 'topMenu')
    );

    v_lolos := (
      v_teks = v_nama_menu_2
      and v_qty_1 = 3
      and v_nilai_1 = 60000
      and v_teks_2 = v_nama_menu_1
      and v_qty_2 = 2
      and v_nilai_2 = 20000
      and jsonb_array_length(v_laporan -> 'topMenu') = 2
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'menu 2 (3 porsi) dulu lalu menu 1 (2 porsi), hanya 2 menu',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (d) ingredientUsage: pemakaian dan sisa stok akhir hari
  ---------------------------------------------------------------------------
  v_nama_cek := '(d) ingredientUsage dipakai benar';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Laporan dibangun ulang di sini supaya pemeriksaan ini mandiri.
    v_laporan := public.build_daily_report(v_tanggal_uji);

    -- Angka diambil sebagai NUMERIC, bukan teks, karena kolomnya numeric(12,3)
    -- dan PostgreSQL boleh menulis "150.000" atau "850.000".
    select (x ->> 'used')::numeric, (x ->> 'stockAtEnd')::numeric
    into v_bahan_a_pakai, v_bahan_a_sisa
    from jsonb_array_elements(v_laporan -> 'ingredientUsage') as x
    where x ->> 'name' = v_nama_bahan_a;

    -- Daftar semua pergerakan bahan A yang disisipkan tes ini (termasuk yang
    -- sengaja dibuat di luar tanggal uji), supaya penyebab angka yang salah
    -- bisa dibaca langsung dari baris hasil tes.
    -- PENTING: klausa INTO harus langsung setelah daftar kolom, jadi SETELAH
    -- tanda kurung penutup string_agg dan SEBELUM from. Tidak boleh ada titik
    -- koma di antara keduanya.
    select string_agg(
      format(
        '[%s %s WIB] %s qty_change %s stock_after %s',
        (sm.created_at at time zone 'Asia/Jakarta')::date::text,
        to_char(sm.created_at at time zone 'Asia/Jakarta', 'HH24:MI'),
        sm.type::text,
        sm.qty_change::text,
        sm.stock_after::text
      ),
      ' ; ' order by sm.created_at
    )
    into v_riwayat_bahan_a
    from public.stock_movements as sm
    where sm.ingredient_id = v_bahan_a;

    -- Hitungan manual memakai rumus docs/api-contract.md bagian 4c:
    -- used = besaran pengurangan (order_confirm) dikurangi besaran yang
    -- dikembalikan (order_cancel_restore), HANYA pada tanggal uji.
    select
      -coalesce(sum(
        case when sm.type = 'order_confirm' then sm.qty_change else 0 end
      ), 0),
      coalesce(sum(
        case when sm.type = 'order_cancel_restore' then sm.qty_change else 0 end
      ), 0),
      -coalesce(sum(
        case when sm.type = 'order_confirm' then sm.qty_change else 0 end
      ), 0)
      -coalesce(sum(
        case when sm.type = 'order_cancel_restore' then sm.qty_change else 0 end
      ), 0)
    into v_pengurangan, v_pengembalian, v_hitung_manual
    from public.stock_movements as sm
    where sm.ingredient_id = v_bahan_a
      and (sm.created_at at time zone 'Asia/Jakarta')::date = v_tanggal_uji;

    select (x ->> 'used')::numeric, (x ->> 'stockAtEnd')::numeric
    into v_bahan_b_pakai, v_bahan_b_sisa
    from jsonb_array_elements(v_laporan -> 'ingredientUsage') as x
    where x ->> 'name' = v_nama_bahan_b;

    v_jumlah := jsonb_array_length(v_laporan -> 'ingredientUsage');

    v_didapat := format(
      '%s: used = %s (harap 150), stockAtEnd = %s (harap 850) | %s: used = %s (harap 5), stockAtEnd = %s (harap 15) | jumlah bahan = %s (harap 2) | hitungan manual: pengurangan %s dikurangi pengembalian %s = %s | pergerakan bahan A: %s',
      v_nama_bahan_a, coalesce(v_bahan_a_pakai::text, '(kosong)'),
      coalesce(v_bahan_a_sisa::text, '(kosong)'),
      v_nama_bahan_b, coalesce(v_bahan_b_pakai::text, '(kosong)'),
      coalesce(v_bahan_b_sisa::text, '(kosong)'),
      v_jumlah,
      coalesce(v_pengurangan::text, '(kosong)'),
      coalesce(v_pengembalian::text, '(kosong)'),
      coalesce(v_hitung_manual::text, '(kosong)'),
      coalesce(v_riwayat_bahan_a, '(kosong)')
    );

    v_lolos := (
      v_bahan_a_pakai = 150
      and v_bahan_a_sisa = 850
      and v_bahan_b_pakai = 5
      and v_bahan_b_sisa = 15
      and v_jumlah = 2
      and v_hitung_manual = 150
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'bahan A dipakai 150 sisa 850, bahan B dipakai 5 sisa 15',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (e) save_daily_report idempotent dan lognya hanya satu
  ---------------------------------------------------------------------------
  v_nama_cek := '(e) save_daily_report idempotent dan satu log';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    v_hasil := public.save_daily_report(v_tanggal_uji, 'catch_up');
    v_dibuat := coalesce((v_hasil ->> 'created')::boolean, false);
    v_report_id := (v_hasil ->> 'reportId')::uuid;

    -- Panggil kedua kalinya: harus mengembalikan created = false.
    v_hasil_kedua := public.save_daily_report(v_tanggal_uji, 'catch_up');
    v_dibuat_lagi := coalesce((v_hasil_kedua ->> 'created')::boolean, true);

    -- Hanya boleh ada satu baris laporan untuk tanggal itu.
    select count(*) into v_jumlah
    from public.daily_reports as dr
    where dr.report_date = v_tanggal_uji;

    -- Log report.saved hanya boleh tertulis satu kali untuk laporan ini.
    select count(*) into v_jumlah_log
    from public.activity_logs as al
    where al.action = 'report.saved'
      and al.entity_type = 'report'
      and al.entity_id = v_report_id
      and al.actor_role = 'system';

    v_didapat := format(
      'panggilan 1 created = %s (harap true), panggilan 2 created = %s (harap false), baris laporan = %s (harap 1), log report.saved = %s (harap 1), source di log = %s',
      v_dibuat, v_dibuat_lagi, v_jumlah, v_jumlah_log,
      coalesce((select al2.meta ->> 'source' from public.activity_logs as al2
        where al2.action = 'report.saved' and al2.entity_id = v_report_id limit 1), '(kosong)')
    );

    v_lolos := (
      v_dibuat
      and not v_dibuat_lagi
      and v_jumlah = 1
      and v_jumlah_log = 1
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'created true lalu false, 1 baris laporan, 1 log report.saved',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (f) tanggal hari ini atau masa depan ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(f) tanggal hari ini dan masa depan ditolak';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  v_bola_lolos := 0;
  begin
    -- Hari ini: laporan masih berubah terus, jadi belum boleh dikunci.
    v_pesan := '(tidak ada error)';
    v_detail := null;
    begin
      perform public.save_daily_report(public.wib_today());
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics
        v_pesan = message_text, v_detail = pg_exception_detail,
        v_konteks = pg_exception_context;
    end;
    if v_pesan like 'VALIDATION_FAILED%' then
      v_bola_lolos := v_bola_lolos + 1;
    end if;
    v_teks := v_pesan;

    -- Masa depan.
    v_pesan := '(tidak ada error)';
    begin
      perform public.save_daily_report(public.wib_today() + 5);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics
        v_pesan = message_text, v_detail = pg_exception_detail,
        v_konteks = pg_exception_context;
    end;
    if v_pesan like 'VALIDATION_FAILED%' then
      v_bola_lolos := v_bola_lolos + 1;
    end if;
    v_teks_2 := v_pesan;

    -- Tidak boleh ada baris laporan yang bocor dari dua percobaan di atas.
    select count(*) into v_jumlah
    from public.daily_reports as dr
    where dr.report_date >= public.wib_today();

    v_didapat := format(
      'pesan hari ini = %s, pesan masa depan = %s, jumlah penolakan = %s (harap 2), laporan hari ini/masa depan = %s (harap 0)',
      v_teks, v_teks_2, v_bola_lolos, v_jumlah
    );

    v_lolos := (v_bola_lolos = 2 and v_jumlah = 0);
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'kedua tanggal ditolak VALIDATION_FAILED dan tidak ada baris laporan baru',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (g) save_missing_reports mengisi hari yang hilang, lalu idempotent
  ---------------------------------------------------------------------------
  v_nama_cek := '(g) save_missing_reports menyimpan hari yang hilang';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- PENTING: tabel daily_reports tidak boleh diubah atau dihapus, ada
    -- trigger yang menolaknya. Jadi "hari yang hilang" disiapkan dengan dua
    -- tanggal baru (v_tanggal_uji_2 dan v_tanggal_uji_3) yang belum pernah
    -- disimpan oleh pemeriksaan lain, BUKAN dengan menghapus baris laporan.
    select count(*) into v_qty_2
    from public.daily_reports as dr
    where dr.report_date in (v_tanggal_uji_2, v_tanggal_uji_3);

    -- Cetakan rentang yang DIPAKAI save_missing_reports: tanggal order paling
    -- awal (menjadi batas awal), sampai kemarin (menjadi batas akhir), dan
    -- berapa tanggal di rentang itu yang belum punya laporan.
    select min(o.queue_date) into v_tanggal_awal_min
    from public.orders as o;

    select count(*) into v_banyak_tanggal
    from generate_series(
      v_tanggal_awal_min::timestamp,
      (public.wib_today() - 1)::timestamp,
      interval '1 day'
    ) as g(t)
    where not exists (
      select 1
      from public.daily_reports as dr
      where dr.report_date = g.t::date
    );

    v_tanggal_dalam_rentang := (
      v_tanggal_uji_2 >= v_tanggal_awal_min
      and v_tanggal_uji_2 <= public.wib_today() - 1
      and v_tanggal_uji_3 >= v_tanggal_awal_min
      and v_tanggal_uji_3 <= public.wib_today() - 1
    );

    v_hasil := public.save_missing_reports(v_admin);
    v_jumlah := (v_hasil ->> 'savedCount')::integer;

    -- Laporan untuk kedua tanggal baru harus tersimpan.
    select count(*) into v_jumlah_order
    from public.daily_reports as dr
    where dr.report_date in (v_tanggal_uji_2, v_tanggal_uji_3);

    -- Panggil kedua kalinya: tidak ada lagi yang hilang, jadi 0.
    v_hasil_kedua := public.save_missing_reports(v_admin);
    v_qty_1 := coalesce((v_hasil_kedua ->> 'savedCount')::integer, -1);

    v_didapat := format(
      'MIN(queue_date) yang dilihat fungsi = %s, rentang %s s.d. %s, tanggal dalam rentang yang belum punya laporan = %s, kedua tanggal tes (%s dan %s) ada di rentang = %s || laporan kedua tanggal baru sebelum dipanggil = %s (harap 0), panggilan 1 savedCount = %s (minimal 2), laporan untuk kedua tanggal = %s (harap 2), panggilan 2 savedCount = %s (harap 0)',
      coalesce(v_tanggal_awal_min::text, '(kosong)'),
      coalesce(v_tanggal_awal_min::text, '(kosong)'),
      (public.wib_today() - 1)::text,
      v_banyak_tanggal,
      v_tanggal_uji_2::text, v_tanggal_uji_3::text,
      v_tanggal_dalam_rentang,
      v_qty_2, v_jumlah, v_jumlah_order, v_qty_1
    );

    v_lolos := (
      v_qty_2 = 0
      and v_jumlah >= 2
      and v_jumlah_order = 2
      and v_qty_1 = 0
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'hari yang hilang (399 dan 398 hari lalu) tersimpan, panggilan kedua 0',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (h) list_reports, get_report, dan get_today_report
  ---------------------------------------------------------------------------
  v_nama_cek := '(h) list_reports, get_report, dan get_today_report benar';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Daftar Riwayat memuat tanggal uji dan diurutkan terbaru dulu.
    v_hasil := public.list_reports(v_admin);
    select count(*) into v_jumlah
    from jsonb_array_elements(v_hasil -> 'reports') as x
    where x ->> 'date' = v_tanggal_uji::text;

    v_teks := v_hasil -> 'reports' -> 0 ->> 'date';

    -- Isi satu laporan tersimpan harus sama dengan yang dibangun.
    select r.id into v_report_id
    from public.daily_reports as r
    where r.report_date = v_tanggal_uji;

    v_laporan := public.get_report(v_admin, v_report_id::text);
    v_qty_1 := (v_laporan -> 'data' -> 'totals' ->> 'orderCount')::integer;
    v_qty_2 := (v_laporan -> 'data' -> 'totals' ->> 'cancelledCount')::integer;
    v_nilai_1 := (v_laporan -> 'data' -> 'totals' ->> 'sales')::numeric;

    -- Laporan hari ini harus ditandai live = true dan tanggalnya hari ini.
    v_hasil_kedua := public.get_today_report(v_admin);
    v_bola := coalesce((v_hasil_kedua ->> 'live')::boolean, false);

    -- Id yang bukan uuid harus ditolak dengan pesan yang sama.
    v_pesan := '(tidak ada error)';
    v_detail := null;
    begin
      perform public.get_report(v_admin, 'bukan-uuid');
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics
        v_pesan = message_text, v_detail = pg_exception_detail,
        v_konteks = pg_exception_context;
    end;
    v_teks_2 := v_pesan;

    v_didapat := format(
      'laporan tanggal uji di daftar = %s (harap 1), tanggal paling atas = %s, isi laporan: orderCount %s cancelledCount %s sales %s, live hari ini = %s, id tidak valid = %s',
      v_jumlah, v_teks, v_qty_1, v_qty_2, v_nilai_1, v_bola, v_teks_2
    );

    v_lolos := (
      v_jumlah = 1
      and v_qty_1 = 2
      and v_qty_2 = 2
      and v_nilai_1 = 80000
      and v_bola
      and v_pesan like 'VALIDATION_FAILED%'
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'tanggal uji ada di daftar, isi laporan sama, live = true, id tidak valid ditolak',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (i) cancel_order ditolak kalau laporan harinya sudah tersimpan
  ---------------------------------------------------------------------------
  v_nama_cek := '(i) pembatalan order dari hari yang sudah ada laporannya ditolak';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Pastikan laporan tanggal uji benar-benar ada.
    perform public.save_daily_report(v_tanggal_uji, 'catch_up');

    v_pesan := '(tidak ada error)';
    v_detail := null;
    v_konteks := null;
    begin
      perform public.cancel_order(
        p_order_id => v_order_d::text,
        p_actor_id => v_aktor,
        p_reason => 'stok_habis'::public.order_cancel_reason
      );
      v_pesan := 'tidak ditolak (pembatalan berhasil jalan)';
    exception when others then
      get stacked diagnostics
        v_pesan = message_text, v_detail = pg_exception_detail,
        v_konteks = pg_exception_context;
    end;

    -- Status order harus tetap menunggu_konfirmasi, tidak boleh berubah.
    select o.status::text into v_teks
    from public.orders as o where o.id = v_order_d;

    v_didapat := format(
      'pesan = %s | detail = %s | konteks = %s | status order = %s (harap menunggu_konfirmasi)',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'), v_teks
    );

    v_lolos := (
      v_pesan like 'VALIDATION_FAILED%'
      and lower(coalesce(v_detail, '')) like '%laporan hari itu sudah tersimpan%'
      and v_teks = 'menunggu_konfirmasi'
    );
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'VALIDATION_FAILED dengan detail laporan hari itu sudah tersimpan, status tidak berubah',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (j) hanya Cashier dan Admin yang boleh memakai fungsi laporan
  ---------------------------------------------------------------------------
  v_nama_cek := '(j) hanya Cashier dan Admin yang boleh memakai fungsi laporan';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  v_bola_lolos := 0;
  begin
    -- Barista dan tanpa akun harus ditolak FORBIDDEN oleh keempat fungsi.
    v_pesan := '(tidak ada error)';
    begin
      perform public.save_missing_reports(v_barista);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;
    v_teks := v_pesan;

    v_pesan := '(tidak ada error)';
    begin
      perform public.save_missing_reports(null);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.get_today_report(v_barista);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.get_today_report(null);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.list_reports(v_barista);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.list_reports(null);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.get_report(v_barista, v_report_id::text);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    v_pesan := '(tidak ada error)';
    begin
      perform public.get_report(null, v_report_id::text);
      v_pesan := 'tidak ditolak';
    exception when others then
      get stacked diagnostics v_pesan = message_text;
    end;
    if v_pesan like '%FORBIDDEN%' then v_bola_lolos := v_bola_lolos + 1; end if;

    -- Admin selalu boleh (sudah dipakai di pemeriksaan lain). Cashier hanya
    -- diuji kalau akunnya ada.
    if v_cashier is not null then
      perform public.list_reports(v_cashier);
      perform public.get_today_report(v_cashier);
      perform public.get_report(v_cashier, v_report_id::text);
      v_bola_lolos := v_bola_lolos + 1;
    end if;

    v_didapat := format(
      'percobaan yang benar = %s dari 9 (8 penolakan FORBIDDEN + 1 percobaan Cashier), pesan penolakan pertama = %s, cashier diuji = %s',
      v_bola_lolos, v_teks, (v_cashier is not null)
    );

    -- Kalau ada akun Cashier, jumlah yang benar adalah 9: delapan penolakan
    -- yang wajib benar ditambah satu kali pemanggilan yang wajib berhasil.
    v_lolos := (v_bola_lolos = 9);
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  if v_cashier is null then
    -- Tidak ada akun Cashier aktif, jadi bagian Cashier tidak bisa dibuktikan.
    -- Penolakan Barista dan tanpa akun tetap wajib benar.
    v_daftar_hasil := v_daftar_hasil || format(
      '[%s] DILEWATI | alasan: tidak ada akun cashier AKTIF di public.profiles (penolakan tetap diuji: %s)',
      v_nama_cek, v_didapat
    );
    v_total := v_total + 1;
    v_jumlah_lewati := v_jumlah_lewati + 1;
  else
    v_total := v_total + 1;
    if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
    v_daftar_hasil := v_daftar_hasil ||
      format('[%s] %s | diharapkan: %s | didapat: %s',
        v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
        '9 dari 9 percobaan benar: barista dan tanpa akun FORBIDDEN, Cashier boleh',
        v_didapat);
  end if;

  ---------------------------------------------------------------------------
  -- (k) hanya ada satu versi cancel_order
  ---------------------------------------------------------------------------
  v_nama_cek := '(k) cancel_order hanya punya satu versi';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Menambah parameter baru membuat fungsi BARU (overload), bukan mengganti
    -- yang lama. Kalau versi lama tidak dibuang, cancel_order punya DUA versi.
    select count(*) into v_jumlah
    from pg_proc as f
    join pg_namespace as n on n.oid = f.pronamespace
    where n.nspname = 'public'
      and f.proname = 'cancel_order';

    v_didapat := format('jumlah versi cancel_order = %s (harap 1)', v_jumlah);

    v_lolos := (v_jumlah = 1);
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'tepat 1 versi cancel_order', v_didapat);

  ---------------------------------------------------------------------------
  -- (l) jadwal pg_cron terpasang
  ---------------------------------------------------------------------------
  v_nama_cek := '(l) jadwal harian pg_cron ada';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      v_pg_cron_ada := true;

      select count(*) into v_jumlah
      from cron.job
      where jobname = 'save_daily_report_nightly'
        and schedule = '5 17 * * *';

      v_didapat := format(
        'jadwal save_daily_report_nightly = %s (harap 1)', v_jumlah
      );

      v_lolos := (v_jumlah = 1);
    else
      v_pg_cron_ada := false;
      v_didapat := 'pg_cron belum terpasang, jadi jadwal belum bisa dicek';
    end if;
  exception when others then
    get stacked diagnostics
      v_pesan = message_text, v_detail = pg_exception_detail,
      v_konteks = pg_exception_context;
    v_pg_cron_ada := true;
    v_didapat := format('ERROR TIDAK TERDUGA: %s | detail = %s | konteks = %s',
      v_pesan, coalesce(v_detail, '(kosong)'), coalesce(v_konteks, '(kosong)'));
  end;

  if v_pg_cron_ada = false then
    -- Ekstensi belum ada: jadwal memang sengaja tidak dibuat, jadi ini bukan
    -- kegagalan.
    v_daftar_hasil := v_daftar_hasil || format(
      '[%s] DILEWATI | alasan: ekstensi pg_cron belum terpasang di project ini',
      v_nama_cek
    );
    v_total := v_total + 1;
    v_jumlah_lewati := v_jumlah_lewati + 1;
  else
    v_total := v_total + 1;
    if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
    v_daftar_hasil := v_daftar_hasil ||
      format('[%s] %s | diharapkan: %s | didapat: %s',
        v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
        'ada 1 jadwal save_daily_report_nightly', v_didapat);
  end if;

  ---------------------------------------------------------------------------
  -- RINGKASAN
  ---------------------------------------------------------------------------
  raise exception '%',
    'RINGKASAN TES (semua perubahan dibatalkan):' || E'\n' ||
    array_to_string(v_daftar_hasil, E'\n') || E'\n' ||
    format('TOTAL: %s pemeriksaan | LOLOS: %s | GAGAL: %s | DILEWATI: %s',
      v_total, v_jumlah_lolos, v_jumlah_gagal, v_jumlah_lewati);
end;
$$;