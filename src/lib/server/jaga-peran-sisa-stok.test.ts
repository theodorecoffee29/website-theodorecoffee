// Tes untuk penjagaan peran endpoint GET /api/staff/stock.
//
// Modul @/lib/auth/session dan @/lib/log dikelompokkan (di-mock) supaya tesnya
// tidak menghubungi database sungguhan. Yang diuji adalah aturan siapa yang
// BOLEH memakai endpoint sisa stok.
//
// Aturannya (docs/pemissions.md bagian 2):
//   - Cashier: boleh. Perlu tahu sisa porsi saat dua order bersaing untuk stok
//     terakhir.
//   - Barista: boleh. Perlu tahu sisa bahan saat menyiapkan pesanan.
//   - Admin: boleh.
//   - Belum login (termasuk customer anonim): DITOLAK dengan UNAUTHENTICATED.
//   - Peran lain yang tidak rightful: DITOLAK dengan FORBIDDEN, dan percobaannya
//     dicatat sebagai access.denied (docs/logging.md bagian 2).
//
// Customer sengaja TIDAK termasuk: customer hanya melihat menu Habis atau
// tersedia, tidak boleh melihat angka stok sama sekali.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Tiruan modul session: ambilSesiStaf yang hasilnya bisa diatur per tes.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log: logActivity.
const logActivityMock = vi.fn();

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => ambilSesiStafMock(),
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: (param: unknown) => logActivityMock(param),
  };
});

import { PERAN_SISA_STOK } from "./petakan-stok";
import { jagaPeranStaf } from "./jaga-peran";

// Sesi staf contoh untuk tiap peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

describe("penjaga peran endpoint sisa stok", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
  });

  it("daftar perannya hanya cashier, barista, dan admin", () => {
    expect([...PERAN_SISA_STOK]).toEqual(["cashier", "barista", "admin"]);
  });

  it("menolak anonim dan customer dengan UNAUTHENTICATED", async () => {
    // Tidak ada sesi sama sekali. Ini yang terjadi kalau customer anonim atau
    // orang yang belum login memanggil endpoint ini.
    ambilSesiStafMock.mockReturnValue(null);

    const hasil = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");

    expect(hasil.diizinkan).toBe(false);
    if (!hasil.diizinkan) {
      expect(hasil.tipe).toBe("UNAUTHENTICATED");
    }
    // Belum login bukan percobaan akses yang tidak rightful, jadi access.denied
    // tidak dicatat.
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("mengizinkan cashier", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

    const hasil = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");

    expect(hasil.diizinkan).toBe(true);
    if (hasil.diizinkan) {
      expect(hasil.sesi.role).toBe("cashier");
    }
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("mengizinkan barista", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

    const hasil = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");

    expect(hasil.diizinkan).toBe(true);
    if (hasil.diizinkan) {
      expect(hasil.sesi.role).toBe("barista");
    }
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("mengizinkan admin", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));

    const hasil = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");

    expect(hasil.diizinkan).toBe(true);
    if (hasil.diizinkan) {
      expect(hasil.sesi.role).toBe("admin");
    }
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("menolak peran di luar daftar dengan FORBIDDEN dan mencatat access.denied", async () => {
    // Sesi dengan peran yang tidak ada di daftar. Untuk endpoint sisa stok ini
    // daftar sudah berisi semua peran staf, jadi kasus ini adalah pengaman
    // kalau suatu saat daftar-nya dikurangi.
    ambilSesiStafMock.mockReturnValue({
      userId: "user-lain",
      name: "Uji Lain",
      role: "peran_lain",
      sessionId: "sess-lain",
    });

    const hasil = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");

    expect(hasil.diizinkan).toBe(false);
    if (!hasil.diizinkan) {
      expect(hasil.tipe).toBe("FORBIDDEN");
    }
    // Percobaan akses tidak rightful HARUS tercatat (docs/logging.md bagian 2).
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    expect(logActivityMock.mock.calls[0]?.[0]).toMatchObject({
      action: "access.denied",
    });
  });
});
