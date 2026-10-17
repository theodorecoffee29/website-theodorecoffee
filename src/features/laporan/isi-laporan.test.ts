// Tes untuk logika tampilan laporan di src/features/laporan/isi-laporan.ts dan
// src/features/laporan/waktu.ts.
//
// Yang diuji di sini adalah SEMUA pekerjaan yang tidak butuh browser: mengubah
// isi laporan dari server menjadi bentuk siap tampil. Ini bagian yang paling mudah
// salah diam-diam, karena kalau nominalnya salah, Cashier salah menghitung uang.
//
// Isi laporan yang dipakai di bawah sengaja dibuat lengkap (ada order yang
// dibatalkan, ada bahan yang minus, ada alasan pembatalan yang kosong) supaya
// kasus-kasus sulit ikut teruji, bukan cuma kasus yang rapi.

import { describe, expect, it } from "vitest";
import {
  formatJumlah,
  jamWib,
  tanggalJamWib,
  tanggalPanjang,
  tanggalPendek,
} from "@/features/laporan/waktu";
import {
  hitungPencocokanUang,
  judulCetak,
  kalimatWaktuCetak,
  labelAsal,
  labelMetodeBayar,
  petakanIsiLaporan,
  petakanMenuTerlaris,
  petakanPemakaianBahan,
  petakanOrders,
  petakanRingkasan,
  petakanSumber,
  teksAlasanBatal,
  teksStatusOrder,
  tandaStokMinus,
} from "@/features/laporan/isi-laporan";

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

/**
 * Satu isi laporan lengkap, bentuknya sama persis dengan hasil fungsi database
 * (docs/api-contract.md bagian 4c) dengan semua angka sudah berupa angka.
 */
const LAPORAN_CONTOH = {
  date: "2026-10-11",
  totals: {
    orderCount: 12,
    sales: 325000,
    cancelledCount: 2,
    unfinishedCount: 1,
  },
  bySource: {
    online: { count: 9, amount: 245000 },
    cashier: { count: 3, amount: 80000 },
  },
  byPaymentMethod: {
    qris: { count: 8, amount: 250000 },
    tunai: { count: 4, amount: 75000 },
  },
  topMenu: [
    { name: "Kopi Susu", qty: 7, amount: 140000 },
    { name: "Americano", qty: 5, amount: 75000 },
  ],
  ingredientUsage: [
    { name: "Biji kopi", unit: "g", used: 420.5, stockAtEnd: -12.25 },
    { name: "Susu", unit: "ml", used: 1400, stockAtEnd: 800 },
    { name: "Gula", unit: "g", used: 300, stockAtEnd: 0 },
  ],
  orders: [
    {
      orderId: "aaa",
      queueNumber: 2,
      customerName: "Budi",
      source: "online",
      paymentMethod: "qris",
      status: "selesai",
      items: [{ name: "Kopi Susu", qty: 2, note: "less sugar" }],
      total: 40000,
      confirmedAt: "2026-10-11T09:15:00+07:00",
      isManualTime: false,
      cancelReason: null,
    },
    {
      orderId: "bbb",
      queueNumber: 1,
      customerName: "Sari",
      source: "cashier",
      paymentMethod: "tunai",
      status: "selesai",
      items: [{ name: "Americano", qty: 1, note: "" }],
      total: 15000,
      confirmedAt: "2026-10-11T08:05:00+07:00",
      isManualTime: false,
      cancelReason: null,
    },
    {
      orderId: "ccc",
      queueNumber: 3,
      customerName: "Andi",
      source: "online",
      paymentMethod: "qris",
      status: "dibatalkan",
      items: [{ name: "Kopi Susu", qty: 1, note: "" }],
      total: 20000,
      confirmedAt: "2026-10-11T10:00:00+07:00",
      isManualTime: true,
      cancelReason: "stok_habis",
    },
    {
      // Order dibatalkan dengan alasan yang kosong. Ini kasus yang harus tetap
      // terbaca jelas, bukan tampil "Dibatalkan: " tanpa isi.
      orderId: "ddd",
      queueNumber: 4,
      customerName: "Dewi",
      source: "online",
      paymentMethod: "qris",
      status: "dibatalkan",
      items: [{ name: "Teh", qty: 1, note: "" }],
      total: 10000,
      confirmedAt: "2026-10-11T10:30:00+07:00",
      isManualTime: false,
      cancelReason: "",
    },
    {
      // Order yang masih menunggu konfirmasi: belum punya jam konfirmasi.
      orderId: "eee",
      queueNumber: 5,
      customerName: "Rina",
      source: "online",
      paymentMethod: "",
      status: "menunggu_konfirmasi",
      items: [{ name: "Kopi Susu", qty: 1, note: "" }],
      total: 20000,
      confirmedAt: null,
      isManualTime: false,
      cancelReason: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Format waktu
// ---------------------------------------------------------------------------

describe("format tanggal dan jam WIB", () => {
  it("mengubah tanggal database menjadi tanggal panjang gaya Indonesia", () => {
    expect(tanggalPanjang("2026-10-11")).toBe("11 Oktober 2026");
  });

  it("mengubah tanggal database menjadi tanggal pendek", () => {
    expect(tanggalPendek("2026-10-11")).toBe("11/10/2026");
  });

  it("tidak menggeser tanggal apa pun dipengaruhi zona waktu mesin", () => {
    // Tanggal 1 Januari tidak boleh jadi 31 Desember, apa pun zona mesinnya.
    // Ini bug yang pernah terjadi kalau tanggal dibaca lewat new Date("...") lalu
    // diformat dengan zona lain.
    expect(tanggalPanjang("2026-01-01")).toBe("1 Januari 2026");
    expect(tanggalPendek("2026-12-31")).toBe("31/12/2026");
  });

  it("mengembalikan string kosong untuk tanggal yang tidak terbaca", () => {
    // String kosong, bukan "Invalid Date", supaya tampilan tidak rusak.
    expect(tanggalPanjang("")).toBe("");
    expect(tanggalPanjang("bukan tanggal")).toBe("");
    expect(tanggalPendek("2026-13-01")).toBe("");
  });

  it("mengubah waktu timestamptz menjadi jam WIB", () => {
    // Waktu UTC 17:05 tanggal 11 Oktober = 00:05 tanggal 12 Oktober di WIB
    // (selisih 7 jam).
    //
    // Pemisah jam dan menit memakai TITIK, sama seperti halaman Cashier
    // (src/features/cashier/waktu-wib.ts), supaya jam di seluruh aplikasi tidak
    // tampil dalam dua bentuk berbeda.
    expect(jamWib("2026-10-11T17:05:00+00:00")).toBe("00.05");
    expect(jamWib("2026-10-11T09:15:00+07:00")).toBe("09.15");
  });

  it("mengembalikan string kosong untuk waktu yang tidak terbaca", () => {
    expect(jamWib("")).toBe("");
    expect(jamWib("bukan waktu")).toBe("");
  });

  it("mengubah waktu menjadi tanggal dan jam WIB sekaligus", () => {
    // Ini yang dipakai untuk kalimat "Disimpan pada ...".
    expect(tanggalJamWib("2026-10-11T17:05:00+00:00")).toBe(
      "12 Oktober 2026, 00.05",
    );
  });

  it("memakai pemformat angka bersama, bukan pemformat baru", () => {
    // Angka takaran bahan harus tampil sama seperti di panel sisa stok.
    expect(formatJumlah(12500)).toBe("12.500");
    expect(formatJumlah(0.25)).toBe("0,25");
    expect(formatJumlah(-12.25)).toBe("-12,25");
  });
});

// ---------------------------------------------------------------------------
// Pemetaan ringkasan
// ---------------------------------------------------------------------------

describe("pemetaan ringkasan laporan ke tampilan", () => {
  it("mengubah totals menjadi angka tampilan", () => {
    const ringkasan = petakanRingkasan(
      "2026-10-11",
      LAPORAN_CONTOH.totals,
      "11 Oktober 2026",
      "11/10/2026",
    );

    expect(ringkasan.tanggalTeks).toBe("11 Oktober 2026");
    expect(ringkasan.tanggalPendek).toBe("11/10/2026");
    expect(ringkasan.orderTerhitungTeks).toBe("12");
    expect(ringkasan.dibatalkanTeks).toBe("2");
    expect(ringkasan.belumSelesaiTeks).toBe("1");
  });

  it("menulis total penjualan sebagai rupiah", () => {
    const ringkasan = petakanRingkasan(
      "2026-10-11",
      LAPORAN_CONTOH.totals,
      "",
      "",
    );

    // Pemisah ribuan titik, gaya Indonesia.
    expect(ringkasan.totalPenjualanTeks).toBe("Rp 325.000");
  });

  it("memberi nilai 0 kalau datanya tidak terbaca", () => {
    // Server harusnya selalu mengirim angka, tapi halaman tidak boleh ikut error
    // kalau ada satu field yang hilang.
    const ringkasan = petakanRingkasan("2026-10-11", {}, "", "");

    expect(ringkasan.orderTerhitungTeks).toBe("0");
    expect(ringkasan.totalPenjualanTeks).toBe("Rp 0");
    expect(ringkasan.dibatalkanTeks).toBe("0");
    expect(ringkasan.belumSelesaiTeks).toBe("0");
  });

  it("membaca angka totals yang datang sebagai teks", () => {
    // Angka jsonb dari PostgREST bisa datang sebagai teks. Kalau tidak dibaca
    // sebagai angka, "15000" + "500" akan jadi "15000500".
    const ringkasan = petakanRingkasan(
      "2026-10-11",
      { orderCount: "12", sales: "325000" },
      "",
      "",
    );

    expect(ringkasan.orderTerhitungTeks).toBe("12");
    expect(ringkasan.totalPenjualanTeks).toBe("Rp 325.000");
  });
});

// ---------------------------------------------------------------------------
// Pencocokan uang
// ---------------------------------------------------------------------------

describe("pengelompokan dan penghitung Pencocokan uang", () => {
  it("mengelompokkan Tunai dan QRIS dari byPaymentMethod", () => {
    const pencocokan = hitungPencocokanUang(LAPORAN_CONTOH.byPaymentMethod);

    expect(pencocokan.tunai.label).toBe("Tunai");
    expect(pencocokan.tunai.jumlahOrder).toBe(4);
    expect(pencocokan.tunai.nominalTeks).toBe("Rp 75.000");

    expect(pencocokan.qris.label).toBe("QRIS");
    expect(pencocokan.qris.jumlahOrder).toBe(8);
    expect(pencocokan.qris.nominalTeks).toBe("Rp 250.000");
  });

  it("menulis jumlah order sebagai kalimat", () => {
    const pencocokan = hitungPencocokanUang(LAPORAN_CONTOH.byPaymentMethod);

    expect(pencocokan.tunai.jumlahOrderTeks).toBe("4 order");
    expect(pencocokan.qris.jumlahOrderTeks).toBe("8 order");
  });

  it("menjumlahkan kedua sisi sama dengan total penjualan", () => {
    // Ini yang membuat kotak Pencocokan uang bisa dipercaya: jumlah kedua sisi
    // harus sama dengan total penjualan di kotak ringkasan.
    const pencocokan = hitungPencocokanUang(LAPORAN_CONTOH.byPaymentMethod);

    expect(pencocokan.tunai.nominal + pencocokan.qris.nominal).toBe(
      LAPORAN_CONTOH.totals.sales,
    );
    expect(pencocokan.tunai.jumlahOrder + pencocokan.qris.jumlahOrder).toBe(
      LAPORAN_CONTOH.totals.orderCount,
    );
  });

  it("memberi nilai 0 kalau satu metode bayar tidak ada sama sekali", () => {
    // Laporan hari tanpa pembayaran tunai harus tetap menampilkan "Rp 0", bukan
    // kotak kosong yang membuat Cashier ragu.
    const pencocokan = hitungPencocokanUang({
      qris: { count: 8, amount: 250000 },
    });

    expect(pencocokan.tunai.jumlahOrder).toBe(0);
    expect(pencocokan.tunai.nominalTeks).toBe("Rp 0");
    expect(pencocokan.qris.nominalTeks).toBe("Rp 250.000");
  });

  it("tidak gagal kalau byPaymentMethod-nya sama sekali tidak ada", () => {
    const pencocokan = hitungPencocokanUang(undefined);

    expect(pencocokan.tunai.nominalTeks).toBe("Rp 0");
    expect(pencocokan.qris.nominalTeks).toBe("Rp 0");
  });
});

// ---------------------------------------------------------------------------
// Asal order
// ---------------------------------------------------------------------------

describe("pemetaan asal order", () => {
  it("menampilkan Online dan Kasir dengan jumlah dan nominalnya", () => {
    const sumber = petakanSumber(LAPORAN_CONTOH.bySource);

    expect(sumber.online.label).toBe("Online");
    expect(sumber.online.jumlahOrder).toBe(9);
    expect(sumber.online.nominalTeks).toBe("Rp 245.000");

    // Nilai "cashier" dari server ditulis jadi "Kasir" di layar.
    expect(sumber.kasir.label).toBe("Kasir");
    expect(sumber.kasir.jumlahOrder).toBe(3);
    expect(sumber.kasir.nominalTeks).toBe("Rp 80.000");
  });

  it("mengubah label asal dari nilai server", () => {
    expect(labelAsal("online")).toBe("Online");
    expect(labelAsal("cashier")).toBe("Kasir");
    // Nilai yang tidak dikenal tidak boleh hilang, tapi juga tidak boleh ditulis
    // mentah ke layar.
    expect(labelAsal("entah")).toBe("Asal tidak diketahui");
    expect(labelAsal("")).toBe("Asal tidak diketahui");
  });

  it("mengubah label metode bayar dari nilai server", () => {
    expect(labelMetodeBayar("qris")).toBe("QRIS");
    expect(labelMetodeBayar("tunai")).toBe("Tunai");
    // Order yang dibatalkan sebelum punya metode bayar.
    expect(labelMetodeBayar("")).toBe("--");
  });
});

// ---------------------------------------------------------------------------
// Menu terlaris
// ---------------------------------------------------------------------------

describe("pemetaan menu terlaris", () => {
  it("menampilkan nama, porsi, dan nominal", () => {
    const menu = petakanMenuTerlaris(LAPORAN_CONTOH.topMenu);

    expect(menu).toHaveLength(2);
    expect(menu[0]?.nama).toBe("Kopi Susu");
    expect(menu[0]?.porsiTeks).toBe("7");
    expect(menu[0]?.nominalTeks).toBe("Rp 140.000");
    expect(menu[1]?.nama).toBe("Americano");
    expect(menu[1]?.nominalTeks).toBe("Rp 75.000");
  });

  it("memberi daftar kosong kalau topMenu tidak ada", () => {
    expect(petakanMenuTerlaris(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pemakaian bahan dan stok minus
// ---------------------------------------------------------------------------

describe("penanda stok minus pada pemakaian bahan", () => {
  it("menandai bahan yang sisanya di bawah 0", () => {
    const bahan = petakanPemakaianBahan(LAPORAN_CONTOH.ingredientUsage);

    // Biji kopi: sisa -12,25 gram, jadi minus.
    expect(bahan[0]?.nama).toBe("Biji kopi");
    expect(bahan[0]?.minus).toBe(true);
    expect(bahan[0]?.sisaTeks).toBe("-12,25");
  });

  it("tidak menandai bahan yang sisanya positif atau tepat nol", () => {
    const bahan = petakanPemakaianBahan(LAPORAN_CONTOH.ingredientUsage);

    expect(bahan[1]?.minus).toBe(false);
    // Sisa tepat 0 berarti habis, bukan minus.
    expect(bahan[2]?.minus).toBe(false);
    expect(bahan[2]?.sisaTeks).toBe("0");
  });

  it("menampilkan satuan dan jumlah terpakai", () => {
    const bahan = petakanPemakaianBahan(LAPORAN_CONTOH.ingredientUsage);

    expect(bahan[0]?.satuan).toBe("g");
    expect(bahan[0]?.terpakaiTeks).toBe("420,5");
    expect(bahan[1]?.terpakaiTeks).toBe("1.400");
  });

  it("membedakan minus dari nol dan dari positif", () => {
    expect(tandaStokMinus(-0.5)).toBe(true);
    expect(tandaStokMinus(0)).toBe(false);
    expect(tandaStokMinus(1)).toBe(false);
    // Nilai yang tidak terbaca dianggap 0, jadi bukan minus.
    expect(tandaStokMinus("abc")).toBe(false);
    expect(tandaStokMinus(undefined)).toBe(false);
    // Teks negatif dari database juga harus terbaca sebagai minus.
    expect(tandaStokMinus("-12.25")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Alasan pembatalan
// ---------------------------------------------------------------------------

describe("pemetaan alasan pembatalan ke teks", () => {
  it("mengubah alasan yang dikenal menjadi kalimat", () => {
    expect(teksAlasanBatal("stok_habis")).toBe("Stok habis");
    expect(teksAlasanBatal("diminta_customer")).toBe("Diminta customer");
    expect(teksAlasanBatal("lainnya")).toBe("Lainnya");
  });

  it("memberi teks cadangan kalau alasan ada tapi isinya kosong", () => {
    // Order DIBATALKAN tapi alasannya tidak tercatat. Kalau ini dianggap "tidak
    // ada", barisnya akan tampil "Dibatalkan: " tanpa isi dan tidak menjelaskan
    // apa pun.
    expect(teksAlasanBatal("")).toBe("tanpa alasan tercatat");
    // Spasi saja dianggap kosong juga.
    expect(teksAlasanBatal("   ")).toBe("tanpa alasan tercatat");
  });

  it("memberi string kosong kalau alasan memang tidak ada sama sekali", () => {
    // Bentuk ini artinya order-nya bukan yang dibatalkan, jadi pemanggil tidak
    // menampilkan baris alasan sama sekali.
    expect(teksAlasanBatal(null)).toBe("");
    expect(teksAlasanBatal(undefined)).toBe("");
  });

  it("menampilkan nilai mentah kalau alasan tidak dikenal", () => {
    // Nilai baru di database tidak boleh hilang hanya karena labelnya belum
    // ditambah.
    expect(teksAlasanBatal("alasan_baru")).toBe("alasan_baru");
  });

  it("membuang spasi di sekeliling alasan yang dikenal", () => {
    expect(teksAlasanBatal("  stok_habis  ")).toBe("Stok habis");
  });
});

// ---------------------------------------------------------------------------
// Daftar order
// ---------------------------------------------------------------------------

describe("pemetaan daftar order", () => {
  it("mengurutkan order menurut nomor antrean", () => {
    // Data contoh sengaja tidak urut (2, 1, 3, 4, 5) supaya urutannya diuji
    // betulan, bukan cuma kebetulan sudah urut.
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    expect(orders.map((satu) => satu.nomorAntrean)).toEqual([1, 2, 3, 4, 5]);
    expect(orders[0]?.nama).toBe("Sari");
    expect(orders[0]?.kunci).toBe("bbb");
  });

  it("menampilkan nomor antrean, nama, asal, dan metode bayar", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);
    const kedua = orders[1];

    expect(kedua?.nomorAntrean).toBe(2);
    expect(kedua?.nama).toBe("Budi");
    expect(kedua?.asalTeks).toBe("Online");
    expect(kedua?.metodeBayarTeks).toBe("QRIS");
  });

  it("menampilkan item beserta jumlah dan catatannya", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);
    const kedua = orders[1];

    expect(kedua?.items).toHaveLength(1);
    expect(kedua?.items[0]?.jumlahTeks).toBe("2");
    expect(kedua?.items[0]?.nama).toBe("Kopi Susu");
    expect(kedua?.items[0]?.catatan).toBe("less sugar");
  });

  it("menganggap catatan kosong sebagai tidak ada", () => {
    // Kalau tidak, tampilan menampilkan kurung kosong seperti "( )".
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    expect(orders[0]?.items[0]?.catatan).toBeNull();
  });

  it("menulis total sebagai rupiah", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    expect(orders[1]?.totalTeks).toBe("Rp 40.000");
  });

  it("menampilkan jam konfirmasi dalam WIB", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    expect(orders[1]?.jamTeks).toBe("09.15");
  });

  it("menandai order dengan waktu manual", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    // Order nomor 3 waktunya diketik manual dari catatan kertas.
    expect(orders[2]?.waktuManual).toBe(true);
    expect(orders[1]?.waktuManual).toBe(false);
  });

  it("memberi jam kosong untuk order yang belum dikonfirmasi", () => {
    // Order nomor 5 masih menunggu konfirmasi, jadi belum ada jam konfirmasi.
    const orders = petakanOrders(LAPORAN_CONTOH.orders);
    const terakhir = orders[4];

    expect(terakhir?.statusTeks).toBe("Menunggu konfirmasi");
    expect(terakhir?.jamTeks).toBe("");
    expect(terakhir?.metodeBayarTeks).toBe("--");
  });

  it("menandai order yang dibatalkan beserta alasannya", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    // Order nomor 3 dibatalkan dengan alasan stok habis.
    expect(orders[2]?.dibatalkan).toBe(true);
    expect(orders[2]?.statusTeks).toBe("Dibatalkan");
    expect(orders[2]?.alasanTeks).toBe("Stok habis");

    // Order nomor 4 dibatalkan tapi alasannya kosong: teks cadangan, bukan kosong.
    expect(orders[3]?.dibatalkan).toBe(true);
    expect(orders[3]?.alasanTeks).toBe("tanpa alasan tercatat");
  });

  it("tidak memberi alasan pembatalan untuk order yang tidak dibatalkan", () => {
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    expect(orders[0]?.dibatalkan).toBe(false);
    expect(orders[0]?.alasanTeks).toBeNull();
  });

  it("tidak menghitung order yang dibatalkan di total penjualan", () => {
    // Aturan dari docs/api-contract.md bagian 4c: order yang dibatalkan tidak masuk
    // hitungan sama sekali. Yang dihitung hanya order berstatus antrean, dikerjakan,
    // atau selesai.
    const orders = petakanOrders(LAPORAN_CONTOH.orders);

    // Order nomor 3 dan 4 dibatalkan, nominalnya 20.000 dan 10.000.
    const totalOrderDibatalkan = orders
      .filter((satu) => satu.dibatalkan)
      .reduce((jumlah, satu) => jumlah + parseRupiah(satu.totalTeks), 0);
    expect(totalOrderDibatalkan).toBe(20000 + 10000);

    // Order yang boleh dihitung: bukan dibatalkan dan bukan masih menunggu
    // konfirmasi. Order 1 (15.000) dan 2 (40.000).
    const totalYangDihitung = orders
      .filter(
        (satu) => !satu.dibatalkan && satu.statusTeks !== "Menunggu konfirmasi",
      )
      .reduce((jumlah, satu) => jumlah + parseRupiah(satu.totalTeks), 0);
    expect(totalYangDihitung).toBe(15000 + 40000);

    // Nominal order yang dibatalkan tidak ikut di dalam total yang dihitung.
    expect(totalYangDihitung).toBe(55000);
    expect(totalYangDihitung).not.toBe(85000);
  });

  it("memberi daftar kosong kalau orders tidak ada", () => {
    expect(petakanOrders(undefined)).toEqual([]);
  });

  it("memetakan status order ke teks lengkap", () => {
    expect(teksStatusOrder("menunggu_konfirmasi")).toBe("Menunggu konfirmasi");
    expect(teksStatusOrder("antrean")).toBe("Di antrean");
    expect(teksStatusOrder("dikerjakan")).toBe("Sedang dibuat");
    expect(teksStatusOrder("selesai")).toBe("Selesai");
    expect(teksStatusOrder("dibatalkan")).toBe("Dibatalkan");
    // Status yang tidak dikenal tidak boleh menampilkan nilai mentah database.
    expect(teksStatusOrder("entah")).toBe("Status tidak diketahui");
  });
});

// ---------------------------------------------------------------------------
// Judul cetak
// ---------------------------------------------------------------------------

describe("pembuat judul cetak", () => {
  it("membuat judul berisi nama usaha dan tanggal laporan", () => {
    // Hasil cetak sering dilipat dan ditumpuk, jadi tanpa nama usaha dan tanggal
    // tumpukan kertas tidak bisa dipilah.
    expect(judulCetak("2026-10-11")).toBe(
      "Theodore Coffee - Laporan 11 Oktober 2026",
    );
  });

  it("membuat judul dari tanggal yang tidak terbaca tanpa gagal", () => {
    expect(judulCetak("")).toBe("Theodore Coffee - Laporan ");
  });

  it("membuat kalimat waktu pencetakan dalam WIB", () => {
    // 2026-10-11T17:10:00Z = 2026-10-12 00:10 WIB.
    const kalimat = kalimatWaktuCetak(Date.parse("2026-10-11T17:10:00+00:00"));

    expect(kalimat).toBe("Dicetak pada 12 Oktober 2026, 00.10");
  });

  it("memberi string kosong kalau waktu pencetakan tidak terbaca", () => {
    expect(kalimatWaktuCetak(Number.NaN)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Pemetaan keseluruhan
// ---------------------------------------------------------------------------

describe("pemetaan isi laporan keseluruhan", () => {
  it("mengubah isi laporan server menjadi bentuk siap tampil", () => {
    const isi = petakanIsiLaporan(LAPORAN_CONTOH);

    expect(isi.ringkasan.totalPenjualanTeks).toBe("Rp 325.000");
    expect(isi.pencocokan.tunai.nominalTeks).toBe("Rp 75.000");
    expect(isi.pencocokan.qris.nominalTeks).toBe("Rp 250.000");
    expect(isi.sumber.online.nominalTeks).toBe("Rp 245.000");
    expect(isi.sumber.kasir.nominalTeks).toBe("Rp 80.000");
    expect(isi.menuTerlaris).toHaveLength(2);
    expect(isi.pemakaianBahan).toHaveLength(3);
    expect(isi.orders).toHaveLength(5);
  });

  it("tidak gagal kalau isinya bukan objek", () => {
    // Halaman laporan tidak boleh ikut error hanya karena server mengirim bentuk
    // yang tidak diharapkan. Hasilnya laporan kosong yang tetap utuh.
    const isi = petakanIsiLaporan(null);

    expect(isi.ringkasan.totalPenjualanTeks).toBe("Rp 0");
    expect(isi.orders).toEqual([]);
    expect(isi.pencocokan.tunai.nominalTeks).toBe("Rp 0");
  });

  it("menjumlahkan nominal per sumber sama dengan total penjualan", () => {
    const isi = petakanIsiLaporan(LAPORAN_CONTOH);

    expect(isi.sumber.online.nominal + isi.sumber.kasir.nominal).toBe(325000);
  });
});

// ---------------------------------------------------------------------------
// Pembantu untuk tes
// ---------------------------------------------------------------------------

/**
 * Mengubah teks rupiah dari OrderTampil kembali menjadi angka.
 *
 * Dipakai hanya di dalam tes untuk menjumlahkan nominal order.
 */
function parseRupiah(teks: string): number {
  return Number(teks.replace("Rp ", "").replace(/\./g, ""));
}
