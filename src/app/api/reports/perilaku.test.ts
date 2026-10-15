// Tes untuk perilaku endpoint laporan di luar penjagaan peran.
//
// Yang diuji:
//   1. GET /api/reports tetap mengembalikan daftar walau save_missing_reports
//      gagal, dengan catchUpFailed: true.
//   2. POST /api/reports/[id]/printed mengembalikan logged: false saat penulisan
//      log gagal, dan TIDAK melempar error.
//   3. Semua respons laporan memakai header Cache-Control: no-store.
//   4. Id laporan yang bukan uuid ditolak tanpa menyentuh database.
//
// Modul @/lib/auth/session, @/lib/supabase/admin, dan @/lib/log dikelompokkan
// (di-mock) supaya tesnya tidak menghubungi database sungguhan.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Tiruan modul session.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log.
const logActivityMock = vi.fn();
const logErrorMock = vi.fn();

// Tiruan klien admin. Hasil rpc per nama fungsi bisa diatur per tes.
const rpcMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();

// Hasil bawaan dari list_reports: daftar Riwayat berisi satu hari.
function hasilListReports() {
  return {
    data: {
      reports: [
        {
          reportId: "22222222-2222-4222-8222-222222222222",
          date: "2026-10-10",
          generatedAt: "2026-10-11T00:05:00+07:00",
          totals: { orderCount: "10", sales: "40000" },
        },
      ],
    },
    error: null,
  };
}

// Hasil rpc bawaan, dipasang ulang di setiap blok beforeEach.
function pasangRpcBawaan() {
  rpcMock.mockImplementation((namaFungsi: string) => {
    if (namaFungsi === "save_missing_reports") {
      return Promise.resolve({ data: { savedCount: 0 }, error: null });
    }
    return Promise.resolve(hasilListReports());
  });
}

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => ambilSesiStafMock(),
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => {
      return {
        // Nilai balik diambil dari rpcMock, jadi tes bisa mengatur hasil tiap
        // nama fungsi lewat mockImplementation tanpa mengubah mock modul ini.
        rpc: (namaFungsi: string, argumen: unknown) =>
          rpcMock(namaFungsi, argumen),
        from: (tabel: string) => {
          fromMock(tabel);
          return {
            select: (kolom: string) => {
              selectMock(kolom);
              return {
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { id: "ada" }, error: null }),
                }),
              };
            },
          };
        },
      };
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
  };
});

import { GET as getDaftarLaporan } from "./route";
import { GET as getLaporanHariIni } from "./today/route";
import { GET as getIsiLaporan } from "./[id]/route";
import { POST as postLaporanDicetak } from "./[id]/printed/route";

// Sesi Cashier aktif untuk semua tes di file ini.
function sesiCashier() {
  return {
    userId: "user-cashier",
    name: "Uji Cashier",
    role: "cashier",
    sessionId: "sess-cashier",
  };
}

function requestPalsu(url: string): NextRequest {
  return new Request("http://localhost" + url) as NextRequest;
}

function paramsPalsu(id: string) {
  return { params: Promise.resolve({ id: id }) };
}

const ID_LAPORAN = "66666666-6666-4666-8666-666666666666";

describe("GET /api/reports: catch-up laporan yang lewat", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    pasangRpcBawaan();
    ambilSesiStafMock.mockReturnValue(sesiCashier());
  });

  it("memanggil save_missing_reports DULUAN, baru list_reports", async () => {
    await getDaftarLaporan(requestPalsu("/api/reports"));

    // Urutannya penting: kalau list_reports dipanggil lebih dulu, daftar yang
    // dikembalikan belum memuat hari yang baru diselamatkan.
    const urutan = rpcMock.mock.calls.map((panggilan) => panggilan[0]);
    expect(urutan).toEqual(["save_missing_reports", "list_reports"]);
  });

  it("mengembalikan daftar dan jumlah hari yang baru disimpan", async () => {
    // Tiruan bawaan mengembalikan savedCount 0.
    const respons = await getDaftarLaporan(requestPalsu("/api/reports"));
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(isi.data.reports).toHaveLength(1);
    expect(isi.data.reports[0].date).toBe("2026-10-10");
    // totals ikut diubah ke angka.
    expect(isi.data.reports[0].totals).toEqual({
      orderCount: 10,
      sales: 40000,
    });
    expect(isi.data.catchUpSaved).toBe(0);
    // Tidak ada masalah, jadi catchUpFailed tidak ikut dikirim.
    expect(isi.data.catchUpFailed).toBeUndefined();
  });

  it("TETAP mengembalikan daftar dengan catchUpFailed saat save_missing_reports gagal", async () => {
    // Ini perilaku yang diminta: kegagalan catch-up tidak boleh menggagalkan
    // seluruh permintaan, karena daftar Riwayat yang bisa dibaca tetap berguna.
    rpcMock.mockImplementation((namaFungsi: string) => {
      if (namaFungsi === "save_missing_reports") {
        return Promise.resolve({
          data: null,
          error: { message: "kegagalan database", code: "XX000" },
        });
      }
      return Promise.resolve({
        data: {
          reports: [
            {
              reportId: "22222222-2222-4222-8222-222222222222",
              date: "2026-10-10",
              generatedAt: "2026-10-11T00:05:00+07:00",
              totals: { orderCount: "10", sales: "40000" },
            },
          ],
        },
        error: null,
      });
    });

    const respons = await getDaftarLaporan(requestPalsu("/api/reports"));
    const isi = await respons.json();

    // Respons tetap sukses...
    expect(respons.status).toBe(200);
    expect(isi.ok).toBe(true);
    // ...daftar tetap ada...
    expect(isi.data.reports).toHaveLength(1);
    // ...dan layar diberi tahu bahwa daftar ini mungkin belum lengkap.
    expect(isi.data.catchUpFailed).toBe(true);
    // Tidak ada hari yang dipastikan tersimpan.
    expect(isi.data.catchUpSaved).toBe(0);
  });

  it("mencatat kegagalan catch-up lewat logError", async () => {
    rpcMock.mockImplementation((namaFungsi: string) => {
      if (namaFungsi === "save_missing_reports") {
        return Promise.resolve({
          data: null,
          error: { message: "kegagalan database" },
        });
      }
      return Promise.resolve({ data: { reports: [] }, error: null });
    });

    await getDaftarLaporan(requestPalsu("/api/reports"));

    // Kegagalan ini harus kelihatan oleh Admin di error_logs.
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock.mock.calls[0]?.[0]).toMatchObject({
      severity: "error",
      source: "database",
    });
  });

  it("membaca savedCount yang datang sebagai teks", async () => {
    // jsonb dari PostgREST kadang mengirim angka sebagai teks.
    rpcMock.mockImplementation((namaFungsi: string) => {
      if (namaFungsi === "save_missing_reports") {
        return Promise.resolve({
          data: { savedCount: "3" },
          error: null,
        });
      }
      return Promise.resolve({ data: { reports: [] }, error: null });
    });

    const respons = await getDaftarLaporan(requestPalsu("/api/reports"));
    const isi = await respons.json();

    expect(isi.data.catchUpSaved).toBe(3);
  });
});

describe("POST /api/reports/[id]/printed: kegagalan menulis log", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    pasangRpcBawaan();
    ambilSesiStafMock.mockReturnValue(sesiCashier());
  });

  it("mencatat report.printed dan membalas logged true saat berhasil", async () => {
    const respons = await postLaporanDicetak(
      requestPalsu("/api/reports/" + ID_LAPORAN + "/printed"),
      paramsPalsu(ID_LAPORAN),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(true);

    // Isi log harus sesuai docs/logging.md bagian 2 dan docs/data-model.md:
    // aksi report.printed, entity_type report, entity_id id laporan.
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
      action: "report.printed",
      actorRole: "cashier",
      actorId: "user-cashier",
      entityType: "report",
      entityId: ID_LAPORAN,
    });
  });

  it("membalas logged false dan TIDAK melempar error saat penulisan log gagal", async () => {
    // Ini aturan dari docs/logging.md bagian 6 poin 4: kegagalan menulis log
    // tidak boleh membuat aksi utama gagal. Untuk endpoint ini, aksi utamanya
    // adalah mencetak laporan.
    logActivityMock.mockImplementation(() => {
      throw new Error("koneksi ke database terputus");
    });

    const respons = await postLaporanDicetak(
      requestPalsu("/api/reports/" + ID_LAPORAN + "/printed"),
      paramsPalsu(ID_LAPORAN),
    );
    const isi = await respons.json();

    // Respons tetap SUKSES (bukan 500), hanya isinya logged: false.
    expect(respons.status).toBe(200);
    expect(isi.ok).toBe(true);
    expect(isi.data.logged).toBe(false);
    // Dan kegagalannya dicatat supaya Admin tahu jejaknya hilang.
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("validasi id laporan", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    pasangRpcBawaan();
    ambilSesiStafMock.mockReturnValue(sesiCashier());
  });

  it("menolak id yang bukan uuid tanpa menyentuh database dan tanpa error_logs", async () => {
    const respons = await getIsiLaporan(
      requestPalsu("/api/reports/bukan-uuid"),
      paramsPalsu("bukan-uuid"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(isi.error.message).toContain("tidak ditemukan");
    // Id yang bukan uuid tidak mungkin ada, jadi database tidak boleh disentuh.
    expect(rpcMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
    // Dan ini bukan kegagalan sistem, jadi tidak dicatat ke error_logs.
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("menolak id yang bukan uuid untuk endpoint printed juga", async () => {
    const respons = await postLaporanDicetak(
      requestPalsu("/api/reports/bukan-uuid/printed"),
      paramsPalsu("bukan-uuid"),
    );
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("VALIDATION_FAILED");
    expect(selectMock).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("memeriksa laporan ada dengan satu query ke daftar laporan", async () => {
    await postLaporanDicetak(
      requestPalsu("/api/reports/" + ID_LAPORAN + "/printed"),
      paramsPalsu(ID_LAPORAN),
    );

    // Satu query suffices: id yang sah tidak berarti laporannya ada.
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock.mock.calls[0]?.[0]).toBe("id");
  });
});

describe("header Cache-Control laporan", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    logErrorMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    pasangRpcBawaan();
    ambilSesiStafMock.mockReturnValue(sesiCashier());
  });

  it("respons sukses memakai no-store", async () => {
    // Laporan hari ini berubah terus-menerus. Kalau responsnya tersimpan di
    // cache, Cashier bisa melihat angka penjualan yang sudah lama.
    const hariIni = await getLaporanHariIni(requestPalsu("/api/reports/today"));
    const daftar = await getDaftarLaporan(requestPalsu("/api/reports"));
    const isi = await getIsiLaporan(
      requestPalsu("/api/reports/" + ID_LAPORAN),
      paramsPalsu(ID_LAPORAN),
    );
    const dicetak = await postLaporanDicetak(
      requestPalsu("/api/reports/" + ID_LAPORAN + "/printed"),
      paramsPalsu(ID_LAPORAN),
    );

    for (const respons of [hariIni, daftar, isi, dicetak]) {
      expect(respons.headers.get("Cache-Control")).toContain("no-store");
    }
  });

  it("respons gagal juga memakai no-store", async () => {
    // termasuk penolakan validasi dan penolakan peran
    const validasi = await getIsiLaporan(
      requestPalsu("/api/reports/bukan-uuid"),
      paramsPalsu("bukan-uuid"),
    );

    ambilSesiStafMock.mockReturnValue(null);
    const peran = await getLaporanHariIni(requestPalsu("/api/reports/today"));

    expect(validasi.headers.get("Cache-Control")).toContain("no-store");
    expect(peran.headers.get("Cache-Control")).toContain("no-store");
  });
});
