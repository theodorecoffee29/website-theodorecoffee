// Tes untuk src/features/cashier/kelompok-order.ts.
//
// Yang diuji: pembagian pesanan ke tiga kelompok, urutan di dalam tiap
// kelompok, pemetaan label asal pesanan, dan pemeriksaan metode bayar.
//
// Status dan aturan diambil dari docs/order-flow.md bagian 1 dan bagian 6.

import { describe, expect, it } from "vitest";
import {
  kelompokkanPesanan,
  labelAsalPesanan,
  metodeBayarValid,
  type PesananRingkas,
} from "./kelompok-order";

// Cara membuat pesanan untuk tes: isi defaultnya boleh diganti per tes.
function buatPesanan(ubah: Partial<PesananRingkas> = {}): PesananRingkas {
  return {
    orderId: "11111111-1111-4111-8111-111111111111",
    queueNumber: 1,
    customerName: "Budi",
    source: "online",
    status: "menunggu_konfirmasi",
    createdAt: "2026-10-08T09:00:00+07:00",
    ...ubah,
  };
}

describe("kelompokkanPesanan", () => {
  it("menaruh pesanan menunggu_konfirmasi di kelompok menunggu", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "a", status: "menunggu_konfirmasi" }),
    ]);

    expect(hasil.menunggu).toHaveLength(1);
    expect(hasil.dikerjakan).toHaveLength(0);
    expect(hasil.selesai).toHaveLength(0);
  });

  it("menaruh antrean dan dikerjakan di kelompok dikerjakan", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "a", status: "antrean" }),
      buatPesanan({ orderId: "b", status: "dikerjakan" }),
    ]);

    expect(hasil.dikerjakan).toHaveLength(2);
    expect(hasil.menunggu).toHaveLength(0);
    expect(hasil.selesai).toHaveLength(0);
  });

  it("menaruh selesai dan dibatalkan di kelompok selesai", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "a", status: "selesai" }),
      buatPesanan({ orderId: "b", status: "dibatalkan" }),
    ]);

    expect(hasil.selesai).toHaveLength(2);
    expect(hasil.menunggu).toHaveLength(0);
    expect(hasil.dikerjakan).toHaveLength(0);
  });

  it("mengurutkan kelompok menunggu dari yang paling lama", () => {
    // Sengaja diberi urutan terbalik supaya urutannya benar-benar diuji.
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "baru", createdAt: "2026-10-08T11:00:00+07:00" }),
      buatPesanan({ orderId: "lama", createdAt: "2026-10-08T08:00:00+07:00" }),
      buatPesanan({
        orderId: "tengah",
        createdAt: "2026-10-08T09:30:00+07:00",
      }),
    ]);

    expect(hasil.menunggu.map((satu) => satu.orderId)).toEqual([
      "lama",
      "tengah",
      "baru",
    ]);
  });

  it("mengurutkan kelompok dikerjakan dari yang paling lama", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({
        orderId: "baru",
        status: "antrean",
        createdAt: "2026-10-08T11:00:00+07:00",
      }),
      buatPesanan({
        orderId: "lama",
        status: "dikerjakan",
        createdAt: "2026-10-08T08:00:00+07:00",
      }),
    ]);

    expect(hasil.dikerjakan.map((satu) => satu.orderId)).toEqual([
      "lama",
      "baru",
    ]);
  });

  it("mengurutkan kelompok selesai dari yang paling baru", () => {
    // Untuk kelompok selesai, yang terbaru lebih menarik dilihat.
    const hasil = kelompokkanPesanan([
      buatPesanan({
        orderId: "lama",
        status: "selesai",
        createdAt: "2026-10-08T08:00:00+07:00",
      }),
      buatPesanan({
        orderId: "baru",
        status: "selesai",
        createdAt: "2026-10-08T11:00:00+07:00",
      }),
      buatPesanan({
        orderId: "tengah",
        status: "dibatalkan",
        createdAt: "2026-10-08T09:30:00+07:00",
      }),
    ]);

    expect(hasil.selesai.map((satu) => satu.orderId)).toEqual([
      "baru",
      "tengah",
      "lama",
    ]);
  });

  it("mengurutkan dengan benar walau format waktu berbeda zona", () => {
    // 09:00 WIB = 02:00 UTC. Kalau dibandingkan sebagai teks mentah, "02:00..."
    // akan dianggap lebih dulu, padahal sebenarnya lebih akhir.
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "utc", createdAt: "2026-10-08T02:00:00Z" }),
      buatPesanan({ orderId: "wib", createdAt: "2026-10-08T09:00:00+07:00" }),
    ]);

    // Keduanya jam 09:00 WIB, jadi urutannya jatuh ke nomor antrean.
    expect(hasil.menunggu.map((satu) => satu.orderId)).toEqual(["utc", "wib"]);
  });

  it("meletakkan pesanan dengan waktu tidak terbaca di akhir", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "rusak", createdAt: "bukan tanggal" }),
      buatPesanan({
        orderId: "normal",
        createdAt: "2026-10-08T09:00:00+07:00",
      }),
    ]);

    // Pesanan dengan waktu rusak tidak boleh mendahului yang waktunya jelas.
    expect(hasil.menunggu.map((satu) => satu.orderId)).toEqual([
      "normal",
      "rusak",
    ]);
  });

  it("memakai nomor antrean saat waktunya sama persis", () => {
    const waktuSama = "2026-10-08T09:00:00+07:00";
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "no3", queueNumber: 3, createdAt: waktuSama }),
      buatPesanan({ orderId: "no1", queueNumber: 1, createdAt: waktuSama }),
      buatPesanan({ orderId: "no2", queueNumber: 2, createdAt: waktuSama }),
    ]);

    expect(hasil.menunggu.map((satu) => satu.orderId)).toEqual([
      "no1",
      "no2",
      "no3",
    ]);
  });

  it("menaruh status yang tidak dikenal di kelompok selesai supaya tidak hilang", () => {
    const hasil = kelompokkanPesanan([
      buatPesanan({ orderId: "asing", status: "status-misterius" }),
    ]);

    expect(hasil.selesai).toHaveLength(1);
  });

  it("mengembalikan tiga kelompok kosong untuk daftar kosong", () => {
    expect(kelompokkanPesanan([])).toEqual({
      menunggu: [],
      dikerjakan: [],
      selesai: [],
    });
  });
});

describe("labelAsalPesanan", () => {
  it("menampilkan Online untuk order dari HP customer", () => {
    expect(labelAsalPesanan("online")).toBe("Online");
  });

  it("menampilkan Kasir untuk input manual", () => {
    expect(labelAsalPesanan("cashier")).toBe("Kasir");
  });

  it("menampilkan teks cadangan untuk asal yang tidak dikenal", () => {
    // Nama kolom mentah tidak boleh tampil ke pengguna.
    expect(labelAsalPesanan("dari_toko")).toBe("Asal tidak diketahui");
    expect(labelAsalPesanan("")).toBe("Asal tidak diketahui");
  });
});

describe("metodeBayarValid", () => {
  it("menerima qris dan tunai", () => {
    // Hanya dua metode yang sah (docs/api-contract.md bagian 2).
    expect(metodeBayarValid("qris")).toBe(true);
    expect(metodeBayarValid("tunai")).toBe(true);
  });

  it("menolak kalau belum ada pilihan (tidak ada nilai bawaan)", () => {
    // Cashier wajib memilih sendiri sebelum konfirmasi (order-flow.md bagian 6).
    expect(metodeBayarValid(null)).toBe(false);
    expect(metodeBayarValid("")).toBe(false);
  });

  it("menolak nilai lain", () => {
    expect(metodeBayarValid("transfer")).toBe(false);
    expect(metodeBayarValid("QRIS")).toBe(false);
  });
});
