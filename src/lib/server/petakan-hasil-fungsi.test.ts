// Tes untuk src/lib/server/petakan-hasil-fungsi.ts.
//
// Yang diuji: perubahan nama field snake_case dari fungsi database menjadi
// camelCase yang dipakai browser, sesuai docs/api-contract.md bagian 4.
//
// Bentuk data di dalam tes ini disalin dari fungsi database yang sebenarnya
// (supabase/migrations), jadi tes ini gagal kalau pemeta tidak sesuai.

import { describe, expect, it } from "vitest";
import {
  petakanHasilBuatOrder,
  petakanHasilBatal,
  petakanHasilKonfirmasi,
  petakanHasilMenu,
  petakanHasilMulai,
  petakanHasilSelesai,
  petakanHasilStatusOrder,
  petakanOrderManual,
} from "./petakan-hasil-fungsi";

// Bentuk jsonb yang benar-benar dikembalikan create_order.
const CONTOH_HASIL_CREATE_ORDER = {
  order_id: "11111111-1111-4111-8111-111111111111",
  queue_number: 7,
  queue_date: "2026-10-08",
  status: "menunggu_konfirmasi",
  total: 45000,
};

// Bentuk jsonb yang benar-benar dikembalikan get_order_status.
const CONTOH_HASIL_STATUS_ORDER = {
  status: "antrean",
  queue_number: 7,
  queue_date: "2026-10-08",
  items: [
    { name: "Kopi Susu", qty: 2, note: "less sugar" },
    { name: "Es Teh", qty: 1, note: null },
  ],
  total: 45000,
};

// Bentuk jsonb yang benar-benar dikembalikan get_menu.
const CONTOH_HASIL_MENU = {
  items: [
    {
      id: "aaaaaaaa-1111-4111-8111-111111111111",
      name: "Kopi Susu",
      price: 22000,
      available: true,
    },
    {
      id: "bbbbbbbb-2222-4222-8222-222222222222",
      name: "Coklat",
      price: 20000,
      available: false,
    },
  ],
};

// Bentuk jsonb yang benar-benar dikembalikan confirm_order saat ada bahan yang
// stoknya jadi minus.
const CONTOH_HASIL_KONFIRMASI = {
  status: "antrean",
  queue_number: 7,
  stock_warnings: [
    {
      ingredient_id: "cccccccc-3333-4333-8333-333333333333",
      ingredient_name: "Susu",
      stock_after: -12.5,
    },
    {
      ingredient_id: "dddddddd-4444-4444-8444-444444444444",
      ingredient_name: "Coklat",
      stock_after: 0,
    },
  ],
};

describe("petakanHasilBuatOrder", () => {
  it("mengubah nama field snake_case menjadi camelCase", () => {
    expect(petakanHasilBuatOrder(CONTOH_HASIL_CREATE_ORDER)).toEqual({
      orderId: "11111111-1111-4111-8111-111111111111",
      queueNumber: 7,
      queueDate: "2026-10-08",
      status: "menunggu_konfirmasi",
      total: 45000,
    });
  });

  it("tidak meninggalkan field orderId kosong", () => {
    // Ini penyebab bug /status/undefined: kalau orderId tidak dipetakan, nilai
    // yang dibaca browser adalah undefined. Jadi hasilnya harus terisi.
    const hasil = petakanHasilBuatOrder(CONTOH_HASIL_CREATE_ORDER);

    expect(hasil.orderId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("mengisi nilai netral saat data tidak berbentuk objek", () => {
    // Tidak melempar error, tapi bentuk balasannya tetap lengkap.
    expect(petakanHasilBuatOrder(null)).toEqual({
      orderId: "",
      queueNumber: 0,
      queueDate: "",
      status: "",
      total: 0,
    });
    expect(petakanHasilBuatOrder(undefined).total).toBe(0);
  });

  it("mengubah angka yang dikirim sebagai teks menjadi angka", () => {
    // Postgres kadang mengirim numeric sebagai teks. Nilainya harus jadi angka
    // supaya bisa dijumlahkan dan ditampilkan sebagai rupiah.
    const hasil = petakanHasilBuatOrder({
      order_id: "abc",
      queue_number: "12",
      total: "45000",
    });

    expect(hasil.queueNumber).toBe(12);
    expect(hasil.total).toBe(45000);
  });
});

describe("petakanHasilStatusOrder", () => {
  it("mengubah nama field snake_case menjadi camelCase", () => {
    expect(petakanHasilStatusOrder(CONTOH_HASIL_STATUS_ORDER)).toEqual({
      status: "antrean",
      queueNumber: 7,
      queueDate: "2026-10-08",
      items: [
        { name: "Kopi Susu", qty: 2, note: "less sugar" },
        { name: "Es Teh", qty: 1, note: null },
      ],
      total: 45000,
    });
  });

  it("membuang item yang tidak lengkap", () => {
    // Entri tanpa nama atau tanpa qty tidak bisa ditampilkan. Lebih baik
    // dilewati daripada membuat halaman error.
    const hasil = petakanHasilStatusOrder({
      status: "antrean",
      items: [
        { name: "Kopi Susu", qty: 1 },
        { name: "Tanpa Jumlah" },
        { qty: 2 },
        "bukan objek",
        null,
      ],
    });

    expect(hasil.items).toEqual([{ name: "Kopi Susu", qty: 1, note: null }]);
  });

  it("menghasilkan daftar kosong saat items bukan array", () => {
    expect(
      petakanHasilStatusOrder({ status: "antrean", items: null }).items,
    ).toEqual([]);
    expect(petakanHasilStatusOrder({ status: "antrean" }).items).toEqual([]);
  });
});

describe("petakanHasilMenu", () => {
  it("memetakan daftar menu beserta status ketersediaannya", () => {
    expect(petakanHasilMenu(CONTOH_HASIL_MENU)).toEqual({
      items: [
        {
          id: "aaaaaaaa-1111-4111-8111-111111111111",
          name: "Kopi Susu",
          price: 22000,
          available: true,
        },
        {
          id: "bbbbbbbb-2222-4222-8222-222222222222",
          name: "Coklat",
          price: 20000,
          available: false,
        },
      ],
    });
  });

  it("menganggap available yang bukan boolean sebagai tidak tersedia", () => {
    // Menu tanpa status yang jelas harus dianggap tidak bisa dipilih, supaya
    // tidak pernah memesan menu yang sebenarnya habis.
    const hasil = petakanHasilMenu({
      items: [{ id: "x", name: "Menu", price: 1000, available: null }],
    });

    expect(hasil.items[0].available).toBe(false);
  });

  it("menghasilkan daftar kosong saat items bukan array", () => {
    expect(petakanHasilMenu({}).items).toEqual([]);
    expect(petakanHasilMenu(null).items).toEqual([]);
  });
});

describe("petakanHasilKonfirmasi", () => {
  it("mengubah queue_number dan stock_warnings menjadi camelCase", () => {
    expect(petakanHasilKonfirmasi(CONTOH_HASIL_KONFIRMASI)).toEqual({
      status: "antrean",
      queueNumber: 7,
      stockWarnings: [
        { ingredientName: "Susu", stockAfter: -12.5 },
        { ingredientName: "Coklat", stockAfter: 0 },
      ],
    });
  });

  it("tidak mengirim ingredient_id ke browser", () => {
    // Yang dibutuhkan Cashier cuma nama bahan dan stoknya (api-contract bagian 4).
    const hasil = petakanHasilKonfirmasi(CONTOH_HASIL_KONFIRMASI);

    expect(hasil.stockWarnings[0]).not.toHaveProperty("ingredientId");
  });

  it("menghasilkan daftar peringatan kosong saat stock_warnings kosong", () => {
    // Kasus paling sering: stok cukup, jadi tidak ada peringatan sama sekali.
    const hasil = petakanHasilKonfirmasi({
      status: "antrean",
      queue_number: 1,
      stock_warnings: [],
    });

    expect(hasil.stockWarnings).toEqual([]);
  });

  it("menghasilkan daftar peringatan kosong saat stock_warnings tidak ada", () => {
    expect(petakanHasilKonfirmasi({ status: "antrean" }).stockWarnings).toEqual(
      [],
    );
  });
});

describe("pemeta status sederhana (batal, mulai, selesai)", () => {
  it("memetakan hasil cancel_order", () => {
    expect(petakanHasilBatal({ status: "dibatalkan" })).toEqual({
      status: "dibatalkan",
    });
  });

  it("memetakan hasil start_order", () => {
    expect(petakanHasilMulai({ status: "digerjakan" })).toEqual({
      status: "digerjakan",
    });
  });

  it("memetakan hasil finish_order", () => {
    expect(petakanHasilSelesai({ status: "selesai" })).toEqual({
      status: "selesai",
    });
  });

  it("mengisi status kosong saat data tidak berbentuk objek", () => {
    expect(petakanHasilBatal(null)).toEqual({ status: "" });
  });
});

// Bentuk jsonb yang benar-benar dikembalikan create_manual_order.
const CONTOH_HASIL_ORDER_MANUAL = {
  order_id: "11111111-1111-4111-8111-111111111111",
  status: "antrean",
  queue_number: 7,
  stock_warnings: [],
};

describe("petakanOrderManual", () => {
  it("mengubah nama field snake_case menjadi camelCase", () => {
    expect(petakanOrderManual(CONTOH_HASIL_ORDER_MANUAL)).toEqual({
      orderId: "11111111-1111-4111-8111-111111111111",
      queueNumber: 7,
      // Order manual LANGSUNG antrean, tanpa tahap Menunggu konfirmasi.
      status: "antrean",
      stockWarnings: [],
    });
  });

  it("memetakan stock_warnings seperti pada konfirmasi", () => {
    // Order manual juga mengurangi stok, jadi peringatan stoknya sama bentuknya.
    const hasil = petakanOrderManual({
      ...CONTOH_HASIL_ORDER_MANUAL,
      stock_warnings: [
        { ingredient_id: "x", ingredient_name: "Susu", stock_after: -5 },
      ],
    });

    expect(hasil.stockWarnings).toEqual([
      { ingredientName: "Susu", stockAfter: -5 },
    ]);
  });

  it("TIDAK mengirim queueDate", () => {
    // Nomor antrean order manual selalu untuk hari ini, jadi tidak ada
    // queueDate di keluaran (bandingkan dengan petakanHasilBuatOrder).
    const hasil = petakanOrderManual(CONTOH_HASIL_ORDER_MANUAL);

    expect(hasil).not.toHaveProperty("queueDate");
    expect(Object.keys(hasil).sort()).toEqual([
      "orderId",
      "queueNumber",
      "status",
      "stockWarnings",
    ]);
  });

  it("mengisi nilai netral saat data tidak berbentuk objek", () => {
    expect(petakanOrderManual(null)).toEqual({
      orderId: "",
      queueNumber: 0,
      status: "",
      stockWarnings: [],
    });
  });

  it("menghasilkan daftar peringatan kosong saat stock_warnings tidak ada", () => {
    const hasil = petakanOrderManual({ order_id: "abc", queue_number: 1 });
    expect(hasil.stockWarnings).toEqual([]);
  });
});
