// File ini: komponen tampilan untuk editor resep satu menu.
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak melakukan perhitungan (sesuai aturan di AGENTS.md bagian "Tampilan").
// Semua logika ada di src/features/admin/menu/use-editor-resep.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).

import { MAKSIMAL_BARIS } from "@/features/admin/menu/editor-resep";
import { teksMenuAdmin } from "@/features/admin/menu/teks";
import type { KeadaanEditorResep } from "@/features/admin/menu/use-editor-resep";

// Props untuk editor resep.
export type PropsEditorResep = {
  keadaan: KeadaanEditorResep;
  // Nama menu yang resepnya sedang diedit (untuk judul).
  namaMenu: string;
  // Tutup editor.
  tutup: () => void;
};

/**
 * Menampilkan editor resep: daftar baris, pilihan tambah bahan, dan tombol
 * simpan.
 *
 * Input: keadaan dari hook, nama menu, dan aksi tutup.
 * Output: elemen React.
 */
export function EditorResep({ keadaan, namaMenu, tutup }: PropsEditorResep) {
  const teks = teksMenuAdmin.editorResep;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4">
        <h2 className="text-base font-semibold">
          {teks.judul.replace("{nama}", namaMenu)}
        </h2>

        {/* Jumlah bahan yang dipakai dari batas 20. */}
        <p className="mt-1 text-xs text-gray-600">
          {teks.jumlahBaris
            .replace("{jumlah}", String(keadaan.baris.length))
            .replace("{maksimal}", String(MAKSIMAL_BARIS))}
        </p>

        {/* Penanda perubahan yang belum disimpan. */}
        {keadaan.belumDisimpan ? (
          <p
            role="status"
            className="mt-2 rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-900"
          >
            {teks.penandaBelumDisimpan}
          </p>
        ) : null}

        {/* Pesan (error atau informasi). */}
        {keadaan.pesan !== null ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {keadaan.pesan}
          </p>
        ) : null}

        {/* Daftar baris resep. */}
        {keadaan.baris.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
            {teks.keteranganTanpaResep}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {keadaan.baris.map((satu) => (
              <li
                key={satu.ingredientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2"
              >
                <span className="text-sm">{satu.ingredientName}</span>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">
                    {teks.labelTakaran}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={satu.takaranTeks}
                    onChange={(event) =>
                      keadaan.ubahTakaran(satu.ingredientId, event.target.value)
                    }
                    disabled={keadaan.sedangMenyimpan}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-gray-600">{satu.unit}</span>

                  <button
                    type="button"
                    onClick={() => keadaan.hapusBaris(satu.ingredientId)}
                    disabled={keadaan.sedangMenyimpan}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:bg-gray-100"
                  >
                    {teks.tombolHapusBaris}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pilihan tambah bahan. Bahan yang sudah dipakai tidak muncul lagi. */}
        <div className="mt-4">
          <p className="text-sm text-gray-700">{teks.labelBahan}</p>

          {/* Belum ada bahan sama sekali. */}
          {keadaan.memuatBahan ? (
            <p className="mt-1 text-sm text-gray-600">
              {teksMenuAdmin.pesan.memuat}
            </p>
          ) : keadaan.pilihanBahan.length === 0 &&
            keadaan.baris.length === 0 ? (
            <p className="mt-1 text-sm text-gray-600">{teks.belumAdaBahan}</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              {keadaan.pilihanBahan.map((satu) => (
                <button
                  key={satu.ingredientId}
                  type="button"
                  onClick={() => keadaan.tambahBahan(satu.ingredientId)}
                  disabled={keadaan.sedangMenyimpan || !keadaan.bisaTambah}
                  className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
                >
                  {satu.name} ({satu.unit})
                </button>
              ))}
            </div>
          )}

          {/* Resep sudah 20 baris. */}
          {!keadaan.bisaTambah ? (
            <p className="mt-1 text-xs text-gray-600">
              {teks.barisPenuh.replace("{maksimal}", String(MAKSIMAL_BARIS))}
            </p>
          ) : null}
        </div>

        {/* Tombol simpan dan tutup. */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={tutup}
            disabled={keadaan.sedangMenyimpan}
            className="rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {teks.tombolTutup}
          </button>

          <button
            type="button"
            onClick={keadaan.simpan}
            // Simpan hanya aktif kalau ada perubahan yang belum disimpan.
            // Tanpa perubahan, tidak ada yang perlu dikirim.
            disabled={!keadaan.belumDisimpan || keadaan.sedangMenyimpan}
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:bg-gray-300"
          >
            {teks.tombolSimpan}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog peringatan saat menutup editor tanpa menyimpan.
 *
 * Muncul kalau masih ada perubahan yang belum disimpan.
 */
export function DialogBelumSimpan({
  konfirmasiTutup,
  batalTutup,
}: {
  konfirmasiTutup: () => void;
  batalTutup: () => void;
}) {
  const teks = teksMenuAdmin.dialogBelumSimpan;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-dialog-belum-simpan"
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <h2 id="judul-dialog-belum-simpan" className="text-base font-semibold">
          {teks.judul}
        </h2>
        <p className="mt-2 text-sm text-gray-700">{teks.isi}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={konfirmasiTutup}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teks.tombolTutup}
          </button>
          <button
            type="button"
            onClick={batalTutup}
            className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm text-white"
          >
            {teks.tombolSimpanDulu}
          </button>
        </div>
      </div>
    </div>
  );
}
