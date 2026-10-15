// Tes untuk penjagaan peran keempat endpoint laporan.
//
// Yang diuji di sini adalah BATAS KEAMANAN, karena laporan berisi omzet:
//   - Cashier dan Admin DIIZINKAN (Cashier untuk mencetak di booth, Admin untuk
//     semua kebutuhan),
//   - Barista DITOLAK (FORBIDDEN) dan access.denied dicatat,
//   - anonim / customer DITOLAK (UNAUTHENTICATED),
//   - kalau ditolak, database TIDAK boleh disentuh sama sekali.
//
// Modul @/lib/auth/session dan @/lib/supabase/admin dikelompokkan (di-mock)
// supaya tesnya tidak menghubungi database sungguhan.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Tiruan modul session: ambilSesiStaf yang hasilnya bisa kita atur per tes.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log: logActivity dipakai penjaga peran dan endpoint printed.
const logActivityMock = vi.fn();

// Tiruan klien admin. from, rpc, dan select dicatat supaya tes bisa memastikan
// database TIDAK disentuh saat permintaan ditolak.
const rpcMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();

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
        // nama fungsi lewat mockImplementation.
        rpc: (namaFungsi: string, argumen: unknown) =>
          rpcMock(namaFungsi, argumen),
        // Rantai from().select().eq().maybeSingle() untuk pengecekan laporan.
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
    logError: () => "ERR-TEST",
  };
});

import { GET as getLaporanHariIni } from "@/app/api/reports/today/route";
import { GET as getDaftarLaporan } from "@/app/api/reports/route";
import { GET as getIsiLaporan } from "@/app/api/reports/[id]/route";
import { POST as postLaporanDicetak } from "@/app/api/reports/[id]/printed/route";

// Sesi staf contoh untuk tiap peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

// Request tiruan. Route laporan tidak memakai cookies maupun nextUrl, jadi
// Request biasa cukup.
function requestPalsu(): NextRequest {
  return new Request("http://localhost/api/reports") as NextRequest;
}

// Parameter alamat tiruan untuk route [id].
function paramsPalsu(id: string) {
  return { params: Promise.resolve({ id: id }) };
}

// Id laporan yang sah (uuid) untuk tes.
const ID_LAPORAN = "66666666-6666-4666-8666-666666666666";

// Keempat endpoint dikumpulkan supaya aturan peran yang sama bisa diuji untuk
// semuanya tanpa menulis tes yang sama berulang kali.
//
// tulisLogKalauDiizinkan: true kalau endpoint itu memang seharusnya menulis
// log aktivitas kalau perannya benar. Endpoint printed menulis log
// report.printed, jadi
// assertion "tidak ada log" hanya berlaku untuk endpoint lain.
const KEEMPAT_ENDPOINT = [
  {
    nama: "GET /api/reports/today",
    panggil: () => getLaporanHariIni(requestPalsu()),
    tulisLogKalauDiizinkan: false,
  },
  {
    nama: "GET /api/reports",
    panggil: () => getDaftarLaporan(requestPalsu()),
    tulisLogKalauDiizinkan: false,
  },
  {
    nama: "GET /api/reports/[id]",
    panggil: () => getIsiLaporan(requestPalsu(), paramsPalsu(ID_LAPORAN)),
    tulisLogKalauDiizinkan: false,
  },
  {
    nama: "POST /api/reports/[id]/printed",
    panggil: () => postLaporanDicetak(requestPalsu(), paramsPalsu(ID_LAPORAN)),
    tulisLogKalauDiizinkan: true,
  },
];

describe("penjagaan peran endpoint laporan", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    // Hasil rpc bawaan: objek kosong yang cukup untuk lolos penjagaan peran.
    rpcMock.mockResolvedValue({ data: {}, error: null });
  });

  for (const endpoint of KEEMPAT_ENDPOINT) {
    describe(endpoint.nama, () => {
      it("menolak anonim dengan UNAUTHENTICATED tanpa menyentuh database", async () => {
        // Tidak ada sesi sama sekali: inilah yang terjadi kalau customer
        // anonim atau orang yang belum login memanggil endpoint ini.
        ambilSesiStafMock.mockReturnValue(null);

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("UNAUTHENTICATED");
        // Database tidak boleh disentuh sama sekali.
        expect(rpcMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
        expect(selectMock).not.toHaveBeenCalled();
        // Belum login bukan percobaan akses yang tidak rightful.
        expect(logActivityMock).not.toHaveBeenCalled();
      });

      it("menolak Barista dengan FORBIDDEN dan mencatat access.denied", async () => {
        // Laporan berisi omzet. Barista tidak boleh membukanya
        // (docs/pemissions.md bagian 2).
        ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

        const respons = await endpoint.panggil();
        const isi = await respons.json();

        expect(isi.ok).toBe(false);
        expect(isi.error.type).toBe("FORBIDDEN");
        // Database tidak boleh disentuh: peran salah harus ditolak lebih dulu.
        expect(rpcMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
        expect(selectMock).not.toHaveBeenCalled();
        // Percobaan akses tidak rightful HARUS tercatat.
        expect(logActivityMock).toHaveBeenCalledTimes(1);
        expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
          action: "access.denied",
          entityType: "auth",
        });
      });

      it("mengizinkan Cashier", async () => {
        ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

        const respons = await endpoint.panggil();

        expect(respons.status).toBe(200);

        // Endpoint yang hanya membaca tidak boleh menulis log. Endpoint printed
        // justru harus menulis log report.printed, jadi tidak diperiksa di sini.
        if (!endpoint.tulisLogKalauDiizinkan) {
          expect(logActivityMock).not.toHaveBeenCalled();
        }
      });

      it("mengizinkan Admin", async () => {
        ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));

        const respons = await endpoint.panggil();

        expect(respons.status).toBe(200);
      });
    });
  }
});

describe("penjagaan peran: sesi akun nonaktif", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
  });

  it("menolak dengan UNAUTHENTICATED saat profil tidak ditemukan", async () => {
    // ambilSesiStaf mengembalikan null kalau akunnya nonaktif atau profilnya
    // belum ada. Jadi penolakannya sama dengan belum login, dan database pun
    // tidak disentuh.
    ambilSesiStafMock.mockReturnValue(null);

    const respons = await getLaporanHariIni(requestPalsu());
    const isi = await respons.json();

    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("UNAUTHENTICATED");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
