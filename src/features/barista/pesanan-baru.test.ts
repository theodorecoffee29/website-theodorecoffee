// Tes untuk src/features/barista/pesanan-baru.ts.
//
// Yang diuji: pendeteksian pesanan baru di antara dua hasil polling, termasuk
// kasus pemuatan pertama yang TIDAK boleh memicu spanduk, dan pemisahan antara
// "pemuatan pertama" dengan "daftar kosong".

import { describe, expect, it } from "vitest";
import {
  cariPesananBaru,
  hitungBaruMasuk,
  teksSpandukBaru,
  type PesananPantau,
} from "./pesanan-baru";

function buatPesanan(ubah: Partial<PesananPantau> = {}): PesananPantau {
  return {
    orderId: "11111111-1111-4111-8111-111111111111",
    queueNumber: 1,
    status: "antrean",
    ...ubah,
  };
}

// Pola kalimat spanduk (di halaman aslinya diambil dari teks.ts).
const TEKS = {
  satu: "Pesanan baru: nomor {n}",
  banyak: "{jumlah} pesanan baru",
};

describe("cariPesananBaru", () => {
  it("tidak memicu apa pun saat pemuatan pertama", () => {
    // Pemuatan pertama (sudahPernahMuat = false). Apa pun yang ada sudah
    // terlihat di layar Barista, jadi bukan pesanan baru.
    const hasil = cariPesananBaru(
      [],
      [buatPesanan({ orderId: "a" }), buatPesanan({ orderId: "b" })],
      false,
    );

    expect(hasil).toEqual([]);
  });

  it("membedakan pemuatan pertama dari daftar kosong", () => {
    // Dua kasus yang daftar sebelumnya sama-sama kosong, tapi hasilnya berbeda.
    // Ini yang membuat flag sudahPernahMuat diperlukan.
    const daftarKosong: PesananPantau[] = [];
    const pemuatanPertama = cariPesananBaru(
      daftarKosong,
      [buatPesanan({ orderId: "a" })],
      false,
    );
    const daftarPernahKosong = cariPesananBaru(
      daftarKosong,
      [buatPesanan({ orderId: "a" })],
      true,
    );

    expect(pemuatanPertama).toEqual([]);
    // Setelah halaman sempat terisi lalu kosong (mis. polling gagal), pesanan
    // yang belum pernah terlihat tetap dianggap baru.
    expect(daftarPernahKosong.map((satu) => satu.orderId)).toEqual(["a"]);
  });

  it("menemukan satu pesanan baru yang muncul di polling berikutnya", () => {
    const hasil = cariPesananBaru(
      [buatPesanan({ orderId: "a" })],
      [
        buatPesanan({ orderId: "a" }),
        buatPesanan({ orderId: "b", queueNumber: 5 }),
      ],
      true,
    );

    expect(hasil).toHaveLength(1);
    expect(hasil[0].orderId).toBe("b");
    expect(hasil[0].queueNumber).toBe(5);
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

  it("tidak menandai pesanan yang hanya berubah status sebagai baru", () => {
    // Pesanan yang Barista lain baru saja tekan Selesai: saat ini masih di
    // antrean (dikerjakan) tapi akan hilang di polling berikutnya. Yang
    // menentukan "baru" adalah belum pernah terlihat, jadi tetap dihitung.
    const hasil = cariPesananBaru(
      [buatPesanan({ orderId: "a", status: "antrean" })],
      [buatPesanan({ orderId: "a", status: "dikerjakan" })],
      true,
    );

    // orderId sama, jadi bukan pesanan baru.
    expect(hasil).toEqual([]);
  });

  it("mendeteksi pesanan yang kembali muncul setelah sempat hilang", () => {
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

describe("hitungBaruMasuk", () => {
  it("menghitung hanya pesanan berstatus antrean", () => {
    // Hanya status "antrean" (Baru masuk) yang dihitung untuk judul tab.
    const jumlah = hitungBaruMasuk([
      buatPesanan({ orderId: "a", status: "antrean" }),
      buatPesanan({ orderId: "b", status: "antrean" }),
      buatPesanan({ orderId: "c", status: "antrean" }),
      buatPesanan({ orderId: "d", status: "dikerjakan" }),
    ]);

    expect(jumlah).toBe(3);
  });

  it("menghitung nol saat tidak ada yang baru masuk", () => {
    expect(hitungBaruMasuk([])).toBe(0);
    expect(
      hitungBaruMasuk([buatPesanan({ orderId: "a", status: "dikerjakan" })]),
    ).toBe(0);
  });
});

describe("teksSpandukBaru", () => {
  it("menyebut nomor antrean untuk satu pesanan baru", () => {
    const teks = teksSpandukBaru(
      [buatPesanan({ orderId: "a", queueNumber: 5 })],
      TEKS,
    );

    expect(teks).toBe("Pesanan baru: nomor 5");
  });

  it("menyebut jumlah untuk beberapa pesanan baru", () => {
    const teks = teksSpandukBaru(
      [
        buatPesanan({ orderId: "a", queueNumber: 5 }),
        buatPesanan({ orderId: "b", queueNumber: 6 }),
        buatPesanan({ orderId: "c", queueNumber: 7 }),
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
