// Tes untuk src/lib/server/validasi-admin.ts.
//
// Yang diuji: semua batas validasi sesuai docs/api-contract.md bagian 4b,
// termasuk batas atas dan bawah, koma berlebih, dan bahan ganda di resep.
//
// File ini murni (tanpa database), jadi tesnya cepat.

import { describe, expect, it } from "vitest";
import {
  koreksiStokSchema,
  buatBahanSchema,
  buatMenuSchema,
  restockBahanSchema,
  ubahBahanSchema,
  ubahMenuSchema,
  ubahResepSchema,
  ubahStatusMenuSchema,
} from "./validasi-admin";

const UUID_BAHAN_1 = "11111111-1111-4111-8111-111111111111";
const UUID_BAHAN_2 = "22222222-2222-4222-8222-222222222222";

describe("nama menu dan bahan", () => {
  it("menerima nama yang valid", () => {
    expect(
      buatMenuSchema.safeParse({ name: "Kopi Susu", price: 22000 }).success,
    ).toBe(true);
  });

  it("memangkas spasi pinggir sebelum menghitung panjang", () => {
    const hasil = buatMenuSchema.safeParse({ name: "   Budi   ", price: 1000 });
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.name).toBe("Budi");
    }
  });

  it("menolak nama kosong dan yang hanya spasi", () => {
    expect(buatMenuSchema.safeParse({ name: "", price: 1000 }).success).toBe(
      false,
    );
    expect(buatMenuSchema.safeParse({ name: "   ", price: 1000 }).success).toBe(
      false,
    );
  });

  it("menerima nama tepat 60 karakter dan menolak 61", () => {
    const batas = "a".repeat(60);
    expect(buatMenuSchema.safeParse({ name: batas, price: 1000 }).success).toBe(
      true,
    );
    expect(
      buatMenuSchema.safeParse({ name: "a".repeat(61), price: 1000 }).success,
    ).toBe(false);
  });
});

describe("harga menu", () => {
  it("menerima harga di dalam batas", () => {
    expect(buatMenuSchema.safeParse({ name: "A", price: 1 }).success).toBe(
      true,
    );
    expect(
      buatMenuSchema.safeParse({ name: "A", price: 10000000 }).success,
    ).toBe(true);
  });

  it("menolak harga di bawah 1 dan di atas 10.000.000", () => {
    // Batas atas 10 juta mencegah harga salah ketik (mis. 100000000) langsung
    // dipakai di laporan.
    expect(buatMenuSchema.safeParse({ name: "A", price: 0 }).success).toBe(
      false,
    );
    expect(buatMenuSchema.safeParse({ name: "A", price: -100 }).success).toBe(
      false,
    );
    expect(
      buatMenuSchema.safeParse({ name: "A", price: 10000001 }).success,
    ).toBe(false);
  });

  it("menolak harga pecahan dan bukan angka", () => {
    expect(buatMenuSchema.safeParse({ name: "A", price: 1.5 }).success).toBe(
      false,
    );
    expect(buatMenuSchema.safeParse({ name: "A", price: "abc" }).success).toBe(
      false,
    );
  });

  it("menerima harga yang dikirim sebagai teks angka", () => {
    // Body dari JSON hanya bisa membawa angka, tapi z.coerce tetap aman kalau
    //nilainya teks (mis. dari form yang diserialisasi jadi string).
    expect(
      buatMenuSchema.safeParse({ name: "A", price: "22000" }).success,
    ).toBe(true);
  });

  it("berlaku sama di schema ubah menu", () => {
    expect(ubahMenuSchema.safeParse({ name: "A", price: 0 }).success).toBe(
      false,
    );
    expect(ubahMenuSchema.safeParse({ name: "A", price: 22000 }).success).toBe(
      true,
    );
  });
});

describe("status aktif menu", () => {
  it("menerima true dan false", () => {
    expect(ubahStatusMenuSchema.safeParse({ isActive: true }).success).toBe(
      true,
    );
    expect(ubahStatusMenuSchema.safeParse({ isActive: false }).success).toBe(
      true,
    );
  });

  it("menolak tanpa isActive (tidak ada nilai bawaan)", () => {
    // Admin harus benar-benar memilih, tidak boleh ada asumsi default.
    expect(ubahStatusMenuSchema.safeParse({}).success).toBe(false);
  });

  it("menolak nilai yang bukan boolean", () => {
    expect(ubahStatusMenuSchema.safeParse({ isActive: "ya" }).success).toBe(
      false,
    );
  });
});

describe("satuan bahan", () => {
  it("menerima g, ml, dan pcs", () => {
    for (const unit of ["g", "ml", "pcs"]) {
      expect(
        buatBahanSchema.safeParse({ name: "Susu", unit: unit }).success,
      ).toBe(true);
    }
  });

  it("menolak satuan lain", () => {
    expect(
      buatBahanSchema.safeParse({ name: "Susu", unit: "ons" }).success,
    ).toBe(false);
    expect(buatBahanSchema.safeParse({ name: "Susu" }).success).toBe(false);
  });
});

describe("stok awal bahan", () => {
  it("menerima initialStock opsional", () => {
    // Tidak mengirimnya berarti 0 (tidak ada pergerakan restock).
    expect(buatBahanSchema.safeParse({ name: "Susu", unit: "g" }).success).toBe(
      true,
    );
  });

  it("menerima 0 dan lebih dari 0", () => {
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 0 })
        .success,
    ).toBe(true);
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 5000 })
        .success,
    ).toBe(true);
  });

  it("menolak initialStock negatif", () => {
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: -1 })
        .success,
    ).toBe(false);
  });

  it("menolak lebih dari 1.000.000", () => {
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 1000001 })
        .success,
    ).toBe(false);
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 1000000 })
        .success,
    ).toBe(true);
  });

  it("menolak lebih dari 3 angka di belakang koma", () => {
    // Kolomnya numeric(12,3): lebih dari 3 desimal akan dipotong diam-diam.
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 0.25 })
        .success,
    ).toBe(true);
    expect(
      buatBahanSchema.safeParse({ name: "S", unit: "g", initialStock: 0.2501 })
        .success,
    ).toBe(false);
  });
});

describe("ubah bahan (hanya nama)", () => {
  it("menerima nama saja", () => {
    expect(ubahBahanSchema.safeParse({ name: "Susu UHT" }).success).toBe(true);
  });

  it("TIDAK menerima field unit (satuan tidak bisa diubah)", () => {
    // Skema tidak punya field unit, jadi field itu diabaikan dan satuan tidak
    // berubah. Yang penting: fungsi ini tidak gagal karena unit dikirim.
    const hasil = ubahBahanSchema.safeParse({ name: "Susu", unit: "ml" });
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data).not.toHaveProperty("unit");
    }
  });

  it("menolak nama kosong", () => {
    expect(ubahBahanSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("restock bahan", () => {
  it("menerima qty lebih dari 0", () => {
    expect(restockBahanSchema.safeParse({ qty: 1 }).success).toBe(true);
    expect(restockBahanSchema.safeParse({ qty: 2000 }).success).toBe(true);
  });

  it("menolak qty 0 dan negatif", () => {
    // Restock berarti menambah, jadi 0 atau negatif tidak masuk akal.
    expect(restockBahanSchema.safeParse({ qty: 0 }).success).toBe(false);
    expect(restockBahanSchema.safeParse({ qty: -5 }).success).toBe(false);
    expect(restockBahanSchema.safeParse({}).success).toBe(false);
  });

  it("menerima note opsional maksimal 100 karakter", () => {
    expect(
      restockBahanSchema.safeParse({ qty: 1, note: "Pembelian" }).success,
    ).toBe(true);
    expect(
      restockBahanSchema.safeParse({ qty: 1, note: "a".repeat(100) }).success,
    ).toBe(true);
    expect(
      restockBahanSchema.safeParse({ qty: 1, note: "a".repeat(101) }).success,
    ).toBe(false);
  });

  it("menolak qty dengan lebih dari 3 desimal", () => {
    expect(restockBahanSchema.safeParse({ qty: 1.234 }).success).toBe(true);
    expect(restockBahanSchema.safeParse({ qty: 1.2345 }).success).toBe(false);
  });
});

describe("koreksi stok", () => {
  it("menerima newQty 0 atau lebih", () => {
    // 0 berarti stok habis setelah hasil hitung fisik.
    expect(
      koreksiStokSchema.safeParse({ newQty: 0, reason: "Habis" }).success,
    ).toBe(true);
    expect(
      koreksiStokSchema.safeParse({ newQty: 6500, reason: "Hitung ulang" })
        .success,
    ).toBe(true);
  });

  it("menolak newQty negatif", () => {
    // Hasil hitung fisik tidak mungkin minus.
    expect(
      koreksiStokSchema.safeParse({ newQty: -1, reason: "Salah" }).success,
    ).toBe(false);
  });

  it("menolak tanpa alasan", () => {
    // Tanpa alasan, riwayat stok tidak bisa ditelusuri.
    expect(koreksiStokSchema.safeParse({ newQty: 10 }).success).toBe(false);
    expect(
      koreksiStokSchema.safeParse({ newQty: 10, reason: "   " }).success,
    ).toBe(false);
  });

  it("menerima alasan 1 sampai 100 karakter", () => {
    expect(
      koreksiStokSchema.safeParse({ newQty: 1, reason: "a" }).success,
    ).toBe(true);
    expect(
      koreksiStokSchema.safeParse({ newQty: 1, reason: "a".repeat(100) })
        .success,
    ).toBe(true);
    expect(
      koreksiStokSchema.safeParse({ newQty: 1, reason: "a".repeat(101) })
        .success,
    ).toBe(false);
  });

  it("menolak newQty dengan lebih dari 3 desimal", () => {
    expect(
      koreksiStokSchema.safeParse({ newQty: 0.125, reason: "Timbang" }).success,
    ).toBe(true);
    expect(
      koreksiStokSchema.safeParse({ newQty: 0.1251, reason: "Timbang" })
        .success,
    ).toBe(false);
  });
});

describe("resep menu", () => {
  it("menerima resep kosong (menu dianggap selalu tersedia)", () => {
    expect(ubahResepSchema.safeParse({ lines: [] }).success).toBe(true);
  });

  it("menerima baris resep yang valid", () => {
    expect(
      ubahResepSchema.safeParse({
        lines: [
          { ingredientId: UUID_BAHAN_1, qtyPerPortion: 20 },
          { ingredientId: UUID_BAHAN_2, qtyPerPortion: 0.5 },
        ],
      }).success,
    ).toBe(true);
  });

  it("menolak lebih dari 20 baris", () => {
    const banyak = Array.from({ length: 21 }, () => ({
      ingredientId: UUID_BAHAN_1,
      qtyPerPortion: 1,
    }));
    expect(ubahResepSchema.safeParse({ lines: banyak }).success).toBe(false);
  });

  it("menerima tepat 20 baris", () => {
    // 20 baris dengan bahan yang sama aman dari aturan jumlah; yang dicek
    // terpisah oleh aturan bahan ganda.
    const banyak = Array.from({ length: 20 }, (_, index) => ({
      ingredientId: `00000000-0000-4000-8000-0000000000${(index + 10).toString()}`,
      qtyPerPortion: 1,
    }));
    expect(ubahResepSchema.safeParse({ lines: banyak }).success).toBe(true);
  });

  it("menolak ingredientId yang bukan uuid", () => {
    expect(
      ubahResepSchema.safeParse({
        lines: [{ ingredientId: "bukan-uuid", qtyPerPortion: 1 }],
      }).success,
    ).toBe(false);
  });

  it("menolak bahan yang disebut lebih dari sekali", () => {
    // Aturan ini diperiksa di server juga, supaya pesannya menyebut bahan mana
    // yang ganda sebelum dikirim ke database.
    expect(
      ubahResepSchema.safeParse({
        lines: [
          { ingredientId: UUID_BAHAN_1, qtyPerPortion: 10 },
          { ingredientId: UUID_BAHAN_1, qtyPerPortion: 20 },
        ],
      }).success,
    ).toBe(false);
  });

  it("menerima dua bahan yang berbeda", () => {
    expect(
      ubahResepSchema.safeParse({
        lines: [
          { ingredientId: UUID_BAHAN_1, qtyPerPortion: 10 },
          { ingredientId: UUID_BAHAN_2, qtyPerPortion: 20 },
        ],
      }).success,
    ).toBe(true);
  });

  it("menolak qtyPerPortion 0 dan negatif", () => {
    expect(
      ubahResepSchema.safeParse({
        lines: [{ ingredientId: UUID_BAHAN_1, qtyPerPortion: 0 }],
      }).success,
    ).toBe(false);
    expect(
      ubahResepSchema.safeParse({
        lines: [{ ingredientId: UUID_BAHAN_1, qtyPerPortion: -1 }],
      }).success,
    ).toBe(false);
  });

  it("menolak qtyPerPortion dengan lebih dari 3 desimal", () => {
    expect(
      ubahResepSchema.safeParse({
        lines: [{ ingredientId: UUID_BAHAN_1, qtyPerPortion: 0.125 }],
      }).success,
    ).toBe(true);
    expect(
      ubahResepSchema.safeParse({
        lines: [{ ingredientId: UUID_BAHAN_1, qtyPerPortion: 0.1251 }],
      }).success,
    ).toBe(false);
  });

  it("menolak tanpa field lines", () => {
    expect(ubahResepSchema.safeParse({}).success).toBe(false);
  });
});
