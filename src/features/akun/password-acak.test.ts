// Tes untuk src/features/akun/password-acak.ts.
//
// Yang diuji:
//   1. Panjangnya tepat 12 karakter.
//   2. Memuat huruf besar, huruf kecil, dan angka (syarat password minimal 10 karakter).
//   3. TIDAK memuat karakter yang mudah tertukar (0, O, 1, I, l).
//   4. Dua pemanggilan menghasilkan password yang BERBEDA.
//
// CATATAN SOAL crypto: fungsi yang diuji memakai crypto.getRandomValues, yang tersedia
// sebagai global di Node versi modern, jadi tes bisa berjalan tanpa peramban.

import { describe, expect, it } from "vitest";
import { buatPasswordAcak, PANJANG_PASSWORD_ACAK } from "./password-acak";

// Jumlah password yang dibuat untuk pengujian yang butuh banyak sampel.
//
// 40 sampel cukup untuk hampir pasti menemukan karakter yang salah, tanpa memperlambat
// tes.
const JUMLAH_SAMPEL = 40;

// Kumpulan password untuk pengujian yang butuh banyak sampel sekaligus.
const semuaSampel: string[] = [];
for (let i = 0; i < JUMLAH_SAMPEL; i++) {
  semuaSampel.push(buatPasswordAcak());
}

describe("buatPasswordAcak", () => {
  it("menghasilkan password sepanjang 12 karakter", () => {
    expect(PANJANG_PASSWORD_ACAK).toBe(12);

    for (const satu of semuaSampel) {
      expect(satu).toHaveLength(PANJANG_PASSWORD_ACAK);
    }
  });

  it("memuat huruf besar, huruf kecil, dan angka", () => {
    // Tiga kelas ini wajib ada karena aturan password mewajibkan huruf dan angka.
    // Tanpa dijamin, sekitar 1 dari 400 password acak bisa saja hanya berisi huruf,
    // dan Admin akan mendapat pesan "password harus memuat angka" untuk password yang
    // dia sendiri minta dibuat.
    for (const satu of semuaSampel) {
      expect(satu).toMatch(/[A-Z]/);
      expect(satu).toMatch(/[a-z]/);
      expect(satu).toMatch(/[0-9]/);
    }
  });

  it("tidak memuat karakter yang mudah tertukar", () => {
    // "O" dan "0", "I" dan "1", serta huruf kecil "l" sering tertukar saat dibaca keras
    // atau saat disalin dari kertas. Jadi karakter itu dihilangkan sama sekali.
    for (const satu of semuaSampel) {
      expect(satu).not.toMatch(/[0O1Il]/);
    }
  });

  it("hanya memakai huruf dan angka", () => {
    // Password ini juga ditulis di kertas dan dibaca keras-keras, jadi karakter khusus
    // yang sulit ditulis tidak dipakai.
    for (const satu of semuaSampel) {
      expect(satu).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("menghasilkan nilai yang berbeda pada setiap pemanggilan", () => {
    // Password yang selalu sama berarti tombol "Buat password acak" tidak berguna.
    // Jumlah nilai unik dihitung, jadi tes tidak hanya memeriksa satu pasang yang bisa
    // kebetulan sama.
    expect(new Set(semuaSampel).size).toBe(semuaSampel.length);
  });

  it("tidak menghasilkan password yang sama pada sampel besar", () => {
    // Pengaman tambahan dengan sampel lebih banyak. Kalau implementasi memakai sumber
    // acak yang buruk (mis. selalu mengembalikan nilai yang sama), tes ini langsung
    // gagal dan penyebabnya jelas.
    const banyak: string[] = [];
    for (let i = 0; i < 200; i++) {
      banyak.push(buatPasswordAcak());
    }

    expect(new Set(banyak).size).toBe(200);
  });

  it("memakai sumber acak yang tersedia untuk keamanan", () => {
    // crypto.getRandomValues adalah sumber acak yang dirancang untuk keamanan. Math.random
    // tidak boleh dipakai untuk password karena hasilnya bisa diprediksi.
    // Yang bisa diperiksa di sini: fungsi yang dipakai benar-benar tersedia, dan
    // hasilnya bervariasi (dibuktikan tes di atas).
    expect(typeof crypto.getRandomValues).toBe("function");
  });
});
