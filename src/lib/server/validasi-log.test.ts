// Tes untuk src/lib/server/validasi-log.ts (validasi filter halaman log).
//
// Yang diuji:
//   1. Tanggal diubah menjadi AWAL HARI dan AKHIR HARI dalam zona WIB (+07:00).
//   2. Kode error ERR-XXXX diterima dalam huruf besar maupun kecil.
//   3. Aksi yang tidak terdaftar DITOLAK (hanya aksi dari docs/logging.md bagian 2).
//   4. Id order harus berupa uuid.
//   5. Tanggal yang tidak ada di kalender dan rentang tanggal terbalik ditolak.
//
// CATATAN SOAL MOCK: file ini mengimpor ACTIVITY_ACTIONS dari @/lib/log, dan modul itu
// memuat klien admin yang membaca environment variable. Modul "../supabase/admin"
// dikelompokkan (di-mock) supaya tes TIDAK membaca environment sama sekali. Daftar
// ACTIVITY_ACTIONS sendiri tetap yang asli, karena justru daftar itu yang sedang diuji.

import { describe, expect, it, vi } from "vitest";

// Modul admin dikelompokkan supaya @/lib/log tidak membaca environment variable.
vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({}),
  };
});

import {
  filterAktivitasSchema,
  filterErrorSchema,
  OFFSET_WIB,
  rentangTanggalNalik,
  rentangWaktuWib,
  tanggalNyataDiKalender,
} from "./validasi-log";

// ---------------------------------------------------------------------------
// Batas waktu WIB
// ---------------------------------------------------------------------------

describe("rentang waktu WIB", () => {
  it("mengubah tanggal awal menjadi pukul 00.00.00 waktu WIB", () => {
    // PENTING: batasnya 00.00.00 WIB, bukan 00.00.00 UTC. Kalau salah, "hari ini"
    // akan bergeser 7 jam dan order yang tercatat jam 7 pagi sampai jam 7 malam
    // tidak akan ikut.
    const rentang = rentangWaktuWib("2026-10-11", undefined);

    expect(rentang.gte).toBe("2026-10-11T00:00:00.000" + OFFSET_WIB);
    expect(OFFSET_WIB).toBe("+07:00");
    expect(rentang.lte).toBeUndefined();
  });

  it("mengubah tanggal akhir menjadi pukul 23.59.59.999 waktu WIB", () => {
    // Batas akhir memakai .999 supaya baris terakhir hari itu (yang bisa tercatat
    // pada 23.59.59.5) tidak terlewat.
    const rentang = rentangWaktuWib(undefined, "2026-10-11");

    expect(rentang.lte).toBe("2026-10-11T23:59:59.999" + OFFSET_WIB);
    expect(rentang.gte).toBeUndefined();
  });

  it("mengubah kedua batas sekaligus", () => {
    const rentang = rentangWaktuWib("2026-10-11", "2026-10-12");

    expect(rentang.gte).toBe("2026-10-11T00:00:00.000+07:00");
    expect(rentang.lte).toBe("2026-10-12T23:59:59.999+07:00");
  });

  it("menghasilkan rentang kosong kalau tidak ada tanggal", () => {
    const rentang = rentangWaktuWib(undefined, undefined);

    expect(rentang.gte).toBeUndefined();
    expect(rentang.lte).toBeUndefined();
  });
});

describe("tanggal nyata di kalender", () => {
  it("menerima tanggal yang benar-benar ada", () => {
    expect(tanggalNyataDiKalender("2026-10-11")).toBe(true);
    expect(tanggalNyataDiKalender("2024-02-29")).toBe(true);
    expect(tanggalNyataDiKalender("2026-12-31")).toBe(true);
  });

  it("menolak tanggal yang tidak ada di kalender", () => {
    // Pola YYYY-MM-DD menerima "2026-02-31", padahal tanggal itu tidak ada. Tanpa
    // pemeriksaan ini, filter seperti itu diam-diam mengembalikan daftar kosong dan
    // Admin mengira berarti tidak ada log.
    expect(tanggalNyataDiKalender("2026-02-31")).toBe(false);
    expect(tanggalNyataDiKalender("2026-13-01")).toBe(false);
    expect(tanggalNyataDiKalender("2026-00-10")).toBe(false);
    // 2026 bukan tahun kabisat, jadi 29 Februari tidak ada.
    expect(tanggalNyataDiKalender("2026-02-29")).toBe(false);
    expect(tanggalNyataDiKalender("bukan tanggal")).toBe(false);
  });
});

describe("rentang tanggal terbalik", () => {
  it("menolak tanggal awal yang lebih besar dari tanggal akhir", () => {
    expect(rentangTanggalNalik("2026-10-12", "2026-10-11")).toBe(false);
  });

  it("menerima tanggal awal yang sama dengan atau lebih kecil", () => {
    expect(rentangTanggalNalik("2026-10-11", "2026-10-11")).toBe(true);
    expect(rentangTanggalNalik("2026-10-11", "2026-10-12")).toBe(true);
  });

  it("menerima kalau salah satu tanggal tidak diisi", () => {
    // Filter hanya "dari tanggal" saja adalah hal yang wajar.
    expect(rentangTanggalNalik("2026-10-12", undefined)).toBe(true);
    expect(rentangTanggalNalik(undefined, "2026-10-11")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter aktivitas
// ---------------------------------------------------------------------------

describe("filter aktivitas", () => {
  it("menerima filter kosong", () => {
    // Tanpa filter apa pun, server mengembalikan 50 baris terbaru.
    const hasil = filterAktivitasSchema.safeParse({});

    expect(hasil.success).toBe(true);
  });

  it("menerima semua filter yang sah", () => {
    const hasil = filterAktivitasSchema.safeParse({
      from: "2026-10-11",
      to: "2026-10-12",
      action: "order.confirmed",
      actorRole: "cashier",
      entityType: "order",
      orderId: "66666666-6666-4666-8666-666666666666",
      cursor: "abc",
    });

    expect(hasil.success).toBe(true);
  });

  it("menerima peran customer dan system yang tidak punya akun", () => {
    // Dua peran ini hanya ada di tabel log, bukan di tabel profiles
    // (src/lib/enum-log.ts).
    expect(
      filterAktivitasSchema.safeParse({ actorRole: "customer" }).success,
    ).toBe(true);
    expect(
      filterAktivitasSchema.safeParse({ actorRole: "system" }).success,
    ).toBe(true);
  });

  it("menolak nama aksi yang tidak terdaftar", () => {
    // Hanya nama aksi dari docs/logging.md bagian 2 yang diterima. Menolak aksi
    // fiktif lebih baik daripada mengembalikan daftar kosong tanpa penjelasan.
    const hasil = filterAktivitasSchema.safeParse({ action: "order.dihapus" });

    expect(hasil.success).toBe(false);
  });

  it("menolak aksi yang tidak dikenal karena hanya huruf besar", () => {
    const hasil = filterAktivitasSchema.safeParse({
      action: "ORDER.CONFIRMED",
    });

    expect(hasil.success).toBe(false);
  });

  it("menolak id order yang bukan uuid", () => {
    expect(
      filterAktivitasSchema.safeParse({ orderId: "bukan-uuid" }).success,
    ).toBe(false);
    expect(filterAktivitasSchema.safeParse({ orderId: "6666" }).success).toBe(
      false,
    );
  });

  it("menerima id order berupa uuid", () => {
    expect(
      filterAktivitasSchema.safeParse({
        orderId: "66666666-6666-4666-8666-666666666666",
      }).success,
    ).toBe(true);
  });

  it("menolak tanggal dengan format yang salah", () => {
    expect(
      filterAktivitasSchema.safeParse({ from: "11/10/2026" }).success,
    ).toBe(false);
    expect(
      filterAktivitasSchema.safeParse({ from: "2026-10-11 08:00" }).success,
    ).toBe(false);
  });

  it("memangkas spasi di sekeliling nilai", () => {
    const hasil = filterAktivitasSchema.safeParse({
      orderId: "  66666666-6666-4666-8666-666666666666  ",
    });

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.orderId).toBe("66666666-6666-4666-8666-666666666666");
    }
  });

  it("menolak peran yang tidak dikenal", () => {
    expect(
      filterAktivitasSchema.safeParse({ actorRole: "pemilik" }).success,
    ).toBe(false);
  });

  it("menolak jenis objek yang tidak dikenal", () => {
    expect(
      filterAktivitasSchema.safeParse({ entityType: "laporan" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Filter error
// ---------------------------------------------------------------------------

describe("filter error", () => {
  it("menerima kode ERR-XXXX dalam huruf besar", () => {
    const hasil = filterErrorSchema.safeParse({ code: "ERR-4F2A" });

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.code).toBe("ERR-4F2A");
    }
  });

  it("menerima kode dalam huruf kecil", () => {
    // Admin sering menyalin kode dari chat customer yang tidak memasang Caps Lock.
    // Huruf kecil TIDAK ditolak di sini; normalisasi ke huruf besar dilakukan di sisi
    // browser sebelum dikirim (src/features/log/label.ts).
    const hasil = filterErrorSchema.safeParse({ code: "err-4f2a" });

    expect(hasil.success).toBe(true);
  });

  it("menolak kode yang formatnya salah", () => {
    // Hanya "ERR-" + tepat 4 huruf/angka yang diterima (docs/logging.md bagian 5).
    expect(filterErrorSchema.safeParse({ code: "ERR-4F2" }).success).toBe(
      false,
    );
    expect(filterErrorSchema.safeParse({ code: "ERR-4F2AB" }).success).toBe(
      false,
    );
    expect(filterErrorSchema.safeParse({ code: "4F2A" }).success).toBe(false);
    expect(filterErrorSchema.safeParse({ code: "ERROR-4F2A" }).success).toBe(
      false,
    );
  });

  it("menerima tingkat dan sumber yang sah", () => {
    expect(filterErrorSchema.safeParse({ severity: "warning" }).success).toBe(
      true,
    );
    expect(filterErrorSchema.safeParse({ severity: "critical" }).success).toBe(
      true,
    );
    expect(filterErrorSchema.safeParse({ source: "database" }).success).toBe(
      true,
    );
  });

  it("menolak tingkat dan sumber yang tidak dikenal", () => {
    expect(filterErrorSchema.safeParse({ severity: "fatal" }).success).toBe(
      false,
    );
    expect(filterErrorSchema.safeParse({ source: "jaringan" }).success).toBe(
      false,
    );
  });

  it("menerima id order berupa uuid dan menolaknya kalau bukan uuid", () => {
    expect(
      filterErrorSchema.safeParse({
        orderId: "66666666-6666-4666-8666-666666666666",
      }).success,
    ).toBe(true);
    expect(filterErrorSchema.safeParse({ orderId: "abc" }).success).toBe(false);
  });

  it("menolak kolom id order dan kode error yang tidak ada di filter aktivitas", () => {
    // Membalik nama filter di url harus ditolak, bukan diam-diam diabaikan. Kalau
    // diabaikan, Admin mengira sedang memfilter padahal tidak.
    expect(filterAktivitasSchema.safeParse({ code: "ERR-4F2A" }).success).toBe(
      false,
    );
    expect(
      filterErrorSchema.safeParse({ action: "order.created" }).success,
    ).toBe(false);
  });

  it("menolak cursor yang terlalu panjang", () => {
    // Cursor yang dibuat server cuma beberapa puluh karakter. Batas ini supaya
    // alamat yang berisi string raksasa tidak ikut diurai.
    const cursorPanjang = "a".repeat(5000);

    expect(filterErrorSchema.safeParse({ cursor: cursorPanjang }).success).toBe(
      false,
    );
  });
});
