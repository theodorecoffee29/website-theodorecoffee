// Tes untuk src/features/cashier/waktu-wib.ts.
//
// Yang diuji: perubahan waktu dari database (timestamptz) menjadi jam WIB.
//
// Penting: tes ini memakai waktu yang tidak ambigu. Kalau kita menulis
// "2026-10-08T02:00:00" tanpa zona, hasilnya bisa berbeda tergantung timezone
// mesin. Jadi semua waktu di tes ini selalu menyebut zonanya.

// Catatan: locale id-ID memakai titik sebagai pemisah jam ("09.15"), bukan
// titik dua. Ini hasil nyata dari Intl, sudah dicek di browser dan Node.
import { describe, expect, it } from "vitest";
import { jamWib } from "./waktu-wib";

describe("jamWib", () => {
  it("menampilkan jam sesuai zona WIB", () => {
    // 02:00 UTC = 09:00 WIB (tambah 7 jam).
    expect(jamWib("2026-10-08T02:00:00Z")).toBe("09.00");
  });

  it("menampilkan jam yang sudah WIB tanpa mengubahnya", () => {
    // 09:15 WIB tetap 09:15 WIB.
    expect(jamWib("2026-10-08T09:15:00+07:00")).toBe("09.15");
  });

  it("menampilkan jam dengan dua digit", () => {
    // Jam 9 pagi ditulis 09, bukan 9.
    expect(jamWib("2026-10-08T09:05:00+07:00")).toBe("09.05");
  });

  it("mengubah waktu sore menjadi jam 24-jam", () => {
    // 14:30, bukan 02:30 PM.
    expect(jamWib("2026-10-08T14:30:00+07:00")).toBe("14.30");
  });

  it("menampilkan tengah malam sebagai 00, bukan 24", () => {
    // 17:00 UTC = 00:00 WIB keesokan hari.
    expect(jamWib("2026-10-08T17:00:00Z")).toBe("00.00");
  });

  it("mengembalikan teks kosong saat waktu tidak terbaca", () => {
    // Tidak boleh menampilkan "Invalid Date" ke Cashier.
    expect(jamWib("bukan tanggal")).toBe("");
    expect(jamWib("")).toBe("");
  });

  it("mengembalikan hasil yang sama untuk input yang sama", () => {
    const waktu = "2026-10-08T02:00:00Z";

    expect(jamWib(waktu)).toBe(jamWib(waktu));
  });
});
