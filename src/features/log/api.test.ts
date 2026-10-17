// Tes untuk src/features/log/api.ts, khusus bagian pembuat query string.
//
// Yang diuji hanya bagian MURNI (buatQueryString), supaya tidak perlu memalsukan
// fetch. Bagian pemanggil API mengikuti pola yang sama seperti api.ts di area lain
// (src/features/laporan/api.ts), dan perbedaannya hanya ada pada pembungkus respons.

import { describe, expect, it } from "vitest";

import { buatQueryString } from "./api";

describe("buatQueryString", () => {
  it("membuat query string dari filter yang terisi", () => {
    const hasil = buatQueryString({
      from: "2026-10-11",
      to: "2026-10-12",
      code: "ERR-4F2A",
    });

    expect(hasil).toBe("from=2026-10-11&to=2026-10-12&code=ERR-4F2A");
  });

  it("membuang filter yang kosong", () => {
    // Filter kosong TIDAK boleh dikirim. Kalau dikirim sebagai string kosong, server
    // akan menolaknya dengan pesan "tidak sesuai", padahal Admin memang tidak mengisi
    // apa pun. Ini yang membuat "?action=" tidak merusak halaman.
    const hasil = buatQueryString({
      from: "2026-10-11",
      to: "",
      action: "",
      actorRole: "",
    });

    expect(hasil).toBe("from=2026-10-11");
  });

  it("membuang filter yang undefined", () => {
    const hasil = buatQueryString({
      from: "2026-10-11",
      to: undefined,
      cursor: undefined,
    });

    expect(hasil).toBe("from=2026-10-11");
  });

  it("menghasilkan string kosong kalau tidak ada filter", () => {
    // String kosong berarti alamatnya tanpa tanda tanya sama sekali.
    expect(buatQueryString({})).toBe("");
  });

  it("mengubah karakter khusus menjadi bentuk yang aman di alamat", () => {
    // Tanpa encodeURIComponent, karakter "&" atau "#" di dalam nilai akan membuat
    // alamat rusak: bagian filter berikutnya hilang atau dianggap sebagai anchor.
    const hasil = buatQueryString({
      orderId: "abc&to=2020-01-01#frag",
    });

    expect(hasil).toBe("orderId=abc%26to%3D2020-01-01%23frag");
    // Nilai yang sudah di-encode tidak boleh mengandung karakter pemisah.
    expect(hasil).not.toContain("&to=");
  });
});
