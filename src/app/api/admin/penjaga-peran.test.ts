// Tes penjaga peran untuk SEMUA endpoint Admin (/api/admin/...).
//
// Yang diuji: hanya admin yang boleh memakai endpoint ini.
//   - anonim (belum login)  -> 401 UNAUTHENTICATED
//   - cashier                -> 403 FORBIDDEN + access.denied dicatat
//   - barista                -> 403 FORBIDDEN + access.denied dicatat
//   - admin                  -> boleh lewat, lalu memanggil database
//
// Modul @/lib/auth/session, @/lib/supabase/admin, dan @/lib/log di-mock supaya
// tesnya tidak menghubungi database sungguhan.
//
// PENTING: diuji juga bahwa database TIDAK disentuh saat permintaan ditolak.
// Kalau tidak, orang yang tidak berhak bisa membebani database.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Tiruan modul session: ambilSesiStaf yang hasilnya bisa diatur per tes.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log: logActivity (untuk access.denied) dan logError.
const logActivityMock = vi.fn();
// logError mengembalikan kode error "ERR-xxxx". Argumennya tidak dipakai di
// sini karena yang diperiksa hanyalah apakah logError dipanggil atau tidak.
const logErrorMock = vi.fn((): string => "ERR-TEST");

// Penghitung pemanggilan database (rpc dan select) supaya bisa dibuktikan bahwa
// database tidak disentuh saat ditolak.
const rpcMock = vi.fn((): Promise<{ data: unknown; error: unknown }> => {
  return Promise.resolve({ data: {}, error: null });
});
// Tiruan rantai query Supabase (from -> select -> eq -> order -> order -> limit).
//
// Semua method mengembalikan objek BERENDAKI SENDIRI, sehingga bisa dirangkai
// sesuka hati dan urutan memanggilnya tidak penting. Rantai diakhiri saat
// method dijalankan: dari, select, eq, dan order mengembalikan rantai lagi;
// limit mengembalikan Promise hasil (sudah boleh di-chain paling akhir).
type RantaiTiruan = {
  select: () => RantaiTiruan;
  eq: () => RantaiTiruan;
  order: () => RantaiTiruan;
  limit: () => Promise<{ data: unknown[]; error: unknown }>;
  then: (onDone: (hasil: unknown) => unknown) => unknown;
};

function buatRantaiTiruan(): RantaiTiruan {
  const rantai: RantaiTiruan = {
    select: () => rantai,
    eq: () => rantai,
    order: () => rantai,
    limit: () => Promise.resolve({ data: [], error: null }),
    // Rantai yang di-await langsung (tanpa method terakhir) juga boleh:
    // hasilnya kosong, supaya tidak error kalau bentuk rantainya berbeda.
    then: (onDone: (hasil: unknown) => unknown) =>
      onDone({ data: [], error: null }),
  };
  return rantai;
}

const fromMock = vi.fn((): RantaiTiruan => buatRantaiTiruan());

vi.mock("@/lib/auth/session", () => {
  return { ambilSesiStaf: () => ambilSesiStafMock() };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({
      rpc: (nama: string, argumen: unknown) => {
        rpcMock();
        void nama;
        void argumen;
        return rpcMock();
      },
      from: (tabel: string) => {
        void tabel;
        return fromMock();
      },
    }),
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: (param: unknown) => logActivityMock(param),
    logError: () => logErrorMock(),
  };
});

import { GET as GET_MENU, POST as POST_MENU } from "./menu/route";
import { PATCH as PATCH_MENU } from "./menu/[id]/route";
import { POST as POST_AKTIF } from "./menu/[id]/active/route";
import { PUT as PUT_RESEP } from "./menu/[id]/recipe/route";
import { GET as GET_BAHAN, POST as POST_BAHAN } from "./ingredients/route";
import { PATCH as PATCH_BAHAN } from "./ingredients/[id]/route";
import { POST as POST_RESTOCK } from "./ingredients/[id]/restock/route";
import { POST as POST_ADJUST } from "./ingredients/[id]/adjust/route";
import { GET as GET_MOVEMENTS } from "./ingredients/[id]/movements/route";

// Sesi staf contoh untuk tiap peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

// UUID valid untuk id di alamat.
const UUID = "11111111-1111-4111-8111-111111111111";

// Objek tiruan untuk request. Route di sini hanya memakai request.json().
const requestPalsu = (body: unknown = {}) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

// Parameter alamat untuk route yang punya [id].
const paramsId = Promise.resolve({ id: UUID });

// Daftar SEMUA endpoint Admin beserta cara memanggilnya.
// dipakai supaya pengujian dilakukan untuk semua endpoint tanpa menulis ulang.
const SEMUA_ENDPOINT: {
  nama: string;
  panggil: () => Promise<Response>;
}[] = [
  { nama: "GET /api/admin/menu", panggil: () => GET_MENU(requestPalsu()) },
  {
    nama: "POST /api/admin/menu",
    panggil: () => POST_MENU(requestPalsu({ name: "Kopi Susu", price: 22000 })),
  },
  {
    nama: "PATCH /api/admin/menu/[id]",
    panggil: () =>
      PATCH_MENU(requestPalsu({ name: "Kopi Susu", price: 22000 }), {
        params: paramsId,
      }),
  },
  {
    nama: "POST /api/admin/menu/[id]/active",
    panggil: () =>
      POST_AKTIF(requestPalsu({ isActive: false }), { params: paramsId }),
  },
  {
    nama: "PUT /api/admin/menu/[id]/recipe",
    panggil: () => PUT_RESEP(requestPalsu({ lines: [] }), { params: paramsId }),
  },
  {
    nama: "GET /api/admin/ingredients",
    panggil: () => GET_BAHAN(requestPalsu()),
  },
  {
    nama: "POST /api/admin/ingredients",
    panggil: () => POST_BAHAN(requestPalsu({ name: "Susu", unit: "ml" })),
  },
  {
    nama: "PATCH /api/admin/ingredients/[id]",
    panggil: () =>
      PATCH_BAHAN(requestPalsu({ name: "Susu UHT" }), { params: paramsId }),
  },
  {
    nama: "POST /api/admin/ingredients/[id]/restock",
    panggil: () =>
      POST_RESTOCK(requestPalsu({ qty: 1000 }), { params: paramsId }),
  },
  {
    nama: "POST /api/admin/ingredients/[id]/adjust",
    panggil: () =>
      POST_ADJUST(requestPalsu({ newQty: 500, reason: "Hitung ulang" }), {
        params: paramsId,
      }),
  },
  {
    nama: "GET /api/admin/ingredients/[id]/movements",
    panggil: () => GET_MOVEMENTS(requestPalsu(), { params: paramsId }),
  },
];

describe("penjaga peran endpoint Admin", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockClear();
    fromMock.mockClear();
  });

  it("menerima 11 endpoint (sesuai tugas 5.2)", () => {
    expect(SEMUA_ENDPOINT).toHaveLength(11);
  });

  // --- anonim -------------------------------------------------------------
  for (const endpoint of SEMUA_ENDPOINT) {
    it(`menolak ${endpoint.nama} untuk anonim (belum login)`, async () => {
      ambilSesiStafMock.mockReturnValue(null);

      const respons = await endpoint.panggil();

      expect(respons.status).toBe(401);
      const isi = await respons.json();
      expect(isi.error.type).toBe("UNAUTHENTICATED");

      // Database tidak boleh disentuh.
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });
  }

  // --- cashier -------------------------------------------------------------
  for (const endpoint of SEMUA_ENDPOINT) {
    it(`menolak ${endpoint.nama} untuk cashier`, async () => {
      ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

      const respons = await endpoint.panggil();

      expect(respons.status).toBe(403);
      const isi = await respons.json();
      expect(isi.error.type).toBe("FORBIDDEN");

      // Akses yang ditolak harus tercatat (docs/logging.md bagian 2).
      expect(logActivityMock).toHaveBeenCalledTimes(1);
      const catatan = logActivityMock.mock.calls[0][0];
      expect(catatan.action).toBe("access.denied");
      expect(catatan.actorRole).toBe("cashier");

      // Database tidak boleh disentuh.
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });
  }

  // --- barista -------------------------------------------------------------
  for (const endpoint of SEMUA_ENDPOINT) {
    it(`menolak ${endpoint.nama} untuk barista`, async () => {
      ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

      const respons = await endpoint.panggil();

      expect(respons.status).toBe(403);
      const isi = await respons.json();
      expect(isi.error.type).toBe("FORBIDDEN");

      expect(logActivityMock).toHaveBeenCalledTimes(1);
      expect(logActivityMock.mock.calls[0][0].actorRole).toBe("barista");

      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });
  }

  // --- admin ---------------------------------------------------------------
  for (const endpoint of SEMUA_ENDPOINT) {
    it(`mengizinkan ${endpoint.nama} untuk admin`, async () => {
      ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));

      const respons = await endpoint.panggil();

      // Admin tidak boleh mendapat 401 atau 403. Kode 200/201 berarti berhasil.
      expect(respons.status).not.toBe(401);
      expect(respons.status).not.toBe(403);

      // Dan access.denied tidak boleh dicatat untuk admin yang sah.
      expect(logActivityMock).not.toHaveBeenCalled();
    });
  }
});

describe("penolakan id yang bukan uuid", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockClear();
    fromMock.mockClear();
    // Sesi admin supaya yang diuji adalah id, bukan peran.
    ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));
  });

  const paramsBuruk = Promise.resolve({ id: "bukan-uuid" });

  const endpointDenganId: { nama: string; panggil: () => Promise<Response> }[] =
    [
      {
        nama: "PATCH /api/admin/menu/[id]",
        panggil: () =>
          PATCH_MENU(requestPalsu({ name: "A", price: 1000 }), {
            params: paramsBuruk,
          }),
      },
      {
        nama: "POST /api/admin/menu/[id]/active",
        panggil: () =>
          POST_AKTIF(requestPalsu({ isActive: true }), { params: paramsBuruk }),
      },
      {
        nama: "PUT /api/admin/menu/[id]/recipe",
        panggil: () =>
          PUT_RESEP(requestPalsu({ lines: [] }), { params: paramsBuruk }),
      },
      {
        nama: "PATCH /api/admin/ingredients/[id]",
        panggil: () =>
          PATCH_BAHAN(requestPalsu({ name: "A" }), { params: paramsBuruk }),
      },
      {
        nama: "POST /api/admin/ingredients/[id]/restock",
        panggil: () =>
          POST_RESTOCK(requestPalsu({ qty: 10 }), { params: paramsBuruk }),
      },
      {
        nama: "POST /api/admin/ingredients/[id]/adjust",
        panggil: () =>
          POST_ADJUST(requestPalsu({ newQty: 1, reason: "a" }), {
            params: paramsBuruk,
          }),
      },
      {
        nama: "GET /api/admin/ingredients/[id]/movements",
        panggil: () => GET_MOVEMENTS(requestPalsu(), { params: paramsBuruk }),
      },
    ];

  for (const endpoint of endpointDenganId) {
    it(`menolak ${endpoint.nama} dengan id bukan uuid`, async () => {
      const respons = await endpoint.panggil();

      expect(respons.status).toBe(400);
      const isi = await respons.json();
      expect(isi.error.type).toBe("VALIDATION_FAILED");

      // Database tidak disentuh dan error tidak dicatat (bukan kegagalan sistem).
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
      expect(logErrorMock).not.toHaveBeenCalled();
    });
  }
});
