// Tes untuk src/features/cashier/alasan-batal.ts.
//
// File ini MURNI (tanpa React, tanpa database, tanpa panggilan API), jadi
// cukup diuji langsung.
//
// Yang diuji:
//   1. Semua alasan yang ada bisa dipilih dan punya label.
//   2. Alasan "lainnya" tanpa catatan ditolak, dengan catatan diterima.
//   3. Catatan lebih dari 100 karakter ditolak.
//   4. Alasan yang belum dipilih ditolak.
//   5. Pemetaan nilai alasan dari database menjadi teks yang tampil.

import { describe, expect, it } from "vitest";
import { ALASAN_BATAL } from "@/lib/alasan-batal";
import {
  labelAlasanBatal,
  periksaAlasanBatal,
  pilihanAlasanBatal,
} from "./alasan-batal";

describe("daftar alasan pembatalan", () => {
  it("memuat keenam alasan sesuai enum di database", () => {
    // Daftar ini harus sama dengan enum order_cancel_reason. Kalau satu nama
    // berubah di database, daftar di sini ikut berubah.
    expect([...ALASAN_BATAL]).toEqual([
      "stok_habis",
      "pembayaran_tidak_diterima",
      "diminta_customer",
      "pesanan_ganda",
      "salah_input",
      "lainnya",
    ]);
  });

  it("setiap alasan punya label yang tidak kosong", () => {
    const pilihan = pilihanAlasanBatal();

    expect(pilihan).toHaveLength(ALASAN_BATAL.length);
    for (const satu of pilihan) {
      expect(satu.label.length).toBeGreaterThan(0);
    }
  });
});

describe("periksaAlasanBatal", () => {
  it("menolak kalau alasan belum dipilih", () => {
    const hasil = periksaAlasanBatal(null, "");

    expect(hasil.boleh).toBe(false);
    expect(hasil.pesan).not.toBeNull();
  });

  it("menerima setiap alasan selain 'lainnya' tanpa catatan", () => {
    for (const alasan of ALASAN_BATAL) {
      if (alasan === "lainnya") {
        continue;
      }
      const hasil = periksaAlasanBatal(alasan, "");
      expect(hasil.boleh).toBe(true);
      expect(hasil.pesan).toBeNull();
    }
  });

  it("menerima alasan lain kalau catatannya diisi", () => {
    const hasil = periksaAlasanBatal("lainnya", "Bahan susu habis di freezer");

    expect(hasil.boleh).toBe(true);
    expect(hasil.pesan).toBeNull();
  });

  it("menolak alasan 'lainnya' tanpa catatan", () => {
    const hasil = periksaAlasanBatal("lainnya", "");

    expect(hasil.boleh).toBe(false);
    expect(hasil.pesan).not.toBeNull();
  });

  it("menolak alasan 'lainnya' yang catatannya cuma spasi", () => {
    // Catatan yang hanya spasi dianggap tidak ada: setelah dipangkas jadi kosong.
    const hasil = periksaAlasanBatal("lainnya", "    ");

    expect(hasil.boleh).toBe(false);
    expect(hasil.pesan).not.toBeNull();
  });

  it("menolak catatan lebih dari 100 karakter", () => {
    const hasil = periksaAlasanBatal("lainnya", "a".repeat(101));

    expect(hasil.boleh).toBe(false);
    expect(hasil.pesan).not.toBeNull();
  });

  it("menerima catatan tepat 100 karakter", () => {
    const hasil = periksaAlasanBatal("lainnya", "a".repeat(100));

    expect(hasil.boleh).toBe(true);
  });

  it("menolak catatan panjang lebih dulu, walaupun alasan selain 'lainnya'", () => {
    // Aturan panjangnya berlaku untuk semua alasan, bukan hanya "lainnya".
    const hasil = periksaAlasanBatal("salah_input", "a".repeat(101));

    expect(hasil.boleh).toBe(false);
  });

  it("menghitung panjang catatan setelah spasi pinggir dipangkas", () => {
    // 100 huruf + 4 spasi pinggir = 104 karakter mentah, tapi setelah dipangkas
    // jadi 100, jadi harus diterima.
    const hasil = periksaAlasanBatal("lainnya", "  " + "a".repeat(100) + "  ");

    expect(hasil.boleh).toBe(true);
  });
});

describe("labelAlasanBatal", () => {
  it("mengubah setiap alasan menjadi teks yang tampil", () => {
    expect(labelAlasanBatal("stok_habis")).toBe("Stok habis");
    expect(labelAlasanBatal("pembayaran_tidak_diterima")).toBe(
      "Pembayaran tidak diterima",
    );
    expect(labelAlasanBatal("diminta_customer")).toBe("Diminta customer");
    expect(labelAlasanBatal("pesanan_ganda")).toBe("Pesanan ganda");
    expect(labelAlasanBatal("salah_input")).toBe("Salah input");
    expect(labelAlasanBatal("lainnya")).toBe("Lainnya");
  });

  it("mengembalikan null kalau tidak ada alasan", () => {
    // Pesanan yang belum dibatalkan tidak punya alasan. Null lebih benar
    // daripada string kosong, karena string kosong tidak bisa dibedakan dari
    // alasan yang benar-benar tidak terbaca.
    expect(labelAlasanBatal(null)).toBeNull();
  });

  it("menampilkan nama aslinya untuk alasan yang tidak dikenal", () => {
    // Kalau database punya alasan baru tapi labelnya belum ditambahkan, Cashier
    // tetap harus melihat informasi, bukan baris kosong.
    expect(labelAlasanBatal("alasan_baru")).toBe("alasan_baru");
  });
});
