// File ini: pembatas permintaan berbasis database (rate limit).
//
// FAIL-OPEN: kalau pemanggilan database gagal, melempar error, atau terlalu
// lama (> 800 ms), kita anggap diizinkan. Alasannya: pembatas adalah lapisan
// tambahan, bukan penjaga utama. Kalau database lambat, lebih baik layanan
// tetap jalan daripada semua pengguna diblokir. Kegagalan dicatat ke log,
// tetapi dengan pembatas frekuensi (paling satu catatan per menit per instance)
// supaya log tidak banjir.

import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

const BATAS_WAKTU_MS = 800;

// Catatan waktu terakhir log per instance (in-memory).
let terakhirLogMs = 0;

function catatKegagalanSekaliPerMenit(pesan: string): void {
  const sekarang = Date.now();
  if (sekarang - terakhirLogMs < 60_000) return;
  terakhirLogMs = sekarang;
  try {
    logError({
      message: pesan,
      severity: "warning",
      source: "server",
      context: { pesan: "fail-open" },
    });
  } catch {
    // Jangan biarkan pencatatan log membuat pembatas gagal.
  }
}

export type HasilBatas = {
  diizinkan: boolean;
  sisa: number;
  cobaLagiDetik: number;
};

export async function batasiPermintaan(params: {
  kunci: string;
  batas: number;
  jendelaDetik: number;
}): Promise<HasilBatas> {
  const { kunci, batas, jendelaDetik } = params;

  const mulai = Date.now();
  try {
    const janji = getAdminClient().rpc("check_rate_limit" as never, {
      p_key: kunci,
      p_limit: batas,
      p_window_seconds: jendelaDetik,
    } as never);

    // Pembatas waktu sederhana.
    const hasil = await Promise.race([
      janji,
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), BATAS_WAKTU_MS),
      ),
    ]);

    if (hasil === null) {
      catatKegagalanSekaliPerMenit(
        "Pembatas permintaan melebihi 800 ms, fail-open.",
      );
      return { diizinkan: true, sisa: batas, cobaLagiDetik: 1 };
    }

    const data = (hasil as { data: unknown }).data as {
      allowed: boolean;
      remaining: number;
      retryAfterSeconds: number;
    } | null;

    if (!data) {
      catatKegagalanSekaliPerMenit(
        "Pembatas permintaan tidak mengembalikan data, fail-open.",
      );
      return { diizinkan: true, sisa: batas, cobaLagiDetik: 1 };
    }

    // Pastikan tidak melebihi batas waktu total (termasuk pemrosesan).
    if (Date.now() - mulai > BATAS_WAKTU_MS) {
      catatKegagalanSekaliPerMenit(
        "Pembatas permintaan melebihi 800 ms, fail-open.",
      );
      return { diizinkan: true, sisa: batas, cobaLagiDetik: 1 };
    }

    return {
      diizinkan: data.allowed,
      sisa: Math.max(0, data.remaining),
      cobaLagiDetik: Math.max(1, data.retryAfterSeconds),
    };
  } catch (error) {
    catatKegagalanSekaliPerMenit(
      "Pembatas permintaan gagal, fail-open: " + String(error),
    );
    return { diizinkan: true, sisa: batas, cobaLagiDetik: 1 };
  }
}

/**
 * Mengambil IP klien dari header yang diisi platform hosting.
 *
 * Urutan: x-vercel-forwarded-for, lalu x-real-ip, lalu x-forwarded-for.
 * x-forwarded-for bisa dipalsukan klien, jadi hanya dipakai kalau dua header
 * sebelumnya tidak ada. Saat memakai x-forwarded-for, ambil seluruh rantai
 * dan pakai elemen terakhir (paling dekat ke server). Catatan: ini tetap
 * bisa dipalsukan kalau platform tidak membersihkan header, jadi ini best effort.
 */
export function ambilIpKlien(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "tidak-diketahui";
}

/**
 * Membuat kunci pembatas dari IP atau email.
 * IP/email tidak pernah dimasukkan mentah; dipakai hash SHA-256 (hex, 32 char).
 */
export async function buatKunci(jenis: string, nilai: string): Promise<string> {
  const dinormalisasi = nilai.trim().toLowerCase();
  const data = new TextEncoder().encode(dinormalisasi);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${jenis}:${hex.slice(0, 32)}`;
}
