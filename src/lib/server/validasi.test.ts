// Tes untuk src/lib/server/validasi.ts.
//
// File ini murni (tanpa database), jadi tesnya cepat. Yang diperiksa:
//   - nama customer (wajib, dipangkas, 1-50 karakter),
//   - jumlah baris item (1-20),
//   - qty (bulat, 1-99),
//   - catatan (maksimal 100 karakter),
//   - metode bayar (hanya qris atau tunai),
//   - harga dari klien DITOLAK (tidak ada di skema).

import { describe, expect, it } from "vitest";
import {
  buatOrderSchema,
  konfirmasiOrderSchema,
  logErrorBrowserSchema,
  orderManualSchema,
} from "./validasi";

// Satu order yang valid, dipakai lalu diubah sedikit di tiap tes.
function orderValidasi(ubah: Record<string, unknown> = {}) {
  return {
    customerName: "Budi",
    items: [{ menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 }],
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    ...ubah,
  };
}

describe("validasi nama customer", () => {
  it("menerima nama yang valid", () => {
    const hasil = buatOrderSchema.safeParse(
      orderValidasi({ customerName: "Budi Santoso" }),
    );
    expect(hasil.success).toBe(true);
  });

  it("memangkas spasi pinggir lalu mengecek panjangnya", () => {
    // Nama dengan spasi pinggir harus tetap valid, karena spasi dipangkas dulu.
    const hasil = buatOrderSchema.safeParse(
      orderValidasi({ customerName: "   Budi   " }),
    );
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.customerName).toBe("Budi");
    }
  });

  it("menolak nama kosong", () => {
    expect(
      buatOrderSchema.safeParse(orderValidasi({ customerName: "" })).success,
    ).toBe(false);
  });

  it("menolak nama yang hanya spasi", () => {
    // Setelah dipangkas, jadi kosong, jadi ditolak.
    expect(
      buatOrderSchema.safeParse(orderValidasi({ customerName: "    " }))
        .success,
    ).toBe(false);
  });

  it("menolak nama lebih dari 50 karakter", () => {
    const namaPanjang = "a".repeat(51);
    expect(
      buatOrderSchema.safeParse(orderValidasi({ customerName: namaPanjang }))
        .success,
    ).toBe(false);
  });

  it("menerima nama tepat 50 karakter", () => {
    const nama50 = "a".repeat(50);
    expect(
      buatOrderSchema.safeParse(orderValidasi({ customerName: nama50 }))
        .success,
    ).toBe(true);
  });

  it("menolak nama yang bukan teks", () => {
    expect(
      buatOrderSchema.safeParse(orderValidasi({ customerName: 123 })).success,
    ).toBe(false);
  });
});

describe("validasi jumlah baris item", () => {
  it("menerima 1 baris item", () => {
    expect(buatOrderSchema.safeParse(orderValidasi()).success).toBe(true);
  });

  it("menerima 20 baris item", () => {
    const items = Array.from({ length: 20 }, () => ({
      menuItemId: "11111111-1111-4111-8111-111111111111",
      qty: 1,
    }));
    expect(buatOrderSchema.safeParse(orderValidasi({ items })).success).toBe(
      true,
    );
  });

  it("menolak lebih dari 20 baris item", () => {
    const items = Array.from({ length: 21 }, () => ({
      menuItemId: "11111111-1111-4111-8111-111111111111",
      qty: 1,
    }));
    expect(buatOrderSchema.safeParse(orderValidasi({ items })).success).toBe(
      false,
    );
  });

  it("menolak items kosong", () => {
    expect(
      buatOrderSchema.safeParse(orderValidasi({ items: [] })).success,
    ).toBe(false);
  });
});

describe("validasi qty per item", () => {
  function itemDenganQty(qty: unknown) {
    return orderValidasi({
      items: [{ menuItemId: "11111111-1111-4111-8111-111111111111", qty }],
    });
  }

  it("menerima qty 1 sampai 99", () => {
    expect(buatOrderSchema.safeParse(itemDenganQty(1)).success).toBe(true);
    expect(buatOrderSchema.safeParse(itemDenganQty(99)).success).toBe(true);
  });

  it("menolak qty 0 dan qty negatif", () => {
    expect(buatOrderSchema.safeParse(itemDenganQty(0)).success).toBe(false);
    expect(buatOrderSchema.safeParse(itemDenganQty(-1)).success).toBe(false);
  });

  it("menolak qty lebih dari 99", () => {
    expect(buatOrderSchema.safeParse(itemDenganQty(100)).success).toBe(false);
  });

  it("menolak qty pecahan (bukan bilangan bulat)", () => {
    expect(buatOrderSchema.safeParse(itemDenganQty(1.5)).success).toBe(false);
  });

  it("menolak qty yang bukan angka", () => {
    expect(buatOrderSchema.safeParse(itemDenganQty("dua")).success).toBe(false);
  });
});

describe("validasi catatan per item", () => {
  function itemDenganNote(note: unknown) {
    return orderValidasi({
      items: [
        { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1, note },
      ],
    });
  }

  it("menerima catatan singkat", () => {
    expect(
      buatOrderSchema.safeParse(itemDenganNote("less sugar")).success,
    ).toBe(true);
  });

  it("menerima item tanpa catatan", () => {
    expect(buatOrderSchema.safeParse(itemDenganNote(undefined)).success).toBe(
      true,
    );
  });

  it("menerima catatan tepat 100 karakter", () => {
    expect(
      buatOrderSchema.safeParse(itemDenganNote("a".repeat(100))).success,
    ).toBe(true);
  });

  it("menolak catatan lebih dari 100 karakter", () => {
    expect(
      buatOrderSchema.safeParse(itemDenganNote("a".repeat(101))).success,
    ).toBe(false);
  });
});

describe("harga tidak diterima dari klien", () => {
  it("mengabaikan field harga di body", () => {
    // Kalau klien mengirim "total" atau "price", skema TIDAK memuat field itu,
    // jadi field tersebut diabaikan (tidak dipakai server). Server tetap
    // menghitung ulang harga dari menu_items.
    const hasil = buatOrderSchema.safeParse(
      orderValidasi({ total: 1, price: 100 }),
    );
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      // Pastikan tidak ada field harga yang ikut terbawa ke hasil validasi.
      expect("total" in hasil.data).toBe(false);
      expect("price" in hasil.data).toBe(false);
    }
  });
});

describe("validasi menuItemId", () => {
  it("menolak menuItemId yang bukan uuid", () => {
    const hasil = buatOrderSchema.safeParse(
      orderValidasi({ items: [{ menuItemId: "bukan-uuid", qty: 1 }] }),
    );
    expect(hasil.success).toBe(false);
  });
});

describe("validasi idempotencyKey", () => {
  it("menolak idempotencyKey yang bukan uuid", () => {
    expect(
      buatOrderSchema.safeParse(orderValidasi({ idempotencyKey: "abc" }))
        .success,
    ).toBe(false);
  });

  it("menolak idempotencyKey yang tidak ada", () => {
    const tanpaKey = orderValidasi();
    delete (tanpaKey as Record<string, unknown>).idempotencyKey;
    expect(buatOrderSchema.safeParse(tanpaKey).success).toBe(false);
  });
});

describe("validasi metode bayar", () => {
  it("menerima qris dan tunai", () => {
    expect(
      konfirmasiOrderSchema.safeParse({ paymentMethod: "qris" }).success,
    ).toBe(true);
    expect(
      konfirmasiOrderSchema.safeParse({ paymentMethod: "tunai" }).success,
    ).toBe(true);
  });

  it("menolak metode lain", () => {
    expect(
      konfirmasiOrderSchema.safeParse({ paymentMethod: "kartu" }).success,
    ).toBe(false);
  });

  it("menolak metode yang tidak ada", () => {
    expect(konfirmasiOrderSchema.safeParse({}).success).toBe(false);
  });
});

describe("validasi log error dari browser", () => {
  it("menerima jenis error yang terdaftar", () => {
    const hasil = logErrorBrowserSchema.safeParse({
      kind: "gagal_kirim_order",
      message: "Gagal kirim",
    });
    expect(hasil.success).toBe(true);
  });

  it("menolak jenis error yang tidak terdaftar", () => {
    const hasil = logErrorBrowserSchema.safeParse({
      kind: "bukan_jenis",
      message: "x",
    });
    expect(hasil.success).toBe(false);
  });

  it("memangkas message yang terlalu panjang", () => {
    const hasil = logErrorBrowserSchema.safeParse({
      kind: "gagal_muat_status",
      message: "a".repeat(501),
    });
    expect(hasil.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Order manual (POST /api/cashier/orders)
//
// Aturan diambil dari docs/api-contract.md bagian 2 dan bagian 4
// (create_manual_order).
// ---------------------------------------------------------------------------

// Waktu ISO hari ini menurut WIB, dipakai sebagai occurredAt yang valid.
//
// Cara membuatnya: ambil waktu sekarang, lalu Ubah ke string ISO dengan zona
// WIB. Dengan begitu tes ini tetap benar kapan pun dijalankan, tanpa tanggal
// yang hardcode (tanggal hardcode akan basi besok).
function occurredAtHariIni(): string {
  const sekarang = new Date();

  // Selisih antara UTC dan WIB selalu 7 jam (Indonesia tidak memakai jam
  // daylight saving).
  const dalamWib = new Date(sekarang.getTime() + 7 * 60 * 60 * 1000);

  return dalamWib.toISOString().replace("Z", "+07:00");
}

// Waktu ISO besok (WIB), untuk menguji aturan "tidak boleh di masa depan".
function occurredAtBesok(): string {
  const dalamWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(dalamWib.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+07:00");
}

// Waktu ISO kemarin (WIB), untuk menguji aturan "harus di hari ini".
function occurredAtKemarin(): string {
  const dalamWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(dalamWib.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+07:00");
}

// Satu order manual yang valid, dipakai lalu diubah sedikit di tiap tes.
function orderManualValid(ubah: Record<string, unknown> = {}) {
  return {
    customerName: "Budi",
    items: [{ menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1 }],
    // paymentMethod wajib untuk order manual: Cashier yang menerima pembayaran.
    paymentMethod: "qris",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    ...ubah,
  };
}

describe("orderManualSchema: field wajib", () => {
  it("menerima order manual yang lengkap dan valid", () => {
    const hasil = orderManualSchema.safeParse(orderManualValid());
    expect(hasil.success).toBe(true);
  });

  it("menolak nama yang kosong setelah dipangkas", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ customerName: "   " }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak nama lebih dari 50 karakter", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ customerName: "a".repeat(51) }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menerima nama tepat 50 karakter", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ customerName: "a".repeat(50) }),
    );
    expect(hasil.success).toBe(true);
  });

  it("memangkas spasi pinggir nama", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ customerName: "   Budi   " }),
    );
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.customerName).toBe("Budi");
    }
  });

  it("menolak tanpa item", () => {
    const hasil = orderManualSchema.safeParse(orderManualValid({ items: [] }));
    expect(hasil.success).toBe(false);
  });

  it("menolak lebih dari 20 baris item", () => {
    const banyak = Array.from({ length: 21 }, () => ({
      menuItemId: "11111111-1111-4111-8111-111111111111",
      qty: 1,
    }));
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ items: banyak }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menerima tepat 20 baris item", () => {
    const banyak = Array.from({ length: 20 }, () => ({
      menuItemId: "11111111-1111-4111-8111-111111111111",
      qty: 1,
    }));
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ items: banyak }),
    );
    expect(hasil.success).toBe(true);
  });

  it("menolak qty di bawah 1 dan di atas 99", () => {
    expect(
      orderManualSchema.safeParse(
        orderManualValid({
          items: [
            { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 0 },
          ],
        }),
      ).success,
    ).toBe(false);

    expect(
      orderManualSchema.safeParse(
        orderManualValid({
          items: [
            { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 100 },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("menolak qty pecahan", () => {
    // qty harus bilangan bulat (api-contract bagian 2).
    const hasil = orderManualSchema.safeParse(
      orderManualValid({
        items: [
          { menuItemId: "11111111-1111-4111-8111-111111111111", qty: 1.5 },
        ],
      }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak catatan lebih dari 100 karakter", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({
        items: [
          {
            menuItemId: "11111111-1111-4111-8111-111111111111",
            qty: 1,
            note: "a".repeat(101),
          },
        ],
      }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menerima catatan tepat 100 karakter", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({
        items: [
          {
            menuItemId: "11111111-1111-4111-8111-111111111111",
            qty: 1,
            note: "a".repeat(100),
          },
        ],
      }),
    );
    expect(hasil.success).toBe(true);
  });

  it("menolak menuItemId yang bukan uuid", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({
        items: [{ menuItemId: "bukan-uuid", qty: 1 }],
      }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak idempotencyKey yang bukan uuid", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ idempotencyKey: "bukan-uuid" }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak tanpa idempotencyKey", () => {
    const isiLengkap = orderManualValid();
    // Hapus idempotencyKey supaya zod mewajibkan field itu.
    const tanpaKunci: Record<string, unknown> = { ...isiLengkap };
    delete tanpaKunci.idempotencyKey;

    const hasil = orderManualSchema.safeParse(tanpaKunci);
    expect(hasil.success).toBe(false);
  });
});

describe("orderManualSchema: metode bayar", () => {
  it("menerima qris dan tunai", () => {
    expect(
      orderManualSchema.safeParse(orderManualValid({ paymentMethod: "qris" }))
        .success,
    ).toBe(true);

    expect(
      orderManualSchema.safeParse(orderManualValid({ paymentMethod: "tunai" }))
        .success,
    ).toBe(true);
  });

  it("menolak metode bayar lain", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ paymentMethod: "transfer" }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak tanpa metode bayar (tidak ada nilai bawaan)", () => {
    // Cashier wajib memilih metode bayar sendiri; tidak boleh ada default.
    const isiLengkap = orderManualValid();
    const tanpaMetode: Record<string, unknown> = { ...isiLengkap };
    delete tanpaMetode.paymentMethod;

    const hasil = orderManualSchema.safeParse(tanpaMetode);
    expect(hasil.success).toBe(false);
  });
});

describe("orderManualSchema: occurredAt", () => {
  it("menerima order tanpa occurredAt (opsional)", () => {
    // Kalau tidak dikirim, database memakai waktu sekarang.
    const hasil = orderManualSchema.safeParse(orderManualValid());
    expect(hasil.success).toBe(true);
  });

  it("menerima occurredAt hari ini", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ occurredAt: occurredAtHariIni() }),
    );
    expect(hasil.success).toBe(true);
  });

  it("menolak occurredAt di masa depan", () => {
    // Aturan: tidak boleh di masa depan (api-contract bagian 4).
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ occurredAt: occurredAtBesok() }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak occurredAt kemarin menurut WIB", () => {
    // Aturan: hanya boleh di hari berjalan (WIB), karena laporan hari
    // sebelumnya sudah terkunci di Riwayat.
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ occurredAt: occurredAtKemarin() }),
    );
    expect(hasil.success).toBe(false);
  });

  it("menolak occurredAt dengan bentuk yang tidak valid", () => {
    // Bukan format waktu ISO.
    for (const buruk of ["bukan waktu", "08-10-2026", "2026/10/08", ""]) {
      const hasil = orderManualSchema.safeParse(
        orderManualValid({ occurredAt: buruk }),
      );
      expect(hasil.success).toBe(false);
    }
  });

  it("menolak occurredAt yang bukan teks sama sekali", () => {
    const hasil = orderManualSchema.safeParse(
      orderManualValid({ occurredAt: 12345 }),
    );
    expect(hasil.success).toBe(false);
  });
});

describe("orderManualSchema: harga dari klien", () => {
  it("TIDAK memakai harga yang dikirim klien", () => {
    // Harga selalu dihitung ulang di server dari menu_items
    // (api-contract bagian 2). Field harga tidak ada di skema, jadi diabaikan.
    const hasil = orderManualSchema.safeParse(
      orderManualValid({
        items: [
          {
            menuItemId: "11111111-1111-4111-8111-111111111111",
            qty: 1,
            price: 1,
          },
        ],
        total: 1,
      }),
    );

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      // Field harga tidak diteruskan ke hasil validasi.
      expect(hasil.data.items[0]).not.toHaveProperty("price");
      expect(hasil.data).not.toHaveProperty("total");
    }
  });
});
