// Tes untuk src/lib/server/pembatas-permintaan.ts.
//
// Fungsi ini murni tanpa database, jadi bisa diuji langsung. Waktu diberikan
// sendiri (bukan Date.now()) supaya kita bisa menguji pergantian periode tanpa
// menunggu.

// Imported dari modul yang sama supaya angkanya tidak ditulis dua kali.
import { beforeEach, describe, expect, it } from "vitest";
import {
  aturanPembatas,
  kosongkanPembatas,
  periksaPembatas,
} from "./pembatas-permintaan";

describe("periksaPembatas", () => {
  beforeEach(() => {
    // Setiap tes mulai dengan penghitung kosong.
    kosongkanPembatas();
  });

  it("mengizinkan permintaan pertama", () => {
    const hasil = periksaPembatas("1.1.1.1", 1000);
    expect(hasil.boleh).toBe(true);
    expect(hasil.sisa).toBe(aturanPembatas().batas - 1);
  });

  it("mengizinkan sampai jumlah batas, lalu menolak", () => {
    const { batas } = aturanPembatas();

    // Permintaan ke-1 sampai ke-batas semuanya diizinkan.
    for (let i = 1; i <= batas; i++) {
      const hasil = periksaPembatas("1.1.1.1", 1000);
      expect(hasil.boleh).toBe(true);
    }

    // Permintaan berikutnya ditolak.
    const setelahBatas = periksaPembatas("1.1.1.1", 1000);
    expect(setelahBatas.boleh).toBe(false);
    expect(setelahBatas.sisa).toBe(0);
  });

  it("menghitung penghitung terpisah untuk tiap alamat IP", () => {
    const { batas } = aturanPembatas();

    // Habiskan batas untuk IP pertama.
    for (let i = 0; i < batas; i++) {
      periksaPembatas("1.1.1.1", 1000);
    }
    expect(periksaPembatas("1.1.1.1", 1000).boleh).toBe(false);

    // IP kedua harus masih boleh, karena punya penghitung sendiri.
    expect(periksaPembatas("2.2.2.2", 1000).boleh).toBe(true);
  });

  it("memulai periode baru setelah durasi periode lewat", () => {
    const { batas, durasiMs } = aturanPembatas();

    // Habiskan batas di waktu 1000.
    for (let i = 0; i < batas; i++) {
      periksaPembatas("1.1.1.1", 1000);
    }
    expect(periksaPembatas("1.1.1.1", 1000).boleh).toBe(false);

    // Setelah periode lewat, penghitung direset dan request boleh lagi.
    const setelahPeriode = periksaPembatas("1.1.1.1", 1000 + durasiMs);
    expect(setelahPeriode.boleh).toBe(true);
  });

  it("tidak mengizinkan tepat sebelum periode habis", () => {
    const { batas, durasiMs } = aturanPembatas();

    for (let i = 0; i < batas; i++) {
      periksaPembatas("1.1.1.1", 1000);
    }

    // Satu milidetik sebelum periode habis, masih ditolak.
    const hampirHabis = periksaPembatas("1.1.1.1", 1000 + durasiMs - 1);
    expect(hampirHabis.boleh).toBe(false);
  });

  it("menyisaikan jumlah saat permintaan ditolak", () => {
    // Setelah ditolak, sisa tetap 0 dan penghitung tidak bertambah.
    for (let i = 0; i < aturanPembatas().batas + 5; i++) {
      periksaPembatas("1.1.1.1", 1000);
    }
    const hasil = periksaPembatas("1.1.1.1", 1000);
    expect(hasil.boleh).toBe(false);
    expect(hasil.sisa).toBe(0);
  });

  it("menangani waktu yang tidak maju (nilai sama)", () => {
    // Nilai waktu yang sama beberapa kali tidak boleh membuat error.
    periksaPembatas("1.1.1.1", 5000);
    periksaPembatas("1.1.1.1", 5000);
    periksaPembatas("1.1.1.1", 5000);
    expect(periksaPembatas("1.1.1.1", 5000).boleh).toBe(true);
  });
});
