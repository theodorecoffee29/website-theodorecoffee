// File ini: komponen tampilan halaman log Admin (/admin/log).
//
// Isinya DUA BAGIAN yang disusun berurutan ke bawah: "Aktivitas" lalu "Error". Kenapa
// bukan tab: dua bagian yang selalu tampil lebih sederhana dan tidak perlu state tab
// yang bisa membuat Admin salah kira bagian mana yang sedang dibaca
// (AGENTS.md bagian "Tampilan": jangan membuat keputusan desain sendiri).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API
// (semua logika ada di src/features/log/).
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).

import type { KeadaanLogAdmin } from "@/features/log/use-log-admin";
import { teksLog } from "@/features/log/teks";
import { FilterAktivitas } from "./filter-aktivitas";
import { FilterError } from "./filter-error";
import { TabelAktivitas } from "./tabel-aktivitas";
import { TabelError } from "./tabel-error";

// Props layar log.
export type PropsLayarLog = {
  // Keadaan dari hook useLogAdmin.
  keadaan: KeadaanLogAdmin;
  // Nama akun yang sedang login, untuk menampilkan di header.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Menampilkan halaman log lengkap: bagian "Aktivitas" dan bagian "Error".
 *
 * Input: keadaan dari hook, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarLog({ keadaan, namaAkun, keluar }: PropsLayarLog) {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksLog.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              {teksLog.subjudulHalaman} Masuk sebagai {namaAkun}.
            </p>
          </div>

          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            Keluar
          </button>
        </header>

        {/* Catatan kecil di bawah halaman, supaya Admin tidak mencari jejaknya di tabel
            dan tahu log tidak bisa diubah (docs/logging.md bagian 2). */}
        <p className="text-xs text-gray-600">
          {teksLog.catatanAkhir.tidakDicatat}
        </p>

        {/* BAGIAN AKTIVITAS */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{teksLog.bagian.aktivitas}</h2>

          <FilterAktivitas
            form={keadaan.aktivitas.form}
            ubahForm={keadaan.aktivitas.ubahForm}
            terapkan={keadaan.aktivitas.terapkan}
            aturUlang={keadaan.aktivitas.aturUlang}
          />

          <TabelAktivitas keadaan={keadaan.aktivitas} />
        </section>

        {/* BAGIAN ERROR */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{teksLog.bagian.error}</h2>

          <FilterError
            form={keadaan.error.form}
            ubahForm={keadaan.error.ubahForm}
            terapkan={keadaan.error.terapkan}
            aturUlang={keadaan.error.aturUlang}
          />

          <TabelError keadaan={keadaan.error} />
        </section>
      </div>
    </main>
  );
}
