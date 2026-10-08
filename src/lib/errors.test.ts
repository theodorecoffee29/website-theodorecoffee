// Tes untuk src/lib/errors.ts: pemetaan error dari database ke tipe error kita.
// api-contract.md bagian 6 punya 8 tipe error. Error dari database muncul sebagai
// raise exception dengan message berupa salah satu tipe itu. Kalau message-nya
// tidak dikenal, hasilnya harus INTERNAL_ERROR.
//
// Catatan khusus: supabase mengirim error sebagai OBJEK BIASA
// { message, code, details, hint } (bukan turunan Error). Tes di bawah memakai
// objek semacam itu, karena hal inilah yang dulu membuat error tertulis
// "[object Object]" dan tidak terbaca.

import { describe, expect, it } from "vitest";
import {
  ERROR_TYPES,
  ambilDetailError,
  fail,
  fromDatabaseError,
  ok,
} from "./errors";

// Bentuk error dari supabase-js untuk "raise exception 'ORDER_NOT_FOUND'".
function errorDatabase(message: string): Record<string, unknown> {
  return {
    message: message,
    code: "P0001",
    details: "order_id tidak valid",
    hint: "Periksa kembali id order",
  };
}

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

describe("fromDatabaseError dengan error berbentuk OBJEK supabase", () => {
  // Ini bagian yang dulu rusak: objek error dari supabase diubah dengan
  // String(error) menjadi "[object Object]", jadi message-nya tidak terbaca dan
  // semuanya menjadi INTERNAL_ERROR 500.
  it("mengenali message dari objek error untuk tiap tipe yang dikenal", () => {
    for (const tipe of ERROR_TYPES) {
      const hasil = fromDatabaseError(errorDatabase(tipe));
      expect(hasil.type).toBe(tipe);
    }
  });

  it("mengenali ORDER_NOT_FOUND persis contoh dari laporan bug", () => {
    // Contoh persis seperti yang muncul dari fungsi get_order_status.
    const error = {
      message: "ORDER_NOT_FOUND",
      code: "P0001",
      details: "order_id tidak valid",
      hint: null,
    };

    const hasil = fromDatabaseError(error);

    expect(hasil.type).toBe("ORDER_NOT_FOUND");
  });

  it("menganggap message objek yang tidak dikenal sebagai INTERNAL_ERROR", () => {
    const error = {
      message: 'relation "orders" does not exist',
      code: "42P01",
      details: "Table not found",
      hint: null,
    };

    expect(fromDatabaseError(error).type).toBe("INTERNAL_ERROR");
  });

  it("menangani error yang bukan objek", () => {
    // Teks biasa, angka, null. Semua bukan tipe dikenal -> INTERNAL_ERROR.
    expect(fromDatabaseError("ORDER_STATUS_CHANGED").type).toBe(
      "ORDER_STATUS_CHANGED",
    );
    expect(fromDatabaseError(42).type).toBe("INTERNAL_ERROR");
    expect(fromDatabaseError(null).type).toBe("INTERNAL_ERROR");
    expect(fromDatabaseError(undefined).type).toBe("INTERNAL_ERROR");
  });
});

describe("ambilDetailError", () => {
  it("membaca message, code, details, dan hint dari objek supabase", () => {
    const detail = ambilDetailError(errorDatabase("VALIDATION_FAILED"));

    expect(detail).toEqual({
      message: "VALIDATION_FAILED",
      code: "P0001",
      details: "order_id tidak valid",
      hint: "Periksa kembali id order",
    });
  });

  it("mengisi null untuk field objek yang tidak ada atau bukan teks", () => {
    const detail = ambilDetailError({ message: "MENU_UNAVAILABLE", hint: 42 });

    expect(detail).toEqual({
      message: "MENU_UNAVAILABLE",
      code: null,
      details: null,
      hint: null,
    });
  });

  it("membaca message dari Error biasa", () => {
    expect(ambilDetailError(new Error("FORBIDDEN")).message).toBe("FORBIDDEN");
  });

  it("mengubah error yang bukan objek menjadi teks", () => {
    expect(ambilDetailError("ORDER_NOT_FOUND")).toEqual({
      message: "ORDER_NOT_FOUND",
      code: null,
      details: null,
      hint: null,
    });

    // null dan undefined dianggap kosong, bukan "[object Object]".
    expect(ambilDetailError(null)).toEqual({
      message: "",
      code: null,
      details: null,
      hint: null,
    });
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
