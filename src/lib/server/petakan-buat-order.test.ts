// Tes untuk src/lib/server/petakan-buat-order.ts.
//
// Yang diuji: hasil fungsi database (snake_case) diubah ke bentuk camelCase
// yang dijanjikan docs/api-contract.md bagian 4, termasuk saat ada field yang
// hilang.

import { describe, expect, it } from "vitest";
import { petakanHasilBuatOrder } from "./petakan-buat-order";

describe("petakanHasilBuatOrder", () => {
  it("mengubah snake_case menjadi camelCase", () => {
    const hasil = petakanHasilBuatOrder({
      order_id: "123e4567-e89b-42d3-a456-426614174000",
      queue_number: 7,
      queue_date: "2026-10-08",
      status: "menunggu_konfirmasi",
      total: 25000,
    });

    expect(hasil).toEqual({
      orderId: "123e4567-e89b-42d3-a456-426614174000",
      queueNumber: 7,
      queueDate: "2026-10-08",
      status: "menunggu_konfirmasi",
      total: 25000,
    });
  });

  it("tidak meninggalkan field orderId kosong (penyebab bug /status/undefined)", () => {
    const hasil = petakanHasilBuatOrder({ order_id: "abc" });
    expect(hasil.orderId).toBe("abc");
  });

  it("memberi nilai netral kalau data bukan objek", () => {
    const hasil = petakanHasilBuatOrder(null);
    expect(hasil).toEqual({
      orderId: "",
      queueNumber: 0,
      queueDate: "",
      status: "",
      total: 0,
    });
  });

  it("memberi nilai netral kalau field hilang atau salah tipe", () => {
    const hasil = petakanHasilBuatOrder({
      order_id: 12345,
      queue_number: "12",
      total: "bukan angka",
    });

    expect(hasil.orderId).toBe("12345");
    expect(hasil.queueNumber).toBe(12);
    expect(hasil.queueDate).toBe("");
    expect(hasil.total).toBe(0);
  });
});
