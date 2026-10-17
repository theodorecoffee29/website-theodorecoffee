// Tes untuk penjagaan peran HALAMAN LAPORAN.
//
// Kenapa tes ini penting: laporan berisi omzet seluruh hari. Kalau penjagaannya
// bocor, Barista (atau orang yang belum login) bisa membaca angka penjualan.
//
// Yang diperiksa di sini adalah penjagaan yang SEBENARNYA dipakai halaman laporan,
// yaitu wajibPeran() dari src/lib/auth/session.ts. Fungsi itu melakukan dua hal:
//   1. Membaca sesi login lewat ambilSesiStaf(). Kalau tidak ada sesi (belum login,
//      akun nonaktif, atau profil belum ada), pengguna diarahkan ke /login. Ini yang
//      menolak ANONIM dan CUSTOMER, karena customer memang tidak punya akun sama
//      sekali (docs/pemissions.md bagian 1).
//   2. Memeriksa apakah perannya boleh membuka path itu. Kalau tidak boleh,
//      access.denied dicatat lalu pengguna diarahkan ke halamannya sendiri. Ini yang
//      menolak BARISTA.
//
// Modul yang bergantung pada server (klien Supabase, paket server-only, dan
// next/navigation) dikelompokkan (di-mock) supaya tesnya tidak menghubungi server
// sungguhan. Fungsi ambilSesiStaf() sendiri TIDAK dimock, supaya tes benar-benar
// menguji rantai penjagaan dari awal sampai akhir. Pola mock-nya sama dengan yang
// dipakai src/app/api/reports/penjaga-peran.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Penanda pada pesan error redirect, supaya tes bisa tahu ke mana pengguna
// diarahkan. redirect() di Next.js tidak pernah kembali, jadi di sini dia dibuat
// melempar error dengan penanda ini.
const TANDA_REDIRECT = "DIARAHKAN:";

// Keadaan tiruan yang dibaca modul session.
//
// klaimTidakAda: true berarti tidak ada sesi sama sekali (anonim atau customer).
// profilAktif: isi baris tabel profiles untuk sesi yang ada.
let klaimTidakAda = false;
let profilAktif = {
  id: "user-uji",
  name: "Uji",
  role: "cashier",
  is_active: true,
};

vi.mock("server-only", () => {
  return {};
});

vi.mock("next/navigation", () => {
  return {
    redirect: (tujuan: string) => {
      throw new Error(TANDA_REDIRECT + tujuan);
    },
  };
});

vi.mock("@/lib/supabase/server", () => {
  return {
    createSupabaseServerClient: () => ({
      auth: {
        // Mengembalikan klaim yang dianggap sudah terverifikasi, atau tidak ada
        // klaim sama sekali kalau klaimTidakAda bernilai true.
        getClaims: async () => {
          if (klaimTidakAda) {
            return { data: null, error: null };
          }
          return {
            data: { claims: { sub: "user-uji", session_id: "sess-uji" } },
            error: null,
          };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: profilAktif, error: null }),
          }),
        }),
      }),
    }),
  };
});

vi.mock("@/lib/log", () => {
  return {
    logActivity: () => {},
    logError: () => "ERR-TEST",
  };
});

import { wajibPeran } from "@/lib/auth/session";

// Hasil satu percobaan membuka halaman.
type HasilBuka = { lolos: boolean; tujuan?: string };

// Keadaan sesi yang ingin disimulasikan.
type SesiUji = {
  // false berarti tidak ada sesi sama sekali (anonim atau customer).
  ada: boolean;
  // Peran dari tabel profiles. Diabaikan kalau ada bernilai false.
  role?: "cashier" | "barista" | "admin";
  // Status aktif akun. false berarti akun dinonaktifkan oleh Admin.
  aktif?: boolean;
};

/**
 * Memanggil wajibPeran dan memberitahu apa yang terjadi.
 *
 * Input: path halaman dan keadaan sesi yang mau disimulasikan.
 * Output: "lolos" kalau pengguna berhak melihat isi halaman, atau
 *         "diarahkan ke [tujuan]" kalau memang dialihkan.
 */
async function cobaBuka(path: string, sesi: SesiUji): Promise<HasilBuka> {
  klaimTidakAda = !sesi.ada;
  profilAktif = {
    id: "user-uji",
    name: "Uji",
    role: sesi.role ?? "cashier",
    is_active: sesi.aktif ?? true,
  };

  try {
    await wajibPeran(path);
    return { lolos: true };
  } catch (error) {
    const pesan = String((error as Error).message ?? "");

    if (pesan.startsWith(TANDA_REDIRECT)) {
      return { lolos: false, tujuan: pesan.slice(TANDA_REDIRECT.length) };
    }

    // Error lain berarti tesnya sendiri yang salah, bukan perilaku yang diuji.
    throw error;
  }
}

// Empat halaman laporan yang harus dilindungi, beserta peran yang boleh.
//
// Cashier boleh /cashier/laporan karena itu halaman Cashier-nya (Admin juga boleh
// sebagai cadangan kalau Cashier berhalangan), tapi Cashier TIDAK boleh
// /admin/laporan karena itu halaman khusus Admin.
const HALAMAN_LAPORAN: { path: string; boleh: string[] }[] = [
  { path: "/cashier/laporan", boleh: ["cashier", "admin"] },
  { path: "/cashier/laporan/[id]", boleh: ["cashier", "admin"] },
  { path: "/admin/laporan", boleh: ["admin"] },
  { path: "/admin/laporan/[id]", boleh: ["admin"] },
];

describe("penjagaan peran halaman laporan", () => {
  beforeEach(() => {
    klaimTidakAda = false;
    profilAktif = {
      id: "user-uji",
      name: "Uji",
      role: "cashier",
      is_active: true,
    };
  });

  for (const halaman of HALAMAN_LAPORAN) {
    describe(halaman.path, () => {
      it("menolak anonim dengan mengarahkan ke /login", async () => {
        // Tidak ada sesi sama sekali. Ini yang terjadi kalau customer (yang memang
        // tidak punya akun) atau orang yang belum login mengetik alamatnya.
        const hasil = await cobaBuka(halaman.path, { ada: false });

        expect(hasil.lolos).toBe(false);
        expect(hasil.tujuan).toBe("/login");
      });

      it("menolak Barista dan mengarahkannya ke /barista", async () => {
        // Sesi Barista sengaja dibuat ADA, supaya yang diuji adalah penolakan
        // berdasarkan peran, bukan berdasarkan tidak adanya sesi.
        const hasil = await cobaBuka(halaman.path, {
          ada: true,
          role: "barista",
        });

        expect(hasil.lolos).toBe(false);
        expect(hasil.tujuan).toBe("/barista");
      });

      it("mengizinkan Cashier", async () => {
        const hasil = await cobaBuka(halaman.path, {
          ada: true,
          role: "cashier",
        });

        if (halaman.boleh.includes("cashier")) {
          expect(hasil.lolos).toBe(true);
        } else {
          // Cashier tidak boleh /admin/laporan. Dia diarahkan ke halamannya
          // sendiri (/cashier), bukan diberi halaman kosong.
          expect(hasil.lolos).toBe(false);
          expect(hasil.tujuan).toBe("/cashier");
        }
      });

      it("mengizinkan Admin", async () => {
        const hasil = await cobaBuka(halaman.path, {
          ada: true,
          role: "admin",
        });

        if (halaman.boleh.includes("admin")) {
          expect(hasil.lolos).toBe(true);
        } else {
          expect(hasil.lolos).toBe(false);
          expect(hasil.tujuan).toBe("/admin");
        }
      });
    });
  }

  it("menolak akun yang dinonaktifkan, sama seperti belum login", async () => {
    // Akun nonaktif tidak boleh masuk meski passwordnya masih diingat.
    // ambilSesiStaf sudah memeriksa hal ini, jadi dari sisi halaman hasilnya sama
    // dengan anonim.
    const hasil = await cobaBuka("/cashier/laporan", {
      ada: true,
      role: "cashier",
      aktif: false,
    });

    expect(hasil.lolos).toBe(false);
    expect(hasil.tujuan).toBe("/login");
  });
});
