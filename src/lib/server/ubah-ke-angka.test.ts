// Tes untuk src/lib/server/ubah-ke-angka.ts.
//
// Yang diuji: perubahan nilai dari database (yang bisa berupa teks untuk kolom
// numeric) menjadi angka JavaScript, termasuk kasus tidak terbaca.

import { describe, expect, it } from "vitest";
import {
  nilaiNegatif,
  ubahKeAngka,
  ubahKeBulat,
  ubahKeTeks,
} from "./ubah-ke-angka";

describe("ubahKeAngka", () => {
  it("memakai angka yang sudah berupa angka", () => {
    expect(ubahKeAngka(5000)).toBe(5000);
    expect(ubahKeAngka(-12.5)).toBe(-12.5);
    expect(ubahKeAngka(0)).toBe(0);
  });

  it("mengubah teks angka dari database menjadi angka", () => {
    // Postgres mengirim numeric sebagai teks dalam banyak kasus.
    expect(ubahKeAngka("5000")).toBe(5000);
    expect(ubahKeAngka("5000.000")).toBe(5000);
    expect(ubahKeAngka("-12.500")).toBe(-12.5);
    expect(ubahKeAngka("0.25")).toBe(0.25);
  });

  it("mengabaikan spasi di teks angka", () => {
    // Angka bisa datang dengan spasi di sekitarnya.
    expect(ubahKeAngka("  5000  ")).toBe(5000);
    expect(ubahKeAngka("\n42\n")).toBe(42);
  });

  it("menggunakan nilai cadangan saat tidak terbaca", () => {
    // Nilai cadangan dipakai supaya halaman tidak error karena satu angka rusak.
    expect(ubahKeAngka(null, 0)).toBe(0);
    expect(ubahKeAngka(undefined, 0)).toBe(0);
    expect(ubahKeAngka("bukan angka", 0)).toBe(0);
    expect(ubahKeAngka("", 0)).toBe(0);
  });

  it("memakai nilai cadangan yang diberikan", () => {
    // Nilai cadangan bisa berbeda, misalnya 0 untuk stok dan 7 untuk antrean.
    expect(ubahKeAngka(null, 7)).toBe(7);
    expect(ubahKeAngka("abc", 7)).toBe(7);
  });

  it("menangani angka NaN dan Infinity sebagai tidak terbaca", () => {
    // NaN dan Infinity bukan angka yang bisa dipakai di perhitungan.
    expect(ubahKeAngka(NaN, 0)).toBe(0);
    expect(ubahKeAngka(Infinity, 0)).toBe(0);
    expect(ubahKeAngka(-Infinity, 0)).toBe(0);
  });

  it("menangani boolean dan objek sebagai tidak terbaca", () => {
    // Objek akan jadi "[object Object]" kalau dipaksa jadi angka.
    expect(ubahKeAngka(true, 0)).toBe(0);
    expect(ubahKeAngka({}, 0)).toBe(0);
  });

  it("TIDAK melakukan penjumlahan salah pada teks angka", () => {
    // Ini alasan utama file ini ada: "5000" + "10" di JavaScript jadi "500010".
    const dariDatabase = ["5000", "10"];
    expect(ubahKeAngka(dariDatabase[0]) + ubahKeAngka(dariDatabase[1])).toBe(
      5010,
    );
  });
});

describe("ubahKeBulat", () => {
  it("mengubah angka dan teks angka menjadi bilangan bulat", () => {
    expect(ubahKeBulat(7)).toBe(7);
    expect(ubahKeBulat("7")).toBe(7);
    expect(ubahKeBulat(7.4)).toBe(7);
    expect(ubahKeBulat(7.6)).toBe(8);
  });

  it("menggunakan nilai cadangan saat tidak terbaca", () => {
    expect(ubahKeBulat(null, 0)).toBe(0);
    expect(ubahKeBulat("abc", 3)).toBe(3);
  });
});

describe("nilaiNegatif", () => {
  it("benar untuk stok minus", () => {
    // Stok boleh minus (docs/data-model.md aturan 4), jadi Admin perlu tahu.
    expect(nilaiNegatif(-1)).toBe(true);
    expect(nilaiNegatif("-0.5")).toBe(true);
  });

  it("salah untuk nol dan stok positif", () => {
    // 0 berarti habis, bukan kurang.
    expect(nilaiNegatif(0)).toBe(false);
    expect(nilaiNegatif(100)).toBe(false);
    expect(nilaiNegatif("0")).toBe(false);
  });

  it("salah saat nilai tidak terbaca", () => {
    // Nilai yang tidak terbaca dianggap bukan minus supaya tidak salah tandai.
    expect(nilaiNegatif(null)).toBe(false);
    expect(nilaiNegatif("abc")).toBe(false);
  });
});

describe("ubahKeTeks", () => {
  it("memakai teks yang sudah berupa teks", () => {
    expect(ubahKeTeks("Kopi Susu")).toBe("Kopi Susu");
    expect(ubahKeTeks("")).toBe("");
  });

  it("mengembalikan string kosong untuk nilai bukan teks", () => {
    // String({}) menghasilkan "[object Object]", jadi jangan dipakai.
    expect(ubahKeTeks(null)).toBe("");
    expect(ubahKeTeks(123)).toBe("");
    expect(ubahKeTeks({})).toBe("");
  });
});
