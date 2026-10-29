-- ============================================================================
-- Migrasi: pembatas permintaan berbasis tabel (rate limit).
-- ============================================================================

-- 1. Tabel rate_limits. RLS aktif tanpa policy: tidak ada yang boleh
--    membaca/menulis kecuali service_role (yang melewati RLS).
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Cabut semua hak dari public/anon/authenticated. Hanya service_role boleh.
revoke all on public.rate_limits from public, anon, authenticated;

-- 2. Fungsi check_rate_limit: naikkan hitungan secara atomik.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_retry integer;
begin
  -- Validasi input.
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'VALIDATION_FAILED';
  end if;
  if p_limit < 1 or p_limit > 100000 then
    raise exception 'VALIDATION_FAILED';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'VALIDATION_FAILED';
  end if;

  -- Awal jendela tetap (fixed window) supaya dua permintaan bersamaan
  -- jatuh ke jendela yang sama.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Naikkan hitungan secara atomik dengan insert ... on conflict.
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update
    set count = public.rate_limits.count + 1
  returning count into v_count;

  -- Detik sampai jendela berikutnya (minimal 1).
  v_retry := (extract(epoch from (v_window_start + (p_window_seconds || ' seconds')::interval - now())))::integer;
  if v_retry < 1 then
    v_retry := 1;
  end if;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'retryAfterSeconds', v_retry
  );
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

-- 3. Fungsi purge_rate_limits: hapus baris lama (> 1 hari).
create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rate_limits() from public, anon, authenticated;
grant execute on function public.purge_rate_limits() to service_role;

-- Jadwalkan pembersihan harian bila pg_cron terpasang.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge_rate_limits_daily',
      '30 17 * * *',
      'select public.purge_rate_limits();'
    );
  else
    raise notice 'Ekstensi pg_cron tidak terpasang; jadwal pembersihan belum dipasang.';
  end if;
end
$$;
