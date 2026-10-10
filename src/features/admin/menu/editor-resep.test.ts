// Tes untuk src/features/admin/menu/editor-resep.ts dan ringkasan-resep.ts.
//
// Yang diuji:
//   1. Logika editor resep: tambah baris, hapus baris, cegah bahan ganda, batas
//      20 baris, dan deteksi ada perubahan.
//   2. Pemeta ringkasan resep (teks "3 bahan" atau "Belum ada resep").
//
// File-file ini murni (tanpa React dan tanpa database), jadi mudah diuji.

import { describe, expect, it } from "vitest";
import {
  MAKSIMAL_BARIS,
  adaPerubahan,
  bahanBelumDipakai,
  hapusBarisResep,
  masihBisaTambah,
  resepSama,
  resepsPenuh,
  sudahDipakai,
  tambahBarisResep,
  type HasilOperasi,
} from "./editor-resep";
import { ringkasResep } from "./ringkasan-resep";

// Membuat satu baris resep untuk tes.
function buatBaris(
  ingredientId: string,
  qtyPerPortion = 1,
): HasilOperasi[number] {
  return {
    ingredientId: ingredientId,
    ingredientName: "Bahan " + ingredientId,
    unit: "g",
    qtyPerPortion: qtyPerPortion,
  };
}

const BAHAN_A = "aaaaaaaa-1111-4111-8111-111111111111";
const BAHAN_B = "bbbbbbbb-2222-4222-8222-222222222222";

describe("tambahBarisResep", () => {
  it("menambah bahan baru dengan takaran bawaan 1", () => {
    const hasil = tambahBarisResep([], buatBaris(BAHAN_A));

    expect(hasil).toHaveLength(1);
    expect(hasil[0].ingredientId).toBe(BAHAN_A);
    expect(hasil[0].qtyPerPortion).toBe(1);
  });

  it("menambah bahan kedua setelah yang pertama", () => {
    const hasil = tambahBarisResep([buatBaris(BAHAN_A)], buatBaris(BAHAN_B));

    expect(hasil).toHaveLength(2);
    expect(hasil[1].ingredientId).toBe(BAHAN_B);
  });

  it("MENGAWANG agar bahan yang sama tidak ditambah dua kali", () => {
    // Ini aturan dari docs/api-contract.md bagian 4b: bahan tidak boleh ganda.
    const hasil = tambahBarisResep([buatBaris(BAHAN_A)], buatBaris(BAHAN_A));

    // Panjang tidak berubah, jadi tambahan ditolak.
    expect(hasil).toHaveLength(1);
    expect(hasil[0].ingredientId).toBe(BAHAN_A);
  });

  it("MENGAWANG agar tidak melebihi 20 baris", () => {
    // Buat daftar yang sudah 20 baris.
    const penuh: HasilOperasi = Array.from({ length: MAKSIMAL_BARIS }, (_, i) =>
      buatBaris("bahan-" + i),
    );
    expect(penuh).toHaveLength(20);

    const hasil = tambahBarisResep(penuh, buatBaris(BAHAN_B));

    // Tetap 20, jadi baris ke-21 ditolak.
    expect(hasil).toHaveLength(MAKSIMAL_BARIS);
  });

  it("tidak mengubah daftar asal saat menambah", () => {
    const asal: HasilOperasi = [buatBaris(BAHAN_A)];
    tambahBarisResep(asal, buatBaris(BAHAN_B));

    // Fungsi tidak boleh mengubah daftar yang diberikan (React relies on this).
    expect(asal).toHaveLength(1);
  });
});

describe("hapusBarisResep", () => {
  it("menghapus baris yang dipilih", () => {
    const daftar: HasilOperasi = [buatBaris(BAHAN_A), buatBaris(BAHAN_B)];

    const hasil = hapusBarisResep(daftar, BAHAN_A);

    expect(hasil).toHaveLength(1);
    expect(hasil[0].ingredientId).toBe(BAHAN_B);
  });

  it("menghapus semua baris kalau dihapus semua", () => {
    const daftar: HasilOperasi = [buatBaris(BAHAN_A), buatBaris(BAHAN_B)];

    const hasil = hapusBarisResep(hapusBarisResep(daftar, BAHAN_A), BAHAN_B);

    // Resep kosong diizinkan: menu dianggap selalu tersedia.
    expect(hasil).toEqual([]);
  });

  it("tidak error kalau barisnya tidak ada", () => {
    const daftar: HasilOperasi = [buatBaris(BAHAN_A)];

    const hasil = hapusBarisResep(daftar, "tidak-ada");

    // Daftar tidak berubah.
    expect(hasil).toHaveLength(1);
  });
});

describe("sudahDipakai dan bahanBelumDipakai", () => {
  it("mendeteksi bahan yang sudah dipakai", () => {
    const daftar: HasilOperasi = [buatBaris(BAHAN_A)];

    expect(sudahDipakai(daftar, BAHAN_A)).toBe(true);
    expect(sudahDipakai(daftar, BAHAN_B)).toBe(false);
  });

  it("menyaring bahan yang belum dipakai", () => {
    // Pilihan "Tambah bahan" tidak boleh menampilkan bahan yang sudah di resep.
    const semuaBahan = [
      { ingredientId: BAHAN_A, name: "A" },
      { ingredientId: BAHAN_B, name: "B" },
    ];
    const daftar: HasilOperasi = [buatBaris(BAHAN_A)];

    const hasil = bahanBelumDipakai(semuaBahan, daftar);

    expect(hasil).toHaveLength(1);
    expect(hasil[0].ingredientId).toBe(BAHAN_B);
  });

  it("mengembalikan semua bahan kalau resep kosong", () => {
    const semuaBahan = [
      { ingredientId: BAHAN_A, name: "A" },
      { ingredientId: BAHAN_B, name: "B" },
    ];

    expect(bahanBelumDipakai(semuaBahan, [])).toHaveLength(2);
  });
});

describe("batas 20 baris", () => {
  it("mendeteksi daftar yang sudah penuh", () => {
    const penuh: HasilOperasi = Array.from({ length: MAKSIMAL_BARIS }, (_, i) =>
      buatBaris("bahan-" + i),
    );

    expect(resepsPenuh(penuh)).toBe(true);
    expect(masihBisaTambah(penuh)).toBe(false);
  });

  it("mendeteksi daftar yang masih bisa ditambah", () => {
    const belumPenuh: HasilOperasi = [buatBaris(BAHAN_A)];

    expect(resepsPenuh(belumPenuh)).toBe(false);
    expect(masihBisaTambah(belumPenuh)).toBe(true);
  });
});

describe("resepSama dan adaPerubahan", () => {
  it("menganggap dua daftar yang sama sebagai sama", () => {
    const satu: HasilOperasi = [buatBaris(BAHAN_A, 20)];
    const dua: HasilOperasi = [buatBaris(BAHAN_A, 20)];

    expect(resepSama(satu, dua)).toBe(true);
    expect(adaPerubahan(satu, dua)).toBe(false);
  });

  it("mendeteksi perubahan takaran", () => {
    const asal: HasilOperasi = [buatBaris(BAHAN_A, 20)];
    const diubah: HasilOperasi = [buatBaris(BAHAN_A, 30)];

    expect(adaPerubahan(asal, diubah)).toBe(true);
  });

  it("mendeteksi bahan yang ditambah", () => {
    const asal: HasilOperasi = [buatBaris(BAHAN_A)];
    const ditambah: HasilOperasi = [buatBaris(BAHAN_A), buatBaris(BAHAN_B)];

    expect(adaPerubahan(asal, ditambah)).toBe(true);
  });

  it("mendeteksi bahan yang dihapus", () => {
    const asal: HasilOperasi = [buatBaris(BAHAN_A), buatBaris(BAHAN_B)];
    const dihapus: HasilOperasi = [buatBaris(BAHAN_A)];

    expect(adaPerubahan(asal, dihapus)).toBe(true);
  });

  it("mendeteksi perubahan urutan", () => {
    // Admin yang menyusun ulang baris memang mengubah resepnya, jadi ini harus
    // dianggap berubah.
    const asal: HasilOperasi = [buatBaris(BAHAN_A), buatBaris(BAHAN_B)];
    const disusun: HasilOperasi = [buatBaris(BAHAN_B), buatBaris(BAHAN_A)];

    expect(adaPerubahan(asal, disusun)).toBe(true);
  });

  it("menganggap dua daftar kosong sebagai sama", () => {
    expect(resepSama([], [])).toBe(true);
    expect(adaPerubahan([], [])).toBe(false);
  });
});

describe("ringkasResep", () => {
  it("menampilkan Belum ada resep untuk resep kosong", () => {
    // "0 bahan" membingungkan: bahan memang tidak ada, bukan banyakannya nol.
    expect(ringkasResep([])).toBe("Belum ada resep");
  });

  it("menampilkan 1 bahan untuk satu baris", () => {
    expect(ringkasResep([buatBaris(BAHAN_A)])).toBe("1 bahan");
  });

  it("menampilkan jumlah bahan untuk lebih dari satu baris", () => {
    const daftar: HasilOperasi = [
      buatBaris(BAHAN_A),
      buatBaris(BAHAN_B),
      buatBaris("cccccccc-3333-4333-8333-333333333333"),
    ];

    expect(ringkasResep(daftar)).toBe("3 bahan");
  });
});
