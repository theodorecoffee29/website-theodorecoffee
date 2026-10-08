// Tes untuk src/features/cashier/pesanan-baru.ts.
//
// Yang diuji: pendeteksian pesanan baru di antara dua hasil polling, termasuk
// kasus pemuatan pertama yang TIDAK boleh memicu notifikasi.
//
// Aturan notifikasi diambil dari docs/api-contract.md bagian 4: notifikasi
// "Pesanan baru dari A" muncul dari order menunggu_konfirmasi yang baru terlihat.

import { describe, expect, it } from "vitest";
import {
  cariPesananBaru,
  hitungPesananMenunggu,
  teksSpandukBaru,
  type PesananPantau,
} from "./pesanan-baru";

function buatPesanan(ubah: Partial<PesananPantau> = {}): PesananPantau {
  return {
    orderId: "11111111-1111-4111-8111-111111111111",
    customerName: "Budi",
    status: "menunggu_konfirmasi",
    ...ubah,
  };
}

// Teks notifikasi untuk diuji (di halaman aslinya diambil dari teks.ts).
const TEKS = {
  satu: "Pesanan baru dari {nama}",
  banyak: "{jumlah} pesanan baru",
};

describe("cariPesananBaru", () => {
  it("tidak memicu apa pun saat pemuatan pertama", () => {
    // Pemuatan pertama (sudahPernahMuat = false). Apa pun yang ada sudah
    // terlihat di layar Cashier, jadi bukan pesanan baru.
    const hasil = cariPesananBaru(
      [],
      [
        buatPesanan({ orderId: "a", customerName: "Budi" }),
        buatPesanan({ orderId: "b", customerName: "Sari" }),
      ],
      false,
    );

    expect(hasil).toEqual([]);
  });

  it("tidak memicu apa pun saat pemuatan pertama meski daftar sebelumnya ada", () => {
    // Menekankan bahwa yang menentukan adalah flag pemuatan pertama, bukan
    // apakah daftarnya kosong.
    const hasil = cariPesananBaru(
      [buatPesanan({ orderId: "a" })],
      [buatPesanan({ orderId: "a" }), buatPesanan({ orderId: "b" })],
      false,
    );

    expect(hasil).toEqual([]);
  });

  it("menemukan satu pesanan baru yang muncul di polling berikutnya", () => {
    const sebelumnya = [buatPesanan({ orderId: "a" })];
    const sekarang = [
      buatPesanan({ orderId: "a" }),
      buatPesanan({ orderId: "b", customerName: "Sari" }),
    ];

    const hasil = cariPesananBaru(sebelumnya, sekarang, true);

    expect(hasil).toHaveLength(1);
    expect(hasil[0].orderId).toBe("b");
    expect(hasil[0].customerName).toBe("Sari");
  });

  it("menemukan beberapa pesanan baru sekaligus", () => {
    const hasil = cariPesananBaru(
      [buatPesanan({ orderId: "a" })],
      [
        buatPesanan({ orderId: "a" }),
        buatPesanan({ orderId: "b" }),
        buatPesanan({ orderId: "c" }),
      ],
      true,
    );

    expect(hasil.map((satu) => satu.orderId)).toEqual(["b", "c"]);
  });

  it("tidak menganggap pesanan yang sudah pernah terlihat sebagai baru", () => {
    // Polling berikutnya tanpa perubahan: tidak ada yang baru.
    const sebelumnya = [
      buatPesanan({ orderId: "a" }),
      buatPesanan({ orderId: "b" }),
    ];
    const sekarang = [
      buatPesanan({ orderId: "a" }),
      buatPesanan({ orderId: "b" }),
    ];

    expect(cariPesananBaru(sebelumnya, sekarang, true)).toEqual([]);
  });

  it("tidak memberi notifikasi untuk pesanan yang sudah dikonfirmasi", () => {
    // Status sudah berubah jadi antrean, jadi bukan menunggu konfirmasi lagi.
    const hasil = cariPesananBaru(
      [],
      [buatPesanan({ orderId: "a", status: "antrean" })],
      true,
    );

    expect(hasil).toEqual([]);
  });

  it("tidak memberi notifikasi untuk pesanan yang langsung selesai atau dibatalkan", () => {
    const hasil = cariPesananBaru(
      [],
      [
        buatPesanan({ orderId: "a", status: "selesai" }),
        buatPesanan({ orderId: "b", status: "dibatalkan" }),
      ],
      true,
    );

    expect(hasil).toEqual([]);
  });

  it("hanya memberi notifikasi untuk yang menunggu di antara campuran", () => {
    const hasil = cariPesananBaru(
      [],
      [
        buatPesanan({ orderId: "a", status: "antrean" }),
        buatPesanan({ orderId: "b", status: "menunggu_konfirmasi" }),
        buatPesanan({ orderId: "c", status: "dibatalkan" }),
      ],
      true,
    );

    expect(hasil.map((satu) => satu.orderId)).toEqual(["b"]);
  });

  it("mendeteksi pesanan yang muncul setelah daftar sempat kosong", () => {
    // Polling sempat gagal sehingga daftar sebelumnya kosong, lalu pulih. Karena
    // halaman sudah pernah memuat, order yang belum pernah terlihat tetap
    // dianggap baru.
    const hasil = cariPesananBaru(
      [],
      [buatPesanan({ orderId: "a" }), buatPesanan({ orderId: "b" })],
      true,
    );

    expect(hasil.map((satu) => satu.orderId)).toEqual(["a", "b"]);
  });

  it("mendeteksi pesanan yang kembali muncul setelah sempat hilang", () => {
    // Mis. Cashier lain membatalkan lalu pesanan baru dibuat dengan id baru:
    // id barunya memang belum pernah terlihat, jadi ini pesanan baru.
    const hasil = cariPesananBaru(
      [buatPesanan({ orderId: "a" })],
      [buatPesanan({ orderId: "b" })],
      true,
    );

    expect(hasil.map((satu) => satu.orderId)).toEqual(["b"]);
  });

  it("mengembalikan daftar kosong saat tidak ada pesanan sama sekali", () => {
    expect(cariPesananBaru([], [], true)).toEqual([]);
  });
});

describe("hitungPesananMenunggu", () => {
  it("menghitung hanya pesanan yang menunggu konfirmasi", () => {
    const jumlah = hitungPesananMenunggu([
      buatPesanan({ orderId: "a", status: "menunggu_konfirmasi" }),
      buatPesanan({ orderId: "b", status: "menunggu_konfirmasi" }),
      buatPesanan({ orderId: "c", status: "antrean" }),
      buatPesanan({ orderId: "d", status: "dikerjakan" }),
      buatPesanan({ orderId: "e", status: "selesai" }),
      buatPesanan({ orderId: "f", status: "dibatalkan" }),
    ]);

    expect(jumlah).toBe(2);
  });

  it("menghitung nol saat tidak ada yang menunggu", () => {
    expect(hitungPesananMenunggu([])).toBe(0);
    expect(
      hitungPesananMenunggu([buatPesanan({ orderId: "a", status: "selesai" })]),
    ).toBe(0);
  });
});

describe("teksSpandukBaru", () => {
  it("menyebut nama customer untuk satu pesanan baru", () => {
    const teks = teksSpandukBaru(
      [buatPesanan({ orderId: "a", customerName: "Budi" })],
      TEKS,
    );

    expect(teks).toBe("Pesanan baru dari Budi");
  });

  it("menyebut jumlah untuk beberapa pesanan baru", () => {
    const teks = teksSpandukBaru(
      [
        buatPesanan({ orderId: "a", customerName: "Budi" }),
        buatPesanan({ orderId: "b", customerName: "Sari" }),
        buatPesanan({ orderId: "c", customerName: "Dina" }),
      ],
      TEKS,
    );

    expect(teks).toBe("3 pesanan baru");
  });

  it("tidak menghasilkan teks saat tidak ada pesanan baru", () => {
    // null berarti spanduk tidak boleh tampil sama sekali.
    expect(teksSpandukBaru([], TEKS)).toBeNull();
  });
});
