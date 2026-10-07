// File ini: pencatatan log khusus untuk login dan keluar.
//
// File ini sengaja TIDAK memakai "use server" dan tidak exporting Server Action.
// Tujuannya: dipakai di dalam modul Server Action (src/app/login/actions.ts).
// Modul "use server" hanya boleh mengekspor fungsi async, jadi pembantu seperti
// ini dipisah ke file biasa supaya rules-nya tetap dipatuhi.

import { logActivity } from "@/lib/log";
import type { SesiStaf } from "@/lib/auth/session";

/**
 * Mencatat login berhasil.
 *
 * Input: sesi staf yang baru saja berhasil login.
 *
 * Pelaku adalah akun itu sendiri, jadi actorId diisi dengan id akunnya dan
 * actorRole dengan perannya. session_id disimpan di meta supaya satu akun yang
 * dipakai di beberapa laptop tetap bisa dibedakan (docs/pemissions.md bagian 1).
 */
export function catatLoginBerhasil(sesi: SesiStaf): void {
  logActivity({
    action: "auth.login",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "auth",
    entityId: sesi.userId,
    meta: sesi.sessionId ? { session_id: sesi.sessionId } : null,
  });
}

/**
 * Mencatat login gagal.
 *
 * Input: email yang dicoba, dan alasan kegagalan dalam kalimat singkat.
 *
 * Kenapa actor_role "system": saat login gagal belum ada akun yang bisa disebut
 * sebagai pelaku, jadi pelakunya dicatat sebagai sistem. Email yang dicoba
 * disimpan di meta supaya Admin bisa menelusuri percobaan login.
 *
 * Password TIDAK PERNAH ikut dicatat di sini maupun di meta.
 */
export function catatLoginGagal(email: string, alasan: string): void {
  logActivity({
    action: "auth.login_failed",
    actorRole: "system",
    entityType: "auth",
    meta: { email: email, alasan: alasan },
  });
}

/**
 * Mencatat pengguna yang keluar (logout).
 *
 * Input: sesi staf yang sedang keluar.
 *
 * Pelaku adalah akunnya sendiri, sama seperti saat login. Dicatat sebelum sesi
 * dihapus, supaya aktivitasnya tetap tercatat walau proses keluar berikutnya
 * gagal.
 */
export function catatLogout(sesi: SesiStaf): void {
  logActivity({
    action: "auth.logout",
    actorRole: sesi.role,
    actorId: sesi.userId,
    entityType: "auth",
    entityId: sesi.userId,
    meta: sesi.sessionId ? { session_id: sesi.sessionId } : null,
  });
}
