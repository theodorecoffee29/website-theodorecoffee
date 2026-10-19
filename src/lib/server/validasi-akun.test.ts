// Tes untuk src/lib/server/validasi-akun.ts.
//
// Yang diuji:
//   1. Nama: dipangkas dulu, 1-50 karakter, menolak yang kosong.
//   2. Email: format email valid, dipangkas, dan menjadi huruf kecil.
//   3. Peran: hanya cashier dan barista; "admin" dan nilai lain DITOLAK.
//   4. Kebijakan password: minimal 10 karakter, harus ada huruf, harus ada angka, dan
//      tidak boleh sama dengan email.
//
// CATATAN SOAL MOCK: file ini tidak mengimpor modul server yang membaca environment,
// jadi tidak ada yang perlu dikelompokkan.

import { describe, expect, it } from "vitest";
import {
  akunIdSchema,
  buatAkunSchema,
  MAKSIMAL_NAMA_AKUN,
  MINIMAL_PASSWORD_AKUN,
  resetPasswordSchema,
  ubahAkunSchema,
  ubahStatusAkunSchema,
} from "./validasi-akun";

// Data akun yang sudah memenuhi semua aturan, dipakai lalu diubah sedikit per tes.
function dataSah() {
  return {
    name: "Budi",
    email: "budi@contoh.com",
    role: "cashier",
    password: "koperand2026",
  };
}

describe("validasi nama akun", () => {
  it("menerima nama yang wajar", () => {
    const hasil = buatAkunSchema.safeParse(dataSah());

    expect(hasil.success).toBe(true);
  });

  it("memangkas spasi di awal dan akhir", () => {
    const hasil = buatAkunSchema.safeParse({ ...dataSah(), name: "  Budi  " });

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.name).toBe("Budi");
    }
  });

  it("menolak nama yang kosong atau hanya spasi", () => {
    // Nama yang isinya cuma spasi dianggap kosong, karena setelah dipangkas tidak ada
    // isinya. Tanpa ini, tabel profiles akan berisi nama kosong.
    expect(buatAkunSchema.safeParse({ ...dataSah(), name: "" }).success).toBe(
      false,
    );
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), name: "   " }).success,
    ).toBe(false);
  });

  it("menolak nama yang terlalu panjang", () => {
    const namaPanjang = "a".repeat(MAKSIMAL_NAMA_AKUN + 1);

    expect(
      buatAkunSchema.safeParse({ ...dataSah(), name: namaPanjang }).success,
    ).toBe(false);
  });

  it("menerima nama tepat di batas panjang", () => {
    const namaPas = "a".repeat(MAKSIMAL_NAMA_AKUN);

    expect(
      buatAkunSchema.safeParse({ ...dataSah(), name: namaPas }).success,
    ).toBe(true);
  });

  it("menolak nama yang bukan teks", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), name: 12345 }).success,
    ).toBe(false);
  });
});

describe("validasi email", () => {
  it("menerima email yang wajar", () => {
    expect(buatAkunSchema.safeParse(dataSah()).success).toBe(true);
  });

  it("memangkas spasi dan mengubahnya menjadi huruf kecil", () => {
    // Email disimpan huruf kecil supaya "Budi@X.com" dan "budi@x.com" dianggap akun yang
    // sama. Kalau tidak, Admin bisa membuat dua akun dengan email yang identik.
    const hasil = buatAkunSchema.safeParse({
      ...dataSah(),
      email: "  Budi@Contoh.COM ",
    });

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.email).toBe("budi@contoh.com");
    }
  });

  it("menolak email yang formatnya salah", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), email: "budi" }).success,
    ).toBe(false);
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), email: "budi@contoh" }).success,
    ).toBe(false);
    expect(buatAkunSchema.safeParse({ ...dataSah(), email: "" }).success).toBe(
      false,
    );
  });
});

describe("validasi peran", () => {
  it("menerima cashier dan barista", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), role: "cashier" }).success,
    ).toBe(true);
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), role: "barista" }).success,
    ).toBe(true);
  });

  it("menolak peran admin", () => {
    // INI yang penting: halaman ini tidak boleh bisa membuat akun admin. Kalau "admin"
    // diterima, siapa pun yang bisa memakai halaman ini bisa membuat akun dengan akses
    // penuh ke aplikasi.
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), role: "admin" }).success,
    ).toBe(false);
  });

  it("menolak peran yang tidak dikenal dan peran kosong", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), role: "pemilik" }).success,
    ).toBe(false);
    expect(buatAkunSchema.safeParse({ ...dataSah(), role: "" }).success).toBe(
      false,
    );
  });

  it("menolak peran admin saat mengubah akun juga", () => {
    // Jalur ubah akun punya aturan yang sama, jadi tidak boleh bisa mengubah Cashier
    // menjadi Admin.
    expect(
      ubahAkunSchema.safeParse({ name: "Budi", role: "admin" }).success,
    ).toBe(false);
    expect(
      ubahAkunSchema.safeParse({ name: "Budi", role: "barista" }).success,
    ).toBe(true);
  });
});

describe("kebijakan password", () => {
  it("menerima password yang memenuhi semua aturan", () => {
    expect(buatAkunSchema.safeParse(dataSah()).success).toBe(true);
  });

  it("menolak password yang terlalu pendek", () => {
    // Dibuat secara terprogram supaya panjangnya pasti 9 karakter (satu kurang dari
    // batas minimum 10) dan tidak salah hitung saat ditulis manual.
    const pendek = "a1" + "b".repeat(7);

    expect(pendek.length).toBe(MINIMAL_PASSWORD_AKUN - 1);
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: pendek }).success,
    ).toBe(false);
  });

  it("menerima password tepat di batas panjang", () => {
    const pas = "a1" + "b".repeat(MINIMAL_PASSWORD_AKUN - 2);

    expect(pas.length).toBe(MINIMAL_PASSWORD_AKUN);
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: pas }).success,
    ).toBe(true);
  });

  it("menolak password tanpa huruf", () => {
    // Password yang semuanya angka lebih mudah ditebak, dan sering muncul dari tanggal
    // atau nomor telepon.
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: "12345678901" })
        .success,
    ).toBe(false);
  });

  it("menolak password tanpa angka", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: "abcdefghijkl" })
        .success,
    ).toBe(false);
  });

  it("menerima password dengan huruf besar dan huruf kecil", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: "Koperand2026" })
        .success,
    ).toBe(true);
  });

  it("menolak password kosong", () => {
    expect(
      buatAkunSchema.safeParse({ ...dataSah(), password: "" }).success,
    ).toBe(false);
  });

  it("menolak password yang sama dengan email", () => {
    // Kalau password sama dengan email, siapa pun yang melihat email (mis. Admin, atau
    // pesan otomatis) bisa langsung masuk ke akun itu.
    const hasil = buatAkunSchema.safeParse({
      ...dataSah(),
      email: "budi@contoh.com",
      password: "budi@contoh.com",
    });

    expect(hasil.success).toBe(false);
  });

  it("menolak password yang sama dengan email dalam huruf besar-kecil berbeda", () => {
    // Perbandingan tidak membedakan huruf besar-kecil, sama seperti cara orang membaca
    // email dan password.
    const hasil = buatAkunSchema.safeParse({
      ...dataSah(),
      email: "budi@contoh.com",
      password: "BUDI@Contoh.com",
    });

    expect(hasil.success).toBe(false);
  });

  it("menyebutkan field password pada pesan kesalahannya", () => {
    // Pesan yang menyebut field membantu Admin tahu bagian mana yang harus diperbaiki
    // (docs/api-contract.md bagian 6).
    const hasil = buatAkunSchema.safeParse({
      ...dataSah(),
      password: "pendek",
    });

    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      expect(hasil.error.issues[0]?.path).toEqual(["password"]);
    }
  });
});

describe("validasi status aktif", () => {
  it("menerima true dan false", () => {
    expect(ubahStatusAkunSchema.safeParse({ isActive: true }).success).toBe(
      true,
    );
    expect(ubahStatusAkunSchema.safeParse({ isActive: false }).success).toBe(
      true,
    );
  });

  it("menolak nilai yang bukan true atau false", () => {
    // Tanpa nilai bawaan: server harus tahu Admin memang memilih status ini, bukan
    // menganggapnya aktif kalau field-nya lupa dikirim.
    expect(ubahStatusAkunSchema.safeParse({ isActive: "ya" }).success).toBe(
      false,
    );
    expect(ubahStatusAkunSchema.safeParse({ isActive: 1 }).success).toBe(false);
    expect(ubahStatusAkunSchema.safeParse({}).success).toBe(false);
  });
});

describe("validasi reset password", () => {
  it("menerima password yang memenuhi aturan", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "koperand2026" }).success,
    ).toBe(true);
  });

  it("menolak password yang tidak memenuhi aturan", () => {
    expect(resetPasswordSchema.safeParse({ password: "pendek" }).success).toBe(
      false,
    );
    expect(
      resetPasswordSchema.safeParse({ password: "abcdefghijkl" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "12345678901" }).success,
    ).toBe(false);
  });
});

describe("validasi id akun", () => {
  it("menerima id berupa uuid", () => {
    const hasil = akunIdSchema.safeParse({
      id: "66666666-6666-4666-8666-666666666666",
    });

    expect(hasil.success).toBe(true);
  });

  it("menolak id yang bukan uuid", () => {
    // Id yang bukan uuid tidak mungkin ada di database, jadi jawabannya nanti sama
    // dengan "akun tidak ditemukan".
    expect(akunIdSchema.safeParse({ id: "bukan-uuid" }).success).toBe(false);
    expect(akunIdSchema.safeParse({ id: "123" }).success).toBe(false);
    expect(akunIdSchema.safeParse({}).success).toBe(false);
  });
});
