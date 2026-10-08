// Tes untuk src/features/customer/penyimpan-order.ts.
//
// Yang diuji:
//   - tambah, baca, buang daftar order aktif,
//   - tahan terhadap localStorage yang error (tidak tersedia / melempar error),
//   - tahan terhadap isi localStorage yang rusak (bukan JSON, bukan array, isi
//     campuran),
//   - id yang bukan uuid valid TIDAK pernah disimpan, dan entri semacam itu
//     dibuang saat membaca (ini penjagaan dari bug "/status/undefined").
//
// Tiruan untuk localStorage dibuat sendiri di sini, supaya tes tidak
// bergantung pada browser sungguhan. Ada dua jenis tiruan: yang normal, dan yang
// sengaja error (untuk menguji penanganan try/catch).

import { beforeEach, describe, expect, it } from "vitest";
import {
  KUNCI_PENYIMPANAN_ORDER,
  bacaOrderAktif,
  buangOrderAktif,
  cariNamaCustomer,
  gantiOrderAktif,
  tambahOrderAktif,
  tulisOrderAktif,
  type OrderTersimpan,
  type PenyimpananSederhana,
} from "./penyimpan-order";

// Id contoh yang berbentuk uuid valid (v4), supaya lolos pemeriksaan bentuk.
const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";
const UUID_3 = "33333333-3333-4333-8333-333333333333";
const UUID_4 = "44444444-4444-4444-8444-444444444444";
const UUID_TIDAK_KENAL = "99999999-9999-4999-8999-999999999999";

// Tiruan localStorage yang bekerja normal, seperti browser.
function buatPenyimpananNormal(): PenyimpananSederhana & {
  isi: Map<string, string>;
} {
  const isi = new Map<string, string>();
  return {
    isi: isi,
    getItem: (kunci) => (isi.has(kunci) ? (isi.get(kunci) as string) : null),
    setItem: (kunci, nilai) => {
      isi.set(kunci, nilai);
    },
    removeItem: (kunci) => {
      isi.delete(kunci);
    },
  };
}

// Tiruan yang selalu melempar error, seperti localStorage di browser yang
// memblokir penyimpanan (mode privat / kuota penuh).
function buatPenyimpananError(): PenyimpananSederhana {
  return {
    getItem: () => {
      throw new Error("localStorage diblokir");
    },
    setItem: () => {
      throw new Error("localStorage diblokir");
    },
    removeItem: () => {
      throw new Error("localStorage diblokir");
    },
  };
}

describe("daftar order aktif", () => {
  let penyimpanan: ReturnType<typeof buatPenyimpananNormal>;

  beforeEach(() => {
    // Setiap tes mulai dengan penyimpanan kosong.
    penyimpanan = buatPenyimpananNormal();
  });

  it("mengembalikan daftar kosong saat belum ada apa pun", () => {
    expect(bacaOrderAktif(penyimpanan)).toEqual([]);
  });

  it("menambah satu order dan membacanya kembali", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_1, customerName: "Budi" },
    ]);
  });

  it("menambah beberapa order dan membacanya kembali", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    tambahOrderAktif(UUID_2, "Sari", penyimpanan);
    tambahOrderAktif(UUID_3, "Dina", penyimpanan);

    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_1, customerName: "Budi" },
      { orderId: UUID_2, customerName: "Sari" },
      { orderId: UUID_3, customerName: "Dina" },
    ]);
  });

  it("tidak menambah order yang sama dua kali", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_1, customerName: "Budi" },
    ]);
  });

  it("membuang satu order", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    tambahOrderAktif(UUID_2, "Sari", penyimpanan);
    buangOrderAktif(UUID_1, penyimpanan);

    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_2, customerName: "Sari" },
    ]);
  });

  it("membuang order yang tidak ada tanpa merusak daftar", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    buangOrderAktif(UUID_TIDAK_KENAL, penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(1);
  });

  it("menghapus kunci penyimpanan saat daftar jadi kosong", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    buangOrderAktif(UUID_1, penyimpanan);
    // Kuncinya dihapus, bukan diisi "[]".
    expect(penyimpanan.isi.has(KUNCI_PENYIMPANAN_ORDER)).toBe(false);
  });

  it("mengganti seluruh daftar sekaligus", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    gantiOrderAktif(
      [
        { orderId: UUID_3, customerName: "Ana" },
        { orderId: UUID_4, customerName: "Bimo" },
      ],
      penyimpanan,
    );
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(2);
  });

  it("mencari nama customer dari daftar tersimpan", () => {
    tambahOrderAktif(UUID_1, "Budi", penyimpanan);
    expect(cariNamaCustomer(UUID_1, penyimpanan)).toBe("Budi");
    // Order yang tidak ada menghasilkan nama kosong.
    expect(cariNamaCustomer(UUID_TIDAK_KENAL, penyimpanan)).toBe("");
  });

  it("tidak menyimpan order id yang bukan uuid valid", () => {
    // "undefined" adalah id yang dulu bisa terlanjur masuk (penyebab bug
    // /status/undefined). Id semacam ini tidak boleh tersimpan sama sekali.
    tambahOrderAktif("undefined", "Budi", penyimpanan);
    tambahOrderAktif("order-1", "Sari", penyimpanan);
    tambahOrderAktif("", "Dina", penyimpanan);

    expect(bacaOrderAktif(penyimpanan)).toEqual([]);
  });

  it("membuang entri yang id-nya bukan uuid valid saat dibaca", () => {
    // Penyimpanan sudah berisi id rusak (mis. karena versi lama). Saat dibaca,
    // entri itu harus dilewati dan tidak pernah dipakai.
    penyimpanan.setItem(
      KUNCI_PENYIMPANAN_ORDER,
      JSON.stringify([
        { orderId: "undefined", customerName: "Budi" },
        { orderId: UUID_1, customerName: "Sari" },
        { orderId: "order-2", customerName: "Dina" },
      ]),
    );

    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_1, customerName: "Sari" },
    ]);
  });
});

describe("tahan terhadap penyimpanan yang error", () => {
  it("mengembalikan daftar kosong saat penyimpanan null", () => {
    // null = localStorage tidak tersedia (mis. di server).
    expect(bacaOrderAktif(null)).toEqual([]);
  });

  it("tidak melempar error saat menambah ke penyimpanan yang error", () => {
    const rusak = buatPenyimpananError();
    // Tidak harus melempar error, hanya diam-diam tidak tersimpan.
    expect(() => tambahOrderAktif(UUID_1, "Budi", rusak)).not.toThrow();
  });

  it("mengembalikan daftar kosong saat membaca dari penyimpanan yang error", () => {
    expect(bacaOrderAktif(buatPenyimpananError())).toEqual([]);
  });

  it("tidak melempar error saat membuang dari penyimpanan yang error", () => {
    const rusak = buatPenyimpananError();
    expect(() => buangOrderAktif(UUID_1, rusak)).not.toThrow();
  });

  it("tidak melempar error saat menambah ke penyimpanan null", () => {
    expect(() => tambahOrderAktif(UUID_1, "Budi", null)).not.toThrow();
  });
});

describe("tahan terhadap isi localStorage yang rusak", () => {
  it("mengembalikan kosong saat isinya bukan JSON", () => {
    const penyimpanan = buatPenyimpananNormal();
    penyimpanan.setItem(KUNCI_PENYIMPANAN_ORDER, "ini bukan json");
    expect(bacaOrderAktif(penyimpanan)).toEqual([]);
  });

  it("mengembalikan kosong saat isinya JSON tapi bukan array", () => {
    const penyimpanan = buatPenyimpananNormal();
    penyimpanan.setItem(KUNCI_PENYIMPANAN_ORDER, '{"bukan":"array"}');
    expect(bacaOrderAktif(penyimpanan)).toEqual([]);
  });

  it("mengembalikan kosong saat isinya JSON null", () => {
    const penyimpanan = buatPenyimpananNormal();
    penyimpanan.setItem(KUNCI_PENYIMPANAN_ORDER, "null");
    expect(bacaOrderAktif(penyimpanan)).toEqual([]);
  });

  it("melewati entri rusak dan mengambil entri yang punya orderId valid", () => {
    const penyimpanan = buatPenyimpananNormal();
    // Array mixture: teks biasa, objek tanpa orderId, dan objek yang benar.
    penyimpanan.setItem(
      KUNCI_PENYIMPANAN_ORDER,
      JSON.stringify([
        "bukan objek",
        { tanpaId: true },
        { orderId: "", customerName: "Kosong" },
        { orderId: UUID_1, customerName: "Budi" },
      ]),
    );

    const hasil = bacaOrderAktif(penyimpanan);

    // Hanya entri dengan orderId yang valid yang diambil.
    expect(hasil).toHaveLength(1);
    expect(hasil[0].orderId).toBe(UUID_1);
  });

  it("mengisi customerName kosong kalau nama tidak tersimpan atau bukan teks", () => {
    const penyimpanan = buatPenyimpananNormal();
    penyimpanan.setItem(
      KUNCI_PENYIMPANAN_ORDER,
      JSON.stringify([
        { orderId: UUID_1 },
        { orderId: UUID_2, customerName: 123 },
      ]),
    );

    const hasil = bacaOrderAktif(penyimpanan);

    expect(hasil).toEqual([
      { orderId: UUID_1, customerName: "" },
      { orderId: UUID_2, customerName: "" },
    ]);
  });
});

describe("tulisOrderAktif langsung", () => {
  it("menulis daftar yang diberikan", () => {
    const penyimpanan = buatPenyimpananNormal();
    tulisOrderAktif([{ orderId: UUID_1, customerName: "A" }], penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(1);
  });

  it("membuang entri yang id-nya bukan uuid valid saat menulis", () => {
    const penyimpanan = buatPenyimpananNormal();
    tulisOrderAktif(
      [
        { orderId: "bukan-uuid", customerName: "Buang" },
        { orderId: UUID_2, customerName: "Simpan" },
      ],
      penyimpanan,
    );
    // Hanya entri dengan uuid valid yang tersimpan.
    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: UUID_2, customerName: "Simpan" },
    ]);
  });

  it("tidak melempar error dengan daftar kosong", () => {
    const penyimpanan = buatPenyimpananNormal();
    const kosong: OrderTersimpan[] = [];
    expect(() => tulisOrderAktif(kosong, penyimpanan)).not.toThrow();
  });
});
