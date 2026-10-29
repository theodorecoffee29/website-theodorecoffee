-- ============================================================================
-- Uji hak akses setelah migrasi cabut_hak_anon_authenticated.
-- Satu blok do $$ ... $$: semua pemeriksaan, lalu raise exception berawalan
-- "RINGKASAN TES".
-- ============================================================================

do $$
declare
  tabel text;
  daftar_tabel text[] := array[
    'profiles','menu_items','ingredients','recipes','queue_counters','orders',
    'order_items','payments','stock_movements','daily_reports','activity_logs',
    'error_logs'
  ];
  hak text;
  daftar_hak text[] := array[
    'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
  ];
  gagal text := '';
  lolos integer := 0;
begin
  -- 1. anon dan authenticated tidak boleh punya hak tulis di 12 tabel.
  foreach tabel in array daftar_tabel loop
    foreach hak in array daftar_hak loop
      if has_table_privilege('anon', 'public.' || tabel, hak) then
        gagal := gagal || 'anon punya ' || hak || ' di ' || tabel || '; ';
      end if;
      if has_table_privilege('authenticated', 'public.' || tabel, hak) then
        gagal := gagal || 'authenticated punya ' || hak || ' di ' || tabel || '; ';
      end if;
    end loop;
  end loop;

  -- 2. authenticated hanya boleh SELECT di profiles.
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    gagal := gagal || 'authenticated tidak punya SELECT di profiles; ';
  end if;
  foreach tabel in array daftar_tabel loop
    if tabel <> 'profiles' and has_table_privilege('authenticated', 'public.' || tabel, 'SELECT') then
      gagal := gagal || 'authenticated punya SELECT di ' || tabel || '; ';
    end if;
  end loop;

  -- 3. anon tidak boleh SELECT di tabel mana pun.
  foreach tabel in array daftar_tabel loop
    if has_table_privilege('anon', 'public.' || tabel, 'SELECT') then
      gagal := gagal || 'anon punya SELECT di ' || tabel || '; ';
    end if;
  end loop;

  -- 4. service_role tetap punya semua hak di 12 tabel.
  foreach tabel in array daftar_tabel loop
    foreach hak in array (daftar_hak || array['SELECT']) loop
      if not has_table_privilege('service_role', 'public.' || tabel, hak) then
        gagal := gagal || 'service_role tidak punya ' || hak || ' di ' || tabel || '; ';
      end if;
    end loop;
  end loop;

  if gagal = '' then
    raise exception 'RINGKASAN TES: SEMUA LULUS';
  else
    raise exception 'RINGKASAN TES: GAGAL - %', gagal;
  end if;
end
$$;
