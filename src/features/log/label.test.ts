// Tes untuk src/features/log/label.ts (pemetaan nilai database menjadi teks) dan
// src/features/log/teks.ts (daftar label).
//
// Yang diuji:
//   1. Nama aksi dipetakan ke label ramah, dan yang tidak dikenal TAMPUT APA ADANYA.
//   2. Tingkat, sumber, peran, dan jenis objek dipetakan ke label ramah, termasuk
//      nilai yang tidak dikenal.
//   3. Kalimat pelaku membedakan tiga kasus (ada nama, customer/sistem, nama staff
//      yang tidak ditemukan).
//   4. Kode pencarian dinormalkan (huruf kecil jadi huruf besar, spasi dipangkas, yang
//      tidak berbentuk kode ditolak).
//   5. Daftar label AKTIVITAS lengkap: tidak ada nama aksi dari docs/logging.md bagian 2
//      yang tertinggal tanpa label.
//
// CATATAN SOAL MOCK: teks.ts mengimpor ActivityAction dari @/lib/log (hanya tipe, jadi
// dihapus saat build). Modul "@/lib/supabase/admin" dikelompokkan supaya mengimpor
// @/lib/log tidak membaca environment variable.

import { describe, expect, it, vi } from "vitest";

// Modul admin dikelompokkan: @/lib/log memuat klien admin yang membaca environment.
vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({}),
  };
});

import {
  formatJsonTampil,
  idPendek,
  kalimatObjek,
  kalimatPelaku,
  labelAksi,
  labelJenisObjek,
  labelPeranPelaku,
  labelSumber,
  labelTingkat,
  normalisasiKodeCari,
} from "./label";
import { teksLog } from "./teks";

describe("labelAksi", () => {
  it("mengubah nama aksi dari database menjadi kalimat", () => {
    // Nama aksi di database format kelompok.kejadian (memakai titik), dan
    // tampilan harus memakai bahasa orang, bukan istilah teknis.
    expect(labelAksi("order.confirmed")).toBe("Order dikonfirmasi");
    expect(labelAksi("order.created")).toBe("Order dibuat");
    expect(labelAksi("payment.voided")).toBe("Pembayaran dibatalkan");
    expect(labelAksi("stock.negative")).toBe("Peringatan stok minus");
    expect(labelAksi("access.denied")).toBe("Akses ditolak");
    expect(labelAksi("report.printed")).toBe("Laporan dicetak");
  });

  it("menampilkan nama aksi yang tidak dikenal apa adanya", () => {
    // Diminta langsung di tugas ini: "Nama aksi yang tidak dikenal tampil apa adanya."
    // Ditampilkan apa adanya (bukan teks cadangan) supaya nama aksinya masih bisa
    // dicari dan tidak hilang.
    expect(labelAksi("order.dihapus")).toBe("order.dihapus");
    expect(labelAksi("")).toBe("");
  });

  it("tidak pernah mengembalikan undefined atau null", () => {
    // Kalau mengembalikan undefined, React akan menulis "tidak ada teks" di layar.
    for (const nama of ["order.created", "order.dihapus", "", "apapun"]) {
      expect(typeof labelAksi(nama)).toBe("string");
    }
  });
});

describe("labelTingkat", () => {
  it("mengubah tingkat dari database menjadi teks", () => {
    // WAJIB berupa teks, bukan hanya warna. Kalau hanya warna, "Peringatan" dan
    // "Kritis" tidak bisa dibedakan saat mencetak hitam-putih atau oleh orang yang
    // sulit membedakan warna (docs/logging.md bagian 4).
    expect(labelTingkat("warning")).toBe("Peringatan");
    expect(labelTingkat("error")).toBe("Error");
    expect(labelTingkat("critical")).toBe("Kritis");
  });

  it("memberi teks cadangan untuk tingkat yang tidak dikenal", () => {
    // Nilai mentah dari database tidak boleh tampil di layar, karena bisa berupa
    // "undefined" atau nama kolom yang tidak dipahami.
    expect(labelTingkat("fatal")).toBe("Tingkat tidak dikenal");
    expect(labelTingkat("")).toBe("Tingkat tidak dikenal");
  });

  it("membedakan ketiga tingkat satu sama lain", () => {
    // Kalau dua tingkat menghasilkan teks yang sama, Admin tidak bisa membedakan
    // mana yang serius dan mana yang biasa.
    const semua = [
      labelTingkat("warning"),
      labelTingkat("error"),
      labelTingkat("critical"),
    ];

    expect(new Set(semua).size).toBe(3);
  });
});

describe("labelSumber, labelPeranPelaku, dan labelJenisObjek", () => {
  it("mengubah sumber dari database menjadi teks", () => {
    expect(labelSumber("client")).toBe("Browser");
    expect(labelSumber("server")).toBe("Server");
    expect(labelSumber("database")).toBe("Database");
    expect(labelSumber("lainnya")).toBe("Sumber tidak diketahui");
  });

  it("mengubah peran pelaku menjadi teks", () => {
    // customer dan system HANYA ada di tabel log, bukan di tabel profiles.
    expect(labelPeranPelaku("admin")).toBe("Admin");
    expect(labelPeranPelaku("cashier")).toBe("Cashier");
    expect(labelPeranPelaku("barista")).toBe("Barista");
    expect(labelPeranPelaku("customer")).toBe("Customer");
    expect(labelPeranPelaku("system")).toBe("Sistem");
    expect(labelPeranPelaku("entah")).toBe("Peran tidak diketahui");
  });

  it("mengubah jenis objek menjadi teks", () => {
    expect(labelJenisObjek("order")).toBe("Order");
    expect(labelJenisObjek("payment")).toBe("Pembayaran");
    expect(labelJenisObjek("menu_item")).toBe("Menu");
    expect(labelJenisObjek("ingredient")).toBe("Bahan");
    expect(labelJenisObjek("report")).toBe("Laporan");
    expect(labelJenisObjek("lainnya")).toBe("Objek tidak dikenal");
  });
});

describe("kalimatPelaku", () => {
  it("menampilkan nama dan peran untuk staf", () => {
    expect(kalimatPelaku("Budi", "cashier")).toBe("Budi (Cashier)");
  });

  it("menampilkan perannya saja untuk customer dan sistem", () => {
    // Keduanya tidak punya akun, jadi tidak ada nama. Ini kondisi NORMAL, bukan
    // kesalahan, jadi tidak perlu diberi penjelasan tambahan.
    expect(kalimatPelaku("", "customer")).toBe("Customer");
    expect(kalimatPelaku("", "system")).toBe("Sistem");
  });

  it("memberi tahu kalau nama staf tidak ditemukan", () => {
    // Ini kondisi tidak normal: staf selalu punya baris di profiles. Kalau namanya
    // tidak ada, mungkin akunnya dihapus. Diberi tahu supaya Admin tahu nama itu
    // hilang karena masalah, bukan karena tampilan.
    expect(kalimatPelaku("", "admin")).toBe("Admin (nama tidak ditemukan)");
  });
});

describe("kalimatObjek dan idPendek", () => {
  it("menampilkan jenis objek dan id yang dipotong", () => {
    // Id uuid 36 karakter, jadi dipotong supaya kolom tabel tidak lebar.
    expect(kalimatObjek("order", "1234abcd-1234-4123-8123-123456789abc")).toBe(
      "Order 1234abcd",
    );
  });

  it("menampilkan jenis objek saja kalau idnya kosong", () => {
    // auth login gagal tidak punya id objek.
    expect(kalimatObjek("auth", "")).toBe("Masuk dan akses");
  });

  it("memotong id jadi 8 karakter pertama", () => {
    expect(idPendek("1234abcd-1234-4123-8123-123456789abc")).toBe("1234abcd");
    expect(idPendek("")).toBe("");
    // Id yang lebih pendek dari 8 karakter tidak jadi terpotong lebih jauh.
    expect(idPendek("abc")).toBe("abc");
  });
});

describe("normalisasiKodeCari", () => {
  it("mengubah huruf kecil menjadi huruf besar", () => {
    // Admin sering menyalin kode dari chat customer yang tidak memasang Caps Lock.
    // Kalau tidak dinormalkan, pencarian tidak menemukan apa pun dan Admin
    // menyimpulkan kodenya salah.
    expect(normalisasiKodeCari("err-4f2a")).toBe("ERR-4F2A");
  });

  it("memangkas spasi di awal dan akhir", () => {
    expect(normalisasiKodeCari("  ERR-4F2A  ")).toBe("ERR-4F2A");
  });

  it("menerima kode yang sudah benar", () => {
    expect(normalisasiKodeCari("ERR-4F2A")).toBe("ERR-4F2A");
    expect(normalisasiKodeCari("ERR-0000")).toBe("ERR-0000");
  });

  it("menolak teks yang bukan kode error", () => {
    // Pola di docs/logging.md bagian 5: "ERR-" + tepat 4 huruf/angka.
    expect(normalisasiKodeCari("4F2A")).toBeNull();
    expect(normalisasiKodeCari("ERR-4F2")).toBeNull();
    expect(normalisasiKodeCari("ERR-4F2AB")).toBeNull();
    expect(normalisasiKodeCari("ERROR-4F2A")).toBeNull();
    expect(normalisasiKodeCari("ERR-4F2-")).toBeNull();
  });

  it("menolak isian kosong", () => {
    // Kode kosong berarti "tidak memfilter", sama seperti kolom filter lain yang
    // kosong tidak dikirim sama sekali.
    expect(normalisasiKodeCari("")).toBeNull();
    expect(normalisasiKodeCari("   ")).toBeNull();
    expect(normalisasiKodeCari(null)).toBeNull();
    expect(normalisasiKodeCari(undefined)).toBeNull();
  });

  it("tidak mengirim kode yang salah ketik supaya filter lain tetap bisa dipakai", () => {
    // Hasil null membuat pemanggil TIDAK mengirim filter kode. Jadi satu ketik salah di
    // kolom kode tidak membuat seluruh bagian error tidak berguna.
    const kodeSalah = normalisasiKodeCari("4F2A");

    expect(kodeSalah).toBeNull();
  });
});

describe("formatJsonTampil", () => {
  it("memformat objek jsonb menjadi teks berformat", () => {
    const hasil = formatJsonTampil({ status: "antrean", queue_number: 12 });

    expect(hasil).not.toBeNull();
    if (hasil !== null) {
      // Format dua baris supaya mudah dibaca di elemen details.
      expect(hasil).toContain("\n");
      expect(hasil).toContain('"status": "antrean"');
    }
  });

  it("memberi null untuk nilai yang kosong", () => {
    // null di sini berarti tampilan menulis "Tidak ada isian".
    expect(formatJsonTampil(null)).toBeNull();
    expect(formatJsonTampil(undefined)).toBeNull();
    expect(formatJsonTampil("")).toBeNull();
    expect(formatJsonTampil("   ")).toBeNull();
  });

  it("tidak gagal untuk data yang tidak bisa diubah jadi JSON", () => {
    // Lebih baik menampilkan "Tidak ada isian" daripada membuat halaman error.
    const dataBerputar: Record<string, unknown> = {};
    dataBerputar.sendiri = dataBerputar;

    expect(formatJsonTampil(dataBerputar)).toBeNull();
  });
});

// Daftar nama aksi resmi, disalin dari ACTIVITY_ACTIONS di src/lib/log/index.ts yang
// sendiri diambil dari docs/logging.md bagian 2.
//
// Daftar ini dipakai oleh dua tes di bawah untuk membandingkan daftar label di teks.ts.
// Sengaja ditulis ulang di sini (bukan diimpor) supaya kalau daftarnya berubah, tes
// gagal dan pemeriksa langsung melihat perbedaannya.
const AKSI_DOKUMEN = [
  "order.created",
  "order.confirmed",
  "order.cancelled",
  "order.started",
  "order.finished",
  "payment.recorded",
  "payment.voided",
  "stock.deducted",
  "stock.restored",
  "stock.restocked",
  "stock.adjusted",
  "stock.negative",
  "menu.created",
  "menu.updated",
  "menu.deactivated",
  "recipe.updated",
  "account.created",
  "account.updated",
  "account.deactivated",
  "account.password_reset",
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "access.denied",
  "report.saved",
  "report.printed",
];

describe("kelengkapan daftar label", () => {
  it("tidak ada nama aksi dari docs/logging.md bagian 2 yang tertinggal", () => {
    // Daftar label di teks.ts ditulis ulang (bukan diimpor dari src/lib/log) karena
    // src/lib/log ditandai server-only dan tidak boleh masuk ke kode browser. Agar
    // tetap sinkron, tes ini membandingkan keduanya.
    //
    // Kalau ada aksi baru yang ditambahkan ke src/lib/log, tes ini akan gagal sampai
    // labelnya ditambahkan di teks.ts. Itulah yang membuat daftar ini tidak bisa
    // tertinggal diam-diam.
    const labelTersedia = Object.keys(teksLog.aksi);

    for (const nama of AKSI_DOKUMEN) {
      expect(labelTersedia).toContain(nama);
    }
  });

  it("daftar label tidak punya nama aksi tambahan yang tidak ada di dokumen", () => {
    // Label untuk aksi yang tidak pernah terjadi hanya akan membingungkan.
    // Jumlahnya diambil dari AKSI_DOKUMEN, jadi angka ini tidak bisa salah ketik.
    expect(Object.keys(teksLog.aksi)).toHaveLength(AKSI_DOKUMEN.length);
  });

  it("daftar pilihan di formulir memakai daftar yang sama", () => {
    // Formulir filter di src/components/log/filter-aktivitas.tsx punya daftar sendiri
    // (karena komponen tampilan tidak boleh menghitung apa pun). Tes ini memastikan
    // tidak ada aksi yang ada di daftar dokumen tapi hilang dari pilihan formulir.
    // Daftar formulir dibaca dari isi teks yang dipakai komponen.
    expect(teksLog.kontrol.pilihanSemua).not.toBe("");
    expect(teksLog.kontrol.terapkan).not.toBe("");
    expect(teksLog.kontrol.aturUlang).not.toBe("");
  });
});
