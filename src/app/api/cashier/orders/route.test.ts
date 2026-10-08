// Tes untuk route handler POST /api/cashier/orders (order manual).
//
// Yang diuji di sini adalah PENJAGAAN PERAN, karena itu batas keamanan yang
// paling penting dari endpoint ini:
//   - Cashier dan Admin DIIZINKAN (Admin sebagai cadangan),
//   - Barista DITOLAK (FORBIDDEN) dan access.denied dicatat,
//   - anonim (belum login) DITOLAK (UNAUTHENTICATED),
//   - kalau ditolak, database TIDAK boleh disentuh sama sekali.
//
// Modul @/lib/auth/session dan @/lib/supabase/admin dikelompokkan (di-mock)
// supaya tesnya tidak menghubungi database sungguhan.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Tiruan modul session: ambilSesiStaf yang hasilnya bisa kita atur per tes.
const ambilSesiStafMock = vi.fn();

// Tiruan modul log: hanya logActivity yang dipakai penjaga peran.
const logActivityMock = vi.fn();

// Tiruan klien admin. rpc dicatat supaya tes bisa memastikan fungsi database
// TIDAK dipanggil saat permintaan ditolak.
const rpcMock = vi.fn();

vi.mock("@/lib/auth/session", () => {
  return {
    ambilSesiStaf: () => ambilSesiStafMock(),
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => {
      return {
        rpc: (namaFungsi: string, argumen: unknown) => {
          rpcMock(namaFungsi, argumen);
          // Sukses default: order dibuat, tanpa peringatan stok.
          return Promise.resolve({
            data: {
              order_id: "11111111-1111-4111-8111-111111111111",
              status: "antrean",
              queue_number: 7,
              stock_warnings: [],
            },
            error: null,
          });
        },
      };
    },
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: (param: unknown) => logActivityMock(param),
  };
});

import { POST } from "./route";

// Sesi staf contoh untuk tiap peran.
function sesiContoh(role: "cashier" | "barista" | "admin") {
  return {
    userId: "user-" + role,
    name: "Uji " + role,
    role,
    sessionId: "sess-" + role,
  };
}

// Body order manual yang valid.
function bodyValid(): string {
  return JSON.stringify({
    customerName: "Budi",
    items: [{ menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 }],
    paymentMethod: "qris",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
  });
}

// Membuat objek Request tiruan yang cukup untuk route ini (route hanya memakai
// request.json()).
//
// Tipe dikembalikan sebagai NextRequest karena itulah tipe yang diharapkan
// signature handler. Kita tidak memakai Request biasa supaya tidak perlu cast di
// setiap pemanggilan, dan tidak perlu membuat objek NextRequest sungguhan karena
// route ini tidak memakai cookies maupun nextUrl.
function requestPalsu(body: string): NextRequest {
  return new Request("http://localhost/api/cashier/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  }) as NextRequest;
}

describe("POST /api/cashier/orders: penjagaan peran", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockReset();
  });

  it("mengizinkan Cashier membuat order manual", async () => {
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));

    const respons = await POST(requestPalsu(bodyValid()));

    expect(respons.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe("create_manual_order");
  });

  it("mengizinkan Admin membuat order manual (cadangan Cashier)", async () => {
    // docs/pemissions.md bagian 2: Admin boleh menginput order manual.
    ambilSesiStafMock.mockReturnValue(sesiContoh("admin"));

    const respons = await POST(requestPalsu(bodyValid()));

    expect(respons.status).toBe(201);
  });

  it("menolak Barista dan mencatat access.denied", async () => {
    // Barista hanya boleh membuat pesanan lewat tombol Mulai/Selesai, bukan
    // membuat order (docs/pemissions.md bagian 2).
    ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

    const respons = await POST(requestPalsu(bodyValid()));

    expect(respons.status).toBe(403);
    const isi = await respons.json();
    expect(isi.ok).toBe(false);
    expect(isi.error.type).toBe("FORBIDDEN");

    // access.denied harus tercatat (docs/logging.md bagian 2).
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    const catatan = logActivityMock.mock.calls[0][0];
    expect(catatan.action).toBe("access.denied");
    expect(catatan.actorRole).toBe("barista");
  });

  it("menolak anonim (belum login) dengan UNAUTHENTICATED", async () => {
    // Customer anonim tidak boleh membuat order manual.
    ambilSesiStafMock.mockReturnValue(null);

    const respons = await POST(requestPalsu(bodyValid()));

    expect(respons.status).toBe(401);
    const isi = await respons.json();
    expect(isi.error.type).toBe("UNAUTHENTICATED");
  });

  it("TIDAK menyentuh database kalau peran ditolak", async () => {
    // Penjagaan peran harus berjalan SEBELUM rpc, supaya tidak ada data yang
    // tersentuh oleh orang yang tidak berhak.
    ambilSesiStafMock.mockReturnValue(sesiContoh("barista"));

    await POST(requestPalsu(bodyValid()));

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("TIDAK menyentuh database kalau belum login", async () => {
    ambilSesiStafMock.mockReturnValue(null);

    await POST(requestPalsu(bodyValid()));

    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/cashier/orders: validasi body", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockReset();
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));
  });

  it("menolak body yang bukan JSON", async () => {
    const respons = await POST(requestPalsu("ini bukan json"));

    expect(respons.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("menolak body tanpa metode bayar", async () => {
    // Tidak ada nilai bawaan: Cashier wajib memilih (api-contract bagian 2).
    const respons = await POST(
      requestPalsu(
        JSON.stringify({
          customerName: "Budi",
          items: [
            { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 },
          ],
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
        }),
      ),
    );

    expect(respons.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("menolak occurredAt di masa depan", async () => {
    const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const respons = await POST(
      requestPalsu(
        JSON.stringify({
          customerName: "Budi",
          items: [
            { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 },
          ],
          paymentMethod: "qris",
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
          occurredAt: besok.toISOString(),
        }),
      ),
    );

    expect(respons.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/cashier/orders: isi permintaan ke database", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockReset();
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));
  });

  it("mengirim p_actor_id dan p_meta dari sesi", async () => {
    // Pola yang sama dengan endpoint staf lain: pelaku dan id sesi ikut
    // dicatat supaya log aktivitas bisa menelusuri siapa yang menginput.
    await POST(requestPalsu(bodyValid()));

    const argumen = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(argumen.p_actor_id).toBe("user-cashier");
    expect(argumen.p_meta).toEqual({ session_id: "sess-cashier" });
  });

  it("mengirim occurredAt null kalau tidak diberikan", async () => {
    // null berarti database memakai waktu sekarang dan is_manual_time = false.
    await POST(requestPalsu(bodyValid()));

    const argumen = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(argumen.p_occurred_at).toBeNull();
  });

  it("mengirim occurredAt yang diberikan", async () => {
    const waktu = new Date().toISOString();

    await POST(
      requestPalsu(
        JSON.stringify({
          customerName: "Budi",
          items: [
            { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 },
          ],
          paymentMethod: "tunai",
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
          occurredAt: waktu,
        }),
      ),
    );

    const argumen = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(argumen.p_occurred_at).toBe(waktu);
  });

  it("TIDAK mengirim harga dari klien", async () => {
    // Harga selalu dihitung ulang di server (api-contract bagian 2).
    await POST(
      requestPalsu(
        JSON.stringify({
          customerName: "Budi",
          items: [
            {
              menuItemId: "11111111-1111-4111-8111-111111111111",
              qty: 1,
              price: 1,
            },
          ],
          paymentMethod: "qris",
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
          total: 1,
        }),
      ),
    );

    const argumen = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(argumen).not.toHaveProperty("total");
    expect(argumen.p_items).toEqual([
      { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 },
    ]);
  });
});

describe("POST /api/cashier/orders: respons", () => {
  beforeEach(() => {
    ambilSesiStafMock.mockReset();
    logActivityMock.mockReset();
    rpcMock.mockReset();
    ambilSesiStafMock.mockReturnValue(sesiContoh("cashier"));
  });

  it("mengembalikan bentuk camelCase sesuai api-contract bagian 4", async () => {
    const respons = await POST(requestPalsu(bodyValid()));

    expect(respons.status).toBe(201);
    const isi = await respons.json();
    expect(isi.ok).toBe(true);
    expect(isi.data).toEqual({
      orderId: "11111111-1111-4111-8111-111111111111",
      queueNumber: 7,
      // Order manual langsung antrean, tanpa tahap Menunggu konfirmasi.
      status: "antrean",
      stockWarnings: [],
    });
  });
});
