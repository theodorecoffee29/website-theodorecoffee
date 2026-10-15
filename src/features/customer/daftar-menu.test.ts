// Tes untuk src/features/customer/daftar-menu.ts.
//
// Kenapa file ini perlu dites: daftar menu dimuat ulang otomatis tiap 30 detik
// (docs/api-contract.md bagian 5). Kalau penggabungan daftar baru dengan isian
// pengguna salah, isiian yang sudah diketik bisa hilang atau terkirim ke server
// padahal menunya sudah tidak tersedia (server akan menolak dengan
// MENU_UNAVAILABLE).

import { describe, expect, it } from "vitest";
import {
  barisDipilih,
  barisTidakTersediaTerpilih,
  sidikJariPesanan,
  susunBarisPesanan,
  type IsiBaris,
  type MenuRingkas,
} from "@/features/customer/daftar-menu";

// Dua menu untuk dipakai di hampir semua tes.
const DUA_MENU: MenuRingkas[] = [
  { id: "m1", name: "Kopi Susu", price: 20000, available: true },
  { id: "m2", name: "Teh Manis", price: 10000, available: true },
];

describe("gabungan daftar menu baru dengan isian pengguna", () => {
  it("menempelkan isian lama ke menu yang masih ada", () => {
    const isiBaris: IsiBaris = {
      m1: { qty: "2", note: "less sugar" },
      m2: { qty: "1", note: "" },
    };

    const baris = susunBarisPesanan(DUA_MENU, isiBaris);

    expect(baris).toHaveLength(2);
    expect(baris[0]).toEqual({
      menuItemId: "m1",
      nama: "Kopi Susu",
      harga: 20000,
      qty: "2",
      note: "less sugar",
      tersedia: true,
    });
    expect(baris[1].qty).toBe("1");
  });

  it("menu baru yang belum pernah dipilih dapat baris kosong", () => {
    const baris = susunBarisPesanan(
      [
        ...DUA_MENU,
        { id: "m3", name: "Croissant", price: 15000, available: true },
      ],
      { m1: { qty: "1", note: "" } },
    );

    expect(baris).toHaveLength(3);
    const barisCroissant = baris.find((satu) => satu.menuItemId === "m3");
    expect(barisCroissant?.qty).toBe("");
    expect(barisCroissant?.tersedia).toBe(true);
  });

  it("menu yang jadi Habis tetap menyimpan isian dan ditandai tidak tersedia", () => {
    // Menu m2 berubah jadi Habis, tapi isian pengguna TIDAK boleh hilang.
    const menuBaru: MenuRingkas[] = [
      DUA_MENU[0],
      { id: "m2", name: "Teh Manis", price: 10000, available: false },
    ];
    const isiBaris: IsiBaris = { m2: { qty: "3", note: "es sedikit" } };

    const baris = susunBarisPesanan(menuBaru, isiBaris);
    const barisTeh = baris.find((satu) => satu.menuItemId === "m2");

    expect(barisTeh?.qty).toBe("3");
    expect(barisTeh?.note).toBe("es sedikit");
    expect(barisTeh?.tersedia).toBe(false);
  });

  it("menu yang hilang dari daftar (nonaktif) tetap jadi baris di paling akhir", () => {
    const isiBaris: IsiBaris = {
      m1: { qty: "1", note: "" },
      m9: { qty: "4", note: "panas" },
    };

    const baris = susunBarisPesanan(DUA_MENU, isiBaris);

    expect(baris).toHaveLength(3);
    const barisTerakhir = baris[baris.length - 1];
    expect(barisTerakhir.menuItemId).toBe("m9");
    expect(barisTerakhir.nama).toBeNull();
    expect(barisTerakhir.harga).toBeNull();
    expect(barisTerakhir.qty).toBe("4");
    expect(barisTerakhir.tersedia).toBe(false);
  });
});

describe("penanda tidak tersedia dan keadaan tombol kirim", () => {
  it("baris Habis yang dipilih ditandai, dan tidak terpilih tidak", () => {
    const menuBaru: MenuRingkas[] = [
      DUA_MENU[0],
      { id: "m2", name: "Teh Manis", price: 10000, available: false },
    ];
    const isiBaris: IsiBaris = { m2: { qty: "3", note: "" } };

    const baris = susunBarisPesanan(menuBaru, isiBaris);
    const bermasalah = barisTidakTersediaTerpilih(baris);

    expect(bermasalah).toHaveLength(1);
    expect(bermasalah[0].menuItemId).toBe("m2");
  });

  it("baris Habis yang belum dipilih tidak memblokir tombol kirim", () => {
    const menuBaru: MenuRingkas[] = [
      DUA_MENU[0],
      { id: "m2", name: "Teh Manis", price: 10000, available: false },
    ];

    const baris = susunBarisPesanan(menuBaru, { m1: { qty: "1", note: "" } });

    expect(barisTidakTersediaTerpilih(baris)).toHaveLength(0);
  });

  it("jumlah yang dikosongkan membuat baris tidak lagi memblokir", () => {
    const menuBaru: MenuRingkas[] = [
      DUA_MENU[0],
      { id: "m2", name: "Teh Manis", price: 10000, available: false },
    ];

    const baris = susunBarisPesanan(menuBaru, { m2: { qty: "", note: "es" } });

    expect(baris.find((satu) => satu.menuItemId === "m2")?.tersedia).toBe(
      false,
    );
    expect(barisTidakTersediaTerpilih(baris)).toHaveLength(0);
  });

  it("barisDipilih hanya benar untuk qty lebih dari 0", () => {
    const baris = susunBarisPesanan(DUA_MENU, {
      m1: { qty: "2", note: "" },
      m2: { qty: "0", note: "" },
    });

    expect(barisDipilih(baris[0])).toBe(true);
    expect(barisDipilih(baris[1])).toBe(false);
  });
});

describe("sidik jari pesanan untuk idempotencyKey", () => {
  it("isi yang sama menghasilkan sidik jari yang sama", () => {
    const barisSatu = susunBarisPesanan(DUA_MENU, {
      m1: { qty: "2", note: "less sugar" },
    });
    const barisDua = susunBarisPesanan(DUA_MENU, {
      m1: { qty: " 2 ", note: " less sugar " },
    });

    expect(sidikJariPesanan("Budi", barisSatu)).toBe(
      sidikJariPesanan(" Budi ", barisDua),
    );
  });

  it("urutan baris berbeda tetap dianggap isi yang sama", () => {
    const isiBaris: IsiBaris = {
      m1: { qty: "1", note: "" },
      m2: { qty: "2", note: "" },
    };
    const barisSatu = susunBarisPesanan(DUA_MENU, isiBaris);
    const barisDua = [...barisSatu].reverse();

    expect(sidikJariPesanan("Budi", barisSatu)).toBe(
      sidikJariPesanan("Budi", barisDua),
    );
  });

  it("qty yang berbeda menghasilkan sidik jari berbeda", () => {
    const barisSatu = susunBarisPesanan(DUA_MENU, {
      m1: { qty: "1", note: "" },
    });
    const barisDua = susunBarisPesanan(DUA_MENU, {
      m1: { qty: "2", note: "" },
    });

    expect(sidikJariPesanan("Budi", barisSatu)).not.toBe(
      sidikJariPesanan("Budi", barisDua),
    );
  });

  it("nama yang berbeda menghasilkan sidik jari berbeda", () => {
    const baris = susunBarisPesanan(DUA_MENU, { m1: { qty: "1", note: "" } });

    expect(sidikJariPesanan("Budi", baris)).not.toBe(
      sidikJariPesanan("Sari", baris),
    );
  });
});
