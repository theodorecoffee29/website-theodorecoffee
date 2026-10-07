// Tes untuk src/lib/errors.ts: pemetaan error dari database ke tipe error kita.
// api-contract.md bagian 6 punya 8 tipe error. Error dari database muncul sebagai
// raise exception dengan message berupa salah satu tipe itu. Kalau message-nya
// tidak dikenal, hasilnya harus INTERNAL_ERROR.

import { describe, expect, it } from "vitest";
import { ERROR_TYPES, fail, fromDatabaseError, ok } from "./errors";

describe("fromDatabaseError", () => {
  it("mengubah message error database yang dikenal menjadi tipe yang sama", () => {
    // Database melempar Error dengan message = salah satu tipe dari daftar.
    const error = new Error("MENU_UNAVAILABLE");

    const hasil = fromDatabaseError(error);

    expect(hasil.type).toBe("MENU_UNAVAILABLE");
  });

  it("mengubah message yang bukan Error (teks biasa) menjadi tipe yang sama", () => {
    const hasil = fromDatabaseError("ORDER_STATUS_CHANGED");

    expect(hasil.type).toBe("ORDER_STATUS_CHANGED");
  });

  it("mengubah message yang tidak dikenal menjadi INTERNAL_ERROR", () => {
    // Ini yang terjadi kalau database melempar error yang tidak kita kenali,
    // misalnya pesan PostgreSQL biasa.
    const error = new Error('relation "orders" does not exist');

    const hasil = fromDatabaseError(error);

    expect(hasil.type).toBe("INTERNAL_ERROR");
  });

  it("mengenali semua tipe error yang ada di bagian 6", () => {
    // Pastikan setiap tipe di daftar resmi bisa dipetakan.
    for (const tipe of ERROR_TYPES) {
      const hasil = fromDatabaseError(new Error(tipe));
      expect(hasil.type).toBe(tipe);
    }
  });

  it("memberi pesan ramah, bukan pesan teknis dari database", () => {
    const hasil = fromDatabaseError(new Error("VALIDATION_FAILED"));

    // Pesan ke pengguna tidak boleh berisi pesan teknis database.
    expect(hasil.message).toBe(
      "Data yang dikirim tidak sesuai. Periksa kembali isianmu.",
    );
  });

  it("memastikan daftar tipe error sama dengan bagian 6", () => {
    // Daftar ini harus persis 8 tipe sesuai dokumen.
    expect(ERROR_TYPES).toEqual([
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "VALIDATION_FAILED",
      "ORDER_NOT_FOUND",
      "ORDER_STATUS_CHANGED",
      "MENU_UNAVAILABLE",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ]);
  });
});

describe("ok dan fail", () => {
  it("ok membungkus data dengan ok: true", () => {
    const hasil = ok({ queueNumber: 3 });

    expect(hasil).toEqual({ ok: true, data: { queueNumber: 3 } });
  });

  it("fail membungkus error dengan ok: false dan bentuk api-contract", () => {
    const hasil = fail({
      type: "ORDER_STATUS_CHANGED",
      message: "Status pesanan sudah berubah. Muat ulang halaman.",
      code: "ERR-4F2A",
    });

    expect(hasil).toEqual({
      ok: false,
      error: {
        type: "ORDER_STATUS_CHANGED",
        message: "Status pesanan sudah berubah. Muat ulang halaman.",
        code: "ERR-4F2A",
      },
    });
  });
});
