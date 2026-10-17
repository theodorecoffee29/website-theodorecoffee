// Tes untuk src/lib/server/cursor-log.ts (penanda lanjutan halaman log).
//
// Yang diuji:
//   1. Pembuat cursor dan pembacanya berbalik dengan benar.
//   2. Cursor yang rusak (bukan base64, bukan JSON, field kurang, waktu tidak terbaca)
//     DITOLAK dan dianggap "tidak ada cursor".
//   3. Filter .or() yang dibentuk benar untuk:
//      - halaman pertama (tanpa cursor),
//      - halaman berikutnya (dengan cursor),
//      - jejak order (cursor DAN filter order_id digabung dengan benar).
//
// PENTING SOAL TES KASUS SATU: beberapa baris log bisa punya waktu yang PERSIS SAMA.
// Contohnya konfirmasi satu order, yang dalam satu transaksi mencatat pembayaran,
// mengurangi stok, dan menulis tiga baris log dengan waktu identik. Karena itu cursor
// memakai (waktu, id), bukan waktu saja. Tes "waktu sama" di bawah sengaja memakai
// kondisi itu.

import { describe, expect, it } from "vitest";
import {
  bacaCursor,
  buatCursor,
  filterAtau,
  MAKSIMAL_CURSOR,
  type Cursor,
} from "./cursor-log";

// Cursor contoh: waktu dan id baris terakhir yang sudah dikirim.
const CURSOR_CONTOH: Cursor = {
  at: "2026-10-11T10:00:00+07:00",
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

describe("buatCursor dan bacaCursor", () => {
  it("mengembalikan nilai yang sama setelah dibaca ulang", () => {
    const teks = buatCursor(CURSOR_CONTOH.at, CURSOR_CONTOH.id);

    expect(bacaCursor(teks)).toEqual(CURSOR_CONTOH);
  });

  it("menghasilkan teks yang aman ditaruh langsung di query string", () => {
    // base64url hanya memakai huruf, angka, "-", dan "_". Kalau ada "+", "/", atau
    // "=", alamatnya harus di-encode dulu, dan itu rawan terlewat.
    const teks = buatCursor(CURSOR_CONTOH.at, CURSOR_CONTOH.id);

    expect(teks).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(teks).not.toContain("+");
    expect(teks).not.toContain("/");
    expect(teks).not.toContain("=");
  });

  it("menghasilkan cursor yang berbeda untuk id yang berbeda dengan waktu sama", () => {
    // Inilah alasan cursor memakai (waktu, id): dua baris dengan waktu identik
    // harus punya posisi yang berbeda.
    const pertama = buatCursor("2026-10-11T10:00:00+07:00", "id-aaaa");
    const kedua = buatCursor("2026-10-11T10:00:00+07:00", "id-bbbb");

    expect(pertama).not.toBe(kedua);
  });

  it("menganggap cursor yang tidak ada sebagai tidak ada", () => {
    expect(bacaCursor(null)).toBeNull();
    expect(bacaCursor(undefined)).toBeNull();
    expect(bacaCursor("")).toBeNull();
    expect(bacaCursor("    ")).toBeNull();
  });

  it("menolak cursor yang rusak", () => {
    // Cursor datang dari browser, jadi tidak bisa dipercaya. Cursor yang rusak
    // TIDAK boleh membuat permintaan gagal, hanya dianggap tidak ada.
    expect(bacaCursor("bukan-base64-yang-sah!!!")).toBeNull();
    expect(
      bacaCursor(Buffer.from("bukan json", "utf8").toString("base64url")),
    ).toBeNull();
  });

  it("menolak cursor yang fieldnya kurang", () => {
    // Hanya "at" saja, tanpa id: tidak sah, karena id dibutuhkan untukurate baris
    // yang waktunya sama.
    const tanpaId = Buffer.from(
      JSON.stringify({ at: "2026-10-11T10:00:00+07:00" }),
      "utf8",
    ).toString("base64url");
    expect(bacaCursor(tanpaId)).toBeNull();

    // Hanya id saja, tanpa waktu.
    const tanpaAt = Buffer.from(JSON.stringify({ id: "abc" }), "utf8").toString(
      "base64url",
    );
    expect(bacaCursor(tanpaAt)).toBeNull();
  });

  it("menolak cursor yang waktunya tidak terbaca", () => {
    // Kalau waktu tidak terbaca, filter lanjutannya akan salah dan Admin bisa
    // melihat halaman yang sama berulang kali.
    const waktuBuruk = Buffer.from(
      JSON.stringify({ at: "bukan waktu", id: "abc" }),
      "utf8",
    ).toString("base64url");

    expect(bacaCursor(waktuBuruk)).toBeNull();
  });

  it("menolak cursor yang isinya bukan objek", () => {
    const array = Buffer.from(JSON.stringify([1, 2, 3]), "utf8").toString(
      "base64url",
    );
    expect(bacaCursor(array)).toBeNull();

    const teks = Buffer.from(JSON.stringify("bukan objek"), "utf8").toString(
      "base64url",
    );
    expect(bacaCursor(teks)).toBeNull();
  });

  it("menolak cursor yang terlalu panjang", () => {
    const panjang = "a".repeat(MAKSIMAL_CURSOR + 1);

    expect(bacaCursor(panjang)).toBeNull();
  });
});

describe("filterAtau untuk halaman log", () => {
  it("tidak menghasilkan filter kalau tidak ada syarat dan tidak ada cursor", () => {
    // Ini kasus paling sering: Admin baru membuka halaman log. Tanpa filter, database
    // tidak perlu filter apa pun.
    expect(filterAtau([], null, "terbaru")).toBeNull();
  });

  it("menggabungkan syarat order_id dan entity_id untuk jejak order", () => {
    // activity_logs punya DUA kolom yang bisa menunjuk ke satu pesanan: order_id dan
    // entity_id. Keduanya harus cocok, kalau tidak jejaknya tidak lengkap.
    const hasil = filterAtau(
      [["order_id.eq.ABC"], ["entity_id.eq.ABC"]],
      null,
      "terlama",
    );

    expect(hasil).toBe("order_id.eq.ABC,entity_id.eq.ABC");
  });

  it("membuat syarat cursor untuk arah terbaru", () => {
    // lt = lebih kecil dari. Cursor menunjuk baris terakhir yang sudah dikirim, jadi
    // yang dicari adalah baris yang lebih lama darinya.
    const hasil = filterAtau([], CURSOR_CONTOH, "terbaru");

    expect(hasil).toBe(
      "at.lt.2026-10-11T10:00:00+07:00,and(at.eq.2026-10-11T10:00:00+07:00,id.lt.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
    );
  });

  it("membuat syarat cursor untuk arah terlama", () => {
    // Saat menelusuri satu order, urutannya dibalik jadi lama ke baru, jadi
    // pembandingnya jadi "lebih besar dari".
    const hasil = filterAtau([], CURSOR_CONTOH, "terlama");

    expect(hasil).toBe(
      "at.gt.2026-10-11T10:00:00+07:00,and(at.eq.2026-10-11T10:00:00+07:00,id.gt.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
    );
  });

  it("menggabungkan syarat order dengan syarat cursor sekaligus", () => {
    // INI KASUS YANG SERING SALAH. Yang benar adalah:
    //   (order_id = ABC atau entity_id = ABC) DAN cursor
    // Tapi PostgREST hanya bisa menulis OR di tingkat paling atas, jadi syaratnya harus
    // dibagikan:
    //   (order_id = ABC DAN cursor) atau (entity_id = ABC DAN cursor)
    //
    // Kalau tidak dibagikan (mis. .or() dipanggil dua kali), salah satu filter hilang
    // dan Admin melihat daftar yang bukan yang dia minta.
    const hasil = filterAtau(
      [["order_id.eq.ABC"], ["entity_id.eq.ABC"]],
      CURSOR_CONTOH,
      "terlama",
    );

    expect(hasil).toBe(
      [
        "and(order_id.eq.ABC,at.gt.2026-10-11T10:00:00+07:00)",
        "and(order_id.eq.ABC,at.eq.2026-10-11T10:00:00+07:00,id.gt.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
        "and(entity_id.eq.ABC,at.gt.2026-10-11T10:00:00+07:00)",
        "and(entity_id.eq.ABC,at.eq.2026-10-11T10:00:00+07:00,id.gt.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
      ].join(","),
    );
  });

  it("membungkus syarat banyak dengan and dan tidak membungkus yang satu", () => {
    // Satu syarat tidak perlu dibungkus and(), supaya teksnya pendek dan mudah dibaca
    // di log server.
    expect(filterAtau([["order_id.eq.ABC"]], null, "terlama")).toBe(
      "order_id.eq.ABC",
    );
  });

  it("tidak menggabungkan syarat cursor dua kali", () => {
    // Pengaman: kalau syarat cursor ikut muncul dua kali di hasil, filter-nya salah.
    const hasil = filterAtau([], CURSOR_CONTOH, "terbaru");

    if (hasil !== null) {
      expect(hasil.split("at.lt.").length - 1).toBe(1);
    }
  });
});
