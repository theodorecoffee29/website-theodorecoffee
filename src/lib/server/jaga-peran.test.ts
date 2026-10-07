// Tes untuk src/lib/server/jaga-peran.ts.
//
// Modul @/lib/auth/session dan @/lib/log dikelompokkan (di-mock) supaya tesnya
// tidak menghubungi database sungguhan. Kita menguji logika penjagaan:
//   - belum login -> UNAUTHENTICATED,
//   - peran salah -> FORBIDDEN + access.denied dicatat,
//   - peran benar -> diizinkan dan sesi dikembalikan.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Tiruan modul session: ambilSesiStaf yang bisa kita atur hasilnya per tes.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log: logActivity dan metaSesi (yang di sini hanya logActivity).
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

import { jagaPeranStaf, metaSesi } from "./jaga-peran";

// Sesi staf contoh untuk tiap peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

describe("jagaPeranStaf", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
  });

  it("menolak dengan UNAUTHENTICATED saat belum login", async () => {
    ambilSesiStafMock.mockReturnValue(null);

    const hasil = await jagaPeranStaf(["cashier", "admin"], "konfirmasi");

    expect(hasil.diizinkan).toBe(false);
    if (!hasil.diizinkan) {
      expect(hasil.tipe).toBe("UNAUTHENTICATED");
    }
    // Tidak ada access.denied saat tidak login (itu hanya untuk peran salah).
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("mengizinkan Cashier memakai endpoint Cashier", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

    const hasil = await jagaPeranStaf(["cashier", "admin"], "konfirmasi");

    expect(hasil.diizinkan).toBe(true);
    if (hasil.diizinkan) {
      expect(hasil.sesi.role).toBe("cashier");
      expect(hasil.sesi.userId).toBe("user-cashier");
    }
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("mengizinkan Admin memakai endpoint Cashier (cadangan)", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));

    const hasil = await jagaPeranStaf(["cashier", "admin"], "konfirmasi");

    expect(hasil.diizinkan).toBe(true);
  });

  it("menolak Cashier memakai endpoint Barista dan mencatat access.denied", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

    const hasil = await jagaPeranStaf(["barista"], "mulai order");

    expect(hasil.diizinkan).toBe(false);
    if (!hasil.diizinkan) {
      expect(hasil.tipe).toBe("FORBIDDEN");
    }
    // access.denied harus dicatat.
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    const param = logActivityMock.mock.calls[0][0];
    expect(param.action).toBe("access.denied");
    expect(param.actorRole).toBe("cashier");
    expect(param.actorId).toBe("user-cashier");
  });

  it("menolak Barista memakai endpoint Cashier", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

    const hasil = await jagaPeranStaf(["cashier", "admin"], "konfirmasi");

    expect(hasil.diizinkan).toBe(false);
    if (!hasil.diizinkan) {
      expect(hasil.tipe).toBe("FORBIDDEN");
    }
  });

  it("menolak Cashier dan Barista memakai endpoint Admin", async () => {
    for (const role of ["cashier", "barista"] as const) {
      ambilSesiStafMock.mockReturnValue(sesiContoh(role));

      const hasil = await jagaPeranStaf(["admin"], "kelola menu");

      expect(hasil.diizinkan).toBe(false);
      if (!hasil.diizinkan) {
        expect(hasil.tipe).toBe("FORBIDDEN");
      }
    }
  });

  it("hanya mengizinkan Barista memakai endpoint Barista", async () => {
    // Barista boleh.
    ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));
    expect((await jagaPeranStaf(["barista"], "antrean")).diizinkan).toBe(true);

    // Cashier dan Admin tidak boleh.
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));
    expect((await jagaPeranStaf(["barista"], "antrean")).diizinkan).toBe(false);

    ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));
    expect((await jagaPeranStaf(["barista"], "antrean")).diizinkan).toBe(false);
  });
});

describe("metaSesi", () => {
  it("menyertakan session_id kalau tersedia", () => {
    const meta = metaSesi(sesiContoh("cashier"));
    expect(meta).toEqual({ session_id: "sess-cashier" });
  });

  it("mengembalikan objek kosong kalau session_id tidak ada", () => {
    const sesiTanpaSession = { ...sesiContoh("barista"), sessionId: null };
    expect(metaSesi(sesiTanpaSession)).toEqual({});
  });
});
