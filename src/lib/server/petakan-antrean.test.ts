// Tes untuk src/lib/server/petakan-antrean.ts.
//
// Yang paling penting di file ini: memastikan output untuk layar Barista TIDAK
// PERNAH memuat harga, total, atau data pembayaran
// (docs/pemissions.md bagian 2). Baris input sengaja dibuat MEMBAWA field
// harga dan pembayaran, lalu kita pastikan field itu hilang di output.

import { describe, expect, it } from "vitest";
import {
  petakanAntreanBarista,
  type BarisOrderAntrean,
} from "./petakan-antrean";

// Satu baris order yang lengkap, termasuk field yang TIDAK BOLEH tampil.
//
// Tipe kembaliannya ditulis eksplisit supaya nilai order_items bisa diganti
// bebas di tes (misalnya jadi null atau berisi entri aneh) tanpa TypeScript
// menolak.
function barisDenganHarga(): BarisOrderAntrean {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    queue_number: 7,
    customer_name: "Budi",
    status: "antrean",
    total: 18000,
    order_items: [
      {
        menu_item_id: "menu-1",
        name_snapshot: "Americano",
        price_snapshot: 18000,
        qty: 2,
        note: "less sugar",
        subtotal: 36000,
      },
    ],
  };
}

describe("petakanAntreanBarista", () => {
  it("mengambil hanya field yang boleh tampil", () => {
    const hasil = petakanAntreanBarista([barisDenganHarga()]);

    // Field yang boleh: orderId, queueNumber, customerName, items, status.
    expect(hasil).toHaveLength(1);
    expect(hasil[0].orderId).toBe("aaaaaaaa-0000-4000-8000-000000000001");
    expect(hasil[0].queueNumber).toBe(7);
    expect(hasil[0].customerName).toBe("Budi");
    expect(hasil[0].status).toBe("antrean");
    expect(hasil[0].items).toHaveLength(1);
    expect(hasil[0].items[0].name).toBe("Americano");
    expect(hasil[0].items[0].qty).toBe(2);
    expect(hasil[0].items[0].note).toBe("less sugar");
  });

  it("TIDAK menyertakan harga di order maupun di item", () => {
    const hasil = petakanAntreanBarista([barisDenganHarga()]);

    // Di level order: tidak boleh ada "total" maupun "price".
    expect(hasil[0]).not.toHaveProperty("total");
    expect(hasil[0]).not.toHaveProperty("price");
    expect(Object.keys(hasil[0]).sort()).toEqual([
      "customerName",
      "items",
      "orderId",
      "queueNumber",
      "status",
    ]);

    // Di level item: tidak boleh ada price_snapshot maupun subtotal.
    expect(hasil[0].items[0]).not.toHaveProperty("price_snapshot");
    expect(hasil[0].items[0]).not.toHaveProperty("subtotal");
    expect(hasil[0].items[0]).not.toHaveProperty("price");
    expect(Object.keys(hasil[0].items[0]).sort()).toEqual([
      "name",
      "note",
      "qty",
    ]);
  });

  it("TIDAK menyertakan data pembayaran walau input punya", () => {
    // Kalau baris input membawa data pembayaran, output tetap tidak boleh
    // memuatnya, karena mapper tidak menyebut field itu.
    const barisDenganPembayaran = {
      ...barisDenganHarga(),
      payment: { method: "qris", amount: 18000, recorded_by: "staff-1" },
    };

    const hasil = petakanAntreanBarista([barisDenganPembayaran]);

    expect(hasil[0]).not.toHaveProperty("payment");
    // Pastikan tidak ada string yang mengandung kata pembayaran/qphysics.
    const seluruhTeks = JSON.stringify(hasil);
    expect(seluruhTeks).not.toContain("qris");
    expect(seluruhTeks).not.toContain("amount");
    expect(seluruhTeks).not.toContain("18000");
  });

  it("mengubah note kosong menjadi null", () => {
    const baris = barisDenganHarga();
    baris.order_items = [{ name_snapshot: "Teh", qty: 1, note: null }];
    const hasil = petakanAntreanBarista([baris]);
    expect(hasil[0].items[0].note).toBeNull();
  });

  it("mengubah note yang tidak ada menjadi null", () => {
    const baris = barisDenganHarga();
    baris.order_items = [{ name_snapshot: "Teh", qty: 1 }];
    const hasil = petakanAntreanBarista([baris]);
    expect(hasil[0].items[0].note).toBeNull();
  });

  it("mengembalikan daftar kosong untuk input kosong", () => {
    expect(petakanAntreanBarista([])).toEqual([]);
  });

  it("mengabaikan item yang tidak valid tanpa membuat halaman error", () => {
    // order_items berisi entri aneh (bukan objek, tanpa nama). Item-item itu
    // dilewati, dan item yang valid tetap tampil.
    const baris = barisDenganHarga();
    baris.order_items = [
      null,
      "bukan objek",
      { qty: 1 }, // tanpa nama
      { name_snapshot: "Latte", qty: 1, note: null }, // valid
    ];

    const hasil = petakanAntreanBarista([baris]);

    expect(hasil[0].items).toHaveLength(1);
    expect(hasil[0].items[0].name).toBe("Latte");
  });

  it("mengembalikan items kosong kalau order_items bukan array", () => {
    const baris = barisDenganHarga();
    baris.order_items = null; // bukan array
    const hasil = petakanAntreanBarista([baris]);
    expect(hasil[0].items).toEqual([]);
  });
});
