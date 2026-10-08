// Tes untuk src/features/barista/antrean-barista.ts.
//
// Yang diuji:
//   1. Pembagian antrean menjadi dua kelompok (dikerjakan dan baruMasuk),
//   2. Urutan di dalam kelompok TIDAK diubah dari urutan server,
//   3. Pemetaan status ke teks.
//
// Status diambil dari docs/order-flow.md bagian 1 dan bagian 4.
//
// Catatan penting: di file ini, pesanan sengaja dibuat dengan nomor antrean yang
// BERLAWAN dengan urutan kemunculannya. Kalau fungsi diam-diam mengurutkan ulang,
// tes ini langsung gagal. Ini sengaja, karena urutan server (waktu konfirmasi
// paling awal) harus dipatuhi.

import { describe, expect, it } from "vitest";
import { kelompokkanAntrean, teksStatusBarista } from "./antrean-barista";
import type { PesananAntrean } from "./api";

function buatPesanan(ubah: Partial<PesananAntrean> = {}): PesananAntrean {
  return {
    orderId: "11111111-1111-4111-8111-111111111111",
    queueNumber: 1,
    customerName: "Budi",
    items: [],
    status: "antrean",
    ...ubah,
  };
}

describe("kelompokkanAntrean", () => {
  it("menaruh status dikerjakan di kelompok dikerjakan", () => {
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", status: "dikerjakan" }),
    ]);

    expect(hasil.dikerjakan).toHaveLength(1);
    expect(hasil.baruMasuk).toHaveLength(0);
  });

  it("menaruh status antrean di kelompok baruMasuk", () => {
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", status: "antrean" }),
    ]);

    expect(hasil.baruMasuk).toHaveLength(1);
    expect(hasil.dikerjakan).toHaveLength(0);
  });

  it("membagi campuran dua status ke kelompok yang benar", () => {
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", status: "antrean" }),
      buatPesanan({ orderId: "b", status: "dikerjakan" }),
      buatPesanan({ orderId: "c", status: "antrean" }),
    ]);

    expect(hasil.baruMasuk.map((satu) => satu.orderId)).toEqual(["a", "c"]);
    expect(hasil.dikerjakan.map((satu) => satu.orderId)).toEqual(["b"]);
  });

  it("MENJAGA urutan dari server di kelompok baruMasuk", () => {
    // Urutan server: nomor antrean 9, lalu 3, lalu 5 (sesuai waktu konfirmasi).
    // Kalau fungsi mengurutkan ulang berdasarkan nomor, hasilnya jadi 3, 5, 9.
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", queueNumber: 9, status: "antrean" }),
      buatPesanan({ orderId: "b", queueNumber: 3, status: "antrean" }),
      buatPesanan({ orderId: "c", queueNumber: 5, status: "antrean" }),
    ]);

    // Urutan harus tetap seperti server: 9, 3, 5.
    expect(hasil.baruMasuk.map((satu) => satu.orderId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("MENJAGA urutan dari server di kelompok dikerjakan", () => {
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", queueNumber: 20, status: "dikerjakan" }),
      buatPesanan({ orderId: "b", queueNumber: 7, status: "dikerjakan" }),
    ]);

    expect(hasil.dikerjakan.map((satu) => satu.orderId)).toEqual(["a", "b"]);
  });

  it("tidak mengubah urutan antrean di kelompok yang sama setelah dipisah", () => {
    // Urutan server: satu pekerjaan, dua antrean, satu pekerjaan lagi.
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "p1", queueNumber: 1, status: "dikerjakan" }),
      buatPesanan({ orderId: "n1", queueNumber: 2, status: "antrean" }),
      buatPesanan({ orderId: "n2", queueNumber: 3, status: "antrean" }),
      buatPesanan({ orderId: "p2", queueNumber: 4, status: "dikerjakan" }),
    ]);

    // Setiap kelompok mempertahankan urutan relatifnya dari server.
    expect(hasil.dikerjakan.map((satu) => satu.orderId)).toEqual(["p1", "p2"]);
    expect(hasil.baruMasuk.map((satu) => satu.orderId)).toEqual(["n1", "n2"]);
  });

  it("melewatkan status yang tidak dikenal (tidak ada tombol yang cocok)", () => {
    // Server hanya mengirim dua status. Kalau muncul yang lain, lebih baik
    // tidak ditampilkan daripada menampilkan tombol yang salah.
    const hasil = kelompokkanAntrean([
      buatPesanan({ orderId: "a", status: "antrean" }),
      buatPesanan({ orderId: "asing", status: "selesai" }),
      buatPesanan({ orderId: "b", status: "dikerjakan" }),
    ]);

    expect(hasil.baruMasuk.map((satu) => satu.orderId)).toEqual(["a"]);
    expect(hasil.dikerjakan.map((satu) => satu.orderId)).toEqual(["b"]);
  });

  it("mengembalikan dua kelompok kosong untuk antrean kosong", () => {
    expect(kelompokkanAntrean([])).toEqual({ dikerjakan: [], baruMasuk: [] });
  });
});

describe("teksStatusBarista", () => {
  it("menampilkan antrean sebagai Baru masuk", () => {
    // Status "antrean" tampil sebagai "Baru masuk" supaya Barista tahu apa
    // yang harus dilakukan (tekan Mulai).
    expect(teksStatusBarista("antrean")).toBe("Baru masuk");
  });

  it("menampilkan dikerjakan sebagai Sedang dikerjakan", () => {
    expect(teksStatusBarista("dikerjakan")).toBe("Sedang dikerjakan");
  });

  it("memberi teks cadangan untuk status yang tidak dikenal", () => {
    expect(teksStatusBarista("menunggu_konfirmasi")).toBe(
      "Status tidak diketahui",
    );
    expect(teksStatusBarista("")).toBe("Status tidak diketahui");
  });
});
