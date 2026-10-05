// Tes contoh untuk memastikan `npm run test` sudah bisa dijalankan.
// File ini tidak dipakai aplikasi, jadi aman dihapus kalau sudah tidak diperlukan.
// Cara menulis tes: describe = kelompok tes, it = satu pemeriksaan,
// expect = apa yang kita harapkan hasilnya.

import { describe, expect, it } from "vitest";

describe("tes contoh", () => {
  it("menjumlahkan dua angka dengan benar", () => {
    // Input: dua angka
    const jumlah = 2 + 3;

    // Harapan: hasilnya 5
    expect(jumlah).toBe(5);
  });
});
