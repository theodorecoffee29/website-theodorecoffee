-- ============================================================================
-- Migrasi: cabut hak akses tabel dari peran anon dan authenticated.
--
-- Kenapa: semua akses data dari aplikasi memakai klien admin (service role),
-- kecuali baca tabel profiles oleh klien sesi (src/lib/auth/session.ts:71-75).
-- Peran anon dan authenticated tidak boleh menyentuh tabel langsung. Service
-- role TIDAK dicabut haknya, tetap punya akses penuh (melewati RLS).
-- ============================================================================

-- 1. Cabut semua hak pada tabel yang sudah ada di schema public.
-- REVOKE aman dijalankan ulang: kalau hak sudah tidak ada, tidak error.
revoke all on all tables in schema public from anon, authenticated;

-- 2. profiles: klien sesi (authenticated) hanya boleh membaca barisnya sendiri
-- (RLS policy "baca profil sendiri atau oleh admin" tetap berlaku).
-- Tidak ada penulisan: session.ts dan login/actions.ts hanya membaca.
grant select on public.profiles to authenticated;

-- 3. Cabut semua hak pada sequence yang sudah ada.
revoke all on all sequences in schema public from anon, authenticated;

-- 4. Cabut hak bawaan untuk objek yang dibuat setelah migrasi ini.
-- Ini penting supaya tabel/sequence/fungsi baru tidak otomatis memberi hak
-- ke anon dan authenticated.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges in schema public
  revoke all on functions from anon, authenticated;
