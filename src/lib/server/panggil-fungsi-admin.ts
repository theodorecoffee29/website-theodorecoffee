// File ini: pemanggil fungsi database Admin dengan tipe yang aman.
//
// KENAPA FILE INI ADA: fungsi Admin (create_menu_item, set_recipe, dan
// sebagainya) dibuat oleh migrasi yang belum masuk ke
// src/lib/supabase/database.types.ts, karena berkas itu DIHASILKAN otomatis oleh
// Supabase. Jadi TypeScript belum mengenal nama fungsi itu dan complained pada
// setiap pemanggilan.
//
// Daripada mengubah berkas hasil-generate secara manual (yang akan ditimpa
// berikutnya), pemanggilan fungsi Admin dikumpulkan di sini. File ini yang
// declares nama fungsi dan bentuk argumennya, jadi route handler tetap normale
// dipanggil dan TypeScript tetap memeriksa nama fungsi serta nama parameter.
//
// CATATAN: begitu database.types.ts di-refresh (npx supabase gen types), daftar
// di bawah bisa dihapus dan route boleh memakai .rpc() langsung seperti
// endpoint order yang lain.

import { getAdminClient } from "@/lib/supabase/admin";

// Bentuk argumen tiap fungsi Admin, mengikuti signature di migrasi
// 20261008062847_admin_functions.sql.
//
// Catatan urutan create_ingredient: p_actor_id dan p_meta harus ditulis sebelum
// p_initial_stock, karena p_initial_stock punya nilai bawaan dan PostgreSQL
// menolak parameter tanpa nilai bawaan yang berada setelah parameter yang punya
// nilai bawaan.
type ArgumenFungsiAdmin = {
  create_menu_item: {
    p_name: string;
    p_price: number;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  update_menu_item: {
    p_menu_item_id: string;
    p_name: string;
    p_price: number;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  set_menu_active: {
    p_menu_item_id: string;
    p_is_active: boolean;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  set_recipe: {
    p_menu_item_id: string;
    p_lines: unknown;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  create_ingredient: {
    p_name: string;
    p_unit: string;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
    p_initial_stock: number | null;
  };
  update_ingredient: {
    p_ingredient_id: string;
    p_name: string;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  restock_ingredient: {
    p_ingredient_id: string;
    p_qty: number;
    p_note: string | null;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
  adjust_stock: {
    p_ingredient_id: string;
    p_new_qty: number;
    p_reason: string;
    p_actor_id: string;
    p_meta: Record<string, unknown>;
  };
};

// Nama fungsi yang boleh dipanggil. TypeScript akan menolak nama lain, jadi
// salah ketik nama fungsi akan terdeteksi saat build.
export type NamaFungsiAdmin = keyof ArgumenFungsiAdmin;

/**
 * Memanggil fungsi database Admin.
 *
 * Input:
 *   - nama: nama fungsi (harus salah satu dari yang terdaftar di atas),
 *   - argumen: argumen sesuai signature fungsi itu.
 * Output: hasil pemanggilan supabase, sama seperti .rpc() biasa
 *         ({ data, error }). Tidak pernah melempar error; kegagalan database
 *         dikembalikan lewat error supaya route bisa memetakannya.
 */
export async function panggilFungsiAdmin<Nama extends NamaFungsiAdmin>(
  nama: Nama,
  argumen: ArgumenFungsiAdmin[Nama],
): Promise<{ data: unknown; error: unknown }> {
  // The cast dipakai karena nama fungsi ini belum ada di database.types.ts
  // (lihat penjelasan di kepala file). Bentuk argumen tetap diperiksa TypeScript
  // lewat tipe ArgumenFungsiAdmin di atas.
  const hasil = await (
    getAdminClient().rpc as unknown as (
      namaFungsi: string,
      argumenRpc: unknown,
    ) => Promise<{ data: unknown; error: unknown }>
  )(nama, argumen);

  return hasil;
}
