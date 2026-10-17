// Tes untuk endpoint POST /api/reports/today/printed.
//
// Endpoint ini dipakai tombol Cetak di bagian "Hari ini" halaman Laporan. Yang
// diuji di sini:
//
//   1. BATAS KEAMANAN. Laporan berisi omzet, jadi hanya Cashier dan Admin yang
//      boleh. Anonim dan customer DITOLAK dengan UNAUTHENTICATED, Barista DITOLAK
//      dengan FORBIDDEN dan percobaannya dicatat sebagai access.denied.
//   2. KEGAGALAN LOG TIDAK BOLEH MENGGAGALKAN PENCETAKAN. Endpoint ini hanya menulis
//      satu catatan log; kalau penulisan log gagal, jawabannya tetap sukses dengan
//      logged: false (docs/logging.md bagian 6 poin 4).
//   3. ISI CATATAN. entity_type "report", entity_id kosong (null), dan meta memuat
//      tanggal laporan serta live: true.
//
// Modul @/lib/auth/session dan @/lib/log dikelompokkan (di-mock) supaya tesnya tidak
// menghubungi database sungguhan. Pola sama dipakai
// src/app/api/reports/penjaga-peran.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Catatan aktivitas yang ditulis, supaya tes bisa memeriksa isinya.
const logActivityMock = vi.fn();

// Log error yang ditulis saat pencatatan gagal.
const logErrorMock = vi.fn();

// Hasil pemanggilan logActivity. Bawaannya berhasil.
let logActivityMelempar: Error | null = null;

// Sesi staf yang dikembalikan modul session. Null berarti tidak ada sesi.
let sesiSekarang: unknown = null;

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => sesiSekarang,
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: (param: unknown) => {
      // Tiruan ini melempar error kalau disuruh begitu, supaya tes bisa memeriksa
      // bahwa kegagalan pencatatan tidak membuat endpoint membalas error.
      if (logActivityMelempar !== null) {
        throw logActivityMelempar;
      }
      logActivityMock(param);
    },
    logError: (param: unknown) => {
      logErrorMock(param);
      return "ERR-TEST";
    },
  };
});

import { POST } from "@/app/api/reports/today/printed/route";

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
 * Membuat request tiruan yang body-nya sudah ditentukan.
 *
 * Input: body yang akan dikirim (boleh undefined kalau body tidak ada).
 * Output: NextRequest tiruan.
 */
function requestPalsu(body?: unknown): NextRequest {
  return new Request("http://localhost/api/reports/today/printed", {
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  }) as NextRequest;
}

describe("POST /api/reports/today/printed", () => {
  beforeEach(() => {
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    logActivityMelempar = null;
    sesiSekarang = null;
  });

  it("menolak anonim dengan UNAUTHENTICATED dan tidak menulis log", async () => {
    // Tidak ada sesi sama sekali. Ini yang terjadi kalau customer anonim atau
    // orang yang belum login memanggil endpoint ini.
    sesiSekarang = null;

    const respons = await POST(requestPalsu({ tanggal: "2026-10-11" }));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("UNAUTHENTICATED");
    // Percobaan tidak rightful (dan tidak punya akun) tidak dicatat sebagai
    // access.denied, dan report.printed tentu tidak ditulis.
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("menolak Barista dengan FORBIDDEN dan mencatat access.denied", async () => {
    // Laporan berisi omzet. Barista tidak boleh membukanya
    // (docs/pemissions.md bagian 2).
    sesiSekarang = sesiContoh("barista");

    const respons = await POST(requestPalsu({ tanggal: "2026-10-11" }));
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");
    // Percobaan akses yang tidak rightful HARUS tercatat.
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
      action: "access.denied",
      entityType: "auth",
    });
  });

  it("mengizinkan Cashier", async () => {
    sesiSekarang = sesiContoh("cashier");

    const respons = await POST(requestPalsu({ tanggal: "2026-10-11" }));

    expect(respons.status).toBe(200);

    const isi = await respons.json();
    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(true);
  });

  it("mengizinkan Admin", async () => {
    sesiSekarang = sesiContoh("admin");

    const respons = await POST(requestPalsu({ tanggal: "2026-10-11" }));
    const isi = await respons.json();

    expect(respons.status).toBe(200);
    expect(isi.data.logged).toBe(true);
  });

  it("mencatat report.printed dengan entity_id kosong dan meta tanggal plus live", async () => {
    sesiSekarang = sesiContoh("cashier");

    await POST(requestPalsu({ tanggal: "2026-10-11" }));

    expect(logActivityMock).toHaveBeenCalledTimes(1);

    const catatan = logActivityMock.mock.calls[0]?.[0] as {
      action: string;
      entityType: string;
      entityId: string | null;
      meta: Record<string, unknown>;
    };

    // Nama aksi harus salah satu dari daftar di docs/logging.md bagian 2.
    expect(catatan.action).toBe("report.printed");
    expect(catatan.entityType).toBe("report");

    // entity_id kosong (null, bukan string kosong) karena laporan hari ini belum
    // tersimpan, jadi tidak ada baris daily_reports yang bisa ditunjuk. Kolomnya
    // bertipe uuid, jadi string kosong akan ditolak.
    expect(catatan.entityId).toBeNull();

    // Meta memuat tanggal laporan dan tanda bahwa ini laporan live.
    expect(catatan.meta.live).toBe(true);
    expect(catatan.meta.date).toBe("2026-10-11");
    // Id sesi/perangkat ikut supaya Admin tahu laporan ini diambil dari mana.
    expect(catatan.meta.session_id).toBe("sess-cashier");
  });

  it("tetap berhasil kalau pencatatan lognya gagal", async () => {
    // Ini aturan paling penting dari endpoint ini: pencetakan di layar Cashier
    // sudah berjalan begitu window.print() dipanggil, jadi kegagalan menulis log
    // tidak boleh mengubah hasilnya menjadi error (docs/logging.md bagian 6 poin 4).
    sesiSekarang = sesiContoh("cashier");
    logActivityMelempar = new Error("koneksi database putus");

    const respons = await POST(requestPalsu({ tanggal: "2026-10-11" }));
    const isi = await respons.json();

    // Respons tetap sukses, hanya menandai bahwa jejaknya tidak tercatat.
    expect(respons.status).toBe(200);
    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(false);

    // Dan kegagalan itu sendiri harus dilaporkan supaya Admin tahu ada laporan
    // yang dicetak tapi jejaknya hilang.
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("tetap berhasil kalau body tidak dikirim sama sekali", async () => {
    // Tanggal di body cuma pelengkap log. Laporan yang dicetak tetap harus
    // dicatat walau tanggalnya tidak ikut terkirim: jejaknya tetap ada.
    sesiSekarang = sesiContoh("cashier");

    const respons = await POST(requestPalsu());
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(true);

    const catatan = logActivityMock.mock.calls[0]?.[0] as {
      meta: Record<string, unknown>;
    };

    // Tidak ada tanggal, tapi tanda live tetap ada.
    expect(catatan.meta.live).toBe(true);
    expect(catatan.meta.date).toBeUndefined();
  });

  it("tetap berhasil kalau body-nya bukan JSON", async () => {
    sesiSekarang = sesiContoh("cashier");

    const requestRusak = new Request(
      "http://localhost/api/reports/today/printed",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "ini bukan JSON",
      },
    ) as NextRequest;

    const respons = await POST(requestRusak);
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(true);
  });

  it("memotong tanggal yang terlalu panjang", async () => {
    // Batas panjang supaya body yang sangat besar tidak bisa dipakai membanjiri
    // log.
    sesiSekarang = sesiContoh("cashier");

    await POST(requestPalsu({ tanggal: "2026-10-11".repeat(20) }));

    const catatan = logActivityMock.mock.calls[0]?.[0] as {
      meta: Record<string, unknown>;
    };

    expect(String(catatan.meta.date).length).toBeLessThanOrEqual(10);
  });
});
