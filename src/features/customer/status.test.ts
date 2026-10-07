// Tes untuk src/features/customer/status.ts.
//
// Yang diuji: pemetaan status order ke teks customer, penentuan status aktif
// dan final, serta apakah customer boleh membatalkan.
//
// Teks yang diharapkan diambil dari docs/order-flow.md bagian 1.

import { describe, expect, it } from "vitest";
import { customerBolehBatalkan, statusMasihAktif, statusSudahFinal, teksStatus } from "./status";

describe("teksStatus", () => {
  it("menampilkan Menunggu konfirmasi untuk menunggu_konfirmasi", () => {
    expect(teksStatus("menunggu_konfirmasi")).toBe("Menunggu konfirmasi");
  });

  it("menampilkan Sedang dibuat untuk antrean dan dikerjakan", () => {
    // Customer tidak perlu tahu bedanya masih antrean atau sedang dibuat.
    expect(teksStatus("antrean")).toBe("Sedang dibuat");
    expect(teksStatus("dikerjakan")).toBe("Sedang dibuat");
  });

  it("menampilkan Pesanan selesai untuk selesai", () => {
    expect(teksStatus("selesai")).toBe("Pesanan selesai");
  });

  it("menampilkan Dibatalkan untuk dibatalkan", () => {
    expect(teksStatus("dibatalkan")).toBe("Dibatalkan");
  });

  it("memberi teks cadangan untuk status yang tidak dikenal", () => {
    expect(teksStatus("apa-saja")).toBe("Status tidak diketahui");
    expect(teksStatus("")).toBe("Status tidak diketahui");
  });
});

describe("statusMasihAktif", () => {
  it("menyatakan aktif untuk menunggu, antrean, dan dikerjakan", () => {
    expect(statusMasihAktif("menunggu_konfirmasi")).toBe(true);
    expect(statusMasihAktif("antrean")).toBe(true);
    expect(statusMasihAktif("dikerjakan")).toBe(true);
  });

  it("menyatakan tidak aktif untuk selesai dan dibatalkan", () => {
    expect(statusMasihAktif("selesai")).toBe(false);
    expect(statusMasihAktif("dibatalkan")).toBe(false);
  });

  it("menyatakan tidak aktif untuk status yang tidak dikenal atau kosong", () => {
    expect(statusMasihAktif("tidak-dikenal")).toBe(false);
    expect(statusMasihAktif("")).toBe(false);
  });
});

describe("statusSudahFinal", () => {
  it("benar hanya untuk selesai dan dibatalkan", () => {
    expect(statusSudahFinal("selesai")).toBe(true);
    expect(statusSudahFinal("dibatalkan")).toBe(true);
  });

  it("salah untuk status yang masih berjalan", () => {
    expect(statusSudahFinal("menunggu_konfirmasi")).toBe(false);
    expect(statusSudahFinal("antrean")).toBe(false);
    expect(statusSudahFinal("dikerjakan")).toBe(false);
  });
});

describe("customerBolehBatalkan", () => {
  it("benar hanya saat menunggu konfirmasi", () => {
    // Customer hanya boleh membatalkan sebelum konfirmasi (order-flow.md bagian 3).
    expect(customerBolehBatalkan("menunggu_konfirmasi")).toBe(true);
  });

  it("salah setelah konfirmasi dan seterusnya", () => {
    expect(customerBolehBatalkan("antrean")).toBe(false);
    expect(customerBolehBatalkan("dikerjakan")).toBe(false);
    expect(customerBolehBatalkan("selesai")).toBe(false);
    expect(customerBolehBatalkan("dibatalkan")).toBe(false);
  });
});