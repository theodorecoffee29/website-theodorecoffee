// Tes untuk src/lib/server/petakan-admin.ts.
//
// Yang diuji: perubahan nama kolom database (snake_case) menjadi camelCase,
// perhitungan isNegative dari stok yang bisa Minus, dan pembersihan nilai dari
// fungsi database.
//
// File ini murni (tanpa database), jadi bisa diuji langsung.

import { describe, expect, it } from "vitest";
import {
  petakanBahanBaru,
  petakanBahanDiubah,
  petakanDaftarBahan,
  petakanDaftarMenu,
  petakanMenuSatuan,
  petakanPergerakan,
  petakanPerubahanStok,
  petakanResep,
  petakanResepFungsi,
  petakanStatusMenu,
} from "./petakan-admin";

describe("petakanDaftarMenu", () => {
  it("mengubah nama kolom snake_case menjadi camelCase", () => {
    const hasil = petakanDaftarMenu([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Kopi Susu",
        price: 22000,
        is_active: true,
        recipes: [],
      },
    ]);

    expect(hasil).toEqual([
      {
        menuItemId: "11111111-1111-4111-8111-111111111111",
        name: "Kopi Susu",
        price: 22000,
        isActive: true,
        recipe: [],
      },
    ]);
  });

  it("membawa baris resep beserta nama dan satuan bahannya", () => {
    // Resep diambil dengan nested select, jadi ingredients ikut terbawa.
    const hasil = petakanDaftarMenu([
      {
        id: "menu-1",
        name: "Kopi Susu",
        price: 22000,
        is_active: true,
        recipes: [
          {
            ingredient_id: "bahan-1",
            ingredient_name: "Susu",
            unit: "ml",
            qty_per_portion: "20.000",
          },
        ],
      },
    ]);

    expect(hasil[0].recipe).toEqual([
      {
        ingredientId: "bahan-1",
        ingredientName: "Susu",
        unit: "ml",
        qtyPerPortion: 20,
      },
    ]);
  });

  it("menganggap resep kosong saat kolomnya bukan array", () => {
    // Menu tanpa resep menghasilkan null dari database.
    const hasil = petakanDaftarMenu([
      { id: "m", name: "Teh", price: 5000, is_active: true, recipes: null },
      { id: "m2", name: "Kopi", price: 5000, is_active: false },
    ]);

    expect(hasil[0].recipe).toEqual([]);
    expect(hasil[1].recipe).toEqual([]);
  });

  it("menandai menu nonaktif dengan isActive false", () => {
    const hasil = petakanDaftarMenu([
      { id: "m", name: "Lama", price: 5000, is_active: false, recipes: [] },
    ]);

    expect(hasil[0].isActive).toBe(false);
  });
});

describe("petakanResep", () => {
  it("mengubah numeric dari database (teks) menjadi angka", () => {
    // Postgres mengirim numeric sebagai teks dalam banyak kasus.
    const hasil = petakanResep([
      {
        ingredient_id: "b",
        ingredient_name: "Susu",
        unit: "ml",
        qty_per_portion: "12.500",
      },
    ]);

    expect(hasil[0].qtyPerPortion).toBe(12.5);
  });

  it("melewatkan baris resep yang tidak lengkap", () => {
    // Baris tanpa id atau nama bahan tidak berguna untuk ditampilkan.
    const hasil = petakanResep([
      {
        ingredient_id: "b",
        ingredient_name: "Susu",
        unit: "ml",
        qty_per_portion: 20,
      },
      { ingredient_id: "", ingredient_name: "Tanpa Id", qty_per_portion: 1 },
      { ingredient_name: "Tanpa Id", qty_per_portion: 1 },
      "bukan objek",
      null,
    ]);

    expect(hasil).toHaveLength(1);
  });

  it("mengembalikan daftar kosong saat inputnya bukan array", () => {
    expect(petakanResep(null)).toEqual([]);
    expect(petakanResep(undefined)).toEqual([]);
  });
});

describe("petakanDaftarBahan", () => {
  it("mengubah kolom snake_case menjadi camelCase", () => {
    const hasil = petakanDaftarBahan([
      { id: "bahan-1", name: "Susu", unit: "ml", stock_qty: "5000.000" },
    ]);

    expect(hasil).toEqual([
      {
        ingredientId: "bahan-1",
        name: "Susu",
        unit: "ml",
        stockQty: 5000,
        isNegative: false,
      },
    ]);
  });

  it("menandai stok minus dengan isNegative true", () => {
    // Stok boleh minus (docs/data-model.md aturan 4), jadi Admin perlu tahu.
    const hasil = petakanDaftarBahan([
      { id: "b1", name: "Susu", unit: "ml", stock_qty: -12.5 },
    ]);

    expect(hasil[0].isNegative).toBe(true);
    expect(hasil[0].stockQty).toBe(-12.5);
  });

  it("mendeteksi stok minus yang datang sebagai TEKS", () => {
    // Ini yang perlu diperhatikan: kalau hanya dibandingkan dengan < 0 pada
    // teks, hasilnya selalu benar secara teknis tapi salah secara makna.
    const hasil = petakanDaftarBahan([
      { id: "b1", name: "Susu", unit: "ml", stock_qty: "-12.500" },
    ]);

    expect(hasil[0].isNegative).toBe(true);
  });

  it("tidak menandai nol sebagai negatif", () => {
    // 0 berarti habis, bukan kurang.
    const hasil = petakanDaftarBahan([
      { id: "b1", name: "A", unit: "g", stock_qty: 0 },
    ]);

    expect(hasil[0].isNegative).toBe(false);
  });

  it("menganggap stok tidak terbaca sebagai bukan negatif", () => {
    const hasil = petakanDaftarBahan([
      { id: "b1", name: "A", unit: "g", stock_qty: null },
    ]);

    expect(hasil[0].stockQty).toBe(0);
    expect(hasil[0].isNegative).toBe(false);
  });
});

describe("petakanPergerakan", () => {
  it("mengubah kolom snake_case menjadi camelCase", () => {
    const hasil = petakanPergerakan([
      {
        id: "m1",
        type: "restock",
        qty_change: "2000.000",
        stock_after: "7000.000",
        created_at: "2026-10-08T09:00:00+07:00",
        order_id: null,
        note: "Pembelian",
      },
    ]);

    expect(hasil).toEqual([
      {
        movementId: "m1",
        type: "restock",
        qtyChange: 2000,
        stockAfter: 7000,
        createdAt: "2026-10-08T09:00:00+07:00",
        orderId: null,
        note: "Pembelian",
      },
    ]);
  });

  it("menyimpan orderId dan note kosong sebagai null", () => {
    // Keduanya boleh kosong di database.
    const hasil = petakanPergerakan([
      {
        id: "m2",
        type: "order_confirm",
        qty_change: -20,
        stock_after: 4980,
        created_at: "2026-10-08T10:00:00+07:00",
        order_id: "order-1",
        note: null,
      },
    ]);

    expect(hasil[0].orderId).toBe("order-1");
    expect(hasil[0].note).toBeNull();
  });

  it("mengubah qty_change negatif dengan benar", () => {
    const hasil = petakanPergerakan([
      {
        id: "m3",
        type: "order_confirm",
        qty_change: "-20.000",
        stock_after: "-12.500",
        created_at: "2026-10-08T11:00:00+07:00",
        order_id: null,
        note: null,
      },
    ]);

    expect(hasil[0].qtyChange).toBe(-20);
    expect(hasil[0].stockAfter).toBe(-12.5);
  });
});

describe("pemeta hasil fungsi database", () => {
  it("memetakan hasil create/update menu", () => {
    expect(
      petakanMenuSatuan({
        menuItemId: "menu-1",
        name: "Kopi Susu",
        price: 25000,
      }),
    ).toEqual({ menuItemId: "menu-1", name: "Kopi Susu", price: 25000 });
  });

  it("memetakan hasil set_menu_active", () => {
    expect(
      petakanStatusMenu({ menuItemId: "menu-1", isActive: false }),
    ).toEqual({ menuItemId: "menu-1", isActive: false });
  });

  it("memetakan hasil set_recipe", () => {
    expect(
      petakanResepFungsi({
        menuItemId: "menu-1",
        lines: [{ ingredientId: "bahan-1", qtyPerPortion: "20.000" }],
      }),
    ).toEqual({
      menuItemId: "menu-1",
      lines: [{ ingredientId: "bahan-1", qtyPerPortion: 20 }],
    });
  });

  it("memetakan hasil create_ingredient", () => {
    expect(
      petakanBahanBaru({
        ingredientId: "bahan-1",
        name: "Susu",
        unit: "ml",
        stockQty: "5000.000",
      }),
    ).toEqual({
      ingredientId: "bahan-1",
      name: "Susu",
      unit: "ml",
      stockQty: 5000,
    });
  });

  it("memetakan hasil update_ingredient tanpa satuan", () => {
    // Fungsi ini hanya mengubah nama, jadi tidak ada unit di keluarannya.
    expect(
      petakanBahanDiubah({ ingredientId: "bahan-1", name: "Susu UHT" }),
    ).toEqual({ ingredientId: "bahan-1", name: "Susu UHT" });
  });

  it("memetakan hasil restock dan adjust", () => {
    expect(
      petakanPerubahanStok({
        ingredientId: "bahan-1",
        stockQty: "7000.000",
        qtyChange: "2000.000",
      }),
    ).toEqual({ ingredientId: "bahan-1", stockQty: 7000, qtyChange: 2000 });

    expect(
      petakanPerubahanStok({
        ingredientId: "bahan-1",
        stockQty: 6500,
        qtyChange: -500,
      }),
    ).toEqual({ ingredientId: "bahan-1", stockQty: 6500, qtyChange: -500 });
  });

  it("mengisi nilai netral saat data bukan objek", () => {
    // Tidak melempar error, tapi bentuk balasannya tetap lengkap.
    expect(petakanMenuSatuan(null)).toEqual({
      menuItemId: "",
      name: "",
      price: 0,
    });
    expect(petakanPerubahanStok(undefined)).toEqual({
      ingredientId: "",
      stockQty: 0,
      qtyChange: 0,
    });
    expect(petakanResepFungsi(null).lines).toEqual([]);
  });
});
