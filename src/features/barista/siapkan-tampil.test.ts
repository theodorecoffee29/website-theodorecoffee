// Tes untuk src/features/barista/siapkan-tampil.ts.
//
// Yang diuji: data yang masuk ke komponen Barista TIDAK PERNAH memuat harga atau
// pembayaran (docs/pemissions.md bagian 2).
//
// Ini pengaman lapis kedua. Lapis pertama ada di server
// (src/lib/server/petakan-antrean.ts). Lapis kedua ada di sini, supaya data yang
// sampai di komponen benar-benar bersih.
//
// Cara tesnya: data input SENGAJA dibuat membawa field harga dan pembayaran,
// lalu kita memastikan field itu hilang di output.

import { describe, expect, it } from "vitest";
import { siapkanUntukTampil } from "./siapkan-tampil";
import { teksStatusBarista } from "./antrean-barista";

// Pesanan dari server yang SENGAJA membawa field yang tidak boleh tampil.
const PESANAN_BOCOR = {
  orderId: "aaaaaaaa-1111-4111-8111-111111111111",
  queueNumber: 7,
  customerName: "Budi",
  items: [
    {
      name: "Americano",
      qty: 2,
      note: "less sugar",
      // Field harga yang tidak boleh tampil:
      price: 18000,
      subtotal: 36000,
    },
  ],
  status: "antrean",
  // Field tingkat pesanan yang tidak boleh tampil:
  total: 36000,
  price: 18000,
  payment: { method: "qris", amount: 36000, recorded_by: "staff-1" },
};

// Keadaan awal supaya tiap tes tidak saling memengaruhi.
function siapkan(): ReturnType<typeof siapkanUntukTampil> {
  return siapkanUntukTampil([PESANAN_BOCOR], teksStatusBarista);
}

describe("siapkanUntukTampil", () => {
  it("TIDAK memuat field harga di level pesanan", () => {
    const hasil = siapkan();
    const satu = hasil[0];

    expect(satu).not.toHaveProperty("total");
    expect(satu).not.toHaveProperty("price");
    // Daftar field harus persis yang boleh tampil, tidak ada satu pun tambahan.
    expect(Object.keys(satu).sort()).toEqual([
      "customerName",
      "items",
      "orderId",
      "queueNumber",
      "status",
      "teksStatus",
    ]);
  });

  it("TIDAK memuat field harga di level item", () => {
    const hasil = siapkan();

    expect(hasil[0].items[0]).not.toHaveProperty("price");
    expect(hasil[0].items[0]).not.toHaveProperty("subtotal");
    expect(Object.keys(hasil[0].items[0]).sort()).toEqual([
      "name",
      "note",
      "qty",
    ]);
  });

  it("TIDAK memuat data pembayaran sama sekali", () => {
    const hasil = siapkan();

    expect(hasil[0]).not.toHaveProperty("payment");

    // Cek juga seluruh isi teksnya, supaya tidak ada nilai harga atau metode
    // bayar yang ikut tersembunyi di field lain.
    const seluruhTeks = JSON.stringify(hasil);
    expect(seluruhTeks).not.toContain("payment");
    expect(seluruhTeks).not.toContain("qris");
    expect(seluruhTeks).not.toContain("18000");
    expect(seluruhTeks).not.toContain("36000");
    expect(seluruhTeks).not.toContain("recorded_by");
  });

  it("memakai pemetaan status yang diberikan", () => {
    const hasil = siapkan();

    expect(hasil[0].teksStatus).toBe("Baru masuk");
    // Status mentah tetap ikut, dipakai untuk memilih tombol.
    expect(hasil[0].status).toBe("antrean");
  });

  it("mempertahankan urutan dari server", () => {
    // Urutan antrean tidak boleh diubah. Siapkan beberapa pesanan dalam urutan
    // tertentu dan pastikan urutannya sama.
    const hasil = siapkanUntukTampil(
      [
        { ...PESANAN_BOCOR, orderId: "a", queueNumber: 9 },
        { ...PESANAN_BOCOR, orderId: "b", queueNumber: 3 },
        { ...PESANAN_BOCOR, orderId: "c", queueNumber: 5 },
      ],
      teksStatusBarista,
    );

    expect(hasil.map((satu) => satu.queueNumber)).toEqual([9, 3, 5]);
  });

  it("mengembalikan daftar kosong untuk antrean kosong", () => {
    expect(siapkanUntukTampil([], teksStatusBarista)).toEqual([]);
  });
});
