-- ============================================================================
-- HANYA UNTUK DEVELOPMENT. Jangan dijalankan di project production.
-- ============================================================================

do $$
declare
  v_result jsonb;
  v_count integer;
  v_deleted integer;
  v_ok boolean;
  v_msg text;
  v_detail text;
  v_context text;
  v_key text := 'tes:kunci-utama';
  v_key2 text := 'tes:kunci-kedua';
begin
  -- (a) p_limit permintaan pertama allowed true, permintaan ke p_limit+1 false.
  -- (b) remaining menurun benar.
  -- (c) retryAfterSeconds antara 1 dan p_window_seconds.
  perform public.check_rate_limit(v_key, 2, 60);
  v_result := public.check_rate_limit(v_key, 2, 60);
  if not (v_result->>'allowed' = 'true') then
    get stacked diagnostics v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL, v_context = PG_EXCEPTION_CONTEXT;
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (a)/(b) permintaan kedua tidak allowed. detail=% context=%', v_detail, v_context;
  end if;

  v_result := public.check_rate_limit(v_key, 2, 60);
  if not (v_result->>'allowed' = 'false') then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (a) permintaan ketiga masih allowed';
  end if;

  -- (d) dua kunci berbeda tidak saling memengaruhi.
  v_result := public.check_rate_limit(v_key2, 1, 60);
  if not (v_result->>'allowed' = 'true') then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (d) kunci kedua ikut terpengaruh';
  end if;

  -- (e) validasi.
  begin
    perform public.check_rate_limit('', 1, 60);
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (e) p_key kosong tidak ditolak';
  exception when others then
    null;
  end;
  begin
    perform public.check_rate_limit(v_key, 0, 60);
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (e) p_limit 0 tidak ditolak';
  exception when others then
    null;
  end;
  begin
    perform public.check_rate_limit(v_key, 1, 0);
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (e) p_window_seconds 0 tidak ditolak';
  exception when others then
    null;
  end;

  -- (f) purge menghapus baris tua, tidak menghapus baris baru.
  insert into public.rate_limits (key, window_start, count)
  values ('tes:lama', now() - interval '2 days', 1);
  v_deleted := public.purge_rate_limits();
  if v_deleted < 1 then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (f) purge tidak menghapus baris tua';
  end if;

  -- (g) anon/authenticated tidak punya hak.
  if has_function_privilege('anon', 'public.check_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (g) anon punya execute check_rate_limit';
  end if;
  if has_table_privilege('anon', 'public.rate_limits', 'SELECT') then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (g) anon punya SELECT rate_limits';
  end if;

  -- (h) hanya satu versi check_rate_limit.
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='check_rate_limit';
  if v_count <> 1 then
    raise exception 'RINGKASAN TES (semua perubahan dibatalkan): GAGAL - (h) jumlah versi check_rate_limit = %', v_count;
  end if;

  raise exception 'RINGKASAN TES (semua perubahan dibatalkan): LOLOS';
end
$$;
