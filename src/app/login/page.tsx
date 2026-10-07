// File ini: halaman login (/login).
//
// Isinya sengaja polos: hanya form email dan kata sandi. Belum ada fitur
// pendaftaran atau lupa kata sandi (itu untuk fase berikutnya).
//
// Halaman ini adalah Client Component karena form-nya memakai useActionState
// untuk menampilkan pesan error dari Server Action tanpa reload halaman.

"use client";

import { useActionState } from "react";
import { loginAction, type HasilLogin } from "./actions";

// Nilai awal untuk useActionState: belum ada error sebelum form dikirim.
const hasilAwal: HasilLogin = { error: null };

export default function HalamanLogin() {
  // useActionState memanggil Server Action saat form dikirim, lalu memberi kita
  // hasil (error atau tidak) supaya bisa ditampilkan.
  //
  // Kenapa dibungkus fungsi panah: useActionState mengirim (state, formData),
  // sedangkan loginAction hanya butuh formData. Pembungkus ini menjembatani
  // keduanya, dan mengabaikan state karena tidak ada di sini.
  const [hasil, kirimAction] = useActionState(
    (_state: HasilLogin, formData: FormData) => loginAction(formData),
    hasilAwal,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Theodore Coffee</h1>
        <p className="mt-1 text-sm text-gray-600">Masuk untuk melanjutkan.</p>

        {/* action menunjuk ke Server Action. method="post" wajib supaya form
            dikirim sebagai POST, bukan GET (supaya sandi tidak ikut di URL). */}
        <form action={kirimAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Kata sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Tampilkan pesan error kalau ada. Pesannya generik, tidak
              membocorkan apakah emailnya terdaftar. */}
          {hasil.error ? (
            <p role="alert" className="text-sm text-red-600">
              {hasil.error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded bg-gray-900 px-3 py-2 text-white hover:bg-gray-700"
          >
            Masuk
          </button>
        </form>
      </div>
    </main>
  );
}
