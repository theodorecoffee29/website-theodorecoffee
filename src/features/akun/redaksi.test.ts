// Tes untuk jaminan penyaringan rahasia di area Kelola Akun.
//
// INI TES TERPISAH dari penjaga-peran.test.ts, dan itu disengaja. Di berkas penjaga
// peran, modul "@/lib/log" dikelompokkan (di-mock) supaya logActivity dan logError tidak
// menulis ke database sungguhan. Tapi mock itu berarti redactSecrets-nya juga tiruan, dan
// pengujian "apakah redactSecrets benar-benar menutupi kunci bernama password" butuh
// fungsi yang ASLI. Maka berkas ini tidak mengunci "@/lib/log", hanya modul admin (supaya
// @/lib/log tidak membaca environment variable).
//
// Yang diuji:
//   1. redactSecrets menutupi kunci bernama "password".
//   2. Kunci yang mengandung kata "password" ikut ditutup (mis. "newPassword").
//   3. Penaringan berjalan di dalam array dan objek bersarang.
//   4. Nilai yang bukan rahasia tetap utuh, supaya konteks yang membantu tetap berguna.
//
// KENAPA TES INI PENTING: di area ini password selalu ada di memori (dari form Admin
// dan dari kolom password di browser). Kalau suatu saat ada kode yang menulis objek berisi
// password ke log, dan nama kuncinya mengandung kata "password", penyaringan ini adalah
// lapis yang mencegahnya. Lapis kedua, karena kode di src/lib/server/kelola-akun.ts sudah
// menjaga agar password tidak pernah masuk ke before, after, maupun meta.

import { describe, expect, it, vi } from "vitest";

// Modul admin dikelompokkan: @/lib/log memuat klien admin yang membaca environment.
vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({}),
  };
});

import { redactSecrets } from "@/lib/log";

// Password uji yang khas, supaya tidak mungkin muncul sendiri di kode.
const PASSWORD_UJI = "Zz9Qq7Ww5Rr3";

describe("redactSecrets untuk data akun", () => {
  it("menyembunyikan nilai pada kunci bernama password", () => {
    const hasil = redactSecrets({
      password: PASSWORD_UJI,
      email: "budi@contoh.com",
    }) as Record<string, unknown>;

    expect(hasil.password).toBe("[DISEMBUNYIKAN]");
  });

  it("menyembunyikan nilai pada kunci yang mengandung kata password", () => {
    // Kunci seperti newPassword atau userPassword ikut tertutup, karena penyaringan cocok
    // pada bagian kata di dalam nama kunci, bukan hanya pada nama yang persis sama.
    const hasil = redactSecrets({
      newPassword: PASSWORD_UJI,
      passwordBaru: PASSWORD_UJI,
      password_confirmation: PASSWORD_UJI,
    }) as Record<string, unknown>;

    expect(hasil.newPassword).toBe("[DISEMBUNYIKAN]");
    expect(hasil.passwordBaru).toBe("[DISEMBUNYIKAN]");
    expect(hasil.password_confirmation).toBe("[DISEMBUNYIKAN]");
  });

  it("menyembunyikan password di dalam array dan objek bersarang", () => {
    // Penyaringan menelusuri ke dalam array dan objek, bukan hanya satu lapis. Ini
    // penting karena konteks error sering dibungkus dalam objek.
    const hasil = redactSecrets({
      akun: {
        daftarPercobaan: [
          { password: PASSWORD_UJI },
          { email: "budi@contoh.com" },
        ],
      },
    }) as { akun: { daftarPercobaan: Record<string, unknown>[] } };

    expect(hasil.akun.daftarPercobaan[0]?.password).toBe("[DISEMBUNYIKAN]");

    // Nilai yang bukan rahasia tetap utuh, supaya konteks yang membantu tetap berguna.
    expect(hasil.akun.daftarPercobaan[1]?.email).toBe("budi@contoh.com");
  });

  it("membiarkan nilai yang bukan rahasia tetap utuh", () => {
    // Email dan nama BUKAN rahasia (docs/logging.md bagian 6 poin 3 secara tegas
    // membolehkan nama customer). Kalau ikut tertutup, log tidak akan berguna.
    const hasil = redactSecrets({
      name: "Budi",
      email: "budi@contoh.com",
      role: "cashier",
    }) as Record<string, unknown>;

    expect(hasil.name).toBe("Budi");
    expect(hasil.email).toBe("budi@contoh.com");
    expect(hasil.role).toBe("cashier");
  });

  it("menyembunyikan password yang muncul di teks panjang seperti pesan log", () => {
    // Nilai di dalam string panjang tidak dipecah (penyaringan bekerja pada nama
    // kunci, bukan pada isi teks). Ini batas yang diketahui: yang dijamin adalah konteks
    // yang Disusun sebagai objek dengan kunci bernama password, bukan password yang
    // sengaja ditulis ke dalam kalimat bebas. Karena itu kode di
    // src/lib/server/kelola-akun.ts tidak pernah menempelkan password ke pesan log.
    const hasil = redactSecrets({
      pesan: "Gagal membuat akun",
      password: PASSWORD_UJI,
    }) as Record<string, unknown>;

    expect(hasil.pesan).toBe("Gagal membuat akun");
    expect(hasil.password).toBe("[DISEMBUNYIKAN]");
  });
});
