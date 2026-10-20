# Audit Keamanan 8.1 — Theodore Coffee V1

Tanggal: 20 Oktober 2026. Auditor: agen AI (OpenCode), mode baca-saja.

Ruang lingkup: seluruh route API dan halaman di `src/app`, `src/proxy.ts`, `src/lib` (auth, server, supabase, log), `.env.example`, `.gitignore`, dan hasil `npm run build` + `npm audit`. Acuan aturan: `docs/pemissions.md` bagian 2 (nama berkas di repo memang "pemissions", bukan "permissions"), `docs/api-contract.md` bagian 1–3 dan 6, `docs/logging.md` bagian 6–7.

**Cara verifikasi.** Sebagian besar pemeriksaan dilakukan langsung dengan membaca berkas dan pencarian teks (bukti `file:baris` disertakan). Analisis awal per route didelegasikan ke subagen, lalu KLAIM PENTING DIVERIFIKASI ULANG oleh pemeriksaan langsung: penjaga tiap route (32 berkas), pemakaian klien admin, header Cache-Control, validasi id, dan redaksi log. Selain itu, **file tes baru `src/test/matriks-akses.test.ts`** membaca isi setiap berkas route dari disk dan membandingkan penjaga yang tertulis di sana dengan aturan dokumen, sehingga inventaris di bagian A tidak hanya hasil bacaan sekali jalan.

**Satu-satunya file yang dibuat/diubah dalam tugas ini:** `audit/keamanan-8-1.md` (laporan ini) dan `src/test/matriks-akses.test.ts` (tes). Tidak ada perbaikan temuan yang dilakukan, sesuai instruksi.

---

## Ringkasan

Aplikasi ini punya tulang punggung keamanan yang sudah benar: setiap endpoint staf/admin dijaga penjaga peran **di server** sebelum menyentuh database, setiap id di alamat divalidasi uuid, daftar nilai terbatas (metode bayar, alasan, peran, filter) memakai `z.enum`, kunci rahasia hanya ada di modul ber-`server-only`, dan tidak ada satu pun primitif XSS.

Temuan terbanyak berlevel **Sedang** dan berputar pada satu tema: **lapisan pembatas permintaan (rate limit) hanya ada di 5 endpoint publik, tidak ada di login, dan tidak ada di seluruh endpoint staf/admin**; ditambah batas ukuran body yang diserahkan sepenuhnya pada default bawaan Next.js. Tidak ada temuan level **Tinggi** yang terverifikasi.

| Tingkat | Jumlah |
|---|---|
| Tinggi | 0 |
| Sedang | 6 |
| Rendah | 8 |

---

## A. Inventaris route dan halaman

Kolom "Tulis DB" = memanggil fungsi database yang mengubah data. "Klien admin" = `getAdminClient()` / `panggilFungsiAdmin()` (kunci service role). "Pembatas" = `periksaPembatas` (in-memory, `src/lib/server/pembatas-permintaan.ts:61`). "no-store" = header `Cache-Control` dari `HEADER_LAPORAN` (`src/lib/server/balas-laporan.ts:23`).

### Route API (32 berkas, 36 handler)

| Alamat | Metode | Penjaga (siapa lolos) | Zod body | Validasi id/query | Klien admin | Tulis DB | Pembatas | no-store |
|---|---|---|---|---|---|---|---|---|
| /api/menu | GET | anonim (tanpa guard) | — | — | ya (`get_menu`, baca) | tidak | ya, 60 | tidak |
| /api/orders | POST | anonim (tanpa guard) | ya | — | ya (`create_order`) | ya | ya, 10 | tidak |
| /api/orders/[id]/status | GET | anonim (tanpa guard) | — | uuid (`route.ts:66`) | ya (`get_order_status`) | tidak | ya, 60 | tidak |
| /api/orders/[id]/cancel | POST | anonim (tanpa guard) | ya | uuid (`route.ts:61`) | ya (`cancel_order`) | ya | ya, 20 | tidak |
| /api/log-error | POST | anonim (tanpa guard) | ya | — | ya (insert `error_logs`) | ya | ya, 10 | tidak |
| /api/cashier/orders | GET | cashier, admin (`route.ts:40`) | — | tidak ada query | ya (select) | tidak | tidak | tidak |
| /api/cashier/orders | POST | cashier, admin (`route.ts:129`) | ya | — | ya (`create_manual_order`) | ya | tidak | tidak |
| /api/cashier/orders/[id]/confirm | POST | cashier, admin (`route.ts:43`) | ya | uuid (`route.ts:53`) | ya (`confirm_order`) | ya | tidak | tidak |
| /api/cashier/orders/[id]/cancel | POST | cashier, admin (`route.ts:46`) | ya | uuid (`route.ts:59`) | ya (`cancel_order`) | ya | tidak | tidak |
| /api/barista/queue | GET | barista (`route.ts:35`) | — | — | ya (select, tanpa harga) | tidak | tidak | tidak |
| /api/barista/orders/[id]/start | POST | barista (`route.ts:37`) | — | uuid (`route.ts:47`) | ya (`start_order`) | ya | tidak | tidak |
| /api/barista/orders/[id]/finish | POST | barista (`route.ts:37`) | — | uuid (`route.ts:47`) | ya (`finish_order`) | ya | tidak | tidak |
| /api/staff/stock | GET | cashier, barista, admin (`route.ts:37`) | — | — | ya (`get_stock_overview`) | tidak | tidak | tidak |
| /api/reports | GET | cashier, admin (`route.ts:58`) | — | — | ya | ya (`save_missing_reports`, idempoten) | tidak | ya |
| /api/reports/today | GET | cashier, admin (`route.ts:44`) | — | — | ya (`get_today_report`) | tidak | tidak | ya |
| /api/reports/today/printed | POST | cashier, admin (`route.ts:55`) | **tidak** | — | ya | ya | tidak | ya |
| /api/reports/[id] | GET | cashier, admin (`route.ts:49`) | — | zod uuid (`route.ts:58`) | ya (`get_report`) | tidak | tidak | ya |
| /api/reports/[id]/printed | POST | cashier, admin (`route.ts:54`) | — | zod uuid (`route.ts:61`) | ya (update `printed`) | ya | tidak | ya |
| /api/admin/accounts | GET | admin (`route.ts:61`) | — | — | ya (`listUsers`) | tidak | tidak | ya |
| /api/admin/accounts | POST | admin (`route.ts:124`) | ya | — | ya (create user) | ya | tidak | ya |
| /api/admin/accounts/[id] | PATCH | admin (`route.ts:42`) | ya | zod uuid (`route.ts:51`) | ya | ya | tidak | ya |
| /api/admin/accounts/[id]/active | POST | admin (`route.ts:45`) | ya | zod uuid (`route.ts:52`) | ya | ya | tidak | ya |
| /api/admin/accounts/[id]/password | POST | admin (`route.ts:52`) | ya | zod uuid (`route.ts:59`) | ya (reset password) | ya | tidak | ya |
| /api/admin/ingredients | GET | admin (`route.ts:41`) | — | — | ya (select) | tidak | tidak | tidak |
| /api/admin/ingredients | POST | admin (`route.ts:76`) | ya | — | ya (`create_ingredient`) | ya | tidak | tidak |
| /api/admin/ingredients/[id] | PATCH | admin (`route.ts:35`) | ya | uuid (`route.ts:42`) | ya (`update_ingredient`) | ya | tidak | tidak |
| /api/admin/ingredients/[id]/adjust | POST | admin (`route.ts:42`) | ya | uuid (`route.ts:49`) | ya (`adjust_stock`) | ya | tidak | tidak |
| /api/admin/ingredients/[id]/movements | GET | admin (`route.ts:36`) | — | uuid (`route.ts:43`) | ya (select) | tidak | tidak | tidak |
| /api/admin/ingredients/[id]/restock | POST | admin (`route.ts:37`) | ya | uuid (`route.ts:44`) | ya (`restock_ingredient`) | ya | tidak | tidak |
| /api/admin/logs/activity | GET | admin (`route.ts:82`) | — | zod `.strict()` + cursor (`route.ts:247`) | ya (select) | tidak | tidak | ya |
| /api/admin/logs/errors | GET | admin (`route.ts:76`) | — | zod `.strict()` + cursor (`route.ts:209`) | ya (select) | tidak | tidak | ya |
| /api/admin/menu | GET | admin (`route.ts:45`) | — | — | ya (select) | tidak | tidak | tidak |
| /api/admin/menu | POST | admin (`route.ts:84`) | ya | — | ya (`create_menu_item`) | ya | tidak | tidak |
| /api/admin/menu/[id] | PATCH | admin (`route.ts:33`) | ya | uuid (`route.ts:40`) | ya (`update_menu_item`) | ya | tidak | tidak |
| /api/admin/menu/[id]/active | POST | admin (`route.ts:39`) | ya | uuid (`route.ts:46`) | ya (`set_menu_active`) | ya | tidak | tidak |
| /api/admin/menu/[id]/recipe | PUT | admin (`route.ts:38`) | ya | uuid (`route.ts:45`) | ya (`set_recipe`) | ya | tidak | tidak |

### Halaman (14 `page.tsx`)

| Alamat | Penjaga | Catatan |
|---|---|---|
| / | publik | halaman customer |
| /login | publik | tanpa login |
| /status/[orderId] | publik | akses lewat id order |
| /cashier | wajibPeran("/cashier") | cashier, admin |
| /cashier/laporan | wajibPeran("/cashier/laporan") | cashier, admin |
| /cashier/laporan/[id] | wajibPeran("/cashier/laporan/[id]") | cashier, admin |
| /barista | wajibPeran("/barista") | barista |
| /admin | wajibPeran("/admin") | admin |
| /admin/akun | wajibPeran("/admin/akun") | admin |
| /admin/laporan | wajibPeran("/admin/laporan") | admin |
| /admin/laporan/[id] | wajibPeran("/admin/laporan/[id]") | admin |
| /admin/log | wajibPeran("/admin/log") | admin |
| /admin/menu | wajibPeran("/admin") | admin (guard path induk, lihat temuan R-13) |
| /admin/stok | wajibPeran("/admin") | admin (guard path induk, lihat temuan R-13) |

### `src/proxy.ts`

Menyegarkan cookie sesi (`getClaims`, `proxy.ts:75`) dan mengarahkan yang belum login ke `/login` untuk alamat dalam `HALAMAN_PERAN` (`proxy.ts:93-105`). Proxy BUKAN penjaga utama (komentar di `proxy.ts:8-13`); peneguhan ada di `wajibPeran()` tiap halaman dan `jagaPeranStaf`/`jagaPeranAdmin` tiap route.

### Perbandingan dengan `docs/pemissions.md` bagian 2

Ketidakcocokan yang ditemukan (semua route lebih longgar dari dokumen; tidak ada route yang lebih ketat):

1. **POST /api/orders** — dokumen: hanya Customer. Kode: tanpa penjaga, jadi Cashier/Barista/Admin yang login juga lolos (hanya dibatasi aturan di dalam `create_order`).
2. **GET /api/orders/[id]/status** — dokumen: hanya Customer. Kode: tanpa penjaga, staf ikut lolos.
3. **POST /api/orders/[id]/cancel** — dokumen: Customer (order sendiri), Cashier, Admin; Barista tidak boleh. Kode: tanpa penjaga; Barista yang login dan tahu id order ikut lolos (aturan "menunggu konfirmasi" tetap ditegakkan di dalam fungsi database `cancel_order` dengan `p_actor_id` null).

Route yang tidak ada di `pemissions.md` maupun `api-contract.md`: **POST /api/reports/today/printed** (bagian 4c api-contract hanya menyebut `POST /api/reports/[id]/printed`). Route lain yang alamatnya tidak ditulis di api-contract tetap punya padanan fungsi database yang didokumentasikan (mis. `list_orders`, `get_barista_queue`, `confirm_order`).

Ketiga ketidakcocokan di atas **dikunci dalam tes** `src/test/matriks-akses.test.ts` (daftar `ketidakcocokanTercatat`), sehingga kalau nanti route berubah (baik diperbaiki maupun makin longgar), tes gagal dan daftar harus diperbarui.

---

## B. Rahasia

1. **Pemakaian kunci service role.** `SUPABASE_SERVICE_ROLE_KEY` hanya disentuh di dua berkas: `src/lib/env.ts:31,49` (dengan `import "server-only"` di baris 14) dan `src/lib/supabase/admin.ts:37` (juga `server-only`, baris 18). Klien admin hanya dipanggil dari route handler (32 berkas, terverifikasi lewat pencarian) — tidak ada satu pun komponen klien yang mengimpornya. Pemetaan `service_role` lain hanya muncul di `src/lib/log/index.ts:76` sebagai kata kunci redaksi dan di file tes.
2. **Variabel `NEXT_PUBLIC_`.** Hanya dua: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/env.ts:47-48`, `src/proxy.ts:26-27`, `src/lib/supabase/client.ts:17-18`) — keduanya memang publik menurut desain Supabase (anon key dipakai browser).
3. **Hasil build ke browser.** `npm run build` dijalankan, lalu folder `.next/static` (berkas yang dikirim ke browser) dicari teks `sb_secret`, `service_role`, dan `SUPABASE_SERVICE_ROLE_KEY`: **tidak ditemukan satu pun**.
4. **Rahasia di berkas ter-track Git.** Pencarian pola `sb_secret_`, `sb_publishable_`, `eyJhbGciOi` (awalan JWT), dan `*.supabase.co` di `src`, `supabase`, `docs`, `README.md`, dan berkas konfigurasi: tidak ada kecocokan. `supabase/config.toml` hanya berisi `project_id = "website-theodorecoffee"` (nama folder lokal, bukan reference id project asli). Tidak ada pola password/kunci keras tertulis.
5. **`.gitignore`.** `git check-ignore -v` mengonfirmasi `.env.local` tercakup aturan `.env*.local` (`.gitignore:58`) dan `opencode.json` tercakup (`.gitignore:7`).

---

## C. Matriks akses otomatis

Dibuat file tes baru **`src/test/matriks-akses.test.ts`** (14 tes, semuanya lolos; dijalankan juga bersama `npm run test` penuh). Isinya:

- **Daftar matriks** 36 handler route API + 14 halaman, lengkap dengan peran yang BOLEH menurut `docs/pemissions.md` bagian 2 (dan api-contract bagian 3 untuk `log-error`).
- **Penjaga ditiru** menyalin urutan pemeriksaan `jagaPeranStaf` (`jaga-peran.ts:44-72`): tanpa sesi → `UNAUTHENTICATED`, peran tidak diizinkan → `FORBIDDEN`, selain itu lolos. Daftar peran tiap route **dibaca dari isi berkas route-nya di disk** (parsing pemanggilan `jagaPeranAdmin` / `jagaPeranStaf`, termasuk bentuk `[...KONSTANTA]` yang nilainya ditelusuri lewat impor), jadi tes tidak sekadar mengulang apa yang tertulis di matriks.
- **Untuk halaman**, tes memakai fungsi asli `peranBolehBukaPath()` dari `src/lib/auth/roles.ts`, plus cek bahwa halaman terlindungi tercakup awalan `HALAMAN_PERAN` (dengan begitu proxy benar-benar mengarahkan anonim ke `/login`).
- **Tes pengaman**: (1) setiap berkas `route.ts` di `src/app` wajib terdaftar di matriks — route baru otomatis membuat tes GAGAL; (2) setiap berkas `page.tsx` juga wajib terdaftar; (3) metode HTTP yang diekspor berkas harus persis sama dengan metode di matriks; (4) hasil dari ketidakcocokan kode vs dokumen harus persis daftar `ketidakcocokanTercatat` — ketidakcocokan baru gagal, ketidakcocokan yang sudah diperbaiki juga gagal (supaya catatan tidak basi).

Hasil: semua lolos — artinya penjaga yang tertulis di 32 berkas route cocok dengan aturan dokumen, kecuali 3 pengecualian tercatat di bagian A (route customer tanpa guard).

---

## D. Validasi dan batas masukan

- **Batas ukuran body: tidak ada yang dikonfigurasi.** `next.config.ts:3-5` kosong (tidak ada `bodySizeLimit` maupun `experimental.serverActions`); tidak ada pemeriksaan `content-length` atau panjang payload di `src/` (pencarian: nol kecocokan). Semua route memanggil `request.json()` tanpa batas. Batas efektif hanya default bawaan Next.js (dilaporkan 1 MB di dokumentasi Next.js; **nilai default itu sendiri tidak diverifikasi di sumber Next.js**).
- **Endpoint anonim punya pembatas permintaan** (semua lewat `periksaPembatas`, `pembatas-permintaan.ts:61`, jendela 10 menit): `POST /api/orders` 10× (`orders/route.ts:35`), `GET /api/orders/[id]/status` 60× (`status/route.ts:47`), `POST /api/orders/[id]/cancel` 20× (`cancel/route.ts:45`), `POST /api/log-error` 10× (`log-error/route.ts:38`), `GET /api/menu` 60× (`menu/route.ts:32`). Endpoint staf/admin **tidak punya** pembatas (pencarian `periksaPembatas` hanya menemui 5 file di atas).
- **Id di alamat**: semua 14 route bermen `[id]` memvalidasi uuid SEBELUM panggil database — via `apakahUuidValid` (orders status/cancel, cashier confirm/cancel, barista start/finish), `cekIdAlamat` (semua route admin ingredients/menu), atau `zod .uuid()` (`akunIdSchema` di accounts, `laporanIdSchema` di reports). Tercantum di tabel bagian A.
- **Daftar nilai tertutup**: metode bayar `z.enum(["qris","tunai"])` (`validasi.ts:69-71`); alasan batal `z.enum(DAFTAR_ALASAN_BATAL)` (`validasi.ts:93`, daftar di `alasan-batal.ts:17-24`); peran akun `z.enum(["cashier","barista"])` (`validasi-akun.ts:66-68`); filter log semua `z.enum` + `.strict()` (`validasi-log.ts:67-131`); satuan stok `z.enum(["g","ml","pcs"])` (`validasi-admin.ts:153`).
- **Pengecualian**: (1) `POST /api/reports/today/printed` menerima body JSON **tanpa zod** (`reports/today/printed/route.ts:58`) — nilainya langsung dipakai; (2) kursor pagination `id`/`at` dari klien dikonkatenasi ke filter PostgREST `.or()` (`cursor-log.ts:172-173`, diverifikasi langsung) — input hanya dicek non-kosong dan format tanggal, bukan daftar tertutup.

---

## E. Kebocoran data

- **Pemetaan error.** Pesan database mentah TIDAK dikirim ke klien pada jalur biasa: `fromDatabaseError` (`src/lib/errors.ts:165-186`) hanya meneruskan pesan ramah; `detail.message/details/hint` mentah hanya masuk konteks **log server** (`balas.ts:168-179`); klien menerima kode `ERR-xxxx` + pesan generik.
- **Pengecualian jalur admin menu/bahan.** `balasDariErrorAdmin` (`balas-admin.ts:74-133`) meneruskan `detail.details` dari database ke respons admin kalau ≤300 karakter dan tidak mengandung pola teknis (`constraint`, `violates`, `duplicate key`, `SQLSTATE`, `public.`, `pg_`). Ini heuristik blokir (blacklist), bukan allowlist — lihat temuan R-1.
- **Endpoint customer.** `GET /api/orders/[id]/status` mengembalikan `status, queueNumber, queueDate, items[{name,qty,note}], total, cancelReason, cancelNote` (`petakan-hasil-fungsi.ts:171-183`) — **tanpa** metode pembayaran dan tanpa nama pelanggan. Siapa pun yang mengetahui UUID order bisa membaca isi pesanan orang lain (memang desain dokumen, ada mitigasi uuid + pembatas 60/menit) — temuan R-3. `POST .../cancel` hanya mengembalikan hasil pembatalan.
- **Endpoint Barista.** Select queue memakai daftar kolom eksplisit tanpa harga (`barista/queue/route.ts:44-50`); pemetaan (`petakan-antrean.ts:57-67`) hanya `orderId, queueNumber, customerName, items[{name,qty,note}], status`; `price_snapshot` dilewati (`:93-94`). Start/finish hanya `{status}` (`petakan-hasil-fungsi.ts:397-400`). Konfirmasi: **tidak ada harga/data pembayaran**.
- **Endpoint Cashier (GET).** Mengembalikan `total`, `price_snapshot`, `subtotal`, dan `payments[{method,amount,voided}]` (`cashier/orders/route.ts:40,53-116`) — wajar untuk peran yang memang mengurus pembayaran (kasir/admin), dan sesuai kontrak.
- **Stack trace / nama tabel** tidak pernah masuk respons pada jalur umum (lihat di atas). Nama fungsi database muncul hanya di pesan log server, bukan di respons.

---

## F. Logging

- **36 panggilan `console.*`, semuanya `console.error`** — tidak ada `console.log`/`console.warn`/`console.debug`. Tersebar di wrapper klien `src/features/*/api.ts` (mencetak URL + `String(error)` saja, diverifikasi pada `akun/api.ts:198-244`, `customer/api.ts:163-200`, `cashier/api.ts:298-356`), satu di `admin/logs/activity/route.ts:322`, satu di `wib-hari-ini.ts:33`, dan lima di `src/lib/log/index.ts:214,226,238,324,333` (jalur kegagalan menulis log itu sendiri, mencetak `param.message` — temuan R-8). Tidak ada yang mencetak `process.env`, header, atau isi body permintaan.
- **Cakupan `redactSecrets`** (diverifikasi langsung, `log/index.ts:70-77,92-128`): kata kunci `password`, `token`, `apikey`, `authorization`, `secret`, `service_role` — dicocokkan sebagai **substring** terhadap nama kunci yang sudah huruf kecil, nilai diganti `"[DISEMBUNYIKAN]"`, penelusuran rekursif ke objek/array. Diterapkan di `logError` (`:190`) dan `logActivity` untuk before/after/meta (`:297-299`), dan hasilnya di-redact ulang saat dibaca (`petakan-log.ts:16-22`).
- **Isi permintaan lengkap di log error?** Tidak. Konteks dari `POST /api/log-error` dibatasi zod dulu (`log-error/route.ts:73-91`: `path` ≤200, `fungsi` ≤100, `message` ≤500, `orderId` uuid) lalu di-redact. Konteks `logError` route lain hanya nama endpoint + kode error, bukan body.
- **Password tidak pernah di-log**: login gagal hanya mencatat email (`log-auth.ts:42-49` via `login/actions.ts:96,108`); reset password membuat before/after identik (`kelola-akun.ts:423-432,676-683`); route ganti password hanya mengembalikan `{accountId}` (`accounts/[id]/password/route.ts:136`).

---

## G. Sesi dan cookie

- **Penyimpanan sesi**: cookie bawaan `@supabase/ssr` lewat `createServerClient` dengan storage adapter cookie (`src/lib/supabase/server.ts:38-59`). **Aplikasi tidak menyetel opsi cookie apa pun** (pencarian `httpOnly|secure|sameSite|maxAge`: nol kecocokan di `src/`), jadi semuanya mengikuti default library — **nilai default library tidak diperiksa** (temuan R-6). `setAll` menelan error (`:51-55`) sehingga kegagalan menulis cookie tidak terlihat.
- **Penyegaran**: `src/proxy.ts` memanggil `supabase.auth.getClaims()` (`:75`), dan cookie baru ditulis lewat `setAll` (`:59-67`); pengalihan membuang query string (`:87-90`).
- **Keputusan otorisasi TIDAK mengandalkan keberadaan cookie.** Setiap permintaan staf melewati `ambilSesiStaf` (`src/lib/auth/session.ts:53-101`): token diverifikasi via `getClaims` (`:71`), profil dibaca dari `profiles`, **`is_active` dicek** (`:84-86`), dan **peran diambil dari tabel profiles** lalu divalidasi `AppRoleSchema` (`:90-93`). Karena `jagaPeranStaf`/`jagaPeranAdmin`/`wajibPeran` semuanya memanggil `ambilSesiStaf`, cek aktif + peran berlaku di **setiap** permintaan, bukan hanya saat login. Menonaktifkan akun langsung menghentikan aksesnya pada permintaan berikutnya.

---

## H. Serangan umum

- **XSS**: pencarian `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `document.write`, `window.location =` di seluruh `src/`: **nol kecocokan**. Teks buatan pengguna (nama customer, catatan item, catatan batal, nama akun) dirender sebagai teks JSX biasa — diverifikasi pada `barista/kartu-pesanan.tsx:52,81-83`, `cashier/kartu-pesanan.tsx:66,116-120`, `customer/status-order.tsx:84,147-149`, `log/tabel-error.tsx:154,162-169`, `log/tabel-aktivitas.tsx:214-228`. Tampilan cetak laporan memakai komponen yang sama (`laporan/isi-laporan.tsx`), tidak ada parser HTML.
- **Open redirect**: halaman login TIDAK punya parameter alamat tujuan (`returnTo`/`next`); redirect server-derif ke `pathUntukRole(sesi.role)` (`login/actions.ts:115`) yang nilainya berasal dari daftar tetap di `roles.ts`. Tidak ada jalur ke situs lain.
- **`href` dinamis** hanya gabungan prefix tetap + UUID yang sudah divalidasi: `beranda-customer.tsx:37` (`"/status/" + orderId`), `layar-laporan.tsx:238` (`pathRiwayat + "/" + reportId`). `router.push` juga prefix hardcoded + id (`use-form-pesan.ts:426`, `use-order-aktif-redirect.ts:41`).
- **Permintaan pengubah data tanpa POST/PATCH/PUT**: tidak ada handler DELETE. Satu-satunya GET yang menulis adalah `GET /api/reports` → `rpc("save_missing_reports")` (`reports/route.ts:72-74`): idempoten by design, dijelaskan di komentar `:6-15`, dan berperan cashier/admin — tetapi melanggar prinsip GET-safe (temuan S-6). RPC baca lain tidak diverifikasi isinya (lihat "tidak diperiksa").

---

## I. Dependensi

`npm audit --omit=dev` (20 Oktober 2026, npm 10.9.3, dependensi produksi dari package-lock.json): **found 0 vulnerabilities**. Tidak ada `npm audit fix` atau pembaruan paket yang dijalankan, sesuai instruksi. Catatan: audit npm hanya menutupi CVE yang terdaftar di registri; kualitas keamanan paket itu sendiri tidak diperiksa.

---

## Daftar temuan

### Tingkat Tinggi

*(Tidak ada. Semua temuan di bawah berdampak terbatas: butuh login staf, butuh tahu UUID, atau menyangkut ketahanan terhadap penyerang otomatis, bukan kebocoran langsung.)*

### Tingkat Sedang

**S-1. Tidak ada pembatas percobaan login.**
File: `src/app/login/actions.ts:70-116` (tidak memanggil `periksaPembatas`).
Risiko: seseorang bisa mencoba menebak email dan kata sandi berkali-kali tanpa halangan dari aplikasi; perlindungan yang ada sepenuhnya mengandalkan Supabase Auth (tidak diperiksa di sini).
Saran: pasang `periksaPembatas` (misal 5–10 percobaan per 10 menit per IP) di `loginAction` sebelum memanggil Supabase.

**S-2. Pembatas permintaan in-memory dan IP dari header yang bisa dipalsukan.**
File: `src/lib/server/pembatas-permintaan.ts:36` (Map lokal, hilang saat restart/multi-instance), `src/lib/server/ambil-ip.ts:24-44` (IP = nilai pertama `x-forwarded-for`).
Risiko: pelaku bisa melewati batas dengan mengubah header `x-forwarded-for`, dan batas gugur kalau aplikasi dijalankan lebih dari satu instance atau setelah restart. Ini melemahkan satu-satunya pelindung endpoint anonim.
Saran: percayai hanya satu hop proxy tepercaya (konfigurasikan di hosting), atau pindahkan penyimpanan hitungan ke database/Redis untuk produksi multi-instance.

**S-3. Tidak ada pembatas permintaan sama sekali di endpoint staf/admin.**
File: seluruh `src/app/api/admin/**`, `src/app/api/cashier/**`, `src/app/api/barista/**`, `src/app/api/staff/stock` (bukti: `periksaPembatas` hanya muncul di 5 route publik).
Risiko: akun internal yang bocor atau penyerang yang sudah login bisa memanggil endpoint berulang kali tanpa batas (misal mencoba banyak id, atau membanjiri pencatatan log aktivitas).
Saran: terapkan pembatas serupa per sesi/IP untuk route staf, dengan angka lebih longgar.

**S-4. Tidak ada batas ukuran body yang dikonfigurasi.**
File: `next.config.ts:3-5` (kosong); `request.json()` tanpa cek panjang payload di semua route penerima body.
Risiko: pengirim bisa mengirim body besar (sampai batas bawaan Next.js) yang memakai memori server; pada endpoint anonim seperti `POST /api/orders` (maksimal 20 baris item menurut zod) body besar mubazir membebani server sebelum validasi menolaknya.
Saran: set `experimental.serverActions.bodySizeLimit`/konfigurasi body parser seperlunya, atau cek `content-length` di awal handler endpoint anonim.

**S-5. Kursor pagination dikonkatenasi mentah ke filter PostgREST.**
File: `src/lib/server/cursor-log.ts:172-173` (`"at." + pembanding + "." + cursor.at` dan `"id." + pembanding + "." + cursor.id`).
Risiko: nilai cursor datang dari klien dan hanya dicek non-kosong + format tanggal (`:107-120`); karakter khusus yang tidak biasa berpotensi mengubah struktur filter query database. Saat ini dampaknya kecil karena id di-cast ke uuid di sisi database, tapi ini pola rapuh.
Saran: validasi id cursor dengan uuid ketat dan tanggal dengan zod, lalu gabungkan hanya nilai yang sudah bersih (pertimbangkan `or()` bertanda kutip).

**S-6. `GET /api/reports` menulis data.**
File: `src/app/api/reports/route.ts:72-74` (`rpc("save_missing_reports")`).
Risiko: permintaan GET secara harfiah memicu pekerjaan tulis; prinsip umum "GET tidak mengubah data" dilanggar, sehingga pemantau, prefetch, atau retry yang tidak sengaja bisa memicu kerja berulang. Saat ini aman karena idempoten dan berperan.
Saran: pindahkan pencadangan laporan ke POST terpisah atau ke cron/scheduled function, agar GET murni membaca.

### Tingkat Rendah

**R-1. Detail error database bisa sampai ke respons admin melalui penyaring heuristik.**
File: `src/lib/server/balas-admin.ts:74-133` (dipakai 9 route `admin/menu` dan `admin/ingredients`).
Risiko: pesan error database yang tidak mengandung kata terlarang tetap dikirim apa adanya ke browser admin; bisa membocorkan struktur internal (nama kolom yang tidak umum) dan heuristik ini mudah terkecoh oleh pesan berbahasa Indonesia.
Saran: kirim hanya kode error + pesan ramah; detail mentah cukup di log server.

**R-2. Login tidak melindungi cookie secara eksplisit.**
File: `src/lib/supabase/server.ts:38-59` (tidak ada `httpOnly`/`secure`/`sameSite` yang disetel aplikasi; `setAll` menelan error `:51-55`).
Risiko: keamanan cookie sepenuhnya mengikuti default `@supabase/ssr` yang tidak diverifikasi di audit ini; bila suatu saat berubah, aplikasi tidak memberi sinyal apa pun. Kegagalan menulis cookie juga sunyi.
Saran: setel opsi cookie secara eksplisit (httpOnly, secure, sameSite) dan minimal catat error `setAll` ke logger.

**R-3. Status order bisa dibaca siapa pun yang mengetahui UUID.**
File: `src/app/api/orders/[id]/status/route.ts:60-72`.
Risiko: id order dibagikan lewat struk/tautan; siapa pun yang memperoleh atau menebak id bisa melihat nama item, catatan, total, dan alasan pembatalan pesanan orang lain. Sesuai desain dokumen, dengan mitigasi uuid acak + pembatas 60/menit.
Saran: pertimbangkan token status tambahan (mis. kode singkat acak) bila privasi nama pelanggan jadi concern; minimal jaga agar `cancelNote` tidak memuat data pribadi.

**R-4. Route customer tidak punya penjaga peran, sehingga staf ikut lolos.**
File: `src/app/api/orders/route.ts` (POST), `src/app/api/orders/[id]/status/route.ts` (GET), `src/app/api/orders/[id]/cancel/route.ts` (POST).
Risiko: ketidakcocokan dengan `docs/pemissions.md` bagian 2 (Barista tidak boleh membatalkan, staf tidak tercantum untuk buat order). Dampak praktis kecil karena aturan status ditegakkan di fungsi database, tapi aturan peran di dokumen tidak ditegakkan di aplikasi.
Saran: tetapkan apakah staf memang boleh memakai endpoint ini; kalau tidak, tambahkan penjaga atau tandai eksplisit di dokumen. (Sudah dikunci di tes matriks.)

**R-5. `POST /api/reports/today/printed` menerima body tanpa zod.**
File: `src/app/api/reports/today/printed/route.ts:58`.
Risiko: nilai body dipakai apa adanya; saat ini hanya `reportId` yang divalidasi uuid setelahnya, jadi dampaknya kecil, tapi tidak konsisten dengan route lain.
Saran: bungkus body dengan skema zod seperti route printed lainnya.

**R-6. Header `Cache-Control` tidak konsisten antar route.**
File: `src/lib/server/balas.ts` (tidak menyetel header sama sekali) vs `balas-laporan.ts:23`, `balas-log.ts:33,46`, `balas-akun.ts:30,43` (memakai `no-store`).
Risiko: respons `GET /api/cashier/orders` (berisi data pembayaran), `GET /api/barista/queue`, dan `GET /api/menu` tidak membawa `no-store`; browser atau proxy bersama berpotensi menyimpannya secara heuristik.
Saran: jadikan `no-store` default di `balasOk`/`balasGagal`, atau setel per route sensitif.

**R-7. `console.error` bisa mencetak pesan mentah dari database ke log server.**
File: `src/lib/log/index.ts:214,226,238,324,333` (jalur kegagalan menulis log).
Risiko: hanya berdampak bila penulisan log gagal; isi `param.message` bisa memuat pesan mentah. Tidak sampai ke klien, dan sudah lewat redaksi bila melewati `redactSecrets`.
Saran: cetak hanya ringkasan pesan, atau lewatkan `redactSecrets` juga pada pesan ini.

**R-8. Halaman `/admin/menu` dan `/admin/stok` dijaga lewat path induk `/admin`.**
File: `src/app/admin/menu/page.tsx:24`, `src/app/admin/stok/page.tsx:24` (memanggil `wajibPeran("/admin")`).
Risiko: kebetulan tidak berbahaya — hasilnya tetap admin-only — tetapi aturan halaman tidak tercatat per halaman, jadi kalau suatu saat `/admin/menu` dibuka untuk peran lain, perubahan guard-nya tidak terlihat di `HALAMAN_PERAN`/`peranBolehBukaPath` untuk path itu.
Saran: tambahkan path persis `/admin/menu` dan `/admin/stok` ke daftar aturan halaman agar tercatat eksplisit.

---

## Yang sudah baik

1. **Penjaga peran di server, bukan hanya di proxy** — 27 route staf/admin memanggil `jagaPeranStaf`/`jagaPeranAdmin` sebelum menyentuh database (daftar lengkap dengan baris di tabel bagian A; dibuktikan otomatis oleh `src/test/matriks-akses.test.ts`).
2. **Cek `is_active` + peran dari database setiap permintaan** lewat `ambilSesiStaf` (`session.ts:71-93`) — bukan sekadar keberadaan cookie.
3. **Semua id di alamat divalidasi uuid sebelum panggil database** (14/14 route bermen `[id]`).
4. **Daftar nilai tertutup** untuk metode bayar, alasan batal, peran, satuan stok, dan filter log (semua `z.enum`, filter log juga `.strict()`).
5. **Kunci service role tidak pernah menyentuh sisi browser**: modul `server-only`, dan `.next/static` bersih dari `sb_secret`/`service_role`/`SUPABASE_SERVICE_ROLE_KEY` setelah build.
6. **Tidak ada primitif XSS dan tidak ada open redirect**; semua teks pengguna dirender sebagai teks JSX, termasuk tampilan cetak.
7. **Redaksi log konsisten**: `redactSecrets` (6 kata kunci, rekursif) diterapkan di `logError` dan `logActivity`; password tidak pernah dicatat di mana pun.
8. **Respons Barista bebas harga/pembayaran** (select kolom eksplisit + pemetaan ketat).
9. **5 endpoint anonim semuanya punya pembatas permintaan**, dan respons sensitif laporan/log/akun memakai `no-store`.
10. **Dependensi produksi bersih**: `npm audit --omit=dev` → 0 vulnerabilities.
11. **Format error konsisten** `{ ok, error: { type, message, code } }` — pesan database mentah tidak bocor di jalur umum.

---

## Yang tidak diperiksa

- **Isi fungsi database di `supabase/migrations/`** (trigger, GRANT/REVOKE, RLS, aturan di dalam `create_order`/`cancel_order`/dsb.) — laporan ini hanya menelusuri sisi aplikasi. Klaim "aturan ditegakkan di database" mengikuti komentar kode dan dokumen, bukan pembacaan SQL.
- **Nilai default cookie `@supabase/ssr`** (httpOnly/secure/sameSite) — tidak diverifikasi dari sumber paket (temuan R-2).
- **Mitigasi rate limit bawaan Supabase Auth** untuk login (temuan S-1).
- **Perilaku nyatanya browser/proxy bersama terhadap respons tanpa header cache** (temuan R-6) — hanya diperiksa ketiadaan header di kode.
- **Nilai default batas ukuran body Next.js** (S-4) — tidak diverifikasi di sumber Next.js.
- **Konfigurasi keamanan tingkat infrastruktur**: HTTPS/HSTS di hosting, keamanan header (CSP, X-Frame-Options) di tingkat deployment, dan proteksi WAF — di luar repo, jadi tidak diperiksa.
- **Kebenaran fungsional skema seed/migrasi terhadap dokumen data-model** — di luar ruang lingkup audit ini.
