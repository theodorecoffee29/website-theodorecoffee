// Tes untuk src/lib/log/index.ts.
//
// Yang diuji di sini:
//   1. Format kode error "ERR-xxxx".
//   2. redactSecrets: nilai rahasia dibuang sebelum dicatat.
//   3. logError TIDAK melempar error walau penulisan ke database gagal.
//
// PENTANG: modul "../supabase/admin" dikelompokkan (di-mock) supaya tes TIDAK
// menghubungi database sungguhan. Kita hanya menguji bentuk kode, penyaringan
// rahasia, dan perilaku saat penulisan gagal. Paket "server-only" juga sudah
// diarahkan ke berkas kosongnya lewat alias di vitest.config.mts, supaya
// mengimpor file ini di Node tidak melempar error.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tiramuan (mock) modul admin. getAdminClient sengaja bisa dibuat gagal,
// untuk menguji bahwa logError tetap aman.
const insertDipanggil = vi.fn();
const getAdminClientMock = vi.fn();

vi.mock("../supabase/admin", () => {
  return {
    getAdminClient: () => getAdminClientMock(),
  };
});

import { buatKodeError, logError, redactSecrets } from "./index";

// Karena modul di-mock, mengimpor setelah vi.mock sudah benar.
// (Vitest men-hoist vi.mock ke atas, jadi urutan tulis tidak berpengaruh.)

// redactSecrets mengembalikan tipe Json (bisa teks/angka/objek/array), supaya
// saat menguji isi objek di bawah, kita bantu ubah dulu ke bentuk objek biasa
// supaya TypeScript mengizinkan kita membaca propertinya. Kita pakai
// Record<string, unknown> (bukan any) supaya tetap ketat; setiap nilai yang
// dibaca bertipe unknown, yang sudah cukup untuk dibandingkan dengan toBe().
function sebagaiObjek(nilai: unknown): Record<string, unknown> {
  return nilai as Record<string, unknown>;
}

describe("buatKodeError", () => {
  it("menghasilkan format ERR- diikuti 4 huruf besar atau angka", () => {
    // Pola: huruf besar/angka acak sepanjang 4 setelah "ERR-".
    const polaKode = /^ERR-[A-Z0-9]{4}$/;

    // Uji berkali-kali supaya yakin bentuknya selalu sama.
    for (let i = 0; i < 50; i++) {
      expect(buatKodeError()).toMatch(polaKode);
    }
  });

  it("menghasilkan kode yang berbeda antar panggilan (acak)", () => {
    // Hasilkan banyak kode lalu cek tidak semuanya sama (acak, bukan tetap).
    const kodeBaru = new Set<string>();
    for (let i = 0; i < 100; i++) {
      kodeBaru.add(buatKodeError());
    }

    // Kalau acak, 100 kode hampir pasti lebih dari satu.
    expect(kodeBaru.size).toBeGreaterThan(1);
  });
});

describe("redactSecrets", () => {
  it("mengganti nilai kunci yang mengandung kata rahasia", () => {
    const data = {
      user_password: "rahasia123",
      access_token: "abc123",
      service_role: "kunci-rahasia",
      nama: "Budi",
    };

    const hasil = sebagaiObjek(redactSecrets(data));

    // Nilai rahasia disembunyikan.
    expect(hasil.user_password).toBe("[DISEMBUNYIKAN]");
    expect(hasil.access_token).toBe("[DISEMBUNYIKAN]");
    expect(hasil.service_role).toBe("[DISEMBUNYIKAN]");
    // Nilai biasa tetap apa adanya.
    expect(hasil.nama).toBe("Budi");
  });

  it("menyaring kata kunci rahasia dalam huruf besar-kecil", () => {
    const data = {
      Authorization: "Bearer xyz",
      APIKEY: "kunci",
      SECRET_TOKEN: "rahasia",
    };

    const hasil = sebagaiObjek(redactSecrets(data));

    expect(hasil.Authorization).toBe("[DISEMBUNYIKAN]");
    expect(hasil.APIKEY).toBe("[DISEMBUNYIKAN]");
    expect(hasil.SECRET_TOKEN).toBe("[DISEMBUNYIKAN]");
  });

  it("menyaring juga di dalam objek bersarang dan array", () => {
    const data = {
      payload: {
        password: "rahasia",
        item: [{ token: "rahasia-token" }],
      },
    };

    const hasil = sebagaiObjek(redactSecrets(data));
    const payload = sebagaiObjek(hasil.payload);
    // Daftar item diubah dulu ke bentuk array supaya elemen pertamanya bisa dibaca.
    const daftarItem = payload.item as Array<Record<string, unknown>>;

    expect(payload.password).toBe("[DISEMBUNYIKAN]");
    expect(daftarItem[0].token).toBe("[DISEMBUNYIKAN]");
  });

  it("membiarkan nilai biasa dan teks apa adanya", () => {
    // Tidak ada kunci rahasia, jadi hasil harus sama dengan masukannya.
    const hasil = redactSecrets({ nama: "Budi", umur: 20, aktif: true });

    expect(hasil).toEqual({ nama: "Budi", umur: 20, aktif: true });
  });
});

describe("logError", () => {
  beforeEach(() => {
    // Bersihkan panggil antar tes.
    insertDipanggil.mockClear();
    getAdminClientMock.mockReset();
  });

  afterEach(() => {
    // Kembalikan console.error ke asal supaya output tes lain tetap bersih.
    vi.restoreAllMocks();
  });

  it("mengembalikan kode ERR-xxxx dan menulis ke error_logs", () => {
    // Tiramuan klien: from().insert() mengembalikan objek dengan then yang
    // meniru hasil Supabase (error kosong = sukses).
    getAdminClientMock.mockReturnValue({
      from: () => ({
        insert: (baris: unknown) => {
          insertDipanggil(baris);
          return Promise.resolve({ error: null });
        },
      }),
    });

    const kode = logError({
      message: "Gagal membuat order",
      severity: "error",
      source: "server",
      context: { file: "src/server/order.ts", orderId: "abc" },
    });

    // Kode yang dikembalikan harus format ERR-xxxx.
    expect(kode).toMatch(/^ERR-[A-Z0-9]{4}$/);

    // Dan kode yang sama harus tersimpan di baris database (supaya bisa dicari).
    expect(insertDipanggil).toHaveBeenCalledTimes(1);
    const barisTersimpan = insertDipanggil.mock.calls[0][0];
    expect(barisTersimpan.code).toBe(kode);
    expect(barisTersimpan.message).toBe("Gagal membuat order");
  });

  it("menyaring rahasia pada context sebelum dikirim ke database", () => {
    getAdminClientMock.mockReturnValue({
      from: () => ({
        insert: (baris: unknown) => {
          insertDipanggil(baris);
          return Promise.resolve({ error: null });
        },
      }),
    });

    logError({
      message: "Gagal login",
      severity: "warning",
      source: "server",
      context: { email: "a@b.com", password: "rahasia" },
    });

    const barisTersimpan = insertDipanggil.mock.calls[0][0];
    // password harus disembunyikan, email biasa tetap ada.
    expect(barisTersimpan.context.password).toBe("[DISEMBUNYIKAN]");
    expect(barisTersimpan.context.email).toBe("a@b.com");
  });

  it("TIDAK melempar error dan tetap mengembalikan kode saat insert gagal", async () => {
    // Tiramuan: insert mengembalikan promise yang ditolak (koneksi gagal).
    getAdminClientMock.mockReturnValue({
      from: () => ({
        insert: () => Promise.reject(new Error("koneksi database gagal")),
      }),
    });

    // Kita pastikan console.error diam-diam supaya tes tidak berisik.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Panggil logError. Yang penting: TIDAK melempar error.
    let kode = "";
    expect(() => {
      kode = logError({
        message: "Gagal mengonfirmasi",
        severity: "error",
        source: "database",
      });
    }).not.toThrow();

    // Kode tetap dikembalikan supaya layar bisa menampilkan kode error.
    expect(kode).toMatch(/^ERR-[A-Z0-9]{4}$/);

    // Penulisan log sengaja tidak di-await (fire-and-forget) supaya tidak
    // menghentikan alur utama. Beri satu tick supaya catch() sempat jalan,
    // baru cek cadangan ke console.error.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(consoleError).toHaveBeenCalled();
  });

  it("TIDAK melempar error saat penyiapan klien gagal", () => {
    // Tiramuan: mendapat klien gagal total (mis. env belum siap), jadi error
    // terlempar sinkron di dalam blok try.
    getAdminClientMock.mockImplementation(() => {
      throw new Error("environment variable belum lengkap");
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let kode = "";
    expect(() => {
      kode = logError({
        message: "Gagal menyiapkan",
        severity: "critical",
        source: "server",
      });
    }).not.toThrow();

    // Tetap mengembalikan kode dan mencatat ke console.error sebagai cadangan.
    expect(kode).toMatch(/^ERR-[A-Z0-9]{4}$/);
    expect(consoleError).toHaveBeenCalled();
  });
});
