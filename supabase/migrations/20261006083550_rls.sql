-- File ini: mengatur siapa boleh membaca dan menulis tiap tabel di Theodore Coffee V1.
-- Dijalankan manual di Supabase Dashboard > SQL Editor, setelah 20261006020347_tables.sql.
-- Isi file ini hanya aturan akses (RLS) dan pengaman data. Belum ada fungsi order
-- dan belum ada data isi.

-- ============================================================================
-- RLS SINGKATAN DARI ROW LEVEL SECURITY
-- RLS adalah fitur PostgreSQL yang memeriksa setiap baris tabel satu per satu
-- sebelum dikirim ke yang bertanya. Kalau tidak ada aturan yang mengizinkan
-- baris itu, baris tersebut tidak dikirim sama sekali.
-- Sifatnya "tolak secara default": menyalakan RLS tanpa menulis policy apa pun
-- sudah cukup untuk menutup sebuah tabel.
-- ============================================================================

-- ============================================================================
-- FUNGSI PEMBANTU: MEMBACA PERAN AKUN YANG SEDANG LOGIN
-- ============================================================================

-- Satu-satunya cara policy tahu siapa orang yang sedang login.
-- Fungsi ini membaca peran dari tabel profiles memakai hak akses pemilik fungsi
-- (security definer), lalu mengembalikan nilai role-nya.
--
-- Kenapa perlu security definer: kalau policy membaca langsung tabel profiles,
-- maka policy itu memanggil RLS lagi, yang memanggil policy profiles, yang
-- memanggil RLS lagi. Rantai itu tidak pernah berhenti. Fungsi ini memutus
-- rantainya dengan membaca tabel memakai hak pemilik, bukan hak pemanggil.
--
-- Kenapa search_path dikosongkan (set search_path = ''): supaya tidak ada tabel
-- atau fungsi dari schema lain yang bisa ikut dipanggil diam-diam dan Dialihkan
-- ke tabel palsu. Karena search_path kosong, semua nama objek harus ditulis
-- lengkap dengan schema-nya.
--
-- Hanya akun aktif (is_active = true) yang punya peran. Akun yang dinonaktifkan
-- Admin otomatis kehilangan aksesnya tanpa perlu mengubah policy.
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
    and p.is_active = true;
$$;

comment on function public.current_user_role() is
  'Mengembalikan peran akun yang sedang login (admin/cashier/barista), atau kosong kalau belum login atau akunnya sudah dinonaktifkan.';

-- Fungsi ini hanya dipakai di dalam policy, bukan dipanggil langsung dari aplikasi.
revoke execute on function public.current_user_role() from public;

grant execute on function public.current_user_role() to authenticated;

-- ============================================================================
-- MENYALAKAN RLS DI SEMUA TABEL
-- 12 tabel. RLS diaktifkan satu per satu di sini, bukan dengan cara otomatis,
-- sehingga tidak ada tabel yang terlewat karena lupa menyebutkannya.
-- ============================================================================

alter table public.profiles enable row level security;

alter table public.menu_items enable row level security;

alter table public.ingredients enable row level security;

alter table public.recipes enable row level security;

alter table public.orders enable row level security;

alter table public.order_items enable row level security;

alter table public.payments enable row level security;

alter table public.stock_movements enable row level security;

alter table public.queue_counters enable row level security;

alter table public.daily_reports enable row level security;

alter table public.activity_logs enable row level security;

alter table public.error_logs enable row level security;

-- ============================================================================
-- POLICY BACA
-- Hanya policy untuk SELECT. Tidak ada satu pun policy untuk INSERT, UPDATE,
-- atau DELETE, jadi tidak ada akun yang bisa menulis langsung lewat API.
-- Semua penulisan nanti lewat fungsi database yang dijalankan dari server.
-- Baris "to authenticated" berarti hanya akun yang sudah login, karena
-- customer tidak punya akun dan tidak boleh menyentuh tabel secara langsung.
-- ============================================================================

-- profiles: setiap orang hanya boleh melihat baris dirinya sendiri. Admin
-- melihat semua profil karena perlu mengelola akun Cashier dan Barista.
create policy "baca profil sendiri atau oleh admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_role()) = 'admin'
);

-- menu_items: semua akun yang sudah login boleh melihat menu yang aktif saja,
-- supaya menu nonaktif tidak bocor ke Cashier atau Barista. Admin melihat
-- semuanya karena menu nonaktif masih perlu dibuka dari halaman kelola menu.
create policy "baca menu"
on public.menu_items
for select
to authenticated
using (
  is_active
  or (select public.current_user_role()) = 'admin'
);

-- ingredients: bahan dan stok hanya untuk Admin (permissions.md bagian 2,
-- hanya Admin yang boleh restock dan mengoreksi stok). Cashier dan Barista
-- tidak boleh melihat angka stok.
create policy "baca bahan"
on public.ingredients
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

-- recipes: resep juga hanya Admin, karena membocorkan resep berarti memberi
-- petunjuk jumlah bahan yang dipakai per porsi.
create policy "baca resep"
on public.recipes
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

-- orders: Cashier (konfirmasi, batalkan, lihat daftar) dan Admin. Barista tidak
-- termasuk karena layarnya tidak boleh berisi harga dan pembayaran, jadi
-- antreannya nanti diambil lewat fungsi khusus, bukan lewat akses tabel.
create policy "baca order"
on public.orders
for select
to authenticated
using ((select public.current_user_role()) in ('cashier', 'admin'));

-- order_items: ikut aturan orders. Baris item memuat harga, jadi tidak untuk
-- Barista.
create policy "baca item order"
on public.order_items
for select
to authenticated
using ((select public.current_user_role()) in ('cashier', 'admin'));

-- payments: Cashier perlu melihat pembayaran untuk mencocokkan dengan yang
-- dibayar customer, Admin untuk pemeriksaan. Barista tidak boleh melihatnya.
create policy "baca pembayaran"
on public.payments
for select
to authenticated
using ((select public.current_user_role()) in ('cashier', 'admin'));

-- stock_movements: riwayat perubahan stok hanya untuk Admin.
create policy "baca pergerakan stok"
on public.stock_movements
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

-- daily_reports: Cashier dan Admin boleh membuka laporan hari ini dan Riwayat.
create policy "baca laporan harian"
on public.daily_reports
for select
to authenticated
using ((select public.current_user_role()) in ('cashier', 'admin'));

-- activity_logs: hanya Admin (permissions.md bagian 2).
create policy "baca log aktivitas"
on public.activity_logs
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

-- error_logs: hanya Admin, karena isinya bisa memuat detail teknis.
create policy "baca log error"
on public.error_logs
for select
to authenticated
using ((select public.current_user_role()) = 'admin');

-- queue_counters sengaja TIDAK diberi policy apa pun.
-- Tidak ada orang yang boleh membacanya (bahkan Admin), dan hanya fungsi
-- pembuatan order yang boleh updating lewat server. Karena RLS sudah menyala,
-- tabel ini otomatis tertutup untuk semua orang.

-- ============================================================================
-- TRIGGER PENGAMAN: LARANG UBAH DAN HAPUS
-- RLS sudah menutup UPDATE dan DELETE untuk semua orang. Tapi service role
-- milik server dan beberapa operasi internal database bisa melewati RLS,
-- sedangkan aturan di permissions.md bagian 2 berlaku untuk siapa pun termasuk
-- Admin: order selesai atau dibatalkan, laporan Riwayat, dan kedua log tidak
-- boleh diubah atau dihapus. Trigger menutup celah itu di lapisan database.
-- ============================================================================

-- Satu fungsi untuk semua trigger di bawah: kalau ada yang mencoba mengubah atau
-- menghapus baris yang dilindungi, PostgreSQL menghentikan perubahan itu dengan
-- pesan error.
create or replace function public.tolak_perubahan_data()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tabel % tidak boleh diubah atau dihapus. Data ini hanya bisa ditambah.',
    tg_table_name
    using errcode = '42501';
end;
$$;

comment on function public.tolak_perubahan_data() is
  'Dipakai trigger untuk menolak UPDATE dan DELETE. Tabel log dan laporan harian hanya bisa ditambah, tidak boleh diubah atau dihapus, termasuk oleh Admin.';

-- Log aktivitas: hanya boleh ditambah, jadi UPDATE dan DELETE ditolak.
create trigger activity_logs_tolak_diubah
before update or delete on public.activity_logs
for each row execute function public.tolak_perubahan_data();

-- Log error: sama seperti log aktivitas, hanya boleh ditambah.
create trigger error_logs_tolak_diubah
before update or delete on public.error_logs
for each row execute function public.tolak_perubahan_data();

-- Laporan harian di Riwayat: tidak boleh diubah dan tidak boleh dihapus
-- supaya angka penjualan historis tetap benar.
create trigger daily_reports_tolak_diubah
before update or delete on public.daily_reports
for each row execute function public.tolak_perubahan_data();

-- Order tidak pernah dihapus; yang batal cukup berstatus dibatalkan
-- (permissions.md bagian 2). Yang berubah hanya kolomnya (status, waktu, siapa),
-- jadi di sini hanya DELETE yang ditolak, bukan UPDATE.
create trigger orders_tolak_dihapus
before delete on public.orders
for each row execute function public.tolak_perubahan_data();

-- Item order mengikuti order: tidak boleh dihapus supaya laporan lama tetap utuh.
create trigger order_items_tolak_dihapus
before delete on public.order_items
for each row execute function public.tolak_perubahan_data();

-- Pembayaran tidak pernah dihapus. Order yang dibatalkan ditandai batal lewat
-- voided_at, bukan dengan menghapus barisnya (data-model.md bagian 2 payments).
create trigger payments_tolak_dihapus
before delete on public.payments
for each row execute function public.tolak_perubahan_data();