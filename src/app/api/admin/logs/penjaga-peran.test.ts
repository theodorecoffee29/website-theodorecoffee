// Tes untuk kedua endpoint log Admin:
//   - GET /api/admin/logs/activity
//   - GET /api/admin/logs/errors
//
// Yang diuji di sini:
//
//   1. BATAS KEAMANAN. Isi log memuat detail teknis kegagalan dan jejak siapa melakukan
//      apa, jadi hanya Admin yang boleh (docs/pemissions.md bagian 2).
//        - Admin DIIZINKAN.
//        - Cashier, Barista, dan customer (anonim) DITOLAK.
//        - Belum login / akun nonaktif DITOLAK dengan UNAUTHENTICATED.
//        - Kalau ditolak, database TIDAK boleh disentuh sama sekali.
//   2. TIDAK ADA HANDLER SELAIN GET di kedua route. Log hanya bisa ditambah oleh sistem
//      dan tidak pernah diubah atau dihapus (docs/data-model.md aturan 1), jadi tidak
//      boleh ada POST, PUT, PATCH, atau DELETE.
//   3. FILTER TIDAK VALID DITOLAK tanpa menyentuh database dan tanpa menulis
//      error_logs (docs/api-contract.md bagian 6).
//
// Modul @/lib/auth/session, @/lib/supabase/admin, dan @/lib/log dikelompokkan (di-mock)
// supaya tesnya tidak menghubungi database sungguhan. Pola sama dipakai
// src/app/api/reports/penjaga-peran.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Sesi yang dikembalikan modul session. Null berarti tidak ada sesi (anonim / customer).
let sesiSekarang: unknown = null;

// Catatan aktivitas yang ditulis.
const logActivityMock = vi.fn();

// Log error yang ditulis. Dipakai untuk membuktikan filter tidak valid TIDAK dicatat.
const logErrorMock = vi.fn();

// Hasil pemanggilan database. Bawaannya: satu baris aktivitas dan satu baris error.
const barisAktivitasDatabase = {
  id: "11111111-1111-4111-8111-111111111111",
  at: "2026-10-11T09:15:00+07:00",
  actor_id: "22222222-2222-4222-8222-222222222222",
  actor_role: "cashier",
  action: "order.confirmed",
  entity_type: "order",
  entity_id: "33333333-3333-4333-8333-333333333333",
  order_id: "33333333-3333-4333-8333-333333333333",
  before: null,
  after: null,
  meta: null,
};

const barisErrorDatabase = {
  id: "44444444-4444-4444-8444-444444444444",
  at: "2026-10-11T10:00:00+07:00",
  code: "ERR-4F2A",
  severity: "error",
  source: "database",
  message: "Gagal memanggil database",
  context: null,
  user_id: null,
  order_id: null,
};

// Rantai query tiruan.
//
// Setiap metode mengembalikan dirinya sendiri supaya bisa dirangkai seperti pada
// supabase-js. Hasil akhirnya (select / limit) mengembalikan baris yang sudah disiapkan.
let hasilQueryAktivitas: { data: unknown; error: unknown } = {
  data: [barisAktivitasDatabase],
  error: null,
};
let hasilQueryError: { data: unknown; error: unknown } = {
  data: [barisErrorDatabase],
  error: null,
};
let hasilQueryProfiles: { data: unknown; error: unknown } = {
  data: [{ id: "22222222-2222-4222-8222-222222222222", name: "Budi" }],
  error: null,
};

// Penghitung pemanggilan select, supaya tes bisa memastikan database tidak disentuh.
let jumlahPanggilanSelect = 0;

// Kuéry yang sedang dibangun, dicatat supaya tes bisa memeriksa filter yang dikirim.
const orTerpakai: string[] = [];

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => sesiSekarang,
    // wajibPeran ikut di-mock supaya halaman yang mengimpornya tidak gagal saat tes
    // ini mengimpor modul route.
    wajibPeran: async () => {
      throw new Error("wajibPeran tidak dipakai di tes endpoint");
    },
  };
});

vi.mock("@/lib/log", async (importOriginal) => {
  // Modul aslinya dipakai sepenuhnya, kecuali dua fungsi yang menulis log. Yang
  // penting: ACTIVITY_ACTIONS dan redactSecrets harus yang ASLI, karena keduanya
  // dipakai oleh route (validasi nama aksi dan penyaringan rahasia), dan memakai
  // tiruan akan membuat tes ini menguji hal yang berbeda dari yang berjalan sungguhan.
  const asli = await importOriginal<typeof import("@/lib/log")>();

  return {
    ACTIVITY_ACTIONS: asli.ACTIVITY_ACTIONS,
    redactSecrets: asli.redactSecrets,
    logActivity: (param: unknown) => logActivityMock(param),
    logError: (param: unknown) => {
      logErrorMock(param);
      return "ERR-TEST";
    },
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({
      from: (tabel: string) => ({
        // Nama kolom yang dipilih sengaja tidak diterima di sini. Yang perlu diketahui
        // tes hanya tabel mana yang dibaca dan hasilnya apa; nama kolom tidak
        // berpengaruh. JavaScript mengabaikan argumen berlebihan, jadi route tetap
        // bisa memanggil select("id, at, ...") seperti biasa.
        select: () => {
          jumlahPanggilanSelect += 1;

          // Tentukan hasil berdasarkan tabel yang dibaca.
          const hasil =
            tabel === "activity_logs"
              ? hasilQueryAktivitas
              : tabel === "error_logs"
                ? hasilQueryError
                : hasilQueryProfiles;

          const rantai = {
            // Semua metode penyaring hanya menyimpan, lalu mengembalikan dirinya.
            eq: () => rantai,
            gte: () => rantai,
            lte: () => rantai,
            in: () => rantai,
            order: () => rantai,
            or: (syarat: string) => {
              orTerpakai.push(syarat);
              return rantai;
            },
            // Metode terakhir: mengembalikan hasil query.
            limit: () => Promise.resolve(hasil),
            maybeSingle: () => Promise.resolve(hasil),
            then: (
              selesai: (hasil: { data: unknown; error: unknown }) => unknown,
            ) => selesai(hasil),
          };

          return rantai;
        },
      }),
    }),
  };
});

import * as routeAktivitas from "@/app/api/admin/logs/activity/route";
import * as routeError from "@/app/api/admin/logs/errors/route";
import { buatCursor } from "@/lib/server/cursor-log";

// Sesi staf contoh untuk satu peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

/**
 * Membuat request tiruan dengan query string tertentu.
 *
 * Input: teks query string tanpa tanda tanya di depan (boleh kosong).
 * Output: NextRequest tiruan.
 *
 * CATATAN: NextRequest di Next.js selalu punya properti nextUrl (objek URL lengkap
 * dengan searchParams). Request biasa TIDAK punya itu, jadi di sini nextUrl dipasang
 * sendiri. Tanpa itu, route handler yang membaca filter dari query string akan gagal di
 * dalam tes, padahal berjalan benar di server sungguhan.
 */
function requestPalsu(query = ""): NextRequest {
  const alamat = new URL(
    "http://localhost/api/admin/logs/activity" +
      (query === "" ? "" : "?" + query),
  );

  return {
    nextUrl: alamat,
    url: alamat.toString(),
    method: "GET",
  } as unknown as NextRequest;
}

// Dua endpoint dikumpulkan supaya aturan peran yang sama bisa diuji untuk keduanya
// tanpa menulis tes yang sama berulang kali.
const KEDUA_ENDPOINT = [
  {
    nama: "GET /api/admin/logs/activity",
    panggil: (query?: string) => routeAktivitas.GET(requestPalsu(query)),
  },
  {
    nama: "GET /api/admin/logs/errors",
    panggil: (query?: string) => routeError.GET(requestPalsu(query)),
  },
];

describe("penjagaan peran endpoint log", () => {
  beforeEach(() => {
    sesiSekarang = null;
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    jumlahPanggilanSelect = 0;
    orTerpakai.length = 0;
    hasilQueryAktivitas = { data: [barisAktivitasDatabase], error: null };
    hasilQueryError = { data: [barisErrorDatabase], error: null };
    hasilQueryProfiles = {
      data: [{ id: "22222222-2222-4222-8222-222222222222", name: "Budi" }],
      error: null,
    };
  });

  for (const endpoint of KEDUA_ENDPOINT) {
    describe(endpoint.nama, () => {
      it("menolak anonim (customer dan belum login) dengan UNAUTHENTICATED", async () => {
        // Tidak ada sesi sama sekali. Customer memang tidak punya akun
        // (docs/permissions.md bagian 1), jadi ia sampai ke sini seperti orang yang
        // belum login.
        sesiSekarang = null;

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("UNAUTHENTICATED");
        expect(isi.error.code).toBeUndefined();

        // Database TIDAK boleh disentuh sama sekali.
        expect(jumlahPanggilanSelect).toBe(0);

        // Belum login bukan percobaan akses yang tidak rightful, jadi access.denied
        // tidak dicatat.
        expect(logActivityMock).not.toHaveBeenCalled();
      });

      it("menolak Barista dengan FORBIDDEN dan mencatat access.denied", async () => {
        sesiSekarang = sesiContoh("barista");

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("FORBIDDEN");
        expect(jumlahPanggilanSelect).toBe(0);

        // Percobaan akses yang tidak rightful HARUS tercatat.
        expect(logActivityMock).toHaveBeenCalledTimes(1);
        expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
          action: "access.denied",
          entityType: "auth",
        });
      });

      it("menolak Cashier dengan FORBIDDEN dan mencatat access.denied", async () => {
        // Cashier boleh melihat laporan, tapi TIDAK boleh melihat log. Isi log memuat
        // detail teknis kegagalan dan jejak siapa melakukan apa
        // (docs/permissions.md bagian 2).
        sesiSekarang = sesiContoh("cashier");

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("FORBIDDEN");
        expect(jumlahPanggilanSelect).toBe(0);
        expect(logActivityMock).toHaveBeenCalledTimes(1);
      });

      it("mengizinkan Admin", async () => {
        sesiSekarang = sesiContoh("admin");

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(respons.status).toBe(200);
        expect(isi.ok).toBe(true);

        // Membuka log TIDAK dicatat (docs/logging.md bagian 2: aksi yang hanya membaca
        // data tidak dicatat).
        expect(logActivityMock).not.toHaveBeenCalled();
      });
    });
  }
});

describe("penolakan filter tidak valid", () => {
  beforeEach(() => {
    sesiSekarang = sesiContoh("admin");
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    jumlahPanggilanSelect = 0;
    orTerpakai.length = 0;
  });

  it("menolak aksi yang tidak terdaftar tanpa menyentuh database", async () => {
    const respons = await routeAktivitas.GET(
      requestPalsu("action=order.dihapus"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);

    // Penolakan business normal TIDAK dicatat ke error_logs
    // (docs/api-contract.md bagian 6).
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("menolak kode error yang formatnya salah tanpa menyentuh database", async () => {
    const respons = await routeError.GET(requestPalsu("code=4F2A"));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("menolak id order yang bukan uuid", async () => {
    const respons = await routeAktivitas.GET(requestPalsu("orderId=abc"));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
  });

  it("menolak tanggal yang formatnya salah", async () => {
    const respons = await routeError.GET(requestPalsu("from=11/10/2026"));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
  });

  it("menolak tanggal yang tidak ada di kalender", async () => {
    // Formatnya benar (YYYY-MM-DD) tapi 31 Februari tidak ada. Tanpa pemeriksaan ini,
    // filter seperti ini akan mengembalikan daftar kosong dan Admin mengira berarti
    // tidak ada log.
    const respons = await routeAktivitas.GET(requestPalsu("from=2026-02-31"));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
  });

  it("menolak rentang tanggal yang terbalik", async () => {
    const respons = await routeAktivitas.GET(
      requestPalsu("from=2026-10-12&to=2026-10-11"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
  });

  it("menolak nama parameter yang tidak dikenal", async () => {
    // Salah ketik nama filter harus complains, bukan diam-diam diabaikan. Kalau
    // diabaikan, Admin mengira sedang memfilter padahal tidak.
    const respons = await routeAktivitas.GET(
      requestPalsu("acsi=order.created"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(jumlahPanggilanSelect).toBe(0);
  });

  it("menerima parameter yang ada tapi kosong tanpa menolaknya", async () => {
    // "?action=" berarti Admin tidak memilih apa pun. Menolaknya akan membuat Admin
    // melihat pesan kesalahan padahal tidak ada kesalahan.
    const respons = await routeAktivitas.GET(requestPalsu("action="));
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
  });
});

describe("bentuk respons sukses", () => {
  beforeEach(() => {
    sesiSekarang = sesiContoh("admin");
    logActivityMock.mockReset();
    jumlahPanggilanSelect = 0;
    orTerpakai.length = 0;
  });

  it("mengembalikan items dan nextCursor dalam bentuk camelCase", async () => {
    // Di sini query diberi 51 baris supaya server bisa memastikan masih ada halaman
    // berikutnya dan mengirim nextCursor.
    hasilQueryAktivitas = {
      data: Array.from({ length: 51 }, (_satu, posisi) => ({
        ...barisAktivitasDatabase,
        id: "id-" + posisi.toString(),
        at: "2026-10-11T09:15:00+07:00",
      })),
      error: null,
    };

    const respons = await routeAktivitas.GET(requestPalsu());
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(isi.data.items).toHaveLength(50);
    expect(typeof isi.data.nextCursor).toBe("string");

    // Tidak ada satu pun kunci snake_case di respons.
    for (const baris of isi.data.items) {
      for (const kunci of Object.keys(baris)) {
        expect(kunci).not.toContain("_");
      }
    }
  });

  it("mengembalikan nextCursor kosong kalau tidak ada baris lagi", async () => {
    // Kalau barisnya tepat habis, nextCursor harus null supaya tombol "Muat lebih
    // banyak" tidak muncul.
    hasilQueryAktivitas = { data: [barisAktivitasDatabase], error: null };

    const respons = await routeAktivitas.GET(requestPalsu());
    const isi = await respons.json();

    expect(isi.data.nextCursor).toBeNull();
  });

  it("membaca nama pelaku dengan satu query tambahan", async () => {
    // Dua query: satu untuk baris log, satu untuk semua id pelaku di halaman itu.
    // Kalau nama diambil satu per baris, satu halaman 50 baris berarti 50 query.
    const respons = await routeAktivitas.GET(requestPalsu());
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(jumlahSelect()).toBe(2);
    expect(isi.data.items[0].actorName).toBe("Budi");
  });

  it("menggabungkan filter order dengan cursor dalam satu .or()", async () => {
    // Kalau .or() dipanggil dua kali, panggilan kedua mengganti yang pertama dan satu
    // filter hilang tanpa jejak.
    //
    // Cursor di sini dibuat dengan buatCursor yang ASLI, bukan teks sembarang. Cursor
    // yang rusak memang dianggap "tidak ada" (itu perilaku yang benar dan diuji di
    // cursor-log.test.ts), jadi tes ini tidak akan menguji apa-apa kalau isinya
    // sembangan.
    const cursorAsli = buatCursor(
      "2026-10-11T09:00:00+07:00",
      "11111111-1111-4111-8111-111111111111",
    );

    await routeAktivitas.GET(
      requestPalsu(
        "orderId=33333333-3333-4333-8333-333333333333&cursor=" + cursorAsli,
      ),
    );

    expect(orTerpakai).toHaveLength(1);
    expect(orTerpakai[0]).toContain("order_id.eq.");
    expect(orTerpakai[0]).toContain("entity_id.eq.");

    // Arahnya "gt" (lebih besar dari) karena sedang menelusuri satu order, dan
    // urutannya dibalik jadi dari yang paling lama.
    expect(orTerpakai[0]).toContain("at.gt.");
  });

  it("tidak mengirim parameter apa pun saat tidak ada filter", async () => {
    // Tanpa filter dan tanpa jejak order, tidak boleh ada .or() sama sekali.
    await routeAktivitas.GET(requestPalsu());

    expect(orTerpakai).toHaveLength(0);
  });
});

describe("hanya ada handler GET", () => {
  it("tidak mengekspor POST, PUT, PATCH, atau DELETE di kedua route", () => {
    // Log hanya bisa ditambah oleh sistem (helper log) dan tidak pernah diubah atau
    // dihapus (docs/data-model.md aturan 1). Kalau ada handler lain, berarti aplikasi
    // punya jalan untuk menulis atau menghapus log, dan itu dilarang.
    //
    // TypeScript sendiri sudah memberi peringatan kalau handler lain ditulis, karena
    // tipenya tidak ada. Tapi pembacaan lewat daftar ekspor di bawah memastikan
    // pemeriksaan ini tetap berjalan meskipun suatu saat tipenya dibuat longgar.
    const DAFTAR_MODUL = [
      routeAktivitas as Record<string, unknown>,
      routeError as Record<string, unknown>,
    ];

    for (const modul of DAFTAR_MODUL) {
      expect(typeof modul.GET).toBe("function");

      expect(modul.POST).toBeUndefined();
      expect(modul.PUT).toBeUndefined();
      expect(modul.PATCH).toBeUndefined();
      expect(modul.DELETE).toBeUndefined();
    }
  });

  it("tidak mengekspor handler lain di luar daftar HTTP Next.js", () => {
    // Pengaman tambahan: kalau suatu saat ada ekspor tak sengaja (mis. helper yang
    // tidak sengaja diekspor), tes ini akan gagal dan langsung memunculkannya.
    //
    // "dynamic" boleh ada: itu bukan handler, tapi konfigurasi route Next.js yang
    // dipakai supaya halaman ini selalu dibaca dari server, tidak dari cache.
    const YANG_BOLEH_DIEKSPOR = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
      "dynamic",
    ];

    for (const modul of [
      routeAktivitas as Record<string, unknown>,
      routeError as Record<string, unknown>,
    ]) {
      for (const nama of Object.keys(modul)) {
        expect(YANG_BOLEH_DIEKSPOR).toContain(nama);
      }
    }
  });
});

// Fungsi kecil supaya assertion di atas tetap pendek.
//
// CATATAN: variabel yang dipakai fungsi ini dinaikkan lewat beforeEach, jadi nilainya
// selalu yang terakhir diatur.
function jumlahSelect(): number {
  return jumlahPanggilanSelect;
}
