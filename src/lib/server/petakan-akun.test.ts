// Tes untuk src/lib/server/petakan-akun.ts (penggabungan profiles dan Auth).
//
// Yang diuji:
//   1. Baris profiles digabung dengan baris Auth berdasarkan id.
//   2. Bentuk keluarannya camelCase (id, name, email, role, isActive, createdAt,
//      lastSignInAt) dan TIDAK ada kunci snake_case yang bocor.
//   3. Urut hasil menurut nama.
//   4. Akun yang hanya ada di salah satu sumber tetap tampil, dan jumlahnya dihitung.
//
// CATATAN SOAL MOCK: file ini mengimpor src/lib/server/ubah-ke-angka yang MURNI (tanpa
// database), jadi tidak ada yang perlu dikelompokkan.

import { describe, expect, it } from "vitest";
import { petakanDaftarAkun, petakanSatuAkun } from "./petakan-akun";

// Satu baris tabel profiles, bentuknya sama seperti kolom tabel aslinya.
const PROFIL_BUDI = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Budi",
  role: "cashier",
  is_active: true,
};

// Satu user dari Supabase Auth, bentuknya sama seperti yang dikembalikan Auth.
const AUTH_BUDI = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "budi@contoh.com",
  created_at: "2026-10-01T02:00:00+00:00",
  last_sign_in_at: "2026-10-11T09:00:00+00:00",
};

describe("petakanSatuAkun", () => {
  it("menggabungkan profil dan Auth menjadi satu akun", () => {
    // profiles tidak menyimpan email, dan Auth tidak menyimpan nama/peran. Satu akun
    // yang berguna untuk Admin butuh keduanya.
    const akun = petakanSatuAkun(PROFIL_BUDI, AUTH_BUDI);

    expect(akun.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(akun.name).toBe("Budi");
    expect(akun.email).toBe("budi@contoh.com");
    expect(akun.role).toBe("cashier");
    expect(akun.isActive).toBe(true);
    expect(akun.createdAt).toBe("2026-10-01T02:00:00+00:00");
    expect(akun.lastSignInAt).toBe("2026-10-11T09:00:00+00:00");
  });

  it("mengubah nama kolom snake_case menjadi camelCase", () => {
    const akun = petakanSatuAkun(PROFIL_BUDI, AUTH_BUDI);

    for (const kunci of Object.keys(akun)) {
      expect(kunci).not.toContain("_");
    }
  });

  it("memberi lastSignInAt kosong untuk akun yang belum pernah masuk", () => {
    // Auth tidak selalu mengisi last_sign_in_at, dan layar menulis "Belum pernah" kalau
    // kosong. Kalau dikembalikan null, pemformatan waktu akan stumbled.
    const akun = petakanSatuAkun(PROFIL_BUDI, {
      ...AUTH_BUDI,
      last_sign_in_at: null,
    });

    expect(akun.lastSignInAt).toBe("");
  });

  it("tetap memetakan akun yang data Auth-nya tidak ditemukan", () => {
    // Ini terjadi kalau profil dibuat manual di luar aplikasi. Akunnya lebih baik
    // ditampilkan tanpa email daripada tidak muncul sama sekali.
    const akun = petakanSatuAkun(PROFIL_BUDI, undefined);

    expect(akun.name).toBe("Budi");
    expect(akun.email).toBe("");
  });

  it("tidak gagal kalau bentuk datanya tidak sesuai", () => {
    const akun = petakanSatuAkun(null, undefined);

    expect(akun.id).toBe("");
    expect(akun.name).toBe("");
    expect(akun.isActive).toBe(false);
  });

  it("menganggap is_active yang bukan true sebagai nonaktif", () => {
    // Keamanan: is_active yang tidak terbaca harus dianggap tidak aktif, bukan aktif.
    // Membalik asumsi ini bisa membuat akun nonaktif terbaca aktif.
    expect(
      petakanSatuAkun({ ...PROFIL_BUDI, is_active: undefined }, undefined)
        .isActive,
    ).toBe(false);
    expect(
      petakanSatuAkun({ ...PROFIL_BUDI, is_active: "true" }, undefined)
        .isActive,
    ).toBe(false);
  });
});

describe("petakanDaftarAkun", () => {
  it("menggabungkan semua akun dan mengurutkannya menurut nama", () => {
    const hasil = petakanDaftarAkun(
      [
        { id: "2", name: "Sari", role: "barista", is_active: true },
        { id: "1", name: "budi", role: "cashier", is_active: true },
        { id: "3", name: "Andi", role: "cashier", is_active: false },
      ],
      [
        {
          id: "1",
          email: "budi@contoh.com",
          last_sign_in_at: "2026-10-11T09:00:00Z",
        },
        { id: "2", email: "sari@contoh.com", last_sign_in_at: null },
        { id: "3", email: "andi@contoh.com", last_sign_in_at: null },
      ],
    );

    // Urut nama: andi, budi, sari (tidak membedakan huruf besar-kecil).
    expect(hasil.accounts.map((satu) => satu.name)).toEqual([
      "Andi",
      "budi",
      "Sari",
    ]);
    expect(hasil.accounts.map((satu) => satu.email)).toEqual([
      "andi@contoh.com",
      "budi@contoh.com",
      "sari@contoh.com",
    ]);
  });

  it("mempertahankan status aktif dari tabel profiles", () => {
    const hasil = petakanDaftarAkun(
      [
        { id: "1", name: "Budi", role: "cashier", is_active: true },
        { id: "2", name: "Andi", role: "cashier", is_active: false },
      ],
      [
        { id: "1", email: "budi@contoh.com" },
        { id: "2", email: "andi@contoh.com" },
      ],
    );

    const budi = hasil.accounts.find((satu) => satu.name === "Budi");
    const andi = hasil.accounts.find((satu) => satu.name === "Andi");

    expect(budi?.isActive).toBe(true);
    expect(andi?.isActive).toBe(false);
  });

  it("menampilkan akun yang ada di Auth tapi tidak ada profilnya", () => {
    // Akun seperti ini dibuat manual di dashboard Supabase. Orangnya SEBENARNYA tidak
    // bisa masuk (profilnya tidak ada), tapi Admin perlu tahu supaya bisa dibereskan.
    const hasil = petakanDaftarAkun(
      [],
      [{ id: "9", email: "tanpa-profil@contoh.com" }],
    );

    expect(hasil.accounts).toHaveLength(1);
    expect(hasil.accounts[0]?.id).toBe("9");
    expect(hasil.accounts[0]?.email).toBe("tanpa-profil@contoh.com");
    expect(hasil.accounts[0]?.name).toBe("");
    expect(hasil.tanpaDataAuth).toBe(1);
  });

  it("menampilkan akun yang profilnya ada tapi data Auth-nya hilang", () => {
    const hasil = petakanDaftarAkun(
      [{ id: "7", name: "Tanpa Auth", role: "cashier", is_active: true }],
      [],
    );

    expect(hasil.accounts).toHaveLength(1);
    expect(hasil.accounts[0]?.name).toBe("Tanpa Auth");
    expect(hasil.accounts[0]?.email).toBe("");
    expect(hasil.tanpaDataAuth).toBe(1);
  });

  it("menghitung jumlah akun yang tidak berpasangan dengan benar", () => {
    // Nilai ini dikirim ke layar sebagai peringatan, jadi harus akurat.
    const hasil = petakanDaftarAkun(
      [
        { id: "1", name: "Budi", role: "cashier", is_active: true },
        { id: "2", name: "Sari", role: "barista", is_active: true },
        { id: "3", name: "Tanpa Auth", role: "cashier", is_active: true },
      ],
      [
        { id: "1", email: "budi@contoh.com" },
        { id: "2", email: "sari@contoh.com" },
        { id: "4", email: "tanpa-profil@contoh.com" },
      ],
    );

    // Tiga di profiles (1, 2, 3) dan satu di Auth saja (4).
    // Yang tidak berpasangan: nomor 3 dan nomor 4.
    expect(hasil.accounts).toHaveLength(4);
    expect(hasil.tanpaDataAuth).toBe(2);
  });

  it("menghasilkan daftar kosong kalau tidak ada data sama sekali", () => {
    const hasil = petakanDaftarAkun([], []);

    expect(hasil.accounts).toEqual([]);
    expect(hasil.tanpaDataAuth).toBe(0);
  });

  it("tidak gagal kalau datanya bukan array atau bukan objek", () => {
    // Halaman daftar tidak boleh ikut error hanya karena satu baris aneh.
    const hasil = petakanDaftarAkun(null, undefined);

    expect(hasil.accounts).toEqual([]);
  });

  it("mengabaikan baris tanpa id", () => {
    // Baris tanpa id tidak bisa dicocokkan dengan Auth, dan menampilkannya dengan id
    // kosong akan membuat dua baris indistinguishable satu sama lain.
    const hasil = petakanDaftarAkun(
      [
        { id: "", name: "Tanpa Id", role: "cashier", is_active: true },
        { id: "1", name: "Budi", role: "cashier", is_active: true },
      ],
      [],
    );

    expect(hasil.accounts).toHaveLength(1);
    expect(hasil.accounts[0]?.name).toBe("Budi");
  });

  it("TIDAK mengirim kolom lain dari Auth selain yang ada di kontrak", () => {
    // Auth mengembalikan banyak kolom (metadata, app_metadata, dan lain-lain). Hanya
    // tiga yang boleh ikut: email, created_at, dan last_sign_in_at.
    const hasil = petakanDaftarAkun(
      [{ id: "1", name: "Budi", role: "cashier", is_active: true }],
      [
        {
          id: "1",
          email: "budi@contoh.com",
          created_at: "2026-10-01T02:00:00Z",
          last_sign_in_at: "2026-10-11T09:00:00Z",
          // Kolom lain yang memang ada di Auth tapi tidak boleh ikut.
          user_metadata: { nama: "Rahasia" },
          app_metadata: { provider: "email" },
          factors: [],
        },
      ],
    );

    expect(Object.keys(hasil.accounts[0] ?? {}).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "isActive",
      "lastSignInAt",
      "name",
      "role",
    ]);
  });
});
