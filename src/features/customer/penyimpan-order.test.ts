// Tes untuk src/features/customer/penyimpan-order.ts.
//
// Yang diuji:
//   - tambah, baca, buang daftar order aktif,
//   - tahan terhadap localStorage yang error (tidak tersedia / melempar error),
//   - tahan terhadap isi localStorage yang rusak (bukan JSON, bukan array, isi
//     campuran).
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
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: "order-1", customerName: "Budi" },
    ]);
  });

  it("menambah beberapa order dan membacanya kembali", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    tambahOrderAktif("order-2", "Sari", penyimpanan);
    tambahOrderAktif("order-3", "Dina", penyimpanan);

    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: "order-1", customerName: "Budi" },
      { orderId: "order-2", customerName: "Sari" },
      { orderId: "order-3", customerName: "Dina" },
    ]);
  });

  it("tidak menambah order yang sama dua kali", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: "order-1", customerName: "Budi" },
    ]);
  });

  it("membuang satu order", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    tambahOrderAktif("order-2", "Sari", penyimpanan);
    buangOrderAktif("order-1", penyimpanan);

    expect(bacaOrderAktif(penyimpanan)).toEqual([
      { orderId: "order-2", customerName: "Sari" },
    ]);
  });

  it("membuang order yang tidak ada tanpa merusak daftar", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    buangOrderAktif("tidak-ada", penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(1);
  });

  it("menghapus kunci penyimpanan saat daftar jadi kosong", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    buangOrderAktif("order-1", penyimpanan);
    // Kuncinya dihapus, bukan diisi "[]".
    expect(penyimpanan.isi.has(KUNCI_PENYIMPANAN_ORDER)).toBe(false);
  });

  it("mengganti seluruh daftar sekaligus", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    gantiOrderAktif(
      [
        { orderId: "order-a", customerName: "Ana" },
        { orderId: "order-b", customerName: "Bimo" },
      ],
      penyimpanan,
    );
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(2);
  });

  it("mencari nama customer dari daftar tersimpan", () => {
    tambahOrderAktif("order-1", "Budi", penyimpanan);
    expect(cariNamaCustomer("order-1", penyimpanan)).toBe("Budi");
    // Order yang tidak ada menghasilkan nama kosong.
    expect(cariNamaCustomer("tidak-ada", penyimpanan)).toBe("");
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
    expect(() => tambahOrderAktif("order-1", "Budi", rusak)).not.toThrow();
  });

  it("mengembalikan daftar kosong saat membaca dari penyimpanan yang error", () => {
    expect(bacaOrderAktif(buatPenyimpananError())).toEqual([]);
  });

  it("tidak melempar error saat membuang dari penyimpanan yang error", () => {
    const rusak = buatPenyimpananError();
    expect(() => buangOrderAktif("order-1", rusak)).not.toThrow();
  });

  it("tidak melempar error saat menambah ke penyimpanan null", () => {
    expect(() => tambahOrderAktif("order-1", "Budi", null)).not.toThrow();
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

  it("melewati entri rusak dan mengambil entri yang punya orderId", () => {
    const penyimpanan = buatPenyimpananNormal();
    // Array mixture: teks biasa, objek tanpa orderId, dan objek yang benar.
    penyimpanan.setItem(
      KUNCI_PENYIMPANAN_ORDER,
      JSON.stringify([
        "bukan objek",
        { tanpaId: true },
        { orderId: "", customerName: "Kosong" },
        { orderId: "order-1", customerName: "Budi" },
      ]),
    );

    const hasil = bacaOrderAktif(penyimpanan);

    // Hanya entri dengan orderId yang valid yang diambil.
    expect(hasil).toHaveLength(1);
    expect(hasil[0].orderId).toBe("order-1");
  });

  it("mengisi customerName kosong kalau nama tidak tersimpan atau bukan teks", () => {
    const penyimpanan = buatPenyimpananNormal();
    penyimpanan.setItem(
      KUNCI_PENYIMPANAN_ORDER,
      JSON.stringify([
        { orderId: "order-1" },
        { orderId: "order-2", customerName: 123 },
      ]),
    );

    const hasil = bacaOrderAktif(penyimpanan);

    expect(hasil).toEqual([
      { orderId: "order-1", customerName: "" },
      { orderId: "order-2", customerName: "" },
    ]);
  });
});

describe("tulisOrderAktif langsung", () => {
  it("menulis daftar yang diberikan", () => {
    const penyimpanan = buatPenyimpananNormal();
    tulisOrderAktif([{ orderId: "a", customerName: "A" }], penyimpanan);
    expect(bacaOrderAktif(penyimpanan)).toHaveLength(1);
  });

  it("tidak melempar error dengan daftar kosong", () => {
    const penyimpanan = buatPenyimpananNormal();
    const kosong: OrderTersimpan[] = [];
    expect(() => tulisOrderAktif(kosong, penyimpanan)).not.toThrow();
  });
});
