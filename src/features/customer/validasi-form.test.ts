// Tes untuk src/features/customer/validasi-form.ts.
//
// Yang diuji: validasi nama, validasi qty, validasi catatan, penghitung total,
// dan ketersediaan tombol kirim.
//
// Perhatikan: total yang diuji di sini HANYA untuk tampilan. Harga sebenarnya
// selalu dihitung server.

import { describe, expect, it } from "vitest";
import {
  bolehKirim,
  hitungTotal,
  menjadiItemSiapKirim,
  validasiCatatan,
  validasiNama,
  validasiQty,
  type BarisPesanan,
} from "./validasi-form";

// Pesan-pesan contoh, supaya tes tidak bergantung pada teksCustomer.
const pesan = {
  nama: { wajib: "Nama wajib diisi.", maks: "Nama maksimal 50 karakter." },
  qty: "Jumlah tiap menu harus antara 0 sampai 99.",
  catatan: "Catatan maksimal 100 karakter.",
  item: "Pilih minimal satu menu dengan jumlah lebih dari 0.",
};

// Dua menu contoh untuk menghitung total.
const daftarMenu = [
  { id: "menu-1", price: 18000 },
  { id: "menu-2", price: 20000 },
];

describe("validasiNama", () => {
  it("menerima nama yang valid", () => {
    expect(validasiNama("Budi", pesan.nama).valid).toBe(true);
  });

  it("memangkas spasi pinggir saat menghitung panjang", () => {
    // Nama dengan spasi pinggir tetap valid kalau isinya tidak kosong.
    expect(validasiNama("   Budi   ", pesan.nama).valid).toBe(true);
  });

  it("menolak nama kosong", () => {
    const hasil = validasiNama("", pesan.nama);
    expect(hasil.valid).toBe(false);
    expect(hasil.pesan).toBe(pesan.nama.wajib);
  });

  it("menolak nama yang hanya spasi", () => {
    expect(validasiNama("    ", pesan.nama).valid).toBe(false);
  });

  it("menerima nama tepat 50 karakter", () => {
    expect(validasiNama("a".repeat(50), pesan.nama).valid).toBe(true);
  });

  it("menolak nama lebih dari 50 karakter", () => {
    expect(validasiNama("a".repeat(51), pesan.nama).valid).toBe(false);
  });
});

describe("validasiQty", () => {
  it("menerima qty antara 0 sampai 99", () => {
    expect(validasiQty("0", pesan.qty).valid).toBe(true);
    expect(validasiQty("1", pesan.qty).valid).toBe(true);
    expect(validasiQty("99", pesan.qty).valid).toBe(true);
  });

  it("menerima isian kosong sebagai 0 (menu tidak dipilih)", () => {
    expect(validasiQty("", pesan.qty).valid).toBe(true);
  });

  it("menolak qty lebih dari 99", () => {
    expect(validasiQty("100", pesan.qty).valid).toBe(false);
  });

  it("menolak qty yang bukan bilangan bulat", () => {
    expect(validasiQty("1.5", pesan.qty).valid).toBe(false);
    expect(validasiQty("dua", pesan.qty).valid).toBe(false);
    expect(validasiQty("-1", pesan.qty).valid).toBe(false);
  });
});

describe("validasiCatatan", () => {
  it("menerima catatan singkat", () => {
    expect(validasiCatatan("less sugar", pesan.catatan).valid).toBe(true);
  });

  it("menerima catatan kosong", () => {
    expect(validasiCatatan("", pesan.catatan).valid).toBe(true);
  });

  it("menerima catatan tepat 100 karakter", () => {
    expect(validasiCatatan("a".repeat(100), pesan.catatan).valid).toBe(true);
  });

  it("menolak catatan lebih dari 100 karakter", () => {
    expect(validasiCatatan("a".repeat(101), pesan.catatan).valid).toBe(false);
  });
});

describe("hitungTotal", () => {
  it("menghitung total dari harga menu kali jumlah", () => {
    const baris: BarisPesanan[] = [
      { menuItemId: "menu-1", qty: "2", note: "" },
      { menuItemId: "menu-2", qty: "1", note: "" },
    ];
    // 18000*2 + 20000*1 = 56000.
    expect(hitungTotal(baris, daftarMenu)).toBe(56000);
  });

  it("mengabaikan baris dengan qty 0", () => {
    const baris: BarisPesanan[] = [
      { menuItemId: "menu-1", qty: "2", note: "" },
      { menuItemId: "menu-2", qty: "0", note: "" },
    ];
    expect(hitungTotal(baris, daftarMenu)).toBe(36000);
  });

  it("mengabaikan baris yang menunya tidak ditemukan", () => {
    const baris: BarisPesanan[] = [
      { menuItemId: "menu-tidak-ada", qty: "3", note: "" },
      { menuItemId: "menu-1", qty: "1", note: "" },
    ];
    // Hanya menu-1 yang dihitung.
    expect(hitungTotal(baris, daftarMenu)).toBe(18000);
  });

  it("mengembalikan 0 saat tidak ada baris", () => {
    expect(hitungTotal([], daftarMenu)).toBe(0);
  });

  it("mengabaikan catatan (catatan tidak berpengaruh ke harga)", () => {
    const tanpaCatatan: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "2", note: "" }];
    const denganCatatan: BarisPesanan[] = [
      { menuItemId: "menu-1", qty: "2", note: "less sugar sekeras batu" },
    ];
    expect(hitungTotal(denganCatatan, daftarMenu)).toBe(hitungTotal(tanpaCatatan, daftarMenu));
  });
});

describe("menjadiItemSiapKirim", () => {
  it("hanya mengirim baris yang qty-nya lebih dari 0", () => {
    const baris: BarisPesanan[] = [
      { menuItemId: "menu-1", qty: "2", note: "" },
      { menuItemId: "menu-2", qty: "0", note: "" },
    ];
    const hasil = menjadiItemSiapKirim(baris);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].menuItemId).toBe("menu-1");
    expect(hasil[0].qty).toBe(2);
  });

  it("tidak mengirim catatan yang kosong", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "1", note: "  " }];
    const hasil = menjadiItemSiapKirim(baris);
    expect(hasil[0].note).toBeUndefined();
  });

  it("mengirim catatan yang ada", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "1", note: " less sugar " }];
    const hasil = menjadiItemSiapKirim(baris);
    // Catatan dipangkas spasi pinggir sebelum dikirim.
    expect(hasil[0].note).toBe("less sugar");
  });

  it("mengembalikan daftar kosong saat semua qty 0", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "0", note: "" }];
    expect(menjadiItemSiapKirim(baris)).toEqual([]);
  });
});

describe("bolehKirim", () => {
  it("benar saat nama valid dan ada minimal satu item", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "1", note: "" }];
    expect(bolehKirim("Budi", baris, pesan)).toBe(true);
  });

  it("salah saat nama kosong walau item ada", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "1", note: "" }];
    expect(bolehKirim("", baris, pesan)).toBe(false);
  });

  it("salah saat tidak ada item yang dipilih", () => {
    const baris: BarisPesanan[] = [{ menuItemId: "menu-1", qty: "0", note: "" }];
    expect(bolehKirim("Budi", baris, pesan)).toBe(false);
  });

  it("salah saat nama dan item sama-sama kosong", () => {
    expect(bolehKirim("", [], pesan)).toBe(false);
  });
});