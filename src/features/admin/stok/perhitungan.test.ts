// File ini: tes untuk perhitungan ringan dan pemetaan riwayat stok.
//
// Semua fungsi di perhitungan.ts MURNI, jadi bisa diuji tanpa database.

import { describe, expect, it } from "vitest";
import {
  hitungSelisihKoreksi,
  labelJenisPergerakan,
  petakanRiwayat,
  stokMinus,
  perkiraanStokSesudah,
} from "@/features/admin/stok/perhitungan";
import { jamWibStok } from "@/features/admin/stok/waktu";

describe("perkiraanStokSesudah", () => {
  it("menambah jumlah restock ke stok sekarang", () => {
    expect(perkiraanStokSesudah(1000, 500)).toBe(1500);
  });

  it("bisa tetap minus kalau stok sekarang sudah minus dan jumlah kecil", () => {
    expect(perkiraanStokSesudah(-10, 5)).toBe(-5);
  });
});

describe("hitungSelisihKoreksi", () => {
  it("positif kalau stok fisik lebih besar dari stok tercatat", () => {
    expect(hitungSelisihKoreksi(100, 150)).toBe(50);
  });

  it("negatif kalau stok fisik lebih kecil dari stok tercatat", () => {
    expect(hitungSelisihKoreksi(100, 80)).toBe(-20);
  });

  it("nol kalau sama", () => {
    expect(hitungSelisihKoreksi(100, 100)).toBe(0);
  });
});

describe("stokMinus", () => {
  it("true kalau stoknya negatif", () => {
    expect(stokMinus(-1)).toBe(true);
  });

  it("false kalau nol atau positif", () => {
    expect(stokMinus(0)).toBe(false);
    expect(stokMinus(10)).toBe(false);
  });
});

describe("labelJenisPergerakan", () => {
  it("memberi label ramah untuk tiap jenis yang dikenal", () => {
    expect(labelJenisPergerakan("order_confirm")).toBe("Pengurangan pesanan");
    expect(labelJenisPergerakan("order_cancel_restore")).toBe(
      "Pengembalian pembatalan",
    );
    expect(labelJenisPergerakan("restock")).toBe("Restock");
    expect(labelJenisPergerakan("adjustment")).toBe("Koreksi");
  });

  it("memakai nama aslinya kalau jenisnya tidak dikenal", () => {
    // Datanya bisa saja jenis baru yang belum dikenali. Labelnya dibuat
    // generik supaya Admin tetap bisa membaca baris itu.
    expect(labelJenisPergerakan("tipe_lain")).toBe("Jenis tidak diketahui");
  });
});

describe("petakanRiwayat", () => {
  // Fungsi konversi waktu yang dipakai agar tes ini tidak bergantung zona
  // waktu laptop.
  const waktuTetap = () => "09.15";

  const barisDasar = {
    movementId: "p1",
    type: "restock",
    qtyChange: 2000,
    stockAfter: 3000,
    note: "Pengiriman pagi",
    orderId: "order-12345678",
    createdAt: "2026-10-08T09:15:00+07:00",
  };

  it("mengubah angka dan waktu ke teks siap tampil", () => {
    const hasil = petakanRiwayat(barisDasar, waktuTetap);

    expect(hasil.waktuTeks).toBe("09.15");
    expect(hasil.jenisTeks).toBe("Restock");
    expect(hasil.perubahanTeks).toBe("+2.000");
    expect(hasil.stokSesudahTeks).toBe("3.000");
    expect(hasil.catatan).toBe("Pengiriman pagi");
  });

  it("membuang catatan kosong supaya tidak tampil", () => {
    const hasil = petakanRiwayat(
      { ...barisDasar, note: null, orderId: null },
      waktuTetap,
    );

    // Kosong memakai null (bukan string kosong) supaya komponen tahu ini
    // "tidak ada", bukan "ada tapi isinya kosong".
    expect(hasil.catatan).toBeNull();
    expect(hasil.orderIdPendek).toBeNull();
  });

  it("memotong id order jadi delapan karakter pertama", () => {
    const hasil = petakanRiwayat(barisDasar, waktuTetap);
    expect(hasil.orderIdPendek).toBe("order-12");
  });
});

describe("jamWibStok", () => {
  it("menampilkan jam sesuai zona WIB", () => {
    // 02:00 UTC = 09:00 WIB.
    expect(jamWibStok("2026-10-08T02:00:00+00:00")).toBe("09.00");
  });

  it("tidak menampilkan detik", () => {
    expect(jamWibStok("2026-10-08T02:00:00+00:00")).not.toContain(":00:");
  });

  it("mengembalikan string kosong kalau waktunya tidak terbaca", () => {
    expect(jamWibStok("bukan waktu")).toBe("");
  });
});
