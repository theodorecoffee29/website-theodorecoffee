-- =============================================================================
-- PERINGATAN BESAR: FILE INI HANYA UNTUK PENGEMBANGAN (development).
-- =============================================================================
--
-- File ini BUKAN migrasi. File ini tidak pernah dijalankan oleh
-- `supabase db push` dan tidak boleh ikut ke database production.
-- Isinya hanya SATU blok DO yang menjalankan seluruh pemeriksaan alasan
-- pembatalan dan get_stock_overview sekaligus, untuk dijalankan sendiri di
-- Supabase Dashboard > SQL Editor.
--
-- CARA MEMAKAI:
--   1. Buka Supabase Dashboard > SQL Editor (project DEVELOPMENT).
--   2. Pastikan migrasi 20261010073525_cancel_reason_stock_overview.sql sudah
--      dijalankan.
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
--
-- CATATAN KENAPA BAHAN DIUBAH LANGSUNG DI PEMERIKSAAN (g):
--   Pemeriksaan (g) butuh bahan dengan stok MINUS, karena get_stock_overview
--   harus mengubahnya jadi 0 porsi. Tidak ada fungsi admin yang bisa membuat
--   stok minus: adjust_stock mewajibkan newQty 0 atau lebih. Jadi stok bahan
--   diubah dengan satu UPDATE langsung. Ini aman karena seluruh blok dibatalkan
--   di akhir, dan blok ini hanya untuk development.
--
-- CARA MENGAMBIL AKUN:
--   Admin, Cashier, dan Barista diambil dari public.profiles. Pemeriksaan yang
--   butuh akun yang tidak ada ditandai DILEWATI (bukan dianggap gagal).
--   Untuk pembatalan oleh staf dipakai Cashier kalau ada, kalau tidak dipakai
--   Admin (Admin juga boleh membatalkan order, docs/pemissions.md).

do $$
declare
  -- Akhiran unik supaya nama tes tidak pernah bentrok.
  v_sufiks         text;
  v_nama_bahan_a   text;
  v_nama_bahan_b   text;
  v_nama_menu_1    text;
  v_nama_menu_2    text;
  v_nama_menu_3    text;
  v_nama_menu_4    text;

  -- Id akun yang dipakai (diambil dari public.profiles).
  v_admin          uuid;
  v_cashier        uuid;
  v_barista        uuid;
  -- Actor staf yang benar-benar dipakai untuk pembatalan.
  v_aktor          uuid;

  -- Id objek yang dibuat selama tes.
  v_bahan_a        uuid;
  v_bahan_b        uuid;
  v_menu_1         uuid;
  v_menu_2         uuid;
  v_menu_3         uuid;
  v_menu_4         uuid;

  -- Id order yang dipakai tiap pemeriksaan.
  v_order_a        uuid;
  v_order_b        uuid;
  v_order_c        uuid;
  v_order_d        uuid;
  v_order_e        uuid;

  -- Nilai yang dibandingkan antar pemeriksaan.
  v_stok_awal      numeric;
  v_stok_sekarang  numeric;
  v_jumlah         integer;
  v_porsi_1        integer;
  v_porsi_2        integer;
  v_jumlah_nonaktif integer;
  v_hasil          jsonb;
  v_cek            jsonb;
  v_teks_hasil     text;
  v_stok_teks      text;

  -- Penampung hasil satu pemeriksaan.
  v_nama_cek       text;
  v_didapat        text;
  v_lolos          boolean;

  -- Daftar hasil seluruh pemeriksaan, dan penghitungnya.
  v_daftar_hasil   text[] := array[]::text[];
  v_total          integer := 0;
  v_jumlah_lolos   integer := 0;
  v_jumlah_gagal   integer := 0;
  v_jumlah_lewati  integer := 0;
begin
  ---------------------------------------------------------------------------
  -- PERSIAPAN
  ---------------------------------------------------------------------------

  v_sufiks := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_nama_bahan_a := 'Tes Bahan Porsi ' || v_sufiks;
  v_nama_bahan_b := 'Tes Bahan Minus ' || v_sufiks;
  v_nama_menu_1 := 'Tes Menu Porsi ' || v_sufiks;
  v_nama_menu_2 := 'Tes Menu Minus ' || v_sufiks;
  v_nama_menu_3 := 'Tes Menu Tanpa Resep ' || v_sufiks;
  v_nama_menu_4 := 'Tes Menu Nonaktif ' || v_sufiks;

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

  -- Cashier kalau ada, kalau tidak Admin (Admin juga boleh membatalkan order).
  v_aktor := coalesce(v_cashier, v_admin);

  -- Catatan urutan parameter create_ingredient: nama, unit, actor, meta, stokAwal.
  -- Bahan A 5000 gram. Dengan takaran 18 gram, sisa porsinya 277
  -- (5000 / 18 = 277,7, dibulatkan ke bawah).
  select public.create_ingredient(v_nama_bahan_a, 'g', v_admin, '{}'::jsonb, 5000)
  into v_hasil;
  v_bahan_a := (v_hasil ->> 'ingredientId')::uuid;

  -- Bahan B 100 gram, nanti dibuat minus di pemeriksaan (g).
  select public.create_ingredient(v_nama_bahan_b, 'g', v_admin, '{}'::jsonb, 100)
  into v_hasil;
  v_bahan_b := (v_hasil ->> 'ingredientId')::uuid;

  -- Menu 1: 18 gram dari bahan A per porsi (untuk 277 porsi).
  select public.create_menu_item(v_nama_menu_1, 20000, v_admin) into v_hasil;
  v_menu_1 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_1::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_a, 'qtyPerPortion', 18)
    ),
    v_admin
  );

  -- Menu 2: 18 gram dari bahan B per porsi (untuk 0 porsi saat bahan minus).
  select public.create_menu_item(v_nama_menu_2, 21000, v_admin) into v_hasil;
  v_menu_2 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_recipe(
    v_menu_2::text,
    jsonb_build_array(
      jsonb_build_object('ingredientId', v_bahan_b, 'qtyPerPortion', 18)
    ),
    v_admin
  );

  -- Menu 3 tanpa resep: sisa porsinya harus null (menu selalu tersedia).
  select public.create_menu_item(v_nama_menu_3, 22000, v_admin) into v_hasil;
  v_menu_3 := (v_hasil ->> 'menuItemId')::uuid;

  -- Menu 4 tidak aktif: tidak boleh muncul di get_stock_overview.
  select public.create_menu_item(v_nama_menu_4, 23000, v_admin) into v_hasil;
  v_menu_4 := (v_hasil ->> 'menuItemId')::uuid;

  perform public.set_menu_active(v_menu_4::text, false, v_admin);

  ---------------------------------------------------------------------------
  -- (a) cancel_order oleh staf tanpa reason ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(a) pembatalan staf tanpa reason ditolak VALIDATION_FAILED';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select public.create_order(
      'Tes Customer A ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_a := (v_hasil ->> 'order_id')::uuid;

    -- Catatan urutan parameter cancel_order yang baru:
    -- orderId, actorId, reason, note, meta. reason dikosongkan.
    begin
      perform public.cancel_order(v_order_a::text, v_aktor, null, null, '{}'::jsonb);
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    -- Status order harus tetap menunggu_konfirmasi karena dibatalkan.
    select o.status into v_teks_hasil
    from public.orders as o where o.id = v_order_a;

    -- Pesan error harus menyebut "reason" supaya Cashier tahu apa yang kurang.
    v_didapat := format('pesan = %s | status order = %s', v_didapat, v_teks_hasil);

    v_lolos := (
      v_didapat like 'VALIDATION_FAILED%'
      and lower(v_didapat) like '%reason%'
      and v_teks_hasil = 'menunggu_konfirmasi'
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'VALIDATION_FAILED yang menyebut reason, status tetap menunggu_konfirmasi',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (b) Alasan "lainnya" tanpa catatan ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(b) alasan lainnya tanpa catatan ditolak';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select public.create_order(
      'Tes Customer B ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_b := (v_hasil ->> 'order_id')::uuid;

    -- reason = lainnya tapi note kosong (dan juga coba note yang cuma spasi).
    begin
      perform public.cancel_order(
        v_order_b::text, v_aktor, 'lainnya'::public.order_cancel_reason, '   ', '{}'::jsonb
      );
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    select o.status into v_teks_hasil
    from public.orders as o where o.id = v_order_b;

    v_didapat := format('pesan = %s | status order = %s', v_didapat, v_teks_hasil);

    v_lolos := (
      v_didapat like 'VALIDATION_FAILED%'
      and v_teks_hasil = 'menunggu_konfirmasi'
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'VALIDATION_FAILED untuk reason lainnya tanpa note, status tetap menunggu_konfirmasi',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (c) Alasan stok_habis berhasil dan tersimpan di orders.cancel_reason
  ---------------------------------------------------------------------------
  v_nama_cek := '(c) pembatalan dengan alasan stok_habis berhasil';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Pakai order dari (b): pembatalan sebelumnya ditolak, jadi order ini masih
    -- menunggu_konfirmasi.
    perform public.cancel_order(
      v_order_b::text, v_aktor, 'stok_habis'::public.order_cancel_reason, null, '{}'::jsonb
    );

    select o.status, o.cancel_reason, o.cancel_note
    into v_teks_hasil, v_hasil, v_cek
    from public.orders as o where o.id = v_order_b;

    v_didapat := format(
      'status = %s, cancel_reason = %s, cancel_note kosong = %s',
      v_teks_hasil, v_hasil, (v_cek is null)
    );

    -- cancel_reason harus persis stok_habis, dan cancel_note tetap kosong
    -- karena alasan ini tidak wajib berketerangan.
    v_lolos := (
      v_teks_hasil = 'dibatalkan'
      and v_hasil::text = 'stok_habis'
      and v_cek is null
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'status dibatalkan, cancel_reason = stok_habis, cancel_note kosong',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (d) Pembatalan oleh customer selalu diminta_customer
  ---------------------------------------------------------------------------
  v_nama_cek := '(d) pembatalan customer diisi diminta_customer otomatis';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select public.create_order(
      'Tes Customer D ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_c := (v_hasil ->> 'order_id')::uuid;

    -- Sengaja mengirim reason lain dan note, untuk membuktikan keduanya
    -- DIABAIKAN oleh customer, bukan dipakai dan bukan ditolak.
    perform public.cancel_order(
      v_order_c::text,
      null,
      'salah_input'::public.order_cancel_reason,
      'Ini harus diabaikan',
      '{}'::jsonb
    );

    select o.status, o.cancel_reason, o.cancel_note
    into v_teks_hasil, v_hasil, v_cek
    from public.orders as o where o.id = v_order_c;

    v_didapat := format(
      'status = %s, cancel_reason = %s, cancel_note kosong = %s',
      v_teks_hasil, v_hasil, (v_cek is null)
    );

    -- Alasan harus diminta_customer, bukan yang dikirim, dan note harus kosong.
    v_lolos := (
      v_teks_hasil = 'dibatalkan'
      and v_hasil::text = 'diminta_customer'
      and v_cek is null
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'cancel_reason = diminta_customer dan cancel_note kosong, walau reason lain dikirim',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (e) get_order_status memuat cancelReason hanya untuk order dibatalkan
  ---------------------------------------------------------------------------
  v_nama_cek := '(e) get_order_status memuat cancelReason hanya untuk order dibatalkan';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Order belum dibatalkan, untuk memastikan kuncinya tidak ikut muncul.
    select public.create_order(
      'Tes Customer E ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil;
    v_order_d := (v_hasil ->> 'order_id')::uuid;

    -- Order dari (d): dibatalkan oleh customer dengan note kosong.
    v_cek := public.get_order_status(v_order_c::text);

    -- Order dari (c): dibatalkan dengan alasan stok_habis.
    v_hasil := public.get_order_status(v_order_b::text);

    -- Order yang belum dibatalkan.
    v_teks_hasil := public.get_order_status(v_order_d::text)::text;

    v_didapat := format(
      'order dibatalkan: cancelReason = %s, punya kunci cancelNote = %s | order aktif punya kunci cancelReason = %s',
      v_cek ->> 'cancelReason',
      (v_cek ? 'cancelNote'),
      (v_teks_hasil like '%cancelReason%')
    );

    -- Untuk order dibatalkan kedua kunci harus ada, untuk order lain tidak.
    v_lolos := (
      v_cek ->> 'cancelReason' = 'diminta_customer'
      and (v_cek ? 'cancelNote')
      and v_hasil ->> 'cancelReason' = 'stok_habis'
      and not (v_teks_hasil like '%cancelReason%')
      and not (v_teks_hasil like '%cancelNote%')
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'order dibatalkan punya cancelReason dan cancelNote, order lain tidak punya keduanya',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (f) Pembatalan order antrean: stok kembali dan pembayaran dibatalkan
  ---------------------------------------------------------------------------
  v_nama_cek := '(f) pembatalan order antrean mengembalikan stok dan membatalkan pembayaran';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Order manual: langsung berstatus antrean, sudah membayar dan sudah
    -- mengurangi stok. Dipanggil dengan 7 parameter (tanpa allowNegativeStock)
    -- supaya tidak bergantung pada parameter tambahan dari migrasi lain.
    --
    -- Catatan urutan parameter create_manual_order:
    -- nama, items, metode, occurredAt, idempotencyKey, actor, meta.
    select public.create_manual_order(
      'Tes Customer F ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1, 'qty', 1)
      ),
      'tunai',
      null,
      gen_random_uuid(),
      v_aktor,
      '{}'::jsonb
    ) into v_hasil;
    v_order_e := (v_hasil ->> 'order_id')::uuid;

    -- Setelah konfirmasi, stok bahan A berkurang 18 gram (sisa 4982).
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_a;

    perform public.cancel_order(
      v_order_e::text, v_aktor, 'pembayaran_tidak_diterima'::public.order_cancel_reason, null, '{}'::jsonb
    );

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_a;

    -- Pembayaran harus ditandai batal (voided_at terisi), bukan dihapus.
    select count(*) into v_jumlah
    from public.payments as pay
    where pay.order_id = v_order_e
      and pay.voided_at is not null;

    v_didapat := format(
      'stok bahan A %s -> %s (harap 5000), pembayaran yang di-void = %s',
      v_stok_awal, v_stok_sekarang, v_jumlah
    );

    v_lolos := (
      v_stok_awal = 4982
      and v_stok_sekarang = 5000
      and v_jumlah = 1
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'stok kembali ke 5000 dan ada 1 pembayaran yang di-void',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (g) get_stock_overview: sisa porsi dan sisa bahan
  ---------------------------------------------------------------------------
  v_nama_cek := '(g) get_stock_overview menghitung sisa porsi dengan benar';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Bahan B dijadikan minus supaya portionsLeft-nya harus jadi 0 (bukan
    -- negatif). Lihat catatan di atas file soal kenapa lewat UPDATE langsung.
    update public.ingredients
    set stock_qty = -10
    where id = v_bahan_b;

    v_cek := public.get_stock_overview(v_admin);

    -- Menu 1: stok 5000, takaran 18 -> 277 porsi.
    select nullif(x ->> 'portionsLeft', '')::integer into v_porsi_1
    from jsonb_array_elements(v_cek -> 'menus') as x
    where x ->> 'menuItemId' = v_menu_1::text;

    -- Menu 2: bahan minus -10, takaran 18 -> floor(-10/18) = -1, harus jadi 0.
    select nullif(x ->> 'portionsLeft', '')::integer into v_porsi_2
    from jsonb_array_elements(v_cek -> 'menus') as x
    where x ->> 'menuItemId' = v_menu_2::text;

    -- Menu 3 tanpa resep: kunci portionsLeft HARUS ada, tapi nilainya null.
    -- jsonb yang bernilai null dibaca sebagai teks kosong, jadi kosong di sini
    -- berarti "portionsLeft: null" dan bukan "menunya tidak ada".
    select count(*) into v_jumlah
    from jsonb_array_elements(v_cek -> 'menus') as x
    where x ->> 'menuItemId' = v_menu_3::text
      and (x ? 'portionsLeft')
      and (x ->> 'portionsLeft') is null;

    -- Menu 4 nonaktif tidak boleh muncul sama sekali.
    select count(*) into v_jumlah_nonaktif
    from jsonb_array_elements(v_cek -> 'menus') as x
    where x ->> 'menuItemId' = v_menu_4::text;

    -- Bahan harus ikut terbawa, dan bahan minus ditandai.
    select x ->> 'stockQty' into v_stok_teks
    from jsonb_array_elements(v_cek -> 'ingredients') as x
    where x ->> 'ingredientId' = v_bahan_b::text;

    select count(*) into v_jumlah
    from jsonb_array_elements(v_cek -> 'ingredients') as x
    where x ->> 'ingredientId' = v_bahan_b::text
      and (x ->> 'isNegative')::boolean;

    v_didapat := format(
      'menu 1 (5000/18) = %s porsi, menu 2 (stok -10) = %s porsi, menu tanpa resep punya portionsLeft null = %s, menu nonaktif muncul = %s, bahan minus: stockQty = %s dan isNegative true = %s',
      v_porsi_1, v_porsi_2, v_jumlah, v_jumlah_nonaktif, v_stok_teks, v_jumlah
    );

    -- Empat hal harus benar sekaligus: hitungan porsi, bahan minus jadi 0,
    -- menu tanpa resep null, dan menu nonaktif tidak muncul.
    v_lolos := (
      v_porsi_1 = 277
      and v_porsi_2 = 0
      and v_jumlah = 1
      and v_jumlah_nonaktif = 0
      and v_stok_teks = '-10'
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'menu 1 = 277 porsi, menu bahan minus = 0 porsi, menu tanpa resep = null, menu nonaktif tidak muncul',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (h) Siapa saja yang boleh memanggil get_stock_overview
  ---------------------------------------------------------------------------
  v_nama_cek := '(h) hanya staf aktif yang boleh memanggil get_stock_overview';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Cashier dan Barista boleh, karena mereka butuh tahu sisa stok untuk
    -- mengerjakan pesanan.
    if v_cashier is not null then
      perform public.get_stock_overview(v_cashier);
    end if;

    if v_barista is not null then
      perform public.get_stock_overview(v_barista);
    end if;

    -- Tanpa akun (null) harus ditolak FORBIDDEN, karena require_staff membaca
    -- peran dari tabel profiles dan tidak menemukan apa pun.
    begin
      perform public.get_stock_overview(null);
      v_didapat := 'panggilan tanpa akun tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    v_didapat := format(
      'cashier diuji: %s, barista diuji: %s, panggilan tanpa akun: %s',
      (v_cashier is not null), (v_barista is not null), v_didapat
    );

    -- Kalau tidak ada Cashier maupun Barista sama sekali, pemeriksaan ini tidak
    -- bisa dibuktikan dan ditandai DILEWATI (bukan dianggap gagal).
    if v_cashier is null and v_barista is null then
      v_daftar_hasil := v_daftar_hasil || format(
        '[%s] DILEWATI | alasan: tidak ada akun cashier atau barista AKTIF di public.profiles (tapi penolakan tanpa akun tetap diuji: %s)',
        v_nama_cek, v_didapat
      );
      v_total := v_total + 1;
      v_jumlah_lewati := v_jumlah_lewati + 1;
    else
      -- Penolakan tanpa akun tetap wajib benar, apa pun keadaan akunnya.
      v_lolos := (v_didapat like '%FORBIDDEN%');
      v_total := v_total + 1;
      if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
      v_daftar_hasil := v_daftar_hasil ||
        format('[%s] %s | diharapkan: %s | didapat: %s',
          v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
          'cashier dan barista berhasil, panggilan tanpa akun FORBIDDEN',
          v_didapat);
    end if;
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
    v_total := v_total + 1;
    v_jumlah_gagal := v_jumlah_gagal + 1;
    v_daftar_hasil := v_daftar_hasil ||
      format('[%s] %s | diharapkan: %s | didapat: %s',
        v_nama_cek, 'GAGAL',
        'cashier dan barista berhasil, panggilan tanpa akun FORBIDDEN',
        v_didapat);
  end;

  ---------------------------------------------------------------------------
  -- (i) Tidak ada dua versi cancel_order, dan hasil bebas harga/pembayaran
  ---------------------------------------------------------------------------
  v_nama_cek := '(i) cancel_order hanya satu versi dan hasil overview bebas harga';
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

    -- Layar Barista tidak boleh melihat harga (aturan 8 di AGENTS.md), jadi
    -- hasil overview tidak boleh memuat price maupun amount sama sekali.
    v_cek := public.get_stock_overview(v_admin);
    v_teks_hasil := v_cek::text;

    v_didapat := format(
      'jumlah versi cancel_order = %s, hasil overview memuat "price" = %s, memuat "amount" = %s',
      v_jumlah,
      (v_teks_hasil like '%price%'),
      (v_teks_hasil like '%amount%')
    );

    v_lolos := (
      v_jumlah = 1
      and not (v_teks_hasil like '%price%')
      and not (v_teks_hasil like '%amount%')
    );
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'tepat 1 versi cancel_order dan tidak ada kunci price maupun amount',
      v_didapat);

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