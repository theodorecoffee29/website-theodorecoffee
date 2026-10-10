// Tes untuk src/features/admin/menu/format.ts dan takaran.ts.
//
// Yang diuji:
//   1. Pemformat rupiah (pemisah ribuan gaya Indonesia).
//   2. Validator nama dan harga menu.
//   3. Pengubah takaran: koma jadi titik, batas 3 desimal, tolak nol dan negatif.
//
// File-file ini murni (tanpa React dan tanpa database), jadi mudah diuji.

import { describe, expect, it } from "vitest";
import {
  cekHargaMenu,
  cekNamaMenu,
  formatRupiah,
  hargaJadiAngka,
} from "./format";
import {
  bersihkanTakaran,
  cekTakaran,
  takaranJadiAngka,
  takaranJadiTeks,
} from "./takaran";

// Pesan yang dipakai di tes (dari teks.ts).
const PESAN_NAMA = { wajib: "Nama wajib", maks: "Nama maksimal 60 karakter" };
const PESAN_HARGA = {
  wajib: "Harga wajib",
  batas: "Harga 1 sampai 10.000.000",
};
const PESAN_TAKARAN = {
  wajib: "Takaran wajib diisi",
  positif: "Takaran harus lebih dari 0",
  desimal: "Maksimal 3 desimal",
  maks: "Takaran maksimal 1.000.000",
};

describe("formatRupiah", () => {
  it("mengubah angka jadi rupiah dengan pemisah ribuan titik", () => {
    expect(formatRupiah(20000)).toBe("Rp 20.000");
    expect(formatRupiah(1000)).toBe("Rp 1.000");
    expect(formatRupiah(10000000)).toBe("Rp 10.000.000");
  });

  it("mengubah 0 jadi Rp 0", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("menerima teks angka", () => {
    expect(formatRupiah("22000")).toBe("Rp 22.000");
  });

  it("menghasilkan Rp 0 untuk nilai yang tidak bisa dibaca", () => {
    // Tidak boleh menampilkan "NaN" atau "[object Object]" ke layar.
    expect(formatRupiah(null)).toBe("Rp 0");
    expect(formatRupiah("abc")).toBe("Rp 0");
    expect(formatRupiah(NaN)).toBe("Rp 0");
    expect(formatRupiah({})).toBe("Rp 0");
  });
});

describe("cekNamaMenu", () => {
  it("menerima nama yang valid", () => {
    expect(cekNamaMenu("Kopi Susu", PESAN_NAMA).valid).toBe(true);
  });

  it("memangkas spasi pinggir sebelum menghitung panjang", () => {
    const hasil = cekNamaMenu("   Budi   ", PESAN_NAMA);
    expect(hasil.valid).toBe(true);
  });

  it("menolak nama kosong dan yang hanya spasi", () => {
    expect(cekNamaMenu("", PESAN_NAMA).valid).toBe(false);
    expect(cekNamaMenu("     ", PESAN_NAMA).valid).toBe(false);
  });

  it("menerima 60 karakter dan menolak 61", () => {
    expect(cekNamaMenu("a".repeat(60), PESAN_NAMA).valid).toBe(true);
    expect(cekNamaMenu("a".repeat(61), PESAN_NAMA).valid).toBe(false);
  });
});

describe("cekHargaMenu", () => {
  it("menerima harga dalam batas 1 sampai 10.000.000", () => {
    expect(cekHargaMenu("1", PESAN_HARGA).valid).toBe(true);
    expect(cekHargaMenu("10000000", PESAN_HARGA).valid).toBe(true);
  });

  it("menolak harga di bawah 1 dan di atas 10.000.000", () => {
    expect(cekHargaMenu("0", PESAN_HARGA).valid).toBe(false);
    expect(cekHargaMenu("10000001", PESAN_HARGA).valid).toBe(false);
  });

  it("menolak harga kosong", () => {
    expect(cekHargaMenu("", PESAN_HARGA).valid).toBe(false);
  });

  it("menolak harga pecahan, negatif, dan huruf", () => {
    expect(cekHargaMenu("1.5", PESAN_HARGA).valid).toBe(false);
    expect(cekHargaMenu("-100", PESAN_HARGA).valid).toBe(false);
    expect(cekHargaMenu("abc", PESAN_HARGA).valid).toBe(false);
  });

  it("menolak harga dengan pemisah ribuan titik", () => {
    // "20.000" ambigu: 20000 atau 20.0005. Yang dikirim ke server adalah angka,
    // jadi titik thousands tidak diterima.
    expect(cekHargaMenu("20.000", PESAN_HARGA).valid).toBe(false);
  });

  it("mengubah teks harga valid menjadi angka", () => {
    expect(hargaJadiAngka(" 22000 ")).toBe(22000);
  });
});

describe("bersihkanTakaran", () => {
  it("mengubah koma menjadi titik", () => {
    // Di Locale Indonesia orang menulis 0,25; server dan JavaScript memakai
    // titik. Tanpa diganti, "0,25" dianggap bukan angka.
    expect(bersihkanTakaran("0,25")).toBe("0.25");
    expect(bersihkanTakaran("20,5")).toBe("20.5");
  });

  it("membuang spasi", () => {
    expect(bersihkanTakaran(" 20.5 ")).toBe("20.5");
    expect(bersihkanTakaran("2 0")).toBe("20");
  });
});

describe("cekTakaran", () => {
  it("menerima angka bulat dan desimal", () => {
    expect(cekTakaran("1", PESAN_TAKARAN).valid).toBe(true);
    expect(cekTakaran("20.5", PESAN_TAKARAN).valid).toBe(true);
  });

  it("menerima koma sebagai pemisah desimal", () => {
    // "0,25" (= 0.25) harus diterima karena itu cara orang Indonesia menulis.
    expect(cekTakaran("0,25", PESAN_TAKARAN).valid).toBe(true);
  });

  it("menerima 3 angka desimal dan menolak 4", () => {
    expect(cekTakaran("0.125", PESAN_TAKARAN).valid).toBe(true);
    expect(cekTakaran("0.1251", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran("0,1251", PESAN_TAKARAN).valid).toBe(false);
  });

  it("menolak takaran kosong", () => {
    expect(cekTakaran("", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran("   ", PESAN_TAKARAN).valid).toBe(false);
  });

  it("menolak nol dan negatif", () => {
    // Takaran 0 berarti bahan tidak dipakai, jadi tidak masuk akal.
    expect(cekTakaran("0", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran("0,0", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran("-1", PESAN_TAKARAN).valid).toBe(false);
  });

  it("menolak lebih dari 1.000.000", () => {
    expect(cekTakaran("1000000", PESAN_TAKARAN).valid).toBe(true);
    expect(cekTakaran("1000000.1", PESAN_TAKARAN).valid).toBe(false);
  });

  it("menolak huruf dan titik ganda", () => {
    expect(cekTakaran("abc", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran("1.2.3", PESAN_TAKARAN).valid).toBe(false);
    expect(cekTakaran(".", PESAN_TAKARAN).valid).toBe(false);
  });
});

describe("takaranJadiAngka dan takaranJadiTeks", () => {
  it("mengubah koma menjadi titik lalu jadi angka", () => {
    expect(takaranJadiAngka("0,25")).toBe(0.25);
    expect(takaranJadiAngka("20.5")).toBe(20.5);
    expect(takaranJadiAngka("abc")).toBe(0);
  });

  it("mengubah angka menjadi teks untuk isian", () => {
    expect(takaranJadiTeks(0.25)).toBe("0.25");
    expect(takaranJadiTeks(20)).toBe("20");
    expect(takaranJadiTeks(NaN)).toBe("");
  });
});
