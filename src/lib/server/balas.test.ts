// Tes untuk src/lib/server/balas.ts.
//
// Yang diuji: pemetaan error database menjadi respons, termasuk:
//   - error yang dikenal (mis. ORDER_NOT_FOUND) dipetakan tanpa mencatat log,
//   - error yang TIDAK dikenal menjadi 500 INTERNAL_ERROR, DAN isi aslinya
//     (message, code, details, hint) tercatat di context logError — bukan
//     "[object Object]" seperti sebelumnya.
//
// Modul @/lib/log di-mock supaya tes tidak menyentuh database.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Tiruan logError: argumen yang dikirim bisa diperiksa lewat mock.calls, dan
// pengembaliannya diatur di beforeEach (kode "ERR-TEST").
const logErrorMock = vi.fn();

vi.mock("@/lib/log", () => {
  return {
    logError: (param: unknown) => logErrorMock(param),
  };
});

import { balasDariErrorDatabase, balasOrderTidakDitemukan } from "./balas";

// Bentuk error dari supabase-js: objek biasa (bukan turunan Error).
function errorDatabase(message: string): Record<string, unknown> {
  return {
    message: message,
    code: "P0001",
    details: "order_id tidak valid",
    hint: null,
  };
}

describe("balasDariErrorDatabase", () => {
  beforeEach(() => {
    logErrorMock.mockReset();
    // Nilai pengembalian mock: kode error "ERR-xxxx" yang akan dipakai
    // balasDariErrorDatabase untuk respons INTERNAL_ERROR.
    logErrorMock.mockReturnValue("ERR-TEST");
  });

  it("mengubah error yang dikenal menjadi tipe yang sama, tanpa mencatat log", async () => {
    const respons = balasDariErrorDatabase(
      errorDatabase("ORDER_NOT_FOUND"),
      "get_order_status",
    );

    expect(respons.status).toBe(404);

    const isi = await respons.json();
    expect(isi).toEqual({
      ok: false,
      error: { type: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan." },
    });

    // Penolakan bisnis normal: tidak dicatat sebagai kegagalan sistem.
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("memetakan semua tipe error yang dikenal dengan benar", async () => {
    const kasus: { type: string; status: number }[] = [
      { type: "UNAUTHENTICATED", status: 401 },
      { type: "FORBIDDEN", status: 403 },
      { type: "VALIDATION_FAILED", status: 400 },
      { type: "ORDER_STATUS_CHANGED", status: 409 },
      { type: "MENU_UNAVAILABLE", status: 409 },
      { type: "RATE_LIMITED", status: 429 },
    ];

    for (const satuKasus of kasus) {
      logErrorMock.mockReset();

      const respons = balasDariErrorDatabase(
        errorDatabase(satuKasus.type),
        "tes",
      );

      expect(respons.status).toBe(satuKasus.status);
      const isi = await respons.json();
      expect(isi.error.type).toBe(satuKasus.type);
      expect(logErrorMock).not.toHaveBeenCalled();
    }
  });

  it("error yang tidak dikenal jadi INTERNAL_ERROR dan detailnya terbaca di log", async () => {
    // Objek error yang message-nya bukan tipe yang dikenal.
    const error = {
      message: 'relation "orders" does not exist',
      code: "42P01",
      details: "Tabel tidak ditemukan",
      hint: "Periksa nama tabel",
    };

    const respons = balasDariErrorDatabase(error, "get_order_status");

    expect(respons.status).toBe(500);

    const isi = await respons.json();
    expect(isi.error.type).toBe("INTERNAL_ERROR");
    // Kode error dari log ada supaya bisa dicari di error_logs.
    expect(isi.error.code).toBe("ERR-TEST");

    // Log memuat pesan asli DAN context berisi keempat field, bukan
    // "[object Object]".
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const param = logErrorMock.mock.calls[0][0];
    expect(param.message).toContain('relation "orders" does not exist');
    expect(param.source).toBe("database");
    expect(param.context).toEqual({
      konteks: "get_order_status",
      message: 'relation "orders" does not exist',
      code: "42P01",
      details: "Tabel tidak ditemukan",
      hint: "Periksa nama tabel",
    });
  });

  it("error yang bukan objek pun tetap terbaca di log", async () => {
    const respons = balasDariErrorDatabase("terjadi apa pun", "get_menu");

    expect(respons.status).toBe(500);

    const isi = await respons.json();
    expect(isi.error.type).toBe("INTERNAL_ERROR");

    const param = logErrorMock.mock.calls[0][0];
    expect(param.message).toContain("terjadi apa pun");
    expect(param.context.message).toBe("terjadi apa pun");
  });
});

describe("balasOrderTidakDitemukan", () => {
  it("mengembalikan 404 ORDER_NOT_FOUND tanpa mencatat log", async () => {
    logErrorMock.mockReset();

    const respons = balasOrderTidakDitemukan();

    expect(respons.status).toBe(404);
    const isi = await respons.json();
    expect(isi).toEqual({
      ok: false,
      error: { type: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan." },
    });

    // Id yang tidak valid bukan kegagalan sistem, jadi tidak dicatat.
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
