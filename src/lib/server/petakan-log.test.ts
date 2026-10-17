// Tes untuk src/lib/server/petakan-log.ts.
//
// Yang diuji:
//   1. Nama kolom database (snake_case) diubah menjadi camelCase.
//   2. actorName diambil dari peta nama pelaku, dan kosong untuk actorId yang tidak ada.
//   3. gabungNamaAktor: satu peta untuk banyak id, dan id yang tidak ada (customer,
//      sistem, akun terhapus) TIDAK dapat nama.
//   4. redactSecrets DIPAKAI LAGI untuk before, after, meta, dan context.
//
// CATATAN SOAL MOCK DAN redactSecrets:
//   Modul "@/lib/supabase/admin" dikelompokkan (di-mock) supaya mengimpor @/lib/log
//   tidak membaca environment variable. redactSecrets yang dipakai di sini adalah
//   FUNGSI ASLI (bukan tiruan), jadi tes ini benar-benar membuktikan nilai rahasia
//   disembunyikan, bukan cuma bahwa fungsinya dipanggil.

import { describe, expect, it, vi } from "vitest";

// Modul admin dikelompokkan: @/lib/log memuat klien admin yang membaca environment.
vi.mock("@/lib/supabase/admin", () => {
  return {
    getAdminClient: () => ({}),
  };
});

import {
  gabungNamaAktor,
  petakanBarisAktivitas,
  petakanBarisError,
} from "./petakan-log";

// Satu baris activity_logs yang sudah dibaca dari database, bentuknya persis seperti
// kolom tabel (snake_case, jsonb, dan timestamptz).
const BARIS_ACTIVITAS = {
  id: "11111111-1111-4111-8111-111111111111",
  at: "2026-10-11T09:15:00+07:00",
  actor_id: "22222222-2222-4222-8222-222222222222",
  actor_role: "cashier",
  action: "order.confirmed",
  entity_type: "order",
  entity_id: "33333333-3333-4333-8333-333333333333",
  order_id: "33333333-3333-4333-8333-333333333333",
  before: { status: "menunggu_konfirmasi" },
  after: { status: "antrean", payment_method: "qris" },
  meta: { session_id: "sess-1", queue_number: 12 },
};

// Satu baris error_logs.
const BARIS_ERROR = {
  id: "44444444-4444-4444-8444-444444444444",
  at: "2026-10-11T10:00:00+07:00",
  code: "ERR-4F2A",
  severity: "error",
  source: "database",
  message: "Gagal memanggil database di confirm_order",
  context: { konteks: "confirm_order", orderId: "abc" },
  user_id: "22222222-2222-4222-8222-222222222222",
  order_id: "33333333-3333-4333-8333-333333333333",
};

// Helper untuk membaca nilai jsonb hasil pemetaan sebagai objek biasa, supaya
// TypeScript mengizinkan kita membaca propertinya.
function sebagaiObjek(nilai: unknown): Record<string, unknown> {
  return nilai as Record<string, unknown>;
}

describe("petakanBarisAktivitas", () => {
  it("mengubah nama kolom snake_case menjadi camelCase", () => {
    const peta = new Map();
    const hasil = petakanBarisAktivitas(BARIS_ACTIVITAS, peta);

    expect(hasil.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(hasil.at).toBe("2026-10-11T09:15:00+07:00");
    expect(hasil.actorId).toBe("22222222-2222-4222-8222-222222222222");
    expect(hasil.actorRole).toBe("cashier");
    expect(hasil.action).toBe("order.confirmed");
    expect(hasil.entityType).toBe("order");
    expect(hasil.entityId).toBe("33333333-3333-4333-8333-333333333333");
    expect(hasil.orderId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("TIDAK mengirim nama kolom mentah", () => {
    // Tidak boleh ada kunci snake_case yang bocor ke respons. Ini yang membuat kolom
    // baru yang mungkin ditambahkan nanti tidak ikut terkirim dengan sendirinya.
    const hasil = petakanBarisAktivitas(BARIS_ACTIVITAS, new Map());

    for (const kunci of Object.keys(hasil)) {
      expect(kunci).not.toContain("_");
    }
  });

  it("mengambil nama pelaku dari peta", () => {
    const peta = new Map([["22222222-2222-4222-8222-222222222222", "Budi"]]);

    const hasil = petakanBarisAktivitas(BARIS_ACTIVITAS, peta);

    expect(hasil.actorName).toBe("Budi");
  });

  it("memberi actorName kosong untuk customer dan sistem", () => {
    // Customer dan sistem tidak punya akun, jadi actor_id-nya kosong dan tidak ada
    // di tabel profiles. Namanya harus tetap string kosong, bukan "undefined".
    const barisCustomer = {
      ...BARIS_ACTIVITAS,
      actor_id: null,
      actor_role: "customer",
    };

    const hasil = petakanBarisAktivitas(barisCustomer, new Map());

    expect(hasil.actorId).toBe("");
    expect(hasil.actorName).toBe("");
    expect(hasil.actorRole).toBe("customer");
  });

  it("memberi actorName kosong kalau akunnya tidak ada di tabel profiles", () => {
    const hasil = petakanBarisAktivitas(BARIS_ACTIVITAS, new Map());

    expect(hasil.actorName).toBe("");
  });

  it("membuang nilai rahasia dari before, after, dan meta", () => {
    // Ini lapisan kedua. Nilai sudah dibersihkan ketika ditulis (logActivity memanggil
    // redactSecrets), tapi halaman log dibaca dari browser, jadi dibersihkan lagi di
    // sini. Kalau ada baris lama yang ditulis sebelum aturan itu ada, nilainya akan
    // ikut terlihat.
    //
    // Nama kuncinya memakai bentuk yang dikenali helper redactSecrets
    // (src/lib/log/index.ts): "apiKey" menjadi "apikey" setelah huruf kecilnya dibuang.
    const peta = new Map();
    const barisBerRahasia = {
      ...BARIS_ACTIVITAS,
      before: { status: "menunggu_konfirmasi" },
      after: { status: "antrean", apiKey: "rahasia-123" },
      meta: { session_id: "sess-1", token: "rahasia-456" },
    };

    const hasil = petakanBarisAktivitas(barisBerRahasia, peta);

    // Nilai yang bukan rahasia tetap utuh.
    expect(sebagaiObjek(hasil.after).status).toBe("antrean");
    expect(sebagaiObjek(hasil.meta).session_id).toBe("sess-1");

    // Nilai rahasia disembunyikan.
    expect(sebagaiObjek(hasil.after).apiKey).toBe("[DISEMBUNYIKAN]");
    expect(sebagaiObjek(hasil.meta).token).toBe("[DISEMBUNYIKAN]");
  });

  it("menyembunyikan nilai rahasia di dalam array dan objek bersarang", () => {
    // redactSecrets menelusuri ke dalam array dan objek, bukan hanya satu lapis.
    const hasil = petakanBarisAktivitas(
      {
        ...BARIS_ACTIVITAS,
        meta: {
          daftar: [{ password: "rahasia-1" }, { aman: "bukan rahasia" }],
        },
      },
      new Map(),
    );

    const daftar = sebagaiObjek(hasil.meta).daftar as unknown[];

    expect(sebagaiObjek(daftar[0]).password).toBe("[DISEMBUNYIKAN]");
    expect(sebagaiObjek(daftar[1]).aman).toBe("bukan rahasia");
  });

  it("menjaga nilai kosong sebagai null, bukan undefined", () => {
    // Kunci JSON yang bernilai undefined akan HILANG saat respons dikirim, jadi bentuk
    // responsnya berubah tergantung isi. null selalu ikut terkirim.
    const hasil = petakanBarisAktivitas(
      { ...BARIS_ACTIVITAS, before: null, after: null, meta: null },
      new Map(),
    );

    expect(hasil.before).toBeNull();
    expect(hasil.after).toBeNull();
    expect(hasil.meta).toBeNull();
    expect("before" in hasil).toBe(true);
  });

  it("tidak gagal kalau baris tidak lengkap", () => {
    // Halaman log tidak boleh ikut error hanya karena satu baris aneh.
    const hasil = petakanBarisAktivitas({}, new Map());

    expect(hasil.id).toBe("");
    expect(hasil.action).toBe("");
    expect(hasil.before).toBeNull();
  });
});

describe("petakanBarisError", () => {
  it("mengubah nama kolom snake_case menjadi camelCase", () => {
    const hasil = petakanBarisError(BARIS_ERROR);

    expect(hasil.code).toBe("ERR-4F2A");
    expect(hasil.severity).toBe("error");
    expect(hasil.source).toBe("database");
    expect(hasil.message).toBe("Gagal memanggil database di confirm_order");
    expect(hasil.userId).toBe("22222222-2222-4222-8222-222222222222");
    expect(hasil.orderId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("TIDAK mengirim kolom yang tidak ada di kontrak", () => {
    // sentry_event_id sengaja tidak diambil: Sentry baru dipasang di Fase 9, dan
    // halaman ini tidak butuh isinya.
    const hasil = petakanBarisError(BARIS_ERROR);

    for (const kunci of Object.keys(hasil)) {
      expect(kunci).not.toContain("sentry");
    }
  });

  it("membuang nilai rahasia dari context", () => {
    const hasil = petakanBarisError({
      ...BARIS_ERROR,
      context: { konteks: "confirm_order", password: "rahasia-789" },
    });

    expect(sebagaiObjek(hasil.context).konteks).toBe("confirm_order");
    expect(sebagaiObjek(hasil.context).password).toBe("[DISEMBUNYIKAN]");
  });

  it("menjelaskan keterbatasan penyaringan pada kunci bergaris bawah", () => {
    // Helper redactSecrets mencocokkan kata kunci TANPA garis bawah ("apikey"), jadi
    // kunci "api_key" tidak ikut disembunyikan. Tes ini mengunci perilaku yang ada
    // sekarang supaya perubahannya terlihat nanti, dan memberi catatan bahwa
    // daftar kata kuncinya mungkin perlu ditambah.
    const hasil = petakanBarisError({
      ...BARIS_ERROR,
      context: { api_key: "rahasia-789" },
    });

    expect(sebagaiObjek(hasil.context).api_key).toBe("rahasia-789");
  });

  it("menjaga nilai kosong sebagai null", () => {
    const hasil = petakanBarisError({ ...BARIS_ERROR, context: null });

    expect(hasil.context).toBeNull();
  });

  it("tidak gagal kalau baris tidak lengkap", () => {
    const hasil = petakanBarisError({});

    expect(hasil.code).toBe("");
    expect(hasil.severity).toBe("");
    expect(hasil.context).toBeNull();
  });
});

describe("gabungNamaAktor", () => {
  it("menggabungkan banyak id menjadi satu peta", () => {
    // INI yang membuat satu halaman cukup satu query: semua id dalam satu halaman
    // digabung lebih dulu, lalu dibaca sekali.
    const peta = gabungNamaAktor(
      ["id-a", "id-b", "id-c"],
      [
        { id: "id-a", name: "Budi" },
        { id: "id-b", name: "Sari" },
        { id: "id-c", name: "Andi" },
      ],
    );

    expect(peta.size).toBe(3);
    expect(peta.get("id-a")).toBe("Budi");
    expect(peta.get("id-b")).toBe("Sari");
    expect(peta.get("id-c")).toBe("Andi");
  });

  it("menangani id yang sama muncul berkali-kali", () => {
    // Satu actor_id bisa muncul di banyak baris log (mis. satu Cashier yang mengonfirmasi
    // banyak order). Peta harus berisi satu entri saja.
    const peta = gabungNamaAktor(
      ["id-a", "id-a", "id-a"],
      [{ id: "id-a", name: "Budi" }],
    );

    expect(peta.size).toBe(1);
    expect(peta.get("id-a")).toBe("Budi");
  });

  it("tidak membuat entri untuk actorId yang kosong", () => {
    // Baris log untuk customer dan sistem punya actor_id kosong. Kalau ada entri
    // dengan nama kosong di peta, layar akan menampilkan "Customer" dengan nama kosong.
    const peta = gabungNamaAktor(["", "", ""], []);

    expect(peta.size).toBe(0);
  });

  it("melewati baris profiles yang namanya kosong atau tidak terbaca", () => {
    const peta = gabungNamaAktor(
      ["id-a", "id-b"],
      [
        { id: "id-a", name: "" },
        { id: "", name: "Tanpa Id" },
        null,
        "bukan objek",
        { id: "id-b", name: "Sari" },
      ],
    );

    // Hanya yang benar-benar punya nama yang masuk. Lebih baik nama kosong di layar
    // daripada nama yang ikut kosong.
    expect(peta.size).toBe(1);
    expect(peta.get("id-b")).toBe("Sari");
  });

  it("menghasilkan peta kosong kalau tidak ada baris profiles", () => {
    const peta = gabungNamaAktor(["id-a"], []);

    expect(peta.size).toBe(0);
  });
});
