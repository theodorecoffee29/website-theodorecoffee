// Tes untuk keempat route kelola akun:
//   - GET  /api/admin/accounts
//   - POST /api/admin/accounts
//   - PATCH /api/admin/accounts/[id]
//   - POST /api/admin/accounts/[id]/active
//   - POST /api/admin/accounts/[id]/password
//
// Yang diuji:
//
//   1. BATAS KEAMANAN. Hanya Admin yang boleh (docs/permissions.md bagian 2). Anonim,
//      Cashier, dan Barista DITOLAK, dan percobaan Cashier dan Barista dicatat sebagai
//      access.denied. Admin DIIZINKAN. Kalau ditolak, database TIDAK boleh disentuh.
//   2. PENJAGAAN AKUN ADMIN DAN AKUN SENDIRI. Akun admin (termasuk akun Admin sendiri)
//      tidak boleh diubah, dinonaktifkan, atau di-reset passwordnya.
//   3. URUTAN DUA LANGKAH. Menonaktifkan: profil DULU, baru Auth. Mengaktifkan: Auth
//      dulu, baru profil. Urutan ini menentukan apakah akun selalu dalam keadaan aman.
//   4. PEMBATALAN PEMBUATAN AKUN. Kalau pengisian profiles gagal, pengguna Auth yang baru
//      dibuat harus dihapus (kalau tidak, email-nya terkunci).
//   5. PASSWORD TIDAK PERNAH BOCOR. Ditemukan dengan password uji yang khas, lalu dicari
//      di SEMUA keluaran: respons, log aktivitas, dan log error.
//   6. EMAIL SUDAH DIPAKAI. Ditolak dengan VALIDATION_FAILED dan pesan ramah.
//
// Modul @/lib/auth/session, @/lib/supabase/admin, dan @/lib/log dikelompokkan (di-mock)
// supaya tesnya tidak menghubungi database atau Supabase Auth sungguhan. Pola sama
// dipakai src/app/api/admin/logs/penjaga-peran.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Password uji yang KHAS. Nilainya dipakai untuk memastikan password tidak bocor ke
// mana pun. Sengaja memakai bentuk yang tidak mungkin muncul sendiri di kode.
const PASSWORD_UJI = "Zz9Qq7Ww5Rr3";

// Catatan aktivitas dan error yang ditulis.
const logActivityMock = vi.fn();
const logErrorMock = vi.fn();

// Urutan kejadian, dipakai untuk memeriksa urutan dua langkah.
const urutanPanggilan: string[] = [];

// Hasil pemanggilan yang bisa diubah per tes.
type HasilKemungkinan = { data: unknown; error: unknown };

let hasilBuatUser: HasilKemungkinan = { data: null, error: null };
let hasilInsertProfil: HasilKemungkinan = { data: null, error: null };
let hasilUpdateProfil: HasilKemungkinan = { data: null, error: null };
// Hasil membaca profiles untuk DAFTAR (dipakai GET): berupa array.
let hasilDaftarProfil: HasilKemungkinan = { data: [], error: null };
// Hasil membaca profiles untuk SATU akun (dipakai route [id]): berupa satu objek.
let hasilSatuProfil: HasilKemungkinan = { data: null, error: null };
let hasilUpdateAuth: HasilKemungkinan = { data: null, error: null };
let hasilHapusAuth: HasilKemungkinan = { data: null, error: null };
let hasilListAuth: HasilKemungkinan = { data: null, error: null };
let hasilAmbilUser: HasilKemungkinan = { data: null, error: null };

// Sesi yang dikembalikan modul session. Null berarti tidak ada sesi (anonim).
let sesiSekarang: unknown = null;

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => sesiSekarang,
    wajibPeran: async () => {
      throw new Error("wajibPeran tidak dipakai di tes endpoint");
    },
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: (param: unknown) => logActivityMock(param),
    logError: (param: unknown) => {
      logErrorMock(param);
      return "ERR-TEST";
    },
    // redactSecrets dipakai oleh modul log asli; yang di sini cuma tiruan supaya tes
    // tidak memuat environment. Pengujian penyaringan rahasia dilakukan di
    // src/lib/log/index.test.ts dan src/lib/server/petakan-akun.test.ts.
    redactSecrets: (data: unknown) => data,
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({
      from: () => ({
        select: () => {
          // Flag ini membedakan dua bentuk pembacaan tabel profiles:
          //   - dengan .eq() -> membaca SATU akun (dipakai route [id]),
          //   - tanpa .eq() -> membaca DAFTAR akun (dipakai GET).
          // Tanpa pembedaan ini, hasil daftar akan terbaca sebagai satu baris, dan
          // tesnya memeriksa data yang salah.
          let membacaSatu = false;

          const rantai = {
            eq: () => {
              membacaSatu = true;
              return rantai;
            },
            maybeSingle: async () => hasilSatuProfil,
            then: (selesai: (hasil: HasilKemungkinan) => unknown) =>
              selesai(membacaSatu ? hasilSatuProfil : hasilDaftarProfil),
          };
          return rantai;
        },
        insert: async () => {
          urutanPanggilan.push("profiles.insert");
          return hasilInsertProfil;
        },
        update: (data: unknown) => {
          urutanPanggilan.push("profiles.update:" + JSON.stringify(data));
          const rantai = {
            eq: async () => hasilUpdateProfil,
          };
          return rantai;
        },
      }),
      auth: {
        admin: {
          createUser: async (attributes: Record<string, unknown>) => {
            urutanPanggilan.push("auth.createUser");

            // Bentuk data user yang dikembalikan Supabase.
            return hasilBuatUser.data === null && hasilBuatUser.error === null
              ? {
                  data: {
                    user: {
                      id: "55555555-5555-4555-8555-555555555555",
                      email: String(attributes.email),
                      created_at: "2026-10-19T02:00:00Z",
                    },
                  },
                  error: null,
                }
              : hasilBuatUser;
          },
          deleteUser: async () => {
            urutanPanggilan.push("auth.deleteUser");
            return hasilHapusAuth;
          },
          updateUserById: async (
            _id: string,
            attributes: Record<string, unknown>,
          ) => {
            // Nama atribut dicatat TANPA nilainya, supaya urutan tes tidak pernah menulis
            // password uji ke memorie tes.
            urutanPanggilan.push(
              "auth.updateUserById:" + Object.keys(attributes).join(","),
            );
            return hasilUpdateAuth;
          },
          listUsers: async () => {
            urutanPanggilan.push("auth.listUsers");
            return hasilListAuth;
          },
          getUserById: async () => {
            urutanPanggilan.push("auth.getUserById");
            return hasilAmbilUser;
          },
        },
      },
    }),
  };
});

import * as routeDaftar from "@/app/api/admin/accounts/route";
import * as routeUbah from "@/app/api/admin/accounts/[id]/route";
import * as routeStatus from "@/app/api/admin/accounts/[id]/active/route";
import * as routePassword from "@/app/api/admin/accounts/[id]/password/route";

// Id akun contoh (bukan uuid yang dipakai akun Admin, supaya tidak tertukar).
const ID_CASHIER = "11111111-1111-4111-8111-111111111111";
const ID_BARISTA = "22222222-2222-4222-8222-222222222222";
const ID_ADMIN = "99999999-9999-4999-8999-999999999999";

// Sesi staf contoh untuk satu peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: ID_ADMIN,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

/**
 * Membuat request tiruan dengan body tertentu.
 *
 * Input: body yang akan dikirim (boleh undefined kalau tidak ada body).
 * Output: NextRequest tiruan.
 *
 * CATATAN: NextRequest di Next.js selalu punya nextUrl. Request biasa tidak punya itu,
 * jadi di sini dipasang sendiri.
 */
function requestPalsu(body?: unknown): NextRequest {
  const alamat = new URL("http://localhost/api/admin/accounts");

  return {
    nextUrl: alamat,
    url: alamat.toString(),
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          json: async () => body,
        }),
  } as unknown as NextRequest;
}

/**
 * Membuat parameter alamat tiruan untuk route [id].
 *
 * Input: id akun.
 * Output: objek params (dalam Promise, sama seperti Next.js 15).
 */
function paramsPalsu(id: string) {
  return { params: Promise.resolve({ id: id }) };
}

/**
 * Mengembalikan seluruh nilai yang muncul di dalam satu nilai apa pun, sebagai satu
 * teks panjang.
 *
 * Ini alat untuk mencari apakah password uji bocor di mana saja (respons, log, atau
 * apa pun). Fungsinya menelusuri objek dan array sampai ke nilai paling dalam.
 */
function seluruhNilai(julai: unknown): string {
  if (julai === null || julai === undefined) {
    return "";
  }

  if (typeof julai === "string") {
    return julai;
  }

  if (typeof julai === "number" || typeof tipeBoolean(julai)) {
    return String(julai);
  }

  if (Array.isArray(julai)) {
    return julai.map(seluruhNilai).join(" | ");
  }

  if (typeof julai === "object") {
    return Object.entries(julai as Record<string, unknown>)
      .map(([kunci, isi]) => kunci + "=" + seluruhNilai(isi))
      .join(" | ");
  }

  return String(julai);
}

// Fungsi kecil agar baris di atas tetap pendek.
function tipeBoolean(nilai: unknown): boolean {
  return typeof nilai === "boolean";
}

// ---------------------------------------------------------------------------

// Daftar seluruh route, supaya aturan peran yang sama bisa diuji untuk semuanya.
const SEMUA_ROUTE = [
  {
    nama: "GET /api/admin/accounts",
    panggil: () => routeDaftar.GET(),
  },
  {
    nama: "POST /api/admin/accounts",
    panggil: () =>
      routeDaftar.POST(
        requestPalsu({
          name: "Budi",
          email: "budi@contoh.com",
          role: "cashier",
          password: PASSWORD_UJI,
        }),
      ),
  },
  {
    nama: "PATCH /api/admin/accounts/[id]",
    panggil: () =>
      routeUbah.PATCH(
        requestPalsu({ name: "Budi", role: "barista" }),
        paramsPalsu(ID_CASHIER),
      ),
  },
  {
    nama: "POST /api/admin/accounts/[id]/active",
    panggil: () =>
      routeStatus.POST(
        requestPalsu({ isActive: false }),
        paramsPalsu(ID_CASHIER),
      ),
  },
  {
    nama: "POST /api/admin/accounts/[id]/password",
    panggil: () =>
      routePassword.POST(
        requestPalsu({ password: PASSWORD_UJI }),
        paramsPalsu(ID_CASHIER),
      ),
  },
];

/**
 * Mengembalikan keadaan bawaan yang membuat semua operasi berhasil.
 *
 * Dipakai tiap kali beforeEach berjalan, supaya tes tidak saling memengaruhi.
 */
function setelKeadaanSah(): void {
  urutanPanggilan.length = 0;
  hasilBuatUser = { data: null, error: null };
  hasilInsertProfil = { data: null, error: null };
  hasilUpdateProfil = { data: null, error: null };
  // Daftar profiles untuk endpoint GET. Bentuknya ARRAY (bukan satu objek), karena
  // GET membaca semua akun sekaligus.
  hasilDaftarProfil = {
    data: [{ id: ID_CASHIER, name: "Budi", role: "cashier", is_active: true }],
    error: null,
  };
  // Satu akun Cashier aktif, yang jadi sasaran semua route ubah.
  hasilSatuProfil = {
    data: {
      id: ID_CASHIER,
      name: "Budi",
      role: "cashier",
      is_active: true,
    },
    error: null,
  };
  hasilUpdateAuth = { data: { user: { id: ID_CASHIER } }, error: null };
  hasilHapusAuth = { data: { user: { id: ID_CASHIER } }, error: null };
  hasilListAuth = {
    data: { users: [{ id: ID_CASHIER, email: "budi@contoh.com" }], total: 1 },
    error: null,
  };
  hasilAmbilUser = {
    data: {
      user: {
        id: ID_CASHIER,
        email: "budi@contoh.com",
        created_at: "2026-10-01T02:00:00Z",
        last_sign_in_at: "2026-10-11T09:00:00Z",
      },
    },
    error: null,
  };
}

describe("penjagaan peran endpoint akun", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = null;
  });

  for (const route of SEMUA_ROUTE) {
    describe(route.nama, () => {
      it("menolak anonim (belum login dan customer) dengan UNAUTHENTICATED", async () => {
        // Customer tidak punya akun sama sekali (docs/permissions.md bagian 1), jadi ia
        // sampai ke sini seperti orang yang belum login.
        sesiSekarang = null;

        const respons = await route.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("UNAUTHENTICATED");
        expect(isi.error.code).toBeUndefined();

        // Database dan Auth TIDAK boleh disentuh sama sekali.
        expect(urutanPanggilan).toEqual([]);
        expect(logActivityMock).not.toHaveBeenCalled();
      });

      it("menolak Cashier dengan FORBIDDEN dan mencatat access.denied", async () => {
        sesiSekarang = sesiContoh("cashier");

        const respons = await route.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("FORBIDDEN");
        expect(urutanPanggilan).toEqual([]);

        // Percobaan akses yang tidak rightful HARUS tercatat.
        expect(logActivityMock).toHaveBeenCalledTimes(1);
        expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
          action: "access.denied",
          entityType: "auth",
        });
      });

      it("menolak Barista dengan FORBIDDEN dan mencatat access.denied", async () => {
        sesiSekarang = sesiContoh("barista");

        const respons = await route.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("FORBIDDEN");
        expect(urutanPanggilan).toEqual([]);
        expect(logActivityMock).toHaveBeenCalledTimes(1);
      });

      it("mengizinkan Admin", async () => {
        sesiSekarang = sesiContoh("admin");

        const respons = await route.panggil();

        // 200 untuk pembacaan dan perubahan, 201 untuk pembuatan sumber daya baru.
        // Dua-duanya berarti berhasil.
        expect([200, 201]).toContain(respons.status);

        const isi = await respons.json();
        expect(isi.ok).toBe(true);
      });
    });
  }
});

describe("daftar akun", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = sesiContoh("admin");
  });

  it("membaca daftar Auth dengan SATU permintaan", async () => {
    // Satu permintaan daftar, bukan satu per akun. Kalau per akun, daftar dengan 10 akun
    // berarti 10 permintaan jaringan.
    hasilListAuth = {
      data: {
        users: [
          { id: ID_CASHIER, email: "budi@contoh.com" },
          { id: ID_BARISTA, email: "sari@contoh.com" },
          { id: ID_ADMIN, email: "admin@contoh.com" },
        ],
        total: 3,
      },
      error: null,
    };

    await routeDaftar.GET();

    const panggilanAuth = urutanPanggilan.filter((satu) =>
      satu.startsWith("auth.listUsers"),
    );

    expect(panggilanAuth).toHaveLength(1);
  });

  it("mengembalikan akun admin di dalam daftar", async () => {
    // Admin ikut ditampilkan supaya Admin tahu akun mana yang aktif. Yang membatasi
    // perubahan ada di endpoint ubah, bukan di daftar.
    hasilDaftarProfil = {
      data: [
        { id: ID_CASHIER, name: "Budi", role: "cashier", is_active: true },
        { id: ID_ADMIN, name: "Admin", role: "admin", is_active: true },
      ],
      error: null,
    };
    hasilListAuth = {
      data: {
        users: [
          { id: ID_CASHIER, email: "budi@contoh.com" },
          { id: ID_ADMIN, email: "admin@contoh.com" },
        ],
        total: 2,
      },
      error: null,
    };

    const respons = await routeDaftar.GET();
    const isi = await respons.json();

    const idAkun = isi.data.accounts.map((satu: { id: string }) => satu.id);

    expect(idAkun).toContain(ID_ADMIN);
  });

  it("TIDAK memuat password di respons", async () => {
    const respons = await routeDaftar.GET();
    const isi = await respons.json();

    expect(seluruhNilai(isi)).not.toContain(PASSWORD_UJI);
  });

  it("mencatat peringatan kalau ada akun yang tidak berpasangan", async () => {
    // Ada profil tapi tidak ada baris di Auth. Ini warning (kejadian tidak normal tapi
    // aplikasi tetap jalan), bukan error.
    hasilDaftarProfil = {
      data: [
        { id: ID_CASHIER, name: "Budi", role: "cashier", is_active: true },
      ],
      error: null,
    };
    hasilListAuth = { data: { users: [], total: 0 }, error: null };

    const respons = await routeDaftar.GET();
    const isi = await respons.json();

    // Daftar tetap dikirim (Admin tetap punya daftar yang bisa dipakai).
    expect(isi.ok).toBe(true);

    // Dan administrators diberi tahu lewat warning.
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock.mock.calls[0]?.[0]).toMatchObject({
      severity: "warning",
    });
  });

  it("TIDAK mencatat peringatan kalau semua akun berpasangan", async () => {
    await routeDaftar.GET();

    expect(logErrorMock).not.toHaveBeenCalled();
  });
});

describe("buat akun", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = sesiContoh("admin");
  });

  it("membuat pengguna Auth dengan email terkonfirmasi dan mengisi profiles", async () => {
    await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );

    // Urutannya harus Auth dulu, baru profiles: tanpa id dari Auth, profiles tidak
    // bisa diisi (id-nya sama dengan id auth.users).
    expect(urutanPanggilan[0]).toBe("auth.createUser");
    expect(urutanPanggilan[1]).toBe("profiles.insert");
  });

  it("mencatat account.created setelah berhasil", async () => {
    await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );

    expect(logActivityMock).toHaveBeenCalledTimes(1);

    const catatan = logActivityMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;

    expect(catatan.action).toBe("account.created");
    expect(catatan.entityType).toBe("account");
    // before dan after hanya boleh berisi nama, peran, email, dan status aktif.
    expect(Object.keys((catatan.after as object) ?? {})).toEqual([
      "name",
      "role",
      "email",
      "isActive",
    ]);
  });

  it("TIDAK pernah mengirim atau mencatat password", async () => {
    // Ini pengaman terpenting dari tugas ini: password uji yang khas dicari di SEMUA
    // keluaran, yaitu respons, log aktivitas, dan log error.
    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );

    const isiRespons = await respons.json();

    expect(seluruhNilai(isiRespons)).not.toContain(PASSWORD_UJI);
    expect(seluruhNilai(logActivityMock.mock.calls)).not.toContain(
      PASSWORD_UJI,
    );
    expect(seluruhNilai(logErrorMock.mock.calls)).not.toContain(PASSWORD_UJI);
  });

  it("menghapus pengguna Auth yang baru dibuat kalau pengisian profiles gagal", async () => {
    // Tanpa penghapusan, email itu sudah tercatat di Auth sementara di aplikasi tidak
    // ada akunnya, dan email-nya jadi terkunci.
    hasilInsertProfil = {
      data: null,
      error: { message: "gagal insert", code: "23505" },
    };

    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );

    // Pengguna HARUS dihapus.
    expect(urutanPanggilan).toContain("auth.deleteUser");

    // Dan kegagalannya harus dicatat serta dikembalikan sebagai INTERNAL_ERROR dengan
    // kode ERR-xxxx.
    expect(logErrorMock).toHaveBeenCalled();

    const isi = await respons.json();
    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("INTERNAL_ERROR");
    expect(isi.error.message).toContain("ERR-TEST");
  });

  it("mencatat kegagalan yang lebih serius kalau penghapusan juga gagal", async () => {
    // Ini kasus terburuk: email terkunci dan Admin perlu tahu.
    hasilInsertProfil = { data: null, error: { message: "gagal insert" } };
    hasilHapusAuth = { data: null, error: { message: "gagal hapus" } };

    await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );

    const catatan = logErrorMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;

    expect(catatan.severity).toBe("critical");
    // Password tidak boleh ikut di sini juga.
    expect(seluruhNilai(logErrorMock.mock.calls)).not.toContain(PASSWORD_UJI);
  });

  it("menolak email yang sudah dipakai dengan pesan ramah", async () => {
    // Email yang sudah dipakai dikenali dari KODE error Auth ("email_exists"), bukan dari
    // kalimat pesannya, supaya tidak rapuh kalau Supabase mengubah kalimatnya.
    hasilBuatUser = {
      data: null,
      error: {
        message: "A user with this email address has already been registered",
        status: 422,
        code: "email_exists",
      },
    };

    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(isi.error.message).toContain("sudah dipakai");

    // Penolakan bisnis normal TIDAK dicatat ke error_logs (docs/api-contract.md bagian 6).
    expect(logErrorMock).not.toHaveBeenCalled();
    // Dan tidak jadi profil nyasar pun.
    expect(urutanPanggilan).not.toContain("profiles.insert");
  });

  it("menolak peran admin", async () => {
    // Halaman ini tidak boleh bisa membuat akun admin.
    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "admin",
        password: PASSWORD_UJI,
      }),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(urutanPanggilan).toEqual([]);
  });

  it("menolak password yang tidak memenuhi aturan sebelum menghubungi Auth", async () => {
    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: "pendek",
      }),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    // Password yang ditolak tidak boleh sampai ke Supabase.
    expect(urutanPanggilan).toEqual([]);
  });

  it("mencatat kegagalan sistem dengan kode ERR-xxxx dan tidak membocorkan kunci", async () => {
    // Kasus kunci server ditolak. Tindakan yang benar: laporkan, jangan memutar.
    hasilBuatUser = {
      data: null,
      error: {
        message: "Invalid API key",
        status: 401,
        code: "invalid_api_key",
      },
    };

    const respons = await routeDaftar.POST(
      requestPalsu({
        name: "Budi",
        email: "budi@contoh.com",
        role: "cashier",
        password: PASSWORD_UJI,
      }),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("INTERNAL_ERROR");

    // Dicatat sebagai critical, karena seluruh fitur yang memakai Admin API akan gagal.
    const catatan = logErrorMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(catatan.severity).toBe("critical");

    // Dan tidak ada reaksi lain: tidak ada permintaan kedua yang mencoba jalan lain.
    expect(urutanPanggilan.filter((satu) => satu.startsWith("auth."))).toEqual([
      "auth.createUser",
    ]);
  });
});

describe("perlindungan akun admin dan akun sendiri", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = sesiContoh("admin");
  });

  it("menolak perubahan akun admin lain dengan FORBIDDEN", async () => {
    // Akun admin lain tidak boleh disentuh dari halaman ini.
    hasilSatuProfil = {
      data: {
        id: "88888888-8888-4888-8888-888888888888",
        name: "Admin lain",
        role: "admin",
        is_active: true,
      },
      error: null,
    };

    const respons = await routeUbah.PATCH(
      requestPalsu({ name: "Mau diubah", role: "cashier" }),
      paramsPalsu("88888888-8888-4888-8888-888888888888"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");

    // TIDAK boleh ada update yang terjadi.
    expect(urutanPanggilan).not.toContain("profiles.update:{}");
    expect(
      urutanPanggilan.some((satu) => satu.startsWith("profiles.update")),
    ).toBe(false);
  });

  it("menolak perubahan akun Admin sendiri dengan FORBIDDEN", async () => {
    // Admin yang sedang login tidak boleh mengubah akunnya sendiri dari sini. Kalau
    // boleh, dia bisa mengunci dirinya sendiri tanpa ada yang bisa membukanya lagi dari
    // aplikasi.
    hasilSatuProfil = {
      data: { id: ID_ADMIN, name: "Admin", role: "admin", is_active: true },
      error: null,
    };

    const respons = await routeUbah.PATCH(
      requestPalsu({ name: "Ganti nama", role: "cashier" }),
      paramsPalsu(ID_ADMIN),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");
    expect(
      urutanPanggilan.some((satu) => satu.startsWith("profiles.update")),
    ).toBe(false);
  });

  it("menolak menonaktifkan akun admin", async () => {
    hasilSatuProfil = {
      data: { id: ID_ADMIN, name: "Admin", role: "admin", is_active: true },
      error: null,
    };

    const respons = await routeStatus.POST(
      requestPalsu({ isActive: false }),
      paramsPalsu(ID_ADMIN),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");
  });

  it("menolak reset password akun admin", async () => {
    hasilSatuProfil = {
      data: { id: ID_ADMIN, name: "Admin", role: "admin", is_active: true },
      error: null,
    };

    const respons = await routePassword.POST(
      requestPalsu({ password: PASSWORD_UJI }),
      paramsPalsu(ID_ADMIN),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");
    // Auth tidak boleh dihubungi sama sekali.
    expect(
      urutanPanggilan.some((satu) => satu.startsWith("auth.updateUserById")),
    ).toBe(false);
  });

  it("menjawab akun tidak ditemukan tanpa mencatat error", async () => {
    // Id uuid yang benar tapi tidak ada: penolakan normal, bukan kegagalan sistem.
    hasilSatuProfil = { data: null, error: null };

    const respons = await routeUbah.PATCH(
      requestPalsu({ name: "Budi", role: "cashier" }),
      paramsPalsu("33333333-3333-4333-8333-333333333333"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(isi.error.message).toContain("tidak ditemukan");
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("menolak id yang bukan uuid tanpa menyentuh database", async () => {
    const respons = await routeUbah.PATCH(
      requestPalsu({ name: "Budi", role: "cashier" }),
      paramsPalsu("bukan-uuid"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(urutanPanggilan).toEqual([]);
  });
});

describe("urutan dua langkah mengubah status aktif", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = sesiContoh("admin");
  });

  it("menonaktifkan: profil DULU, baru Auth", async () => {
    // Urutan ini menentukan keamanan. Pemeriksaan is_active berjalan di setiap halaman
    // dan setiap permintaan, jadi begitu profil nonaktif, orang itu langsung kehilangan
    // akses walau langkah Auth belum jalan.
    await routeStatus.POST(
      requestPalsu({ isActive: false }),
      paramsPalsu(ID_CASHIER),
    );

    const posisiProfil = urutanPanggilan.findIndex((satu) =>
      satu.startsWith("profiles.update"),
    );
    const posisiAuth = urutanPanggilan.findIndex((satu) =>
      satu.startsWith("auth.updateUserById"),
    );

    expect(posisiProfil).toBeGreaterThanOrEqual(0);
    expect(posisiAuth).toBeGreaterThanOrEqual(0);
    expect(posisiProfil).toBeLessThan(posisiAuth);

    // Dan ban di Auth memakai durasi yang sangat panjang.
    expect(urutanPanggilan[posisiAuth]).toBe(
      "auth.updateUserById:ban_duration",
    );
  });

  it("mengaktifkan: Auth DULU (cabut ban), baru profil", async () => {
    // Urutannya berbalik, dan alasannya sama: mencabut ban tidak memberi akses apa pun
    // selama profilnya masih nonaktif, jadi langkah itu aman kalau langkah berikutnya
    // gagal.
    hasilSatuProfil = {
      data: { id: ID_CASHIER, name: "Budi", role: "cashier", is_active: false },
      error: null,
    };

    await routeStatus.POST(
      requestPalsu({ isActive: true }),
      paramsPalsu(ID_CASHIER),
    );

    const posisiAuth = urutanPanggilan.findIndex((satu) =>
      satu.startsWith("auth.updateUserById"),
    );
    const posisiProfil = urutanPanggilan.findIndex((satu) =>
      satu.startsWith("profiles.update"),
    );

    expect(posisiAuth).toBeGreaterThanOrEqual(0);
    expect(posisiAuth).toBeLessThan(posisiProfil);
  });

  it("mencatat account.deactivated setelah berhasil menonaktifkan", async () => {
    await routeStatus.POST(
      requestPalsu({ isActive: false }),
      paramsPalsu(ID_CASHIER),
    );

    const catatan = logActivityMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;

    expect(catatan.action).toBe("account.deactivated");
    // after menandai status aktif berubah menjadi false.
    expect((catatan.after as { isActive: boolean }).isActive).toBe(false);
  });

  it("menjelaskan keadaan kalau profil sudah nonaktif tapi Auth gagal", async () => {
    // Keadaan setengah jadi: aplikasi sudah menolak akunnya, tapi ban di Auth belum
    // aktif. Pesannya harus jujur soal itu, supaya Admin tahu akun belum aman
    // sepenuhnya.
    hasilUpdateAuth = {
      data: null,
      error: {
        message: "gagal update",
        status: 500,
        code: "unexpected_failure",
      },
    };

    const respons = await routeStatus.POST(
      requestPalsu({ isActive: false }),
      paramsPalsu(ID_CASHIER),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("INTERNAL_ERROR");
    expect(isi.error.message).toContain("di aplikasi");
    expect(isi.error.message).toContain("Auth");

    // Kegagalan harus tercatat, dan activity.deactivated TIDAK boleh ditulis (akun belum
    // benar-benar nonaktif).
    expect(logErrorMock).toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("menjelaskan keadaan kalau ban sudah tercabut tapi profil gagal diaktifkan", async () => {
    // Kebalikan dari kasus di atas.
    hasilSatuProfil = {
      data: { id: ID_CASHIER, name: "Budi", role: "cashier", is_active: false },
      error: null,
    };
    hasilUpdateProfil = { data: null, error: { message: "gagal update" } };

    const respons = await routeStatus.POST(
      requestPalsu({ isActive: true }),
      paramsPalsu(ID_CASHIER),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.message).toContain("belum aktif di aplikasi");
  });
});

describe("reset password", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    setelKeadaanSah();
    sesiSekarang = sesiContoh("admin");
  });

  it("menyetel password lewat Auth dan mencatat account.password_reset", async () => {
    const respons = await routePassword.POST(
      requestPalsu({ password: PASSWORD_UJI }),
      paramsPalsu(ID_CASHIER),
    );

    // Endpoint ini mengembalikan hanya id akun, dan suksesnya berarti status 200.
    expect(respons.status).toBe(200);

    // Password diteruskan ke Supabase Auth lewat updateUserById (nilai atributnya
    // sengaja tidak ikut dicatat di urutanPanggilan).
    expect(urutanPanggilan).toContain("auth.updateUserById:password");

    const catatan = logActivityMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;

    expect(catatan.action).toBe("account.password_reset");
  });

  it("TIDAK pernah mengirim atau mencatat password", async () => {
    const respons = await routePassword.POST(
      requestPalsu({ password: PASSWORD_UJI }),
      paramsPalsu(ID_CASHIER),
    );

    const isiRespons = await respons.json();

    // Dicari di respons, log aktivitas, dan log error.
    expect(seluruhNilai(isiRespons)).not.toContain(PASSWORD_UJI);
    expect(seluruhNilai(logActivityMock.mock.calls)).not.toContain(
      PASSWORD_UJI,
    );
    expect(seluruhNilai(logErrorMock.mock.calls)).not.toContain(PASSWORD_UJI);
  });

  it("TIDAK mencatat password di before maupun after", async () => {
    // before dan after sengaja dibuat sama (ringkasan akun tanpa password), jadi dari
    // log orang tidak bisa melihat apa password barunya.
    await routePassword.POST(
      requestPalsu({ password: PASSWORD_UJI }),
      paramsPalsu(ID_CASHIER),
    );

    const catatan = logActivityMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;

    expect(Object.keys((catatan.before as object) ?? {})).toEqual([
      "name",
      "role",
      "email",
      "isActive",
    ]);
    expect(catatan.before).toEqual(catatan.after);
  });

  it("menolak password yang tidak memenuhi aturan", async () => {
    const respons = await routePassword.POST(
      requestPalsu({ password: "pendek" }),
      paramsPalsu(ID_CASHIER),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(urutanPanggilan).toEqual([]);
  });
});
