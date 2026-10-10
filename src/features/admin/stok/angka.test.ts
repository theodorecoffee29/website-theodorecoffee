// File ini: tes untuk parsing dan format angka stok.
//
// Semua fungsi di angka.ts MURNI, jadi bisa diuji tanpa database dan tanpa
// browser.

import { describe, expect, it } from "vitest";
import {
  MAKSIMAL_NILAI,
  bersihkanAngka,
  cekAngka,
  angkaJadiAngka,
  formatAngkaIndonesia,
  formatPerubahan,
} from "@/features/admin/stok/angka";
import { teksStokAdmin } from "@/features/admin/stok/teks";

// Memakai pesan asli dari teks.ts, bukan dummy, supaya tes ini ikut menangkap
// kalau nama field pesannya berubah.
const pesan = teksStokAdmin.pesanAngka;

describe("bersihkanAngka", () => {
  it("membaca titik sebagai ribuan dan koma sebagai desimal", () => {
    // "1.234,5" berarti 1234.5. Kalau titiknya ikut diganti jadi titik, hasilnya
    // "1.234.5" yang tidak bisa dibaca sama sekali.
    expect(bersihkanAngka("1.234,5")).toBe("1234.5");
  });

  it("membuang titik ribuan kalau memang susunan ribuan", () => {
    expect(bersihkanAngka("1.234")).toBe("1234");
    expect(bersihkanAngka("1.000.000")).toBe("1000000");
  });

  it("membaca satu titik sebagai desimal kalau bukan susunan ribuan", () => {
    expect(bersihkanAngka("1234.5")).toBe("1234.5");
  });

  it("membuang spasi, termasuk spasi yang tersalin", () => {
    expect(bersihkanAngka(" 1 000 ")).toBe("1000");
  });

  it("membiarkan angka bulat apa adanya", () => {
    expect(bersihkanAngka("25")).toBe("25");
  });
});

describe("cekAngka", () => {
  it("menerima koma maupun titik sebagai pemisah desimal", () => {
    expect(cekAngka("1.234,5", pesan, true).valid).toBe(true);
    expect(cekAngka("1234.5", pesan, true).valid).toBe(true);
  });

  it("menolak isian kosong", () => {
    const hasil = cekAngka("", pesan, true);
    expect(hasil.valid).toBe(false);
    expect(hasil.pesan).toBe(pesan.wajib);
  });

  it("menolak teks yang bukan angka", () => {
    expect(cekAngka("abc", pesan, true).valid).toBe(false);
  });

  it("menolak tanda minus di depan, karena isian harus positif", () => {
    expect(cekAngka("-5", pesan, false).valid).toBe(false);
  });

  it("menerima nol kalau nol boleh", () => {
    expect(cekAngka("0", pesan, true).valid).toBe(true);
  });

  it("menolak nol kalau nol tidak boleh (restock)", () => {
    const hasil = cekAngka("0", pesan, false);
    expect(hasil.valid).toBe(false);
    expect(hasil.pesan).toBe(pesan.positif);
  });

  it("menolak lebih dari tiga angka desimal", () => {
    const hasil = cekAngka("1,2345", pesan, true);
    expect(hasil.valid).toBe(false);
    expect(hasil.pesan).toBe(pesan.desimal);
  });

  it("menerima tepat tiga angka desimal", () => {
    expect(cekAngka("1,234", pesan, true).valid).toBe(true);
  });

  it("menolak angka di atas batas satu juta", () => {
    const hasil = cekAngka("1000001", pesan, true);
    expect(hasil.valid).toBe(false);
    expect(hasil.pesan).toBe(pesan.maks);
  });

  it("menerima angka tepat di batas satu juta", () => {
    expect(cekAngka("1000000", pesan, true).valid).toBe(true);
  });
});

describe("angkaJadiAngka", () => {
  it("mengubah teks Indonesia menjadi angka", () => {
    expect(angkaJadiAngka("1.234,5")).toBeCloseTo(1234.5);
    expect(angkaJadiAngka("25")).toBe(25);
  });

  it("mengembalikan nol kalau teksnya tidak terbaca", () => {
    expect(angkaJadiAngka("abc")).toBe(0);
    expect(angkaJadiAngka("")).toBe(0);
  });
});

describe("formatAngkaIndonesia", () => {
  it("memakai titik untuk ribuan dan koma untuk desimal", () => {
    expect(formatAngkaIndonesia(1234.5)).toBe("1.234,5");
  });

  it("membulatkan ke tiga angka desimal", () => {
    expect(formatAngkaIndonesia(1.2345)).toBe("1,235");
  });

  it("tidak menulis desimal yang tidak perlu", () => {
    expect(formatAngkaIndonesia(25)).toBe("25");
  });

  it("tulis angka nol", () => {
    expect(formatAngkaIndonesia(0)).toBe("0");
  });

  it("tulis angka minus apa adanya", () => {
    expect(formatAngkaIndonesia(-5)).toBe("-5");
  });
});

describe("formatPerubahan", () => {
  it("memberi tanda plus untuk angka positif", () => {
    expect(formatPerubahan(2000)).toBe("+2.000");
  });

  it("memberi tanda minus untuk angka negatif", () => {
    expect(formatPerubahan(-20)).toBe("-20");
  });

  it("tidak memberi tanda untuk nol", () => {
    expect(formatPerubahan(0)).toBe("0");
  });
});

describe("batas nilai", () => {
  it("batasnya satu juta", () => {
    expect(MAKSIMAL_NILAI).toBe(1000000);
  });
});
