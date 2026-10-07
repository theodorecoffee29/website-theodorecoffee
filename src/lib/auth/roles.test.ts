// Tes untuk src/lib/auth/roles.ts.
//
// File ini murni (tanpa database), jadi tesnya cepat. Kita menguji SEMUA
// kombinasi antara tiga peran dan tiga halaman peran, supaya tidak ada
// kombinasi yang terlewat.
//
// Docs/pemissions.md bagian 2 jadi acuan:
//   - /cashier boleh dibuka Cashier dan Admin (Admin acting as cadangan).
//   - /barista hanya Barista.
//   - /admin hanya Admin.

import { describe, expect, it } from "vitest";
import { HALAMAN_PERAN, pathUntukRole, peranBolehBukaPath } from "./roles";

// Semua peran yang ada, dipakai untuk menguji setiap kombinasi.
const semuaPeran = ["cashier", "barista", "admin"] as const;

// Setiap peran dengan halaman yang BOLEH dibuka, dan halaman yang TIDAK BOLEH.
// Ditulis eksplisit (bukan dihitung ulang dari kode yang diuji) supaya tesnya
// benar-benar memeriksa aturan, bukan mengulang apa yang diimplementasikan.
const hakAkses: Record<
  (typeof semuaPeran)[number],
  { boleh: string[]; tidakBoleh: string[] }
> = {
  cashier: {
    boleh: ["/cashier"],
    tidakBoleh: ["/barista", "/admin"],
  },
  barista: {
    boleh: ["/barista"],
    tidakBoleh: ["/cashier", "/admin"],
  },
  admin: {
    boleh: ["/admin", "/cashier"],
    tidakBoleh: ["/barista"],
  },
};

describe("pathUntukRole", () => {
  it("mengembalikan halaman milik setiap peran", () => {
    expect(pathUntukRole("cashier")).toBe("/cashier");
    expect(pathUntukRole("barista")).toBe("/barista");
    expect(pathUntukRole("admin")).toBe("/admin");
  });
});

describe("peranBolehBukaPath", () => {
  it("mengizinkan setiap peran membuka halamannya sendiri", () => {
    for (const role of semuaPeran) {
      for (const path of hakAkses[role].boleh) {
        expect(peranBolehBukaPath(role, path)).toBe(true);
      }
    }
  });

  it("menolak setiap peran membuka halaman yang bukan haknya", () => {
    for (const role of semuaPeran) {
      for (const path of hakAkses[role].tidakBoleh) {
        expect(peranBolehBukaPath(role, path)).toBe(false);
      }
    }
  });

  it("memeriksa seluruh kombinasi peran dan halaman peran", () => {
    // Yang diuji di sini: seluruh kombinasi peran x halaman peran, yaitu 9.
    // Dihitung manual supaya kita yakin semua kombinasi benar-benar diperiksa.
    let jumlahDiperiksa = 0;

    for (const role of semuaPeran) {
      for (const halaman of HALAMAN_PERAN) {
        const harusBoleh = hakAkses[role].boleh.includes(halaman);
        expect(peranBolehBukaPath(role, halaman)).toBe(harusBoleh);
        jumlahDiperiksa += 1;
      }
    }

    // 3 peran x 3 halaman = 9 kombinasi.
    expect(jumlahDiperiksa).toBe(9);
  });

  it("hanya Admin yang boleh membuka /cashier sebagai cadangan", () => {
    // Cashier boleh, dan Admin juga boleh. Dua peran lain tidak.
    expect(peranBolehBukaPath("cashier", "/cashier")).toBe(true);
    expect(peranBolehBukaPath("admin", "/cashier")).toBe(true);
    expect(peranBolehBukaPath("barista", "/cashier")).toBe(false);
  });

  it("tidak ada peran selain Admin yang boleh membuka /admin", () => {
    expect(peranBolehBukaPath("admin", "/admin")).toBe(true);
    expect(peranBolehBukaPath("cashier", "/admin")).toBe(false);
    expect(peranBolehBukaPath("barista", "/admin")).toBe(false);
  });

  it("hanya Barista yang boleh membuka /barista", () => {
    expect(peranBolehBukaPath("barista", "/barista")).toBe(true);
    expect(peranBolehBukaPath("cashier", "/barista")).toBe(false);
    expect(peranBolehBukaPath("admin", "/barista")).toBe(false);
  });

  it("mengizinkan halaman yang bukan halaman peran untuk semua peran", () => {
    // Halaman umum tidak dibatasi peran.
    for (const role of semuaPeran) {
      expect(peranBolehBukaPath(role, "/login")).toBe(true);
      expect(peranBolehBukaPath(role, "/")).toBe(true);
    }
  });

  it("menangani path dengan garis miring di akhir dan huruf besar-kecil", () => {
    // "/Admin/" harus dianggap sama dengan "/admin".
    expect(peranBolehBukaPath("cashier", "/admin/")).toBe(false);
    expect(peranBolehBukaPath("admin", "/Admin/")).toBe(true);
    expect(peranBolehBukaPath("barista", "/BARISTA")).toBe(true);
  });
});
