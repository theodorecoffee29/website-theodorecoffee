// Tes untuk src/features/cashier/waktu-manual.ts.
//
// Yang diuji:
//   1. Jam dan menit pilihan Cashier diubah menjadi waktu ISO dengan +07:00,
//   2. Hasilnya TIDAK bergantung pada zona waktu komputer,
//   3. Waktu manual tidak boleh di masa depan dan harus di hari ini (WIB).
//
// Cara menguji syarat (2): di dalam tes, zona waktu proses diubah ke beberapa
// zona berbeda (process.env.TZ). Kalau fungsi ini benar, hasilnya tetap sama di
// semua zona.

import { afterEach, describe, expect, it } from "vitest";
import { cekWaktuManual, waktuIsoDariJamMenit } from "./waktu-manual";

// Zona waktu asal proses, disimpan supaya bisa dikembalikan setelah tes.
const zonaAsli = process.env.TZ;

// Memindahkan zona waktu proses (dipakai untuk menguji syarat 2).
function setZona(zona: string): void {
  process.env.TZ = zona;
}

afterEach(() => {
  // Kembalikan zona waktu supaya tes lain tidak terpengaruh.
  if (zonaAsli === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = zonaAsli;
  }
});

describe("waktuIsoDariJamMenit", () => {
  it("menghasilkan waktu ISO dengan offset +07:00", () => {
    // Waktu sekarang yang dipakai hanya untuk mengambil tanggalnya.
    const sekarang = new Date("2026-10-08T05:00:00Z"); // 12:00 WIB

    const hasil = waktuIsoDariJamMenit(9, 15, sekarang);

    expect(hasil).toBe("2026-10-08T09:15:00+07:00");
  });

  it("menulis jam dan menit dengan dua digit", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z");

    // 9:05 harus ditulis 09:05, bukan 9:5 (ISO selalu dua digit).
    expect(waktuIsoDariJamMenit(9, 5, sekarang)).toBe(
      "2026-10-08T09:05:00+07:00",
    );
  });

  it("menerima jam 0 dan jam 23", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z");

    expect(waktuIsoDariJamMenit(0, 0, sekarang)).toBe(
      "2026-10-08T00:00:00+07:00",
    );
    expect(waktuIsoDariJamMenit(23, 59, sekarang)).toBe(
      "2026-10-08T23:59:00+07:00",
    );
  });

  it("menolak jam dan menit di luar batas", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z");

    // Batas jam 0-23, menit 0-59.
    expect(waktuIsoDariJamMenit(-1, 0, sekarang)).toBeNull();
    expect(waktuIsoDariJamMenit(24, 0, sekarang)).toBeNull();
    expect(waktuIsoDariJamMenit(0, -1, sekarang)).toBeNull();
    expect(waktuIsoDariJamMenit(0, 60, sekarang)).toBeNull();
    // Pecahan juga ditolak: pilihan dari dropdown selalu bulat.
    expect(waktuIsoDariJamMenit(9.5, 0, sekarang)).toBeNull();
  });

  it("menggunakan tanggal HARI INI menurut WIB, bukan tanggal lokal", () => {
    // 2026-10-08T17:00:00Z = 2026-10-09 00:00 WIB. Jadi tanggal WIB-nya sudah
    // 9 Oktober, walau tanggal UTC-nya masih 8 Oktober.
    const WIBTengahMalam = new Date("2026-10-08T17:00:00Z");

    const hasil = waktuIsoDariJamMenit(10, 0, WIBTengahMalam);

    expect(hasil).toBe("2026-10-09T10:00:00+07:00");
  });
});

describe("waktuIsoDariJamMenit: bebas dari zona waktu komputer", () => {
  // Ini syarat yang paling penting: laptop Cashier bisa punya zona waktu apa
  // saja, tapi waktu yang dikirim ke server HARUS WIB.
  const zonaYangDiuji = [
    "Asia/Jakarta", // WIB (pas)
    "UTC", // 7 jam di belakang WIB
    "America/New_York", // jauh di belakang
    "Asia/Tokyo", // 2 jam di depan WIB
    "Australia/Sydney", // paling depan
  ];

  it("menghasilkan string yang sama persis di semua zona waktu", () => {
    // Waktu "sekarang" yang sama dipakai di semua zona.
    const sekarang = new Date("2026-10-08T05:00:00Z");
    const hasilPerZona: (string | null)[] = [];

    for (const zona of zonaYangDiuji) {
      setZona(zona);
      hasilPerZona.push(waktuIsoDariJamMenit(9, 15, sekarang));
    }

    // Semua zona harus menghasilkan hasil yang sama.
    for (const hasil of hasilPerZona) {
      expect(hasil).toBe("2026-10-08T09:15:00+07:00");
    }
  });

  it("TIDAK memakai jam lokal komputer", () => {
    // Bukti langsung: kalau fungsi ini salah dan memakai jam lokal, hasilnya
    // akan berbeda antar zona. Kita hitung jam lokal di tiap zona untuk
    // menunjukkan bedanya.
    const sekarang = new Date("2026-10-08T05:00:00Z"); // 12:00 WIB
    const jamLokal: number[] = [];

    for (const zona of zonaYangDiuji) {
      setZona(zona);
      jamLokal.push(sekarang.getHours());
    }

    // Jam lokal memang berbeda antar zona (5 di UTC, 12 di Jakarta, ...).
    expect(new Set(jamLokal).size).toBeGreaterThan(1);
    // Tapi fungsi kita tetap menghasilkan waktu WIB yang sama.
    setZona("UTC");
    expect(waktuIsoDariJamMenit(9, 15, sekarang)).toBe(
      "2026-10-08T09:15:00+07:00",
    );
  });
});

describe("cekWaktuManual", () => {
  it("menerima waktu manual di hari ini", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z"); // 12:00 WIB
    const waktu = waktuIsoDariJamMenit(9, 15, sekarang);

    // null berarti tidak ada masalah.
    expect(cekWaktuManual(waktu, sekarang)).toBeNull();
  });

  it("menerima waktu yang SEDANG berjalan (toleransi detik)", () => {
    // Cashier memilih jam dan menit yang sedang berjalan. Detik sudah lewat
    // sedikit, tapi itu bukan "masa depan" yang sebenarnya.
    const sekarang = new Date("2026-10-08T05:00:30Z"); // 12:00:30 WIB
    const waktu = waktuIsoDariJamMenit(12, 0, sekarang);

    expect(cekWaktuManual(waktu, sekarang)).toBeNull();
  });

  it("menolak waktu di masa depan", () => {
    // "Sekarang" pukul 12:00 WIB, tapi Cashier memilih 13:00.
    const sekarang = new Date("2026-10-08T05:00:00Z"); // 12:00 WIB
    const waktu = waktuIsoDariJamMenit(13, 0, sekarang);

    expect(cekWaktuManual(waktu, sekarang)).toBe(
      "Waktu manual tidak boleh di masa depan.",
    );
  });

  it("menolak waktu kemarin menurut WIB", () => {
    // Sekarang: 8 Oktober 12:00 WIB.
    const sekarang = new Date("2026-10-08T05:00:00Z");
    // Cashier memilih 7 Oktober 09:00 WIB. Ini bukan masa depan (sudah lewat),
    // tapi tanggalnya beda, jadi tetap ditolak.
    const waktuKemarin = "2026-10-07T09:00:00+07:00";

    expect(cekWaktuManual(waktuKemarin, sekarang)).toBe(
      "Waktu manual harus di hari ini (WIB).",
    );
  });

  it("menolak waktu ISO yang tidak bisa dibaca", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z");

    expect(cekWaktuManual("bukan waktu", sekarang)).toBe(
      "Waktu manual tidak valid.",
    );
  });

  it("menolak waktu kosong (null)", () => {
    const sekarang = new Date("2026-10-08T05:00:00Z");

    expect(cekWaktuManual(null, sekarang)).toBe("Waktu manual belum lengkap.");
  });

  it("menerima batas tengah malam WIB", () => {
    // Waktu sekarang: 8 Oktober 23:30 WIB (= 16:30 UTC).
    const sekarang = new Date("2026-10-08T16:30:00Z");
    // Cashier memilih 23:00 WIB, masih hari ini.
    const waktu = "2026-10-08T23:00:00+07:00";

    expect(cekWaktuManual(waktu, sekarang)).toBeNull();
  });

  it("menolak waktu 00:30 WIB kalau sekarang sudah lewat tengah malam", () => {
    // Sekarang: 9 Oktober 00:30 WIB (= 8 Oktober 17:30 UTC).
    const sekarang = new Date("2026-10-08T17:30:00Z");
    // Cashier memilih 00:00 WIB tanggal 8 Oktober: itu kemarin menurut WIB.
    const waktu = "2026-10-08T00:00:00+07:00";

    expect(cekWaktuManual(waktu, sekarang)).toBe(
      "Waktu manual harus di hari ini (WIB).",
    );
  });
});
