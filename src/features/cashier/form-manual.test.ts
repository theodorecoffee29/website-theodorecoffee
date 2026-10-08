// Tes untuk src/features/cashier/form-manual.ts.
//
// Yang diuji: validasi nama, qty, dan catatan; penghitungan total; pembentukan
// item yang siap dikirim; dan syarat tombol Simpan boleh ditekan.
//
// Aturan batas diambil dari docs/api-contract.md bagian 2.

import { describe, expect, it } from "vitest";
import {
  MAKSIMAL_CATATAN,
  MAKSIMAL_NAMA,
  bolehSimpan,
  hitungTotal,
  menjadiItemSiapKirim,
  periksaCatatan,
  periksaForm,
  periksaNama,
  periksaQty,
  type BarisForm,
} from "./form-manual";

// Teks pesan untuk tiap tes (dari teksCashier di pemakaian nyata).
const PESAN = {
  nama: { wajib: "Nama wajib diisi.", maks: "Nama maksimal 50 karakter." },
  qtyMaks: "Jumlah tiap menu harus antara 0 sampai 99.",
  catatanMaks: "Catatan maksimal 100 karakter.",
  jumlahBarisMaks: "Pesanan maksimal 20 baris item.",
};

const PESAN_SIMPAN = PESAN;

// Daftar menu contoh: dua menu dengan harga berbeda.
const MENU = [
  { id: "menu-1", price: 20000 },
  { id: "menu-2", price: 15000 },
];

function buatBaris(ubah: Partial<BarisForm> = {}): BarisForm {
  return {
    menuItemId: "menu-1",
    qty: "1",
    note: "",
    ...ubah,
  };
}

describe("periksaNama", () => {
  it("menerima nama yang valid", () => {
    expect(periksaNama("Budi Santoso", PESAN.nama).valid).toBe(true);
  });

  it("menolak nama kosong dan yang hanya spasi", () => {
    expect(periksaNama("", PESAN.nama).valid).toBe(false);
    // Spasi pinggir dipangkas dulu, jadi isian spasi saja jadi kosong.
    expect(periksaNama("   ", PESAN.nama).valid).toBe(false);
  });

  it("memangkas spasi pinggir sebelum menghitung panjang", () => {
    // Nama dengan spasi excess tapi panjang sebenarnya di bawah 50 tetap valid.
    expect(periksaNama("   Budi   ", PESAN.nama).valid).toBe(true);
  });

  it("menerima nama tepat 50 karakter dan menolak 51", () => {
    expect(periksaNama("a".repeat(MAKSIMAL_NAMA), PESAN.nama).valid).toBe(true);
    expect(periksaNama("a".repeat(MAKSIMAL_NAMA + 1), PESAN.nama).valid).toBe(
      false,
    );
  });
});

describe("periksaQty", () => {
  it("menerima isian kosong sebagai 0 (menu tidak dipilih)", () => {
    expect(periksaQty("", PESAN.qtyMaks).valid).toBe(true);
  });

  it("menerima 0 sampai 99", () => {
    expect(periksaQty("0", PESAN.qtyMaks).valid).toBe(true);
    expect(periksaQty("1", PESAN.qtyMaks).valid).toBe(true);
    expect(periksaQty("99", PESAN.qtyMaks).valid).toBe(true);
  });

  it("menolak lebih dari 99", () => {
    // 99 adalah batas teknis supaya data tidak sampah (api-contract bagian 2).
    expect(periksaQty("100", PESAN.qtyMaks).valid).toBe(false);
  });

  it("menolak angka negatif, desimal, dan huruf", () => {
    expect(periksaQty("-1", PESAN.qtyMaks).valid).toBe(false);
    expect(periksaQty("1.5", PESAN.qtyMaks).valid).toBe(false);
    expect(periksaQty("abc", PESAN.qtyMaks).valid).toBe(false);
  });
});

describe("periksaCatatan", () => {
  it("menerima catatan kosong", () => {
    expect(periksaCatatan("", PESAN.catatanMaks).valid).toBe(true);
  });

  it("menerima 100 karakter dan menolak 101", () => {
    expect(
      periksaCatatan("a".repeat(MAKSIMAL_CATATAN), PESAN.catatanMaks).valid,
    ).toBe(true);
    expect(
      periksaCatatan("a".repeat(MAKSIMAL_CATATAN + 1), PESAN.catatanMaks).valid,
    ).toBe(false);
  });
});

describe("periksaForm", () => {
  it("menerima form yang seluruhnya benar", () => {
    const hasil = periksaForm(
      "Budi",
      [buatBaris({ qty: "2" }), buatBaris({ menuItemId: "menu-2", qty: "1" })],
      PESAN_SIMPAN,
    );

    expect(hasil.valid).toBe(true);
    expect(hasil.pesan).toBeNull();
  });

  it("menolak lebih dari 20 baris item", () => {
    // Batas 20 baris per order (api-contract bagian 2).
    const banyak = Array.from({ length: 21 }, () => buatBaris({ qty: "1" }));
    expect(periksaForm("Budi", banyak, PESAN_SIMPAN).valid).toBe(false);
  });

  it("menolak qty yang tidak valid di salah satu baris", () => {
    const hasil = periksaForm(
      "Budi",
      [
        buatBaris({ qty: "1" }),
        buatBaris({ menuItemId: "menu-2", qty: "abc" }),
      ],
      PESAN_SIMPAN,
    );

    expect(hasil.valid).toBe(false);
  });

  it("menolak catatan yang terlalu panjang", () => {
    const hasil = periksaForm(
      "Budi",
      [buatBaris({ note: "a".repeat(MAKSIMAL_CATATAN + 1) })],
      PESAN_SIMPAN,
    );

    expect(hasil.valid).toBe(false);
  });
});

describe("hitungTotal", () => {
  it("menghitung jumlah harga dikali qty", () => {
    // 2 x 20000 + 1 x 15000 = 55000
    const total = hitungTotal(
      [
        buatBaris({ menuItemId: "menu-1", qty: "2" }),
        buatBaris({ menuItemId: "menu-2", qty: "1" }),
      ],
      MENU,
    );

    expect(total).toBe(55000);
  });

  it("mengabaikan baris dengan qty 0 atau kosong", () => {
    const total = hitungTotal(
      [
        buatBaris({ menuItemId: "menu-1", qty: "0" }),
        buatBaris({ menuItemId: "menu-2", qty: "" }),
      ],
      MENU,
    );

    expect(total).toBe(0);
  });

  it("mengabaikan menu yang tidak ada di daftar", () => {
    // Menu dinonaktifkan mungkin tidak lagi ada di daftar.
    const total = hitungTotal([buatBaris({ menuItemId: "menu-hilang" })], MENU);

    expect(total).toBe(0);
  });

  it("mengabaikan catatan (catatan tidak berpengaruh ke harga)", () => {
    const tanpaCatatan = hitungTotal([buatBaris({ qty: "1" })], MENU);
    const denganCatatan = hitungTotal(
      [buatBaris({ qty: "1", note: "less sugar" })],
      MENU,
    );

    expect(denganCatatan).toBe(tanpaCatatan);
  });

  it("mengembalikan 0 untuk form kosong", () => {
    expect(hitungTotal([], MENU)).toBe(0);
  });
});

describe("menjadiItemSiapKirim", () => {
  it("hanya mengirim baris dengan qty lebih dari 0", () => {
    const hasil = menjadiItemSiapKirim([
      buatBaris({ menuItemId: "menu-1", qty: "2" }),
      buatBaris({ menuItemId: "menu-2", qty: "0" }),
    ]);

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toEqual({ menuItemId: "menu-1", qty: 2 });
  });

  it("tidak mengirim catatan kosong", () => {
    const hasil = menjadiItemSiapKirim([buatBaris({ qty: "1", note: "" })]);

    expect(hasil[0]).not.toHaveProperty("note");
  });

  it("mengirim catatan yang ada isinya", () => {
    const hasil = menjadiItemSiapKirim([
      buatBaris({ qty: "1", note: "  less sugar  " }),
    ]);

    expect(hasil[0].note).toBe("less sugar");
  });

  it("TIDAK mengirim harga dari klien", () => {
    // Harga selalu dihitung ulang di server (api-contract bagian 2).
    const hasil = menjadiItemSiapKirim([buatBaris({ qty: "1" })]);

    expect(hasil[0]).not.toHaveProperty("price");
  });
});

describe("bolehSimpan", () => {
  it("aktif saat semua syarat terpenuhi", () => {
    const hasil = bolehSimpan(
      "Budi",
      [buatBaris({ qty: "1" })],
      "qris",
      PESAN_SIMPAN,
    );

    expect(hasil).toBe(true);
  });

  it("nonaktif saat nama kosong", () => {
    expect(
      bolehSimpan("", [buatBaris({ qty: "1" })], "qris", PESAN_SIMPAN),
    ).toBe(false);
  });

  it("nonaktif saat tidak ada item yang dipilih", () => {
    expect(
      bolehSimpan("Budi", [buatBaris({ qty: "0" })], "qris", PESAN_SIMPAN),
    ).toBe(false);
  });

  it("nonaktif saat metode bayar belum dipilih", () => {
    // Tidak ada nilai bawaan: Cashier wajib memilih sendiri.
    expect(
      bolehSimpan("Budi", [buatBaris({ qty: "1" })], null, PESAN_SIMPAN),
    ).toBe(false);
  });

  it("nonaktif saat waktu manual melanggar aturan", () => {
    // Kalau waktu manual tidak valid, tombol dinonaktifkan supaya tidak
    // mengirim order yang pasti ditolak server.
    const hasil = bolehSimpan(
      "Budi",
      [buatBaris({ qty: "1" })],
      "tunai",
      PESAN_SIMPAN,
      "Waktu manual tidak boleh di masa depan.",
    );

    expect(hasil).toBe(false);
  });

  it("aktif saat waktu manual tidak dicentang (pesan null)", () => {
    const hasil = bolehSimpan(
      "Budi",
      [buatBaris({ qty: "1" })],
      "tunai",
      PESAN_SIMPAN,
      null,
    );

    expect(hasil).toBe(true);
  });

  it("nonaktif saat ada isian jumlah yang tidak valid", () => {
    expect(
      bolehSimpan("Budi", [buatBaris({ qty: "100" })], "qris", PESAN_SIMPAN),
    ).toBe(false);
  });
});
