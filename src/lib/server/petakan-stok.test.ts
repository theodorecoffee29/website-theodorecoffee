// Tes untuk src/lib/server/petakan-stok.ts.
//
// File ini MURNI (tanpa database dan tanpa Supabase), jadi bisa diuji langsung.
//
// Yang diuji:
//   1. Angka numeric dari database yang datang sebagai TEKS diubah ke angka
//      (ini alasan utama file ini ada: kolom numeric dari PostgREST bisa
//      sampai sebagai teks, dan "5000" + "10" jadi "500010" kalau dipakai
//      langsung).
//   2. portionsLeft yang null tetap null, tidak berubah jadi 0. Null berarti
//      "menu tanpa resep", 0 berarti "habis".
//   3. isNegative dihitung dari nilai stoknya.

import { describe, expect, it } from "vitest";
import { PERAN_SISA_STOK, petakanSisaStok } from "./petakan-stok";

describe("petakanSisaStok", () => {
  it("mengubah numeric yang datang sebagai teks menjadi angka", () => {
    // Bentuk inilah yang sering terjadi: kolom numeric PostgreSQL dikirim
    // PostgREST sebagai teks.
    const hasil = petakanSisaStok({
      menus: [{ menuItemId: "m1", name: "Americano", portionsLeft: "277" }],
      ingredients: [
        {
          ingredientId: "i1",
          name: "Kopi bubuk",
          unit: "g",
          stockQty: "5000.000",
          isNegative: false,
        },
      ],
    });

    expect(hasil.menus[0]?.portionsLeft).toBe(277);
    expect(hasil.ingredients[0]?.stockQty).toBe(5000);
  });

  it("membaca numeric yang sudah berupa angka", () => {
    const hasil = petakanSisaStok({
      menus: [{ menuItemId: "m1", name: "Latte", portionsLeft: 12 }],
      ingredients: [
        {
          ingredientId: "i1",
          name: "Susu",
          unit: "ml",
          stockQty: 1250,
          isNegative: false,
        },
      ],
    });

    expect(hasil.menus[0]?.portionsLeft).toBe(12);
    expect(hasil.ingredients[0]?.stockQty).toBe(1250);
  });

  it("menjaga portionsLeft null tetap null untuk menu tanpa resep", () => {
    // Ini cases yang paling mudah salah: kalau null diubah jadi 0, Cashier akan
    // melihat menu tanpa resep sebagai menu yang habis.
    const hasil = petakanSisaStok({
      menus: [{ menuItemId: "m1", name: "Air mineral", portionsLeft: null }],
      ingredients: [],
    });

    expect(hasil.menus[0]?.portionsLeft).toBeNull();
  });

  it("menjaga 0 tetap 0 (bukan diubah jadi null)", () => {
    const hasil = petakanSisaStok({
      menus: [{ menuItemId: "m1", name: "Cappuccino", portionsLeft: 0 }],
      ingredients: [],
    });

    expect(hasil.menus[0]?.portionsLeft).toBe(0);
  });

  it("menandai bahan yang stoknya minus", () => {
    const hasil = petakanSisaStok({
      menus: [],
      ingredients: [
        {
          ingredientId: "i1",
          name: "Susu",
          unit: "ml",
          stockQty: "-10",
          isNegative: false,
        },
        {
          ingredientId: "i2",
          name: "Gula",
          unit: "g",
          stockQty: "500",
          isNegative: false,
        },
      ],
    });

    // isNegative dihitung ulang dari stoknya, bukan dipercaya apa adanya dari
    // server. Kalau server mengirim isNegative yang salah, tanda minusnya tetap
    // benar di tampilan.
    expect(hasil.ingredients[0]?.isNegative).toBe(true);
    expect(hasil.ingredients[0]?.stockQty).toBe(-10);
    expect(hasil.ingredients[1]?.isNegative).toBe(false);
  });

  it("membaca kunci snake_case kalau server mengirimnya", () => {
    const hasil = petakanSisaStok({
      menus: [{ menu_item_id: "m1", name: "Teh", portions_left: "3" }],
      ingredients: [
        { ingredient_id: "i1", name: "Daun teh", unit: "g", stock_qty: "80" },
      ],
    });

    expect(hasil.menus[0]?.menuItemId).toBe("m1");
    expect(hasil.menus[0]?.portionsLeft).toBe(3);
    expect(hasil.ingredients[0]?.ingredientId).toBe("i1");
    expect(hasil.ingredients[0]?.stockQty).toBe(80);
  });

  it("mengubah daftar yang hilang menjadi daftar kosong, bukan error", () => {
    const hasil = petakanSisaStok({});

    expect(hasil.menus).toEqual([]);
    expect(hasil.ingredients).toEqual([]);
  });

  it("tidak melempar error kalau data bukan objek sama sekali", () => {
    // Panel sisa stok hanya informasi tambahan. Lebih baik kosong daripada
    // membuat halaman Cashier/Barista ikut error.
    expect(() => petakanSisaStok(null)).not.toThrow();
    expect(petakanSisaStok("bukan data").menus).toEqual([]);
  });

  it("melewatkan menu tanpa nama", () => {
    // Baris tanpa nama tidak berguna dan hanya membingungkan.
    const hasil = petakanSisaStok({
      menus: [
        { menuItemId: "m1", name: "", portionsLeft: "5" },
        { menuItemId: "m2", name: "Latte", portionsLeft: "5" },
      ],
      ingredients: [],
    });

    expect(hasil.menus).toHaveLength(1);
    expect(hasil.menus[0]?.name).toBe("Latte");
  });

  it("TIDAK memuat harga, total, atau pembayaran sama sekali", () => {
    // Ini aturan keamanan layar Barista (docs/pemissions.md bagian 2). Kalau
    // data harga ikut terbawa, panel ini akan membocorkannya ke Barista.
    const hasil = petakanSisaStok({
      menus: [
        { menuItemId: "m1", name: "Latte", portionsLeft: "5", price: 20000 },
      ],
      ingredients: [
        {
          ingredientId: "i1",
          name: "Susu",
          unit: "ml",
          stockQty: "1000",
          amount: 25000,
        },
      ],
    });

    // Bentuk hasil hanya boleh punya field yang sudah dideklarasikan di tipe,
    // jadi harga dari server otomatis terbuang.
    expect(Object.keys(hasil.menus[0] ?? {}).sort()).toEqual([
      "menuItemId",
      "name",
      "portionsLeft",
    ]);
    expect(Object.keys(hasil.ingredients[0] ?? {}).sort()).toEqual([
      "ingredientId",
      "isNegative",
      "name",
      "stockQty",
      "unit",
    ]);
  });
});

describe("PERAN_SISA_STOK", () => {
  it("hanya memuat cashier, barista, dan admin", () => {
    // Customer TIDAK boleh. Docs/pemissions.md bagian 2: customer hanya melihat
    // menu Habis atau tersedia, bukan angka stok.
    expect([...PERAN_SISA_STOK]).toEqual(["cashier", "barista", "admin"]);
    expect(PERAN_SISA_STOK).not.toContain("customer");
  });
});
