// Tes untuk konstanta polling di src/features/cashier/polling.ts dan
// src/features/barista/polling.ts.
//
// Kenapa konstanta polling perlu dites: nilainya kecil dan tidak terlihat dari
// kode, jadi paling mudah salah kalau ada yang diubah lalu tidak sengaja (mis.
// kembali ke 3000). Nilai yang diuji diambil dari docs/api-contract.md bagian 5.

import { describe, expect, it } from "vitest";
import {
  POLLING_DAFTAR_PESANAN_MS,
  POLLING_SISA_STOK_MS as POLLING_SISA_STOK_CASHIER_MS,
} from "@/features/cashier/polling";
import {
  POLLING_ANTREAN_MS,
  POLLING_SISA_STOK_MS as POLLING_SISA_STOK_BARISTA_MS,
} from "@/features/barista/polling";

describe("konstanta polling Cashier", () => {
  it("daftar pesanan di-poll setiap 2 detik", () => {
    expect(POLLING_DAFTAR_PESANAN_MS).toBe(2000);
  });

  it("sisa stok di-poll setiap 5 detik", () => {
    expect(POLLING_SISA_STOK_CASHIER_MS).toBe(5000);
  });
});

describe("konstanta polling Barista", () => {
  it("antrean di-poll setiap 2 detik", () => {
    expect(POLLING_ANTREAN_MS).toBe(2000);
  });

  it("sisa stok di-poll setiap 10 detik", () => {
    expect(POLLING_SISA_STOK_BARISTA_MS).toBe(10000);
  });
});

describe("perbandingan jeda polling", () => {
  it("daftar pesanan Cashier lebih cepat daripada panel sisa stoknya", () => {
    // Daftar pesanan butuh cepat karena ada notifikasi pesanan baru.
    expect(POLLING_DAFTAR_PESANAN_MS).toBeLessThan(
      POLLING_SISA_STOK_CASHIER_MS,
    );
  });

  it("antrean Barista lebih cepat daripada panel sisa stoknya", () => {
    // Barista memakai panel sisa stok hanya untuk menyiapkan bahan, jadi tidak
    // perlu sering mengambil data terbaru (dan menghemat baterai laptop).
    expect(POLLING_ANTREAN_MS).toBeLessThan(POLLING_SISA_STOK_BARISTA_MS);
  });
});
