// File ini: bagian yang sama untuk ketiga halaman peran (/cashier, /barista,
// /admin). Halaman-halaman tersebut BELUM punya fitur apa pun, jadi isinya
// cuma judul peran, nama akun, dan tombol keluar.
//
// Kenapa dipisah jadi satu komponen: ketiga halaman ditampilkan persis sama,
// hanya teks perannya yang beda. Menulisnya satu kali saja supaya tidak ada
// bagian yang berubah-ubah di antara halaman.

import { logoutAction } from "@/app/login/actions";
import type { SesiStaf } from "@/lib/auth/session";

// Label ramah untuk ditampilkan, misal "Cashier".
const labelPeran: Record<SesiStaf["role"], string> = {
  cashier: "Cashier",
  barista: "Barista",
  admin: "Admin",
};

/**
 * Menampilkan halaman peran yang masih kosong.
 *
 * Input: sesi staf yang sudah dijamin oleh wajibPeran() di halaman, dan path
 *        halaman itu (dipakai untuk pesan singkat).
 * Output: elemen React.
 */
export default function PanelPeran({
  sesi,
  path,
}: {
  sesi: SesiStaf;
  path: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{labelPeran[sesi.role]}</h1>
        <p className="mt-1 text-sm text-gray-600">Masuk sebagai {sesi.name}.</p>

        <p className="mt-4 rounded border border-dashed border-gray-300 p-3 text-sm text-gray-600">
          Halaman ini masih kosong. Fitur {labelPeran[sesi.role]} dibangun di
          fase berikutnya.
        </p>

        {/* Text kecil berisi path halaman, membantu saat belajar dan mengecek
            proteksi. */}
        <p className="mt-2 text-xs text-gray-400">{path}</p>

        {/* action menunjuk Server Action logout, jadi cookie sesi dihapus
            lalu pengguna diarahkan ke /login. */}
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Keluar
          </button>
        </form>
      </div>
    </main>
  );
}
