-- =============================================================================
-- PERINGATAN BESAR: FILE INI HANYA UNTUK PENGEMBANGAN (development).
-- =============================================================================
--
-- File ini BUKAN migrasi. File ini tidak pernah dijalankan oleh
-- `supabase db push` dan tidak boleh ikut ke database production.
-- Isinya hanya SATU blok DO yang menjalankan seluruh pemeriksaan fitur "stok
-- tidak cukup" sekaligus, untuk dijalankan sendiri di Supabase Dashboard >
-- SQL Editor.
--
-- CARA MEMAKAI:
--   1. Buka Supabase Dashboard > SQL Editor (project DEVELOPMENT).
--   2. Pastikan migrasi 20261010040045_stock_check.sql sudah dijalankan.
--   3. Blokir seluruh isi file ini, lalu tekan Run. JANGAN menjalankan
--      per baris: seluruh pemeriksaan harus jalan dalam satu blok.
--   4. Hasilnya muncul sebagai ERROR yang memuat ringkasan semua pemeriksaan.
--      Itu normal, bukan kegagalan.
--
-- KENAPA HASILNYA ERROR:
--   Blok ini sengaja raise exception di akhir dengan teks ringkasan. Exception
--   itu membuat PostgreSQL MEMBATALKAN seluruh perubahan di dalam blok
--   (rollback). Jadi tidak ada sisa data tes di database: tidak ada menu
--   "Tes", tidak ada bahan "Tes", tidak ada order, dan tidak ada log aktivitas.
--   Ini penting karena menu dan bahan tidak boleh dihapus lewat aplikasi
--   (order lama masih merujuknya), jadi delete tidak bisa jadi cara pembersihan.
--
-- NAMA SELURUH DATA TES:
--   Semua menu dan bahan yang dibuat di sini memakai awalan "Tes " dan akhiran
--   unik dari gen_random_uuid(). Jadi tidak mungkin bentrok dengan data asli
--   maupun dengan hasil run sebelumnya.
--
-- CATATAN PENTING SOAL STOK YANG HABIS:
--   create_order dan create_manual_order menolak menu yang sudah "Habis"
--   (MENU_UNAVAILABLE) kalau bahannya kurang untuk SATU PORSI. Jadi tes di
--   bawah TIDAK boleh memakai bahan yang lebih kecil dari satu porsi. Yang
--   diuji adalah bahan yang cukup untuk satu porsi tapi TIDAK cukup untuk
--   jumlah pesanan. Contoh: bahan 30 gram, menu pakai 10 gram per porsi, order
--   5 porsi (butuh 50 gram). Menu boleh dipesan, order-nya tidak bisa
--   diselesaikan.
--
-- SETIAP BAHAN PUNYA STOK AWALNYA SENDIRI:
--   Pemeriksaan (c) dan (e) sengaja membuat stok bahan jadi MINUS. Kalau
--   pemeriksaan berikutnya memakai bahan yang sama, create_order akan gagal
--   lebih dulu dengan MENU_UNAVAILABLE (karena bahan satu porinya juga tidak
--   terpenuhi), sehingga yang diuji jadi salah. Jadi tiap pemeriksaan memakai
--   bahan sendiri supaya angkanya mudah dibaca dan tidak saling mengganggu.
--
-- CARA MENGAMBIL AKUN:
--   Admin dan Cashier diambil dari public.profiles. Untuk konfirmasi dipakai
--   Cashier kalau ada; kalau tidak ada akun Cashier aktif, dipakai Admin
--   (Admin boleh mengonfirmasi order sebagai cadangan, docs/Order-flow.md
--   bagian 7 ayat 3). Jadi pemeriksaan tidak pernah dilewatkan karena tidak
--   ada Cashier.

do $$
declare
  -- Akhiran unik supaya nama tes tidak pernah bentrok.
  v_sufiks         text;
  v_nama_bahan_a   text;
  v_nama_bahan_b   text;
  v_nama_bahan_c   text;
  v_nama_bahan_d   text;
  v_nama_menu_1    text;
  v_nama_menu_2    text;
  v_nama_menu_3    text;
  v_nama_menu_4    text;
  v_nama_menu_kosong text;

  -- Id akun yang dipakai (diambil dari public.profiles).
  v_admin          uuid;
  v_cashier        uuid;
  -- Actor yang benar-benar dipakai untuk konfirmasi.
  v_aktor          uuid;

  -- Id objek yang dibuat selama tes.
  v_bahan_a        uuid;
  v_bahan_b        uuid;
  v_bahan_c        uuid;
  v_bahan_d        uuid;
  v_menu_1         uuid;
  v_menu_2         uuid;
  v_menu_3         uuid;
  v_menu_4         uuid;
  v_menu_kosong    uuid;

  -- Id order yang dipakai tiap pemeriksaan.
  v_order_a        uuid;
  v_order_b        uuid;
  v_order_d_1      uuid;
  v_order_d_2      uuid;
  v_order_f_kurang uuid;
  v_order_f_kosong uuid;

  -- Nilai yang dibandingkan antar pemeriksaan.
  v_stok_awal      numeric;
  v_stok_sekarang  numeric;
  v_status_ordinal public.order_status;
  v_jumlah_bayar   integer;
  v_jumlah_log     integer;
  v_jumlah_entri   integer;
  v_jumlah_kurang  integer;
  v_jumlah_order_lama integer;
  v_hasil          jsonb;
  v_cek            jsonb;
  v_semua          jsonb;

  -- Penampung hasil satu pemeriksaan.
  v_nama_cek       text;
  v_didapat        text;
  v_lolos          boolean;

  -- Daftar hasil seluruh pemeriksaan, dan penghitungnya.
  v_daftar_hasil   text[] := array[]::text[];
  v_total          integer := 0;
  v_jumlah_lolos   integer := 0;
  v_jumlah_gagal   integer := 0;
begin
  ---------------------------------------------------------------------------
  -- PERSIAPAN
  ---------------------------------------------------------------------------

  v_sufiks := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_nama_bahan_a := 'Tes Bahan A ' || v_sufiks;
  v_nama_bahan_b := 'Tes Bahan B ' || v_sufiks;
  v_nama_bahan_c := 'Tes Bahan C ' || v_sufiks;
  v_nama_bahan_d := 'Tes Bahan D ' || v_sufiks;
  v_nama_menu_1 := 'Tes Menu Porsi ' || v_sufiks;
  v_nama_menu_2 := 'Tes Menu Balapan ' || v_sufiks;
  v_nama_menu_3 := 'Tes Menu Manual ' || v_sufiks;
  v_nama_menu_4 := 'Tes Menu Periksa ' || v_sufiks;
  v_nama_menu_kosong := 'Tes Menu Tanpa Resep ' || v_sufiks;

  -- Admin aktif. Tanpa ini, tidak ada yang boleh dipanggil sama sekali.
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

  -- Cashier aktif. Kalau tidak ada, konfirmasi dilakukan oleh Admin (Admin
  -- boleh mengonfirmasi sebagai cadangan, docs/Order-flow.md bagian 7 ayat 3).
  select p.id into v_cashier
  from public.profiles as p
  where p.role = 'cashier'
    and p.is_active
  order by p.created_at
  limit 1;

  v_aktor := coalesce(v_cashier, v_admin);

  -- Catatan urutan parameter create_ingredient: nama, unit, actor, meta, stokAwal.
  -- Bahan A 1000 gram untuk (a) (b) (c).
  select public.create_ingredient(v_nama_bahan_a, 'g', v_admin, '{}'::jsonb, 1000)
  into v_hasil;
  v_bahan_a := (v_hasil ->> 'ingredientId')::uuid;

  -- Bahan B 15 gram untuk (d): dua order berebut 10 gram terakhir.
  select public.create_ingredient(v_nama_bahan_b, 'g', v_admin, '{}'::jsonb, 15)
  into v_hasil;
  v_bahan_b := (v_hasil ->> 'ingredientId')::uuid;

  -- Bahan C 30 gram untuk (e): satu porsi 10 gram masih boleh, order 5 porsi
  -- (50 gram) tidak.
  select public.create_ingredient(v_nama_bahan_c, 'g', v_admin, '{}'::jsonb, 30)
  into v_hasil;
  v_bahan_c := (v_hasil ->> 'ingredientId')::uuid;

  -- Bahan D 30 gram untuk (f).
  select public.create_ingredient(v_nama_bahan_d, 'g', v_admin, '{}'::jsonb, 30)
  into v_hasil;
  v_bahan_d := (v_hasil ->> 'ingredientId')::uuid;

  -- Menu 1: 10 gram dari bahan A per porsi.
  select public.create_menu_item(v_nama_menu_1, 20000, v_admin) into v_hasil;
  v_menu_1 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_1::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_a, 'qtyPerPortion', 10)
    ),
    v_admin
  );

  -- Menu 2: 10 gram dari bahan B per porsi.
  select public.create_menu_item(v_nama_menu_2, 21000, v_admin) into v_hasil;
  v_menu_2 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_2::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_b, 'qtyPerPortion', 10)
    ),
    v_admin
  );

  -- Menu 3: 10 gram dari bahan C per porsi.
  select public.create_menu_item(v_nama_menu_3, 22000, v_admin) into v_hasil;
  v_menu_3 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_3::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_c, 'qtyPerPortion', 10)
    ),
    v_admin
  );

  -- Menu 4: 10 gram dari bahan D per porsi.
  select public.create_menu_item(v_nama_menu_4, 24000, v_admin) into v_hasil;
  v_menu_4 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_4::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_d, 'qtyPerPortion', 10)
    ),
    v_admin
  );

  -- Menu tanpa resep untuk (f): tidak butuh bahan apa pun, harus selalu cukup.
  select public.create_menu_item(v_nama_menu_kosong, 23000, v_admin) into v_hasil;
  v_menu_kosong := (v_hasil ->> 'menuItemId')::uuid;

  ---------------------------------------------------------------------------
  -- (a) Order dengan stok cukup berhasil dikonfirmasi
  ---------------------------------------------------------------------------
  -- confirm_order dipanggil TANPA parameter p_allow_negative_stock, jadi yang
  -- dipakai adalah nilai bawaannya (false). Order ini stoknya cukup, jadi harus
  -- tetap berhasil. Ini sekaligus memastikan nilai bawaan itu tidak memblokir
  -- order yang memang aman.
  v_nama_cek := '(a) order dengan stok cukup berhasil dikonfirmasi';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_a;

    -- 5 porsi x 10 gram = 50 gram, stok bahan A 1000 gram, jadi cukup.
    select public.create_order(
      'Tes Customer A ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 5)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_a := (v_hasil ->> 'order_id')::uuid;

    perform public.confirm_order(v_order_a::text, 'tunai', v_aktor);

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_a;

    select o.status into v_status_ordinal
    from public.orders as o where o.id = v_order_a;

    select count(*) into v_jumlah_bayar
    from public.payments as pay where pay.order_id = v_order_a;

    v_didapat := format(
      'stok bahan A %s -> %s (harap 950), status = %s, jumlah pembayaran = %s',
      v_stok_awal, v_stok_sekarang, v_status_ordinal, v_jumlah_bayar
    );

    v_lolos := (
      v_stok_awal = 1000
      and v_stok_sekarang = 950
      and v_status_ordinal = 'antrean'
      and v_jumlah_bayar = 1
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'berhasil dikonfirmasi, stok 1000 jadi 950, status antrean, 1 pembayaran',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (b) Stok kurang tanpa persetujuan ditolak dan tidak mengubah apa pun
  ---------------------------------------------------------------------------
  v_nama_cek := '(b) stok kurang tanpa persetujuan ditolak STOCK_INSUFFICIENT';
  v_didapat := '(tidak bersamaan)';
  v_lolos := false;
  begin
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_a;

    -- 500 porsi x 10 gram = 5000 gram, stok bahan A cuma 950 gram. Porinya
    -- (10 gram) masih cukup, jadi menu tidak "Habis" dan order bisa dibuat.
    select public.create_order(
      'Tes Customer B ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 500)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_b := (v_hasil ->> 'order_id')::uuid;

    -- Konfirmasi TANPA persetujuan harus ditolak.
    begin
      perform public.confirm_order(v_order_b::text, 'tunai', v_aktor, '{}'::jsonb, false);
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    -- Setelah ditolak, tidak boleh ada efek samping sama sekali.
    select o.status into v_status_ordinal
    from public.orders as o where o.id = v_order_b;

    select count(*) into v_jumlah_bayar
    from public.payments as pay where pay.order_id = v_order_b;

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_a;

    v_didapat := format(
      'pesan = %s | setelah ditolak: status = %s, jumlah pembayaran = %s, stok = %s (sebelumnya %s)',
      v_didapat, v_status_ordinal, v_jumlah_bayar, v_stok_sekarang, v_stok_awal
    );

    -- LOLOS kalau ditolak dengan STOCK_INSUFFICIENT, status order TIDAK berubah,
    -- tidak ada pembayaran, dan stok tidak bergerak.
    v_lolos := (
      v_didapat like 'STOCK_INSUFFICIENT%'
      and v_status_ordinal = 'menunggu_konfirmasi'
      and v_jumlah_bayar = 0
      and v_stok_sekarang = v_stok_awal
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'STOCK_INSUFFICIENT, status tetap menunggu_konfirmasi, tanpa pembayaran, stok tidak berubah',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (c) Dengan persetujuan stok minus, konfirmasi berhasil dan tercatat
  ---------------------------------------------------------------------------
  v_nama_cek := '(c) dengan persetujuan stok minus berhasil dan ada log stock_override';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_a;

    -- Order yang sama, kali ini dengan persetujuan stok minus.
    perform public.confirm_order(v_order_b::text, 'tunai', v_aktor, '{}'::jsonb, true);

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_a;

    -- Harus ada tepat satu log stock.negative untuk bahan ini, dan metanya
    -- harus memuat stock_override = true (tanda stok minus ini disetujui).
    select count(*) into v_jumlah_log
    from public.activity_logs as l
    where l.action = 'stock.negative'
      and l.entity_id = v_bahan_a
      and l.order_id = v_order_b
      and (l.meta ->> 'stock_override') = 'true';

    v_didapat := format(
      'stok bahan A %s -> %s (harap -4050), jumlah log stock.negative dengan stock_override = %s',
      v_stok_awal, v_stok_sekarang, v_jumlah_log
    );

    v_lolos := (
      v_stok_awal = 950
      and v_stok_sekarang = -4050
      and v_jumlah_log = 1
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'stok 950 jadi -4050 dan tepat 1 log stock.negative dengan stock_override',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (d) Dua order berebut stok terakhir: hanya satu yang berhasil
  ---------------------------------------------------------------------------
  v_nama_cek := '(d) dua order berebut stok terakhir, hanya satu berhasil';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Bahan B masih 15 gram. Dua order 1 porsi masing-masing butuh 10 gram:
    -- order pertama menyisakan 5 gram, order kedua harus ditolak.
    --
    -- Perhatikan: pemeriksaan ini berurutan dalam SATU transaksi. Ini menguji
    -- aturan penguncian baris bahan: kalau stok dicek tanpa mengunci baris
    -- bahan lebih dulu, kedua konfirmasi bisa sama-sama melihat stok 15 gram
    -- lalu keduanya mengurangi, dan stoknya jadi minus. Dengan penguncian,
    -- konfirmasi kedua membaca stok yang sudah dikurangi dan ikut ditolak.
    select public.create_order(
      'Tes Customer D1 ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_2, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_d_1 := (v_hasil ->> 'order_id')::uuid;

    select public.create_order(
      'Tes Customer D2 ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_2, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_d_2 := (v_hasil ->> 'order_id')::uuid;

    -- Konfirmasi pertama harus berhasil.
    perform public.confirm_order(v_order_d_1::text, 'tunai', v_aktor, '{}'::jsonb, false);

    -- Konfirmasi kedua harus ditolak karena stok tinggal 5 gram.
    begin
      perform public.confirm_order(v_order_d_2::text, 'tunai', v_aktor, '{}'::jsonb, false);
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_b;

    select o.status into v_status_ordinal
    from public.orders as o where o.id = v_order_d_2;

    v_didapat := format(
      'pesan konfirmasi kedua = %s | stok bahan B = %s (harap 5), status order kedua = %s',
      v_didapat, v_stok_sekarang, v_status_ordinal
    );

    v_lolos := (
      v_didapat like 'STOCK_INSUFFICIENT%'
      and v_stok_sekarang = 5
      and v_status_ordinal = 'menunggu_konfirmasi'
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'konfirmasi kedua STOCK_INSUFFICIENT, stok 15 jadi 5, order kedua tetap menunggu_konfirmasi',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (e) create_manual_order: ditolak dulu, lalu berhasil dengan persetujuan
  ---------------------------------------------------------------------------
  v_nama_cek := '(e) create_manual_order ditolak lalu berhasil dengan persetujuan';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_c;

    -- Catatan urutan parameter create_manual_order:
    -- nama, items, metode, occurredAt, idempotencyKey, actor, meta, allowNegative.
    -- occurredAt null berarti pakai waktu sekarang.
    --
    -- Tanpa persetujuan harus ditolak.
    begin
      perform public.create_manual_order(
        'Tes Customer E1 ' || v_sufiks,
        jsonb_build_array(
          jsonb_build_object('menuItemId', v_menu_3, 'qty', 5)
        ),
        'tunai',
        null,
        gen_random_uuid(),
        v_aktor,
        '{}'::jsonb,
        false
      );
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    -- Penolakan harus membatalkan seluruh transaksi, termasuk insert order.
    -- Dicatat lewat pencarian nama, jadi tidak perlu menyimpan kunci idempotensi.
    select count(*) into v_jumlah_entri
    from public.orders as o
    where o.customer_name = 'Tes Customer E1 ' || v_sufiks;

    -- Dengan persetujuan harus berhasil dan stok bahan C jadi minus.
    perform public.create_manual_order(
      'Tes Customer E2 ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_3, 'qty', 5)
      ),
      'tunai',
      null,
      gen_random_uuid(),
      v_aktor,
      '{}'::jsonb,
      true
    );

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_c;

    v_didapat := format(
      'pesan tanpa persetujuan = %s | order sisa setelah ditolak = %s | stok bahan C %s -> %s (harap -20)',
      v_didapat, v_jumlah_entri, v_stok_awal, v_stok_sekarang
    );

    v_lolos := (
      v_didapat like 'STOCK_INSUFFICIENT%'
      and v_jumlah_entri = 0
      and v_stok_awal = 30
      and v_stok_sekarang = -20
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'STOCK_INSUFFICIENT tanpa persetujuan dan tanpa sisa order, lalu berhasil dengan persetujuan dan stok jadi -20',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (f) order_stock_check dan pending_orders_stock_check konsisten
  ---------------------------------------------------------------------------
  v_nama_cek := '(f) order_stock_check dan pending_orders_stock_check konsisten';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Order 5 porsi dari bahan D: butuh 50 gram, stok 30 gram. Porinya (10 gram)
    -- masih cukup, jadi order-nya berhasil dibuat dan bisa diperiksa.
    select public.create_order(
      'Tes Customer F1 ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_4, 'qty', 5)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_f_kurang := (v_hasil ->> 'order_id')::uuid;

    -- Order dari menu tanpa resep: tidak butuh bahan, harus cukup.
    select public.create_order(
      'Tes Customer F2 ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_kosong, 'qty', 2)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_f_kosong := (v_hasil ->> 'order_id')::uuid;

    -- Pemeriksaan satu order.
    v_cek := public.order_stock_check(v_order_f_kurang);
    select count(*) into v_jumlah_kurang
    from jsonb_array_elements(v_cek -> 'shortages') as s;

    -- Pemeriksaan semua order hari ini dalam SATU panggilan.
    v_semua := public.pending_orders_stock_check();

    -- Entri untuk order yang bahannya kurang: harus ada, dan tidak cukup.
    select count(*) into v_jumlah_entri
    from jsonb_array_elements(v_semua) as x
    where x ->> 'orderId' = v_order_f_kurang::text
      and (x ->> 'sufficient')::boolean = false;

    -- Entri untuk order tanpa resep: harus ada, dan cukup.
    select count(*) into v_jumlah_bayar
    from jsonb_array_elements(v_semua) as x
    where x ->> 'orderId' = v_order_f_kosong::text
      and (x ->> 'sufficient')::boolean = true;

    -- Order yang sudah dikonfirmasi (order A dan D1) TIDAK boleh muncul lagi,
    -- karena fungsi ini hanya memeriksa order menunggu_konfirmasi.
    select count(*) into v_jumlah_order_lama
    from jsonb_array_elements(v_semua) as x
    where x ->> 'orderId' = v_order_a::text
       or x ->> 'orderId' = v_order_d_1::text;

    v_didapat := format(
      'order_stock_check: sufficient = %s, jumlah bahan kurang = %s | pending: entri order kurang = %s, entri order tanpa resep yang cukup = %s, order lama yang bocor = %s',
      v_cek ->> 'sufficient', v_jumlah_kurang,
      v_jumlah_entri, v_jumlah_bayar, v_jumlah_order_lama
    );

    v_lolos := (
      (v_cek ->> 'sufficient')::boolean = false
      and v_jumlah_kurang = 1
      and v_jumlah_entri = 1
      and v_jumlah_bayar = 1
      and v_jumlah_order_lama = 0
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'order kurang tidak cukup, order tanpa resep cukup, dan hanya order menunggu_konfirmasi yang dimuat',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (g) Tidak ada dua versi confirm_order dan create_manual_order
  ---------------------------------------------------------------------------
  v_nama_cek := '(g) tidak ada dua versi confirm_order dan create_manual_order';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Menambah parameter baru sebenarnya membuat fungsi BARU (overload), bukan
    -- mengganti yang lama. Kalau versi lama tidak dibuang, confirm_order akan
    -- punya DUA versi dengan nama sama, dan pemanggil yang jadi berubah bisa
    -- diam-diam memakai versi yang salah.
    select
      count(*) filter (where f.proname = 'confirm_order'),
      count(*) filter (where f.proname = 'create_manual_order'),
      count(*) filter (where f.proname = 'apply_order_confirmation')
    into v_jumlah_bayar, v_jumlah_log, v_jumlah_kurang
    from pg_proc as f
    join pg_namespace as n on n.oid = f.pronamespace
    where n.nspname = 'public'
      and f.proname in ('confirm_order', 'create_manual_order', 'apply_order_confirmation');

    -- Ketiganya juga tidak boleh ikut hilang bersama versi lamanya.
    select count(*) into v_jumlah_entri
    from pg_proc as f
    join pg_namespace as n on n.oid = f.pronamespace
    where n.nspname = 'public'
      and f.proname in ('confirm_order', 'create_manual_order', 'apply_order_confirmation');

    v_didapat := format(
      'jumlah versi: confirm_order = %s, create_manual_order = %s, apply_order_confirmation = %s',
      v_jumlah_bayar, v_jumlah_log, v_jumlah_kurang
    );

    -- Tiap nama harus punya tepat SATU versi.
    v_lolos := (
      v_jumlah_bayar = 1
      and v_jumlah_log = 1
      and v_jumlah_kurang = 1
      and v_jumlah_entri = 3
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'tepat 1 versi untuk tiap fungsi', v_didapat);

  ---------------------------------------------------------------------------
  -- RINGKASAN
  ---------------------------------------------------------------------------
  -- Exception ini melempar seluruh transaksi, jadi semua data tes yang dibuat
  -- di atas otomatis dibatalkan. Tidak ada sisa di database.
  raise exception '%',
    'RINGKASAN TES (semua perubahan dibatalkan):' || E'\n' ||
    array_to_string(v_daftar_hasil, E'\n') || E'\n' ||
    format('TOTAL: %s pemeriksaan | LOLOS: %s | GAGAL: %s',
      v_total, v_jumlah_lolos, v_jumlah_gagal);
end;
$$;