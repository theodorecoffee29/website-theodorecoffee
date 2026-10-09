-- =============================================================================
-- PERINGATAN BESAR: FILE INI HANYA UNTUK PENGEMBANGAN (development).
-- =============================================================================
--
-- File ini BUKAN migrasi. File ini tidak pernah dijalankan oleh
-- `supabase db push` dan tidak boleh ikut ke database production.
-- Isinya hanya SATU blok DO yang menjalankan seluruh pemeriksaan fungsi Admin
-- sekaligus, untuk dijalankan sendiri di Supabase Dashboard > SQL Editor.
--
-- CARA MEMAKAI:
--   1. Buka Supabase Dashboard > SQL Editor (project DEVELOPMENT).
--   2. Pastikan migrasi 20261008062847_admin_functions.sql sudah dijalankan.
--   3. Blokir seluruh isi file ini, lalu tekan Run. JANGAN menjalankan
--      per baris: seluruh pemeriksaan harus jalan dalam satu blok.
--   4. Hasilnya muncul sebagai ERROR yang memuat ringkasan semua pemeriksaan.
--      Itu normal, bukan kegagalan. Cara membacanya ada di bagian RINGKASAN
--      di bawah.
--
-- KENAPA HASILNYA ERROR:
--   Blok ini sengajaraise exception di akhir dengan teks ringkasan. Exception
--   itu membuat PostgreSQL MEMBATALKAN seluruh perubahan di dalam blok
--   (rollback). Jadi tidak ada sisa data tes di database: tidak ada menu "Tes",
--   tidak ada bahan "Tes", tidak ada order, dan tidak ada log aktivitas.
--   Ini penting karena menu dan bahan tidak boleh dihapus lewat aplikasi
--   (order lama masih merujuknya), jadi-delete tidak bisa jadi cara pembersihan.
--
-- KENAPA SEMUA DI DALAM SATU BLOK:
--   Supaya tidak ada data yang tersisa kalau ada pemeriksaan yang gagal di
--   tengah jalan. Kalau dipisah-pisah, data dari blok yang sudah berhasil akan
--   tertinggal dan sulit dibersihkan.
--
-- NAMA SELURUH DATA TES:
--   Semua menu dan bahan yang dibuat di sini memakai awalan "Tes " dan
--   akhiran unik dari gen_random_uuid(). Jadi tidak mungkin bentrok dengan data
--   asli maupun dengan hasil run sebelumnya.
--
-- CATATAN TENTANG HASIL PEMERIKSAAN:
--   Setiap pemeriksaan yang harus GAGAL sengaja dipanggil di dalam blok
--   "exception when others". Pemeriksaan dianggap LOLOS kalau pesan error yang
--   ditangkap persis sama dengan tipe yang diharapkan (VALIDATION_FAILED atau
--   FORBIDDEN), bukan sekadar "ada error".
-- =============================================================================

do $$
declare
  -- Akhiran unik supaya nama tes tidak pernah bentrok.
  v_sufiks        text;
  -- Nama data tes (semua berawalan "Tes ").
  v_nama_menu_1    text;
  v_nama_menu_2    text;
  v_nama_bahan     text;

  -- Id akun yang dipakai.
  v_admin          uuid;
  v_cashier        uuid;

  -- Id objek yang dibuat selama tes.
  v_menu_1_id      uuid;
  v_menu_2_id      uuid;
  v_bahan_id       uuid;
  v_order_id       uuid;

  -- Nilai yang dibandingkan antar pemeriksaan.
  v_harga_awal     integer;
  v_harga_baru     integer;
  v_snapshot_awal  integer;
  v_snapshot_akhir integer;
  v_stok_awal      numeric;
  v_stok_sekarang  numeric;
  v_qty_change     numeric;
  v_stock_after    numeric;
  v_jumlah_menu    integer;
  -- Berapa menu tes yang terlihat di get_menu saat sedang dinonaktifkan.
  -- Dipisah supaya perbandingannya memakai angka, bukan membaca teks pesan.
  v_jumlah_menu_nonaktif integer;
  v_jumlah_resep   integer;
  v_satuan_awal    public.ingredient_unit;
  v_satuan_akhir   public.ingredient_unit;

  -- Hasil pemanggilan fungsi yang perlu dipecah isinya.
  v_hasil_fungsi   jsonb;

  -- Penampung hasil satu pemeriksaan.
  v_nama_cek       text;
  v_diharapkan     text;
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

  -- Akhiran unik. 8 huruf pertama dari uuid tanpa tanda hubung.
  v_sufiks := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_nama_menu_1 := 'Tes Menu A ' || v_sufiks;
  v_nama_menu_2 := 'Tes Menu Resep ' || v_sufiks;
  v_nama_bahan := 'Tes Bahan ' || v_sufiks;

  -- Id admin aktif. Tanpa ini, tidak ada yang boleh dipanggil sama sekali.
  select p.id into v_admin
  from public.profiles as p
  where p.role = 'admin' and p.is_active
  order by p.created_at
  limit 1;

  if v_admin is null then
    -- Tidak ada admin aktif: tidak ada yang bisa dijalankan. Diberi tahu lewat
    -- exception yang sama bentuknya supaya cara membacanya tetap sama.
    raise exception '%',
      'RINGKASAN TES (semua perubahan dibatalkan):' || E'\n' ||
      'GAGAL menjalankan tes: tidak ada akun admin AKTIF di public.profiles.' || E'\n' ||
      'Buat akun admin lebih dulu, lalu jalankan ulang file ini.';
  end if;

  -- Id cashier untuk tes penolakan FORBIDDEN.
  --
  -- Dipakai AKUN CASHIER APAPUN yang aktif, bukan harus bernama tertentu.
  -- Alasannya: yang sedang diuji adalah aturan "hanya admin yang boleh", dan
  -- aturan itu berlaku untuk semua akun cashier, bukan cuma yang namanya
  -- tertentu. Jadi tidak perlu membuat akun khusus.
  --
  -- Kalau tidak ada satu pun akun cashier aktif, pemeriksaan (i) dilewatkan
  -- dan dicatat sebagai DILEWATI (bukan dianggap gagal).
  select p.id into v_cashier
  from public.profiles as p
  where p.role = 'cashier'
    and p.is_active
  order by p.created_at
  limit 1;

  ---------------------------------------------------------------------------
  -- (a) Nama kembar dengan huruf besar/kecil berbeda ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(a) nama kembar beda huruf besar/kecil ditolak';
  v_diharapkan := 'VALIDATION_FAILED';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Membuat menu pertama (langkah pendukung, harusnya berhasil).
    select public.create_menu_item(v_nama_menu_1, 22000, v_admin)
    into v_hasil_fungsi;
    v_menu_1_id := (v_hasil_fungsi ->> 'menuItemId')::uuid;
    v_harga_awal := 22000;

    -- Membuat menu dengan nama yang sama tapi huruf besar/kecil berbeda.
    -- Ini harus ditolak.
    begin
      perform public.create_menu_item(upper(v_nama_menu_1), 23000, v_admin);
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_lolos := (v_didapat = v_diharapkan);
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      v_diharapkan, v_didapat);

  ---------------------------------------------------------------------------
  -- (b) Ubah harga menu tidak mengubah order lama
  ---------------------------------------------------------------------------
  -- Menu tes ini belum punya resep, dan menu tanpa resep dianggap selalu
  -- tersedia (menu_item_available), jadi create_order akan berhasil.
  v_nama_cek := '(b) ubah harga menu tidak mengubah order lama';
  v_diharapkan := 'price_snapshot order lama tetap sama setelah harga menu diubah';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Membuat order dengan menu tes, lalu membaca harga yang tersimpan di order.
    select public.create_order(
      'Tes Customer ' || v_sufiks,
      jsonb_build_array(
        jsonb_build_object('menuItemId', v_menu_1_id, 'qty', 1)
      ),
      gen_random_uuid()
    ) into v_hasil_fungsi;

    -- PENTING: create_order mengembalikan kunci SNAKE_CASE ("order_id"), bukan
    -- camelCase. Fungsi database belum dipetakan ke camelCase (pemetaan itu
    -- dilakukan di route handler server), jadi di sini harus memakai nama
    -- persis seperti yang dikembalikan database. Kalau salah menulis
    -- 'orderId', nilai ini jadi null dan baris order_items tidak ditemukan.
    v_order_id := (v_hasil_fungsi ->> 'order_id')::uuid;

    select oi.price_snapshot into v_snapshot_awal
    from public.order_items as oi
    where oi.order_id = v_order_id;

    -- Harga menu diubah lewat fungsi Admin yang resmi.
    perform public.update_menu_item(
      v_menu_1_id::text, v_nama_menu_1, 33000, v_admin
    );

    -- Membaca ulang harga yang tersimpan di order lama.
    select oi.price_snapshot into v_snapshot_akhir
    from public.order_items as oi
    where oi.order_id = v_order_id;

    -- Membaca harga menu sekarang, untuk memastikan benar-benar berubah.
    select m.price into v_harga_baru
    from public.menu_items as m where m.id = v_menu_1_id;

    v_didapat := format(
      'harga menu %s -> %s, price_snapshot order %s -> %s',
      v_harga_awal, v_harga_baru, v_snapshot_awal, v_snapshot_akhir
    );

    -- LOLOS kalau harga menu benar-benar berubah, tapi snapshot order tetap.
    v_lolos := (v_harga_baru = 33000 and v_snapshot_akhir = v_snapshot_awal);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      v_diharapkan, v_didapat);

  ---------------------------------------------------------------------------
  -- (c) Menu nonaktif hilang dari get_menu, lalu muncul lagi saat diaktifkan
  ---------------------------------------------------------------------------
  -- get_menu() mengembalikan SATU jsonb {"items": [...]}, bukan tabel. Jadi
  -- isinya dibaca lewat jsonb_array_elements.
v_nama_cek := '(c) menu nonaktif hilang dari get_menu lalu muncul lagi';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Nonaktifkan.
    perform public.set_menu_active(v_menu_1_id::text, false, v_admin);

    select count(*) into v_jumlah_menu
    from public.get_menu() as m,
         lateral jsonb_array_elements(m -> 'items') as item
    where item ->> 'id' = v_menu_1_id::text;

    -- Dicatat terpisah, supaya tidak harus dibaca dari teks pesan.
    v_jumlah_menu_nonaktif := v_jumlah_menu;
    v_didapat := format('jumlah menu tes di get_menu setelah dinonaktifkan: %s', v_jumlah_menu_nonaktif);

    -- Aktifkan lagi.
    perform public.set_menu_active(v_menu_1_id::text, true, v_admin);

    select count(*) into v_jumlah_menu
    from public.get_menu() as m,
         lateral jsonb_array_elements(m -> 'items') as item
    where item ->> 'id' = v_menu_1_id::text;

    v_didapat := v_didapat || format(
      ', lalu setelah diaktifkan: %s', v_jumlah_menu
    );

    -- LOLOS kalau saat nonaktif tidak muncul sama sekali, dan saat aktif
    -- muncul tepat satu. Perbandingan memakai angka, bukan membaca teks.
    v_lolos := (v_jumlah_menu_nonaktif = 0 and v_jumlah_menu = 1);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      '0 saat nonaktif lalu 1 saat aktif', v_didapat);

  ---------------------------------------------------------------------------
  -- (d) Bahan dengan stok awal membuat pergerakan restock
  ---------------------------------------------------------------------------
  v_nama_cek := '(d) bahan dengan stok awal membuat pergerakan restock';
  v_diharapkan := '(tidak dipakai)';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Catatan urutan parameter create_ingredient: nama, unit, actor, meta, stokAwal.
    select public.create_ingredient(
      v_nama_bahan, 'g', v_admin, '{}'::jsonb, 5000
    ) into v_hasil_fungsi;
    v_bahan_id := (v_hasil_fungsi ->> 'ingredientId')::uuid;

    -- Stok bahan setelah dibuat harus 5000.
    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_id;

    -- Harus ada SATU pergerakan restock dengan selisih dan sisa yang benar.
    select count(*) into v_jumlah_menu
    from public.stock_movements as m
    where m.ingredient_id = v_bahan_id
      and m.type = 'restock'
      and m.qty_change = 5000
      and m.stock_after = 5000;

    v_didapat := format(
      'stok bahan = %s, jumlah pergerakan restock yang cocok = %s',
      v_stok_sekarang, v_jumlah_menu
    );

    v_lolos := (v_stok_sekarang = 5000 and v_jumlah_menu = 1);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'stok 5000 dan tepat 1 pergerakan restock (qty_change 5000, stock_after 5000)',
      v_didapat);

  ---------------------------------------------------------------------------
  -- (e) Resep dengan bahan ganda ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(e) resep dengan bahan ganda ditolak';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Menu kedua khusus untuk tes resep.
    select public.create_menu_item(v_nama_menu_2, 18000, v_admin)
    into v_hasil_fungsi;
    v_menu_2_id := (v_hasil_fungsi ->> 'menuItemId')::uuid;

    -- Resep dengan bahan yang sama disebut dua kali. Harus ditolak.
    begin
      perform public.set_recipe(
        v_menu_2_id::text,
        jsonb_build_array(
          jsonb_build_object('ingredientId', v_bahan_id, 'qtyPerPortion', 10),
          jsonb_build_object('ingredientId', v_bahan_id, 'qtyPerPortion', 20)
        ),
        v_admin
      );
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    -- Resep yang gagal tadi harus TIDAK meninggalkan baris apa pun di database.
    select count(*) into v_jumlah_resep
    from public.recipes as r where r.menu_item_id = v_menu_2_id;

    v_didapat := v_didapat || format(
      ', jumlah baris resep yang tertinggal: %s', v_jumlah_resep
    );

    v_lolos := (v_didapat like 'VALIDATION_FAILED%' and v_jumlah_resep = 0);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'VALIDATION_FAILED dan tidak ada baris resep yang tersisa', v_didapat);

  ---------------------------------------------------------------------------
  -- (f) Restock menambah stok
  ---------------------------------------------------------------------------
  v_nama_cek := '(f) restock menambah stok';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select i.stock_qty into v_stok_awal
    from public.ingredients as i where i.id = v_bahan_id;

    -- Tambah 2000 dari stok 5000, jadi harusnya jadi 7000.
    select public.restock_ingredient(
      v_bahan_id::text, 2000, 'Tes pembelian susu', v_admin
    ) into v_hasil_fungsi;

    select i.stock_qty into v_stok_sekarang
    from public.ingredients as i where i.id = v_bahan_id;

    v_didapat := format('stok %s -> %s (harap 7000)', v_stok_awal, v_stok_sekarang);
    v_lolos := (v_stok_awal = 5000 and v_stok_sekarang = 7000);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'stok bertambah dari 5000 menjadi 7000', v_didapat);

  ---------------------------------------------------------------------------
  -- (g) adjust_stock menghasilkan pergerakan adjustment berisi selisih
  ---------------------------------------------------------------------------
  v_nama_cek := '(g) adjust_stock membuat pergerakan adjustment berisi selisih';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Koreksi stok 7000 menjadi 6500, jadi selisihnya -500.
    perform public.adjust_stock(
      v_bahan_id::text, 6500, 'Tes koreksi hasil hitung fisik', v_admin
    );

    select m.qty_change, m.stock_after into v_qty_change, v_stock_after
    from public.stock_movements as m
    where m.ingredient_id = v_bahan_id and m.type = 'adjustment'
    order by m.created_at desc
    limit 1;

    v_didapat := format(
      'qty_change = %s, stock_after = %s', v_qty_change, v_stock_after
    );

    -- LOLOS kalau selisihnya -500 dan stok sesudahnya 6500.
    v_lolos := (v_qty_change = -500 and v_stock_after = 6500);
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'qty_change = -500 dan stock_after = 6500', v_didapat);

  ---------------------------------------------------------------------------
  -- (h) adjust_stock tanpa alasan ditolak
  ---------------------------------------------------------------------------
  v_nama_cek := '(h) adjust_stock tanpa alasan ditolak';
  v_diharapkan := 'VALIDATION_FAILED';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    -- Alasan hanya spasi: dianggap kosong, harus ditolak.
    begin
      perform public.adjust_stock(v_bahan_id::text, 123, '   ', v_admin);
      v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
    exception when others then
      v_didapat := sqlerrm;
    end;

    v_lolos := (v_didapat = 'VALIDATION_FAILED');
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'VALIDATION_FAILED', v_didapat);

  ---------------------------------------------------------------------------
  -- (i) Panggilan oleh cashier ditolak FORBIDDEN
  ---------------------------------------------------------------------------
  v_nama_cek := '(i) panggilan oleh cashier ditolak FORBIDDEN';
  if v_cashier is null then
    -- Tidak ada akun cashier aktif sama sekali, jadi tes ini dilewatkan (bukan gagal).
    v_daftar_hasil := v_daftar_hasil || format(
      '[%s] DILEWATI | alasan: tidak ada akun dengan role cashier yang AKTIF di public.profiles',
      v_nama_cek
    );
    v_total := v_total + 1;
    v_jumlah_lewati := v_jumlah_lewati + 1;
  else
    v_didapat := '(tidak dijalankan)';
    begin
      begin
        perform public.create_menu_item(
          'Tes Menu Cashier ' || v_sufiks, 10000, v_cashier
        );
        v_didapat := 'tidak ditolak (fungsi berhasil jalan)';
      exception when others then
        v_didapat := sqlerrm;
      end;
      v_lolos := (v_didapat = 'FORBIDDEN');
    exception when others then
      v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
      v_lolos := false;
    end;
    v_total := v_total + 1;
    if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
    v_daftar_hasil := v_daftar_hasil ||
      format('[%s] %s | diharapkan: %s | didapat: %s',
        v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
        'FORBIDDEN', v_didapat);
  end if;

  ---------------------------------------------------------------------------
  -- (j) Satuan bahan tidak bisa berubah lewat update_ingredient
  ---------------------------------------------------------------------------
  v_nama_cek := '(j) satuan bahan tidak berubah lewat update_ingredient';
  v_didapat := '(tidak dijalankan)';
  v_lolos := false;
  begin
    select i.unit into v_satuan_awal
    from public.ingredients as i where i.id = v_bahan_id;

    -- Fungsi ini hanya menerima nama. Satuan tidak ada di parameternya.
    perform public.update_ingredient(
      v_bahan_id::text, 'Tes Bahan Diganti ' || v_sufiks, v_admin
    );

    select i.unit into v_satuan_akhir
    from public.ingredients as i where i.id = v_bahan_id;

    v_didapat := format('satuan %s -> %s', v_satuan_awal, v_satuan_akhir);
    v_lolos := (v_satuan_awal = 'g' and v_satuan_akhir = 'g');
  exception when others then
    v_didapat := 'ERROR TIDAK TERDUGA: ' || sqlerrm;
  end;
  v_total := v_total + 1;
  if v_lolos then v_jumlah_lolos := v_jumlah_lolos + 1; else v_jumlah_gagal := v_jumlah_gagal + 1; end if;
  v_daftar_hasil := v_daftar_hasil ||
    format('[%s] %s | diharapkan: %s | didapat: %s',
      v_nama_cek, case when v_lolos then 'LOLOS' else 'GAGAL' end,
      'satuan tetap g', v_didapat);

  ---------------------------------------------------------------------------
  -- RINGKASAN
  ---------------------------------------------------------------------------
  -- Exception ini melempar seluruh transaksi, jadi semua data tes yang dibuat
  -- di atas otomatis dibatalkan. Tidak ada sisa di database.
  raise exception '%',
    'RINGKASAN TES (semua perubahan dibatalkan):' || E'\n' ||
    array_to_string(v_daftar_hasil, E'\n') || E'\n' ||
    format('TOTAL: %s pemeriksaan | LOLOS: %s | GAGAL: %s | DILEWATI: %s',
      v_total, v_jumlah_lolos, v_jumlah_gagal, v_jumlah_lewati);
end;
$$;
