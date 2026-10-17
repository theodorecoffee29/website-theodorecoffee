// Tes untuk konstanta polling di src/features/laporan/polling.ts.
//
// Kenapa konstanta polling perlu dites: nilainya kecil dan tidak terlihat dari kode,
// jadi paling mudah salah kalau ada yang mengubahnya lalu tidak sengaja (mis. kembali
// jadi 5000). Nilai yang diuji disamakan dengan layar lain yang paling lambat, yaitu
// "Sisa stok di Barista" di docs/api-contract.md bagian 5.
//
// CATATAN SOAL DOKUMEN: tabel polling di docs/api-contract.md bagian 5 belum punya
// baris untuk halaman laporan (tabel itu ditulis sebelum halaman laporan ada).
// Karena itu nilai 10 detik di sini tidak berasal dari baris dokumen, tapi disamakan
// dengan layar yang paling lambat. Ini dilaporkan ke pengguna supaya dokumen bisa
// ditambahkan barisnya nanti.

import { describe, expect, it } from "vitest";
import { POLLING_LAPORAN_HARI_INI_MS } from "@/features/laporan/polling";
import { POLLING_SISA_STOK_MS as POLLING_SISA_STOK_BARISTA_MS } from "@/features/barista/polling";

describe("konstanta polling laporan", () => {
  it("laporan hari ini di-poll setiap 10 detik", () => {
    expect(POLLING_LAPORAN_HARI_INI_MS).toBe(10000);
  });

  it("seperlambat layar yang paling lambat di aplikasi", () => {
    // Laporan bukan layar yang butuh perubahan tiap detik: dipakai untuk melihat
    // ringkasan penjualan dan mencocokkan uang di akhir acara. Polling yang lebih
    // lambat dari semua layar lain membuat halaman ini tidak membebani server.
    expect(POLLING_LAPORAN_HARI_INI_MS).toBeGreaterThanOrEqual(
      POLLING_SISA_STOK_BARISTA_MS,
    );
  });
});
