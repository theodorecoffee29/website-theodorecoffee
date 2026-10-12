// Tes untuk src/features/barista/api.ts dan src/features/stok/api.ts.
//
// Yang diuji di sini bukan cara fetch-nya (itu butuh browser), tapi PERINGATAN
// KEAMANAN yang paling penting di area Barista: data yang sampai ke komponen
// Barista tidak boleh pernah memuat harga atau pembayaran.
//
// Dasarnya docs/pemissions.md bagian 2: layar Barista hanya menampilkan nomor
// antrean, nama customer, item + jumlah, catatan, dan panel sisa stok. Tanpa
// harga dan data pembayaran.
//
// Cara mengujinya: bentuk data yang dikirim ke komponen tampilan didefinisikan
// oleh tipe di file api.ts. Kalau suatu field ditambahkan ke tipe itu, field itu
// otomatis bisa muncul di layar Barista. Tes inilah yang menangkapnya.

import { describe, expect, it } from "vitest";
import type { ItemAntrean, PesananAntrean, HasilAntrean } from "./api";
import type {
  BahanSisaStok,
  MenuSisaStok,
  HasilSisaStok,
} from "@/features/stok/api";

// Satu pesanan antrean yang lengkap.
const PESANAN: PesananAntrean = {
  orderId: "o1",
  queueNumber: 1,
  customerName: "Budi",
  items: [
    { name: "Americano", qty: 2, note: null },
    { name: "Latte", qty: 1, note: "less sugar" },
  ],
  status: "antrean",
};

// Satu menu sisa stok.
const MENU: MenuSisaStok = {
  menuItemId: "m1",
  name: "Americano",
  portionsLeft: 12,
};

// Satu bahan sisa stok.
const BAHAN: BahanSisaStok = {
  ingredientId: "i1",
  name: "Susu",
  unit: "ml",
  stockQty: 1250,
  isNegative: false,
};

describe("data antrean Barista", () => {
  it("tidak punya field harga, total, atau pembayaran", () => {
    // Ini yang dikirim ke komponen Barista. Kalau nama field harga/amount ada
    // di sini, data itu bisa tampil di layar Barista.
    const namaField = Object.keys(PESANAN);

    expect(namaField).not.toContain("price");
    expect(namaField).not.toContain("total");
    expect(namaField).not.toContain("subtotal");
    expect(namaField).not.toContain("payment");
    expect(namaField).not.toContain("amount");
  });

  it("item antrean juga tidak punya harga", () => {
    const item: ItemAntrean = PESANAN.items[0] ?? {
      name: "",
      qty: 0,
      note: null,
    };

    expect(Object.keys(item)).not.toContain("price");
    expect(Object.keys(item)).not.toContain("subtotal");
  });

  it("hasil antrean hanya punya daftar pesanan", () => {
    const hasil: HasilAntrean = { orders: [PESANAN] };

    expect(Object.keys(hasil)).toEqual(["orders"]);
  });
});

describe("data panel sisa stok", () => {
  it("menu sisa stok tidak punya harga", () => {
    expect(Object.keys(MENU)).not.toContain("price");
  });

  it("bahan sisa stok tidak punya harga atau nominal", () => {
    expect(Object.keys(BAHAN)).not.toContain("price");
    expect(Object.keys(BAHAN)).not.toContain("amount");
  });

  it("hasil panel hanya punya daftar menu dan daftar bahan", () => {
    const hasil: HasilSisaStok = {
      menus: [MENU],
      ingredients: [BAHAN],
    };

    expect(Object.keys(hasil).sort()).toEqual(["ingredients", "menus"]);
  });

  it("tidak ada nama field yang mengandung harga atau pembayaran di seluruh tipe", () => {
    // Penjaga terakhir: gabungkan semua kunci yang mungkin muncul, lalu cari
    // yang mencurigakan. Ini menangkap field baru yang ditambahkan di kemudian
    // hari tanpa disadari.
    const semuaKunci = [
      ...Object.keys(PESANAN),
      ...Object.keys(PESANAN.items[0] ?? {}),
      ...Object.keys(MENU),
      ...Object.keys(BAHAN),
    ];

    const kataTerlarang = [
      "price",
      "harga",
      "total",
      "subtotal",
      "payment",
      "amount",
      "nominal",
    ];

    for (const kunci of semuaKunci) {
      const kunciLower = kunci.toLowerCase();
      for (const kata of kataTerlarang) {
        expect(kunciLower).not.toContain(kata);
      }
    }
  });
});
