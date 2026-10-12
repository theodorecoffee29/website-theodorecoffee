// Tes untuk src/features/stok/sisa-porsi.ts dan format.ts.
//
// Dua file ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.
//
// Yang diuji:
//   1. Logika petunjuk "Stok tidak cukup": jumlah pesanan dibanding sisa porsi,
//      termasuk kasus porsi 0 dan menu tanpa resep.
//   2. Format angka stok memakai pemisah ribuan versi Indonesia.

import { describe, expect, it } from "vitest";
import {
  cariSisaPorsi,
  stokTidakCukup,
  type MenuStokRingkas,
} from "./sisa-porsi";
import { formatStokIndonesia } from "./format";

// Daftar menu sisa stok untuk beberapa tes.
const DAFTAR_MENU: MenuStokRingkas[] = [
  { menuItemId: "m1", portionsLeft: 10 },
  { menuItemId: "m2", portionsLeft: 0 },
  // Menu tanpa resep: sisa porsinya tidak bisa dihitung.
  { menuItemId: "m3", portionsLeft: null },
];

describe("cariSisaPorsi", () => {
  it("menemukan sisa porsi menu yang ada", () => {
    expect(cariSisaPorsi(DAFTAR_MENU, "m1")).toBe(10);
  });

  it("mengembalikan 0 untuk menu yang bahannya habis", () => {
    // 0 adalah nilai yang sah dan BUKAN berarti "tidak ditemukan".
    expect(cariSisaPorsi(DAFTAR_MENU, "m2")).toBe(0);
  });

  it("mengembalikan null untuk menu tanpa resep", () => {
    expect(cariSisaPorsi(DAFTAR_MENU, "m3")).toBeNull();
  });

  it("mengembalikan null untuk menu yang tidak ada di daftar", () => {
    expect(cariSisaPorsi(DAFTAR_MENU, "m9")).toBeNull();
  });

  it("mengembalikan null kalau menuItemId kosong", () => {
    // Order lama bisa tidak punya menuItemId.
    expect(cariSisaPorsi(DAFTAR_MENU, null)).toBeNull();
    expect(cariSisaPorsi(DAFTAR_MENU, "")).toBeNull();
  });
});

describe("stokTidakCukup", () => {
  it("true kalau jumlah pesanan melebihi sisa porsi", () => {
    expect(stokTidakCukup(DAFTAR_MENU, "m1", 11)).toBe(true);
  });

  it("false kalau jumlah pesanan sama dengan sisa porsi", () => {
    // Tepat sama masih cukup: bahan habis tepat setelah pesanan dibuat.
    expect(stokTidakCukup(DAFTAR_MENU, "m1", 10)).toBe(false);
  });

  it("false kalau jumlah pesanan lebih sedikit dari sisa porsi", () => {
    expect(stokTidakCukup(DAFTAR_MENU, "m1", 3)).toBe(false);
  });

  it("true kalau sisa porsinya 0 dan pesanan meminta minimal satu", () => {
    expect(stokTidakCukup(DAFTAR_MENU, "m2", 1)).toBe(true);
  });

  it("false kalau sisa porsinya 0 dan tidak ada pesanan", () => {
    // 0 > 0 salah, jadi tidak dianggap tidak cukup.
    expect(stokTidakCukup(DAFTAR_MENU, "m2", 0)).toBe(false);
  });

  it("TIDAK pernah true untuk menu tanpa resep", () => {
    // Menu tanpa resep tidak punya bahan, jadi tidak bisa "tidak cukup".
    // Kalau ini true, Cashier akan melihat peringatan yang salah.
    expect(stokTidakCukup(DAFTAR_MENU, "m3", 99)).toBe(false);
  });

  it("false kalau menunya tidak ada di daftar sisa stok", () => {
    // Panel sisa stok mungkin belum termuat. Lebih baik tidak memberi
    // peringatan daripada memberi peringatan yang salah.
    expect(stokTidakCukup(DAFTAR_MENU, "m9", 99)).toBe(false);
  });

  it("false kalau daftar sisa stok masih kosong", () => {
    expect(stokTidakCukup([], "m1", 99)).toBe(false);
  });

  it("false kalau menuItemId kosong", () => {
    expect(stokTidakCukup(DAFTAR_MENU, null, 99)).toBe(false);
  });

  it("menganggap jumlah yang tidak terbaca sebagai 0", () => {
    // Jumlah NaN tidak boleh membuat panel menampilkan peringatan palsu.
    expect(stokTidakCukup(DAFTAR_MENU, "m1", Number.NaN)).toBe(false);
  });
});

describe("formatStokIndonesia", () => {
  it("memakai titik sebagai pemisah ribuan", () => {
    expect(formatStokIndonesia(5000)).toBe("5.000");
    expect(formatStokIndonesia(12500)).toBe("12.500");
    expect(formatStokIndonesia(1000000)).toBe("1.000.000");
  });

  it("memakai koma sebagai pemisah desimal", () => {
    expect(formatStokIndonesia(1.25)).toBe("1,25");
    expect(formatStokIndonesia(0.5)).toBe("0,5");
  });

  it("membulatkan ke tiga angka di belakang koma", () => {
    // Batas kolom numeric(12,3) di database. Tanpa pembulatan, angka seperti
    // 0.30000000000000004 akan tampil dengan semua desimalnya.
    expect(formatStokIndonesia(1.23456)).toBe("1,235");
  });

  it("menampilkan angka bulat tanpa desimal", () => {
    expect(formatStokIndonesia(25)).toBe("25");
  });

  it("menampilkan nol", () => {
    expect(formatStokIndonesia(0)).toBe("0");
  });

  it("menampilkan stok minus apa adanya", () => {
    expect(formatStokIndonesia(-10)).toBe("-10");
    expect(formatStokIndonesia(-1250)).toBe("-1.250");
  });

  it("menampilkan 0 untuk angka yang tidak valid", () => {
    // "NaN" di layar akan membingungkan Cashier.
    expect(formatStokIndonesia(Number.NaN)).toBe("0");
    expect(formatStokIndonesia(Number.POSITIVE_INFINITY)).toBe("0");
  });
});
