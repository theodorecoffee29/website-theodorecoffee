// Tes untuk src/lib/server/petikan-laporan.ts.
//
// File ini MURNI (tanpa database dan tanpa Supabase), jadi bisa diuji langsung.
//
// Yang diuji:
//   1. Angka numeric dari database yang datang sebagai TEKS diubah ke angka.
//   2. Bentuk isi laporan TIDAK diubah: field yang bukan angka (nama customer,
//      tanggal, status, catatan) diteruskan apa adanya.
//   3. Bentuk daftar Riwayat dan satu laporan tersimpan.

import { describe, expect, it } from "vitest";
import {
  petakanDaftarLaporan,
  petakanLaporanHariIni,
  petakanLaporanTersimpan,
  ubahAngkaDalamLaporan,
} from "./petikan-laporan";

// Satu isi laporan dengan semua angka sengaja dikirim sebagai TEKS, seperti
// yang sering terjadi kalau nilainya berasal dari jsonb PostgREST.
const LAPORAN_TEKSTUAL = {
  date: "2026-10-11",
  totals: {
    orderCount: "12",
    sales: "45000",
    cancelledCount: "2",
    unfinishedCount: "1",
  },
  bySource: {
    online: { count: "8", amount: "30000" },
    cashier: { count: "4", amount: "15000" },
  },
  byPaymentMethod: {
    qris: { count: "10", amount: "40000" },
    tunai: { count: "2", amount: "5000" },
  },
  topMenu: [{ name: "Kopi Susu", qty: "9", amount: "22500" }],
  ingredientUsage: [
    { name: "Susu", unit: "ml", used: "1250.5", stockAtEnd: "750.25" },
  ],
  orders: [
    {
      orderId: "11111111-1111-4111-8111-111111111111",
      queueNumber: "3",
      customerName: "Budi",
      source: "online",
      paymentMethod: "qris",
      status: "selesai",
      items: [{ name: "Kopi Susu", qty: "2", note: "less sugar" }],
      total: "9000",
      confirmedAt: "2026-10-11T09:15:00+07:00",
      isManualTime: false,
      cancelReason: null,
    },
  ],
};

describe("ubahAngkaDalamLaporan", () => {
  it("mengubah angka bertingkat yang datang sebagai teks", () => {
    // Bentuk laporan bertingkat: objek di dalam objek, objek di dalam array.
    // Semuanya harus ditelusuri.
    const hasil = ubahAngkaDalamLaporan(LAPORAN_TEKSTUAL) as Record<
      string,
      Record<string, unknown>
    >;

    expect(hasil.totals?.orderCount).toBe(12);
    expect(hasil.totals?.sales).toBe(45000);
    expect(hasil.totals?.cancelledCount).toBe(2);
  });

  it("mengubah angka di dalam array dan objek di dalam array", () => {
    const hasil = ubahAngkaDalamLaporan(LAPORAN_TEKSTUAL) as Record<
      string,
      unknown
    >;
    const topMenu = hasil.topMenu as { qty: number; amount: number }[];
    const usage = hasil.ingredientUsage as {
      used: number;
      stockAtEnd: number;
    }[];

    expect(topMenu[0]?.qty).toBe(9);
    expect(topMenu[0]?.amount).toBe(22500);
    expect(usage[0]?.used).toBe(1250.5);
    expect(usage[0]?.stockAtEnd).toBe(750.25);
  });

  it("TIDAK mengubah nama customer yang kebetulan berupa angka", () => {
    // Ini alasannya daftar field angka ditulis eksplisit. Kalau aturannya
    // "kalau teksnya kelihatan angka, ubah", nama customer "12345" akan
    // menjadi angka dan tampilannya rusak.
    const hasil = ubahAngkaDalamLaporan({
      orders: [{ customerName: "12345", queueNumber: "7" }],
    }) as { orders: { customerName: unknown; queueNumber: unknown }[] };

    expect(hasil.orders[0]?.customerName).toBe("12345");
    expect(hasil.orders[0]?.queueNumber).toBe(7);
  });

  it("meneruskan teks lain apa adanya", () => {
    const hasil = ubahAngkaDalamLaporan(LAPORAN_TEKSTUAL) as Record<
      string,
      unknown
    >;
    const orders = hasil.orders as { status: string; source: string }[];

    expect(hasil.date).toBe("2026-10-11");
    expect(orders[0]?.status).toBe("selesai");
    expect(orders[0]?.source).toBe("online");
  });

  it("menjaga null tetap null", () => {
    // cancelReason null berarti order itu tidak dibatalkan. Kalau diubah jadi 0
    // atau "", tampilannya akan salah.
    const hasil = ubahAngkaDalamLaporan(LAPORAN_TEKSTUAL) as {
      orders: { cancelReason: unknown }[];
    };

    expect(hasil.orders[0]?.cancelReason).toBeNull();
  });

  it("mengubah angka desimal dengan koma atau titik", () => {
    const hasil = ubahAngkaDalamLaporan({ sales: "45000.50" }) as {
      sales: number;
    };

    expect(hasil.sales).toBe(45000.5);
  });

  it("mengubah angka yang sudah berupa angka tanpa mengubahnya", () => {
    const hasil = ubahAngkaDalamLaporan({ qty: 3 }) as { qty: number };

    expect(hasil.qty).toBe(3);
  });

  it("mengubah angka yang tidak terbaca menjadi 0, bukan NaN", () => {
    // Field angka yang isinya rusak akan tampil "0", bukan "NaN" yang
    // membingungkan Cashier.
    const hasil = ubahAngkaDalamLaporan({ sales: "bukan angka" }) as {
      sales: number;
    };

    expect(hasil.sales).toBe(0);
  });

  it("meneruskan nilai yang bukan objek atau array apa adanya", () => {
    expect(ubahAngkaDalamLaporan("teks")).toBe("teks");
    expect(ubahAngkaDalamLaporan(null)).toBeNull();
    expect(ubahAngkaDalamLaporan(true)).toBe(true);
  });
});

describe("petakanLaporanHariIni", () => {
  it("mengembalikan isi laporan dengan angka yang sudah diubah", () => {
    const hasil = petakanLaporanHariIni(LAPORAN_TEKSTUAL) as Record<
      string,
      Record<string, unknown>
    >;

    expect(hasil.totals?.sales).toBe(45000);
  });

  it("memastikan live bernilai true", () => {
    // Laporan hari ini belum disimpan, jadi harus ditandai live supaya layar
    // bisa menampilkan pengibarannya.
    const hasil = petakanLaporanHariIni(LAPORAN_TEKSTUAL) as {
      live: boolean;
    };

    expect(hasil.live).toBe(true);
  });

  it("tidak melempar error kalau data tak terduga", () => {
    expect(() => petakanLaporanHariIni(null)).not.toThrow();
    expect(petakanLaporanHariIni("bukan objek")).toEqual({ live: true });
  });
});

describe("petakanDaftarLaporan", () => {
  // Hasil list_reports dari database: array laporan dengan ringkasan total.
  const HASIL_LIST_REPORTS = {
    reports: [
      {
        reportId: "22222222-2222-4222-8222-222222222222",
        date: "2026-10-10",
        generatedAt: "2026-10-11T00:05:00+07:00",
        totals: { orderCount: "10", sales: "40000" },
      },
      {
        reportId: "33333333-3333-4333-8333-333333333333",
        date: "2026-10-09",
        generatedAt: "2026-10-10T00:05:00+07:00",
        totals: { orderCount: "5", sales: "20000" },
      },
    ],
  };

  it("memetakan daftar laporan beserta ringkasan totalsnya", () => {
    const hasil = petakanDaftarLaporan(HASIL_LIST_REPORTS, 0, false);

    expect(hasil.reports).toHaveLength(2);
    expect(hasil.reports[0]?.reportId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(hasil.reports[0]?.date).toBe("2026-10-10");
    expect(hasil.reports[0]?.generatedAt).toBe("2026-10-11T00:05:00+07:00");
    // totals ikut diubah angkanya.
    expect(hasil.reports[0]?.totals).toEqual({
      orderCount: 10,
      sales: 40000,
    });
  });

  it("mempertahankan urutan dari server (terbaru dulu)", () => {
    // Urutan Riwayat ditentukan database. Server tidak boleh mengurutkan ulang.
    const hasil = petakanDaftarLaporan(HASIL_LIST_REPORTS, 0, false);

    expect(hasil.reports[0]?.date).toBe("2026-10-10");
    expect(hasil.reports[1]?.date).toBe("2026-10-09");
  });

  it("menyimpan jumlah hari yang baru disimpan dari catch-up", () => {
    const hasil = petakanDaftarLaporan(HASIL_LIST_REPORTS, 2, false);

    expect(hasil.catchUpSaved).toBe(2);
  });

  it("menambahkan catchUpFailed hanya kalau catch-up gagal", () => {
    const normal = petakanDaftarLaporan(HASIL_LIST_REPORTS, 0, false);
    const gagal = petakanDaftarLaporan(HASIL_LIST_REPORTS, 0, true);

    // Respons normal harus tetap ringkas.
    expect(normal.catchUpFailed).toBeUndefined();
    expect(gagal.catchUpFailed).toBe(true);
  });

  it("tetap mengembalikan daftar kosong tanpa melempar error", () => {
    // Riwayat yang masih kosong adalah keadaan normal (mis. hari pertama
    // acara), bukan kegagalan.
    const hasil = petakanDaftarLaporan({}, 0, false);

    expect(hasil.reports).toEqual([]);
    expect(hasil.catchUpSaved).toBe(0);
  });

  it("membuang entri tanpa reportId", () => {
    // Entri tanpa id tidak bisa dibuka lagi, jadi dilewati.
    const hasil = petakanDaftarLaporan(
      {
        reports: [
          { date: "2026-10-10", totals: {} },
          {
            reportId: "44444444-4444-4444-8444-444444444444",
            date: "2026-10-09",
          },
        ],
      },
      0,
      false,
    );

    expect(hasil.reports).toHaveLength(1);
    expect(hasil.reports[0]?.date).toBe("2026-10-09");
  });
});

describe("petakanLaporanTersimpan", () => {
  it("memetakan isi satu laporan tersimpan", () => {
    const hasil = petakanLaporanTersimpan({
      reportId: "55555555-5555-4555-8555-555555555555",
      date: "2026-10-09",
      generatedAt: "2026-10-10T00:05:00+07:00",
      data: LAPORAN_TEKSTUAL,
    });

    expect(hasil.reportId).toBe("55555555-5555-4555-8555-555555555555");
    expect(hasil.date).toBe("2026-10-09");

    // Isi laporan diteruskan apa adanya, hanya angkanya yang diubah.
    const isi = hasil.data as { totals: Record<string, unknown> };
    expect(isi.totals.orderCount).toBe(12);
  });

  it("memberi nilai kosong kalau data tidak terbaca", () => {
    const hasil = petakanLaporanTersimpan(null);

    expect(hasil.reportId).toBe("");
    expect(hasil.date).toBe("");
    expect(hasil.generatedAt).toBe("");
    expect(hasil.data).toBeNull();
  });
});
