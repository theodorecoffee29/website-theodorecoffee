// File ini: komponen tampilan utama layar Barista (/barista).
//
// Komponen ini HANYA menerima props dan menampilkannya; tidak memanggil API dan
// tidak mengubah state sendiri (sesuai aturan di AGENTS.md bagian "Tampilan").
// Semua logika ada di src/features/barista/use-antrean-barista.ts.
//
// Tampilan sengaja POLOS dan sementara (sampai Fase 7).
//
// Urutan antrean PERSIS seperti dari server (waktu konfirmasi paling awal di
// atas). Komponen ini tidak mengurutkan apa pun, hanya menampilkannya sesuai
// urutan yang diterimanya.

import { KartuPesanan } from "./kartu-pesanan";
import { teksBarista } from "@/features/barista/teks";
import type { KeadaanBarista } from "@/features/barista/use-antrean-barista";

// Props layar Barista. Semuanya berasal dari hook useAntreanBarista.
export type PropsLayarBarista = {
  keadaan: KeadaanBarista;
  // Nama akun Barista yang sedang login (untuk ditampilkan di header).
  namaAkun: string;
  // Aksi keluar. Dipanggil dari tombol di komponen ini.
  keluar: () => void;
};

/**
 * Menampilkan seluruh isi layar Barista.
 *
 * Input: keadaan dari hook, nama akun, dan aksi keluar.
 * Output: elemen React.
 */
export function LayarBarista({ keadaan, namaAkun, keluar }: PropsLayarBarista) {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header: judul, nama akun, tombol keluar. */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-xl font-bold">{teksBarista.judulHalaman}</h1>
            <p className="text-sm text-gray-600">
              {teksBarista.subjudulHalaman} Masuk sebagai {namaAkun}.
            </p>
          </div>
          <button
            type="button"
            onClick={keluar}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {teksBarista.tombol.keluar}
          </button>
        </header>

        {/* Spanduk pesanan baru. Tanpa suara, hanya teks (docs/prd.md bagian 5:
            notifikasi suara di luar V1). */}
        {keadaan.spandukBaru !== null ? (
          <div
            role="status"
            className="flex items-center justify-between rounded border border-blue-300 bg-blue-50 px-3 py-2"
          >
            <span className="text-sm font-medium">{keadaan.spandukBaru}</span>
            <button
              type="button"
              onClick={keadaan.tutupSpanduk}
              className="rounded border border-blue-300 px-2 py-1 text-xs"
            >
              {teksBarista.notifikasi.tutup}
            </button>
          </div>
        ) : null}

        {/* Pesan status memuat / gagal / aksi. */}
        {keadaan.memuat ? (
          <p className="text-sm text-gray-600">{teksBarista.pesan.memuat}</p>
        ) : null}
        {keadaan.gagalMuat ? (
          <p role="status" className="text-sm text-amber-700">
            {teksBarista.pesan.gagalMuat}
          </p>
        ) : null}
        {keadaan.pesan !== null ? (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
          >
            {keadaan.pesan}
          </p>
        ) : null}

        {/* Kelompok 1: Sedang dikerjakan (di atas). */}
        <BagianKelompok
          judul={teksBarista.kelompok.dikerjakan}
          keterangan={teksBarista.kelompok.keteranganDikerjakan}
          jumlah={keadaan.dikerjakan.length}
        >
          {keadaan.dikerjakan.map((satu) => (
            <KartuPesanan
              key={satu.orderId}
              pesanan={satu}
              sedangAksi={keadaan.sedangAksi === satu.orderId}
              mulai={() => keadaan.mulai(satu.orderId)}
              selesaikan={() => keadaan.selesaikan(satu.orderId)}
            />
          ))}
        </BagianKelompok>

        {/* Kelompok 2: Baru masuk (di bawah). */}
        <BagianKelompok
          judul={teksBarista.kelompok.baruMasuk}
          keterangan={teksBarista.kelompok.keteranganBaruMasuk}
          jumlah={keadaan.baruMasuk.length}
        >
          {keadaan.baruMasuk.map((satu) => (
            <KartuPesanan
              key={satu.orderId}
              pesanan={satu}
              sedangAksi={keadaan.sedangAksi === satu.orderId}
              mulai={() => keadaan.mulai(satu.orderId)}
              selesaikan={() => keadaan.selesaikan(satu.orderId)}
            />
          ))}
        </BagianKelompok>
      </div>
    </main>
  );
}

/**
 * Menampilkan satu kelompok antrean beserta judul, keterangan, dan jumlahnya.
 *
 * Input: judul, keterangan, jumlah pesanan, dan anak-anaknya (kartu pesanan).
 * Output: elemen section.
 *
 * Dipisah jadi komponen kecil supaya dua kelompok di layar Barista punya
 * tampilan yang benar-benar sama.
 */
function BagianKelompok({
  judul,
  keterangan,
  jumlah,
  children,
}: {
  judul: string;
  keterangan: string;
  jumlah: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{judul}</h2>
        <span className="text-xs text-gray-600">
          {teksBarista.kelompok.jumlahOrder.replace("{jumlah}", String(jumlah))}
        </span>
      </div>

      <p className="text-xs text-gray-600">{keterangan}</p>

      {/* Kalau kelompok kosong, tampilkan pesan supaya Barista tahu itu bukan
          kegagalan pemuatan. */}
      {jumlah === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
          {teksBarista.kelompok.kosong}
        </p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}
