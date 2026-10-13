// Tes untuk src/features/customer/teks-pembatalan.ts.
//
// Kenapa file ini perlu dites: pemetaan alasan pembatalan ke kalimat customer
// adalah aturan yang dilihat pengguna (docs/order-flow.md bagian 6 ayat 22 dan
// 23). Kalau ada alasan yang salah petition atau catsatan yang hilang, customer
// melihat informasi yang salah tanpa ada yang menyadarinya.

import { describe, expect, it } from "vitest";
import { teksPembatalan } from "@/features/customer/teks-pembatalan";
import { teksCustomer } from "@/features/customer/teks";

describe("teks pembatalan untuk semua alasan", () => {
  it("stok_habis memakai kalimat stok habis", () => {
    const hasil = teksPembatalan("stok_habis", null);

    expect(hasil.alasan).toBe(teksCustomer.status.alasanBatal.stokHabis);
    expect(hasil.alasan).toBe("Dibatalkan karena stok habis");
    expect(hasil.catatan).toBeNull();
  });

  it("pembayaran_tidak_diterima memakai kalimat pembayaran belum diterima", () => {
    const hasil = teksPembatalan("pembayaran_tidak_diterima", null);

    expect(hasil.alasan).toBe(
      teksCustomer.status.alasanBatal.pembayaranTidakDiterima,
    );
    expect(hasil.catatan).toBeNull();
  });

  it("diminta_customer memakai kalimat dibatalkan oleh kamu", () => {
    const hasil = teksPembatalan("diminta_customer", null);

    expect(hasil.alasan).toBe(teksCustomer.status.alasanBatal.dimintaCustomer);
    expect(hasil.alasan).toBe("Dibatalkan oleh kamu");
  });

  it("pesanan_ganda memakai kalimat pesanan ganda", () => {
    const hasil = teksPembatalan("pesanan_ganda", null);

    expect(hasil.alasan).toBe(teksCustomer.status.alasanBatal.pesananGanda);
  });

  it("salah_input memakai kalimat salah input", () => {
    const hasil = teksPembatalan("salah_input", null);

    expect(hasil.alasan).toBe(teksCustomer.status.alasanBatal.salahInput);
  });

  it("lainnya memakai kalimat umum dan menampilkan catatannya", () => {
    const hasil = teksPembatalan("lainnya", "Bocor di tutup auditorium");

    expect(hasil.alasan).toBe(teksCustomer.status.alasanBatal.lainnya);
    expect(hasil.alasan).toBe("Dibatalkan");
    expect(hasil.catatan).toBe("Bocor di tutup auditorium");
  });

  it("alasan lain tetap menampilkan catatan kalau ada", () => {
    const hasil = teksPembatalan("stok_habis", "Gula habis semua");

    expect(hasil.alasan).toBe("Dibatalkan karena stok habis");
    expect(hasil.catatan).toBe("Gula habis semua");
  });
});

describe("teks pembatalan saat alasan tidak ada", () => {
  it("alasan kosong (order lama) hanya menampilkan Dibatalkan", () => {
    const hasil = teksPembatalan(null, null);

    expect(hasil.alasan).toBe("Dibatalkan");
    expect(hasil.catatan).toBeNull();
  });

  it("alasan kosong tapi catatan ada tetap menampilkan catatannya", () => {
    const hasil = teksPembatalan(null, "Dibatalkan oleh kasir di booth");

    expect(hasil.alasan).toBe("Dibatalkan");
    expect(hasil.catatan).toBe("Dibatalkan oleh kasir di booth");
  });

  it("alasan yang tidak dikenal diperlakukan seperti lainnya", () => {
    const hasil = teksPembatalan("alasan_palsu", null);

    expect(hasil.alasan).toBe("Dibatalkan");
    expect(hasil.catatan).toBeNull();
  });

  it("catatan yang cuma spasi dianggap tidak ada", () => {
    const hasil = teksPembatalan("stok_habis", "   ");

    expect(hasil.alasan).toBe("Dibatalkan karena stok habis");
    expect(hasil.catatan).toBeNull();
  });

  it("alasan dengan spasi pinggir tetap dikenali", () => {
    const hasil = teksPembatalan("  stok_habis  ", " Catatan ");

    expect(hasil.alasan).toBe("Dibatalkan karena stok habis");
    expect(hasil.catatan).toBe("Catatan");
  });
});