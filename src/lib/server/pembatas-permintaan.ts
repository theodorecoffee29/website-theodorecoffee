// File ini: pembatas jumlah permintaan (rate limit) untuk endpoint yang bisa
// dipanggil anonim, supaya satu orang tidak bisa membanjiri server dengan order
// palsu atau permintaan status.
//
// KETERBATASAN YANG PERLU DIKETAHUI:
// Penyimpanan penghitung di sini memakai MEMORI instance Node.js. Itu cukup
// untuk satu instance (misalnya saat development, atau satu server Vercel).
// Kalau aplikasi nanti berjalan di BANYAK instance, setiap instance punya
// penghitungnya sendiri, sehingga batas sebenarnya menjadi "batas x jumlah
// instance" dan tidak akurat. Setelah itu, bagian penyimpanan di file ini yang
// perlu diganti (misalnya ke tabel di database atau Redis), bukan cara pakainya.

export type HasilPembatas = {
  // True kalau permintaan ini BOLEH lewat.
  boleh: boolean;
  // Sisa jumlah permintaan yang masih boleh dalam periode ini.
  sisa: number;
};

// Berapa kali satu alamat IP boleh meminta dalam satu periode untuk endpoint
// yang biasanya tidak sering dipanggil (misalnya membuat order).
const BATASAN_PERIODE = 10;

// Berapa lama satu periode berlangsung, dalam milidetik.
const DURASI_PERIODE_MS = 60 * 1000;

// Satu catatan penghitung untuk satu alamat IP.
type CatatanPembatas = {
  // Kapan periode ini dimulai (waktu dari argumen sekarangMs).
  mulai: number;
  // Berapa kali sudah dipakai dalam periode ini.
  jumlah: number;
};

// Penyimpanan penghitung, memakai alamat IP sebagai kunci.
const catatanPembatas = new Map<string, CatatanPembatas>();

/**
 * Memeriksa dan menambah penghitung untuk satu alamat IP.
 *
 * Input:
 *   - kunci: identitas yang dihitung, biasanya alamat IP. Boleh ditambah nama
 *     endpoint supaya setiap endpoint punya penghitung sendiri (lihat catatan
 *     di bawah).
 *   - sekarangMs: waktu sekarang dalam milidetik. Bawaan: Date.now().
 *   - batas: berapa kali boleh dalam satu periode. Bawaan: BATASAN_PERIODE.
 * Output: HasilPembatas. "boleh" bernilai true kalau masih di bawah batas.
 *
 * Cara kerja:
 *   1. Kalau kunci ini belum pernah tercatat, atau periodenya sudah lewat,
 *      penghitung direset dan permintaan ini dihitung sebagai yang pertama.
 *   2. Kalau masih dalam periode dan belum mencapai batas, jumlah dinaikkan.
 *   3. Kalau sudah mencapai batas, permintaan ditolak dan jumlah tidak
 *      dinaikkan, supaya batasnya tidak ikut bergeser.
 *
 * PENTING: setiap endpoint sebaiknya memakai kunci sendiri, misalnya
 * "buat-order:" + ip. Kalau semuanya memakai ip saja, orang yang berada di
 * halaman status (polling tiap 5 detik) bisa menghabiskan kuota orang lain yang
 * sedang membuat order. Alasannya, kebutuhan tiap endpoint berbeda.
 */
export function periksaPembatas(
  kunci: string,
  sekarangMs: number = Date.now(),
  batas: number = BATASAN_PERIODE,
): HasilPembatas {
  const catatanLama = catatanPembatas.get(kunci);

  // Mulai periode baru kalau belum pernah tercatat atau periode sebelumnya
  // sudah lewat. Perbandingan "sudah lewat" juga menangani waktu yang tidak
  // maju sama sekali (nilai sama), yang dianggap sudah habis.
  const perluReset =
    !catatanLama || sekarangMs - catatanLama.mulai >= DURASI_PERIODE_MS;

  if (perluReset) {
    catatanPembatas.set(kunci, { mulai: sekarangMs, jumlah: 1 });
    return { boleh: true, sisa: batas - 1 };
  }

  // Sudah mencapai batas periode ini: tolak.
  if (catatanLama.jumlah >= batas) {
    return { boleh: false, sisa: 0 };
  }

  catatanLama.jumlah += 1;
  return { boleh: true, sisa: batas - catatanLama.jumlah };
}

/**
 * Mengosongkan semua penghitung.
 * Hanya dipakai oleh tes supaya setiap tes mulai dari kondisi bersih.
 * Fungsi ini tidak dipanggil oleh aplikasi.
 */
export function kosongkanPembatas(): void {
  catatanPembatas.clear();
}

/**
 * Batas permintaan per endpoint, dalam permintaan per menit per alamat IP.
 *
 * Kenapa tiap endpoint punya batas sendiri: kebutuhannya berbeda. Halaman status
 * dipanggil berulang (polling tiap 5 detik, sekitar 12 kali per menit), jadi
 * batasnya dibuat lebih longgar. Sebaliknya membuat order dan membatalkan order
 * adalah aksi yang jarang, jadi dibatasi ketat supaya tidak dipakai untuk
 * membanjiri server.
 *
 * Angka ini masih bisa diubah; api-contract.md bagian 7 menyebut angkanya
 * ditentukan saat implementasi.
 */
export const BATASAN_ENDPOINT = {
  // Melihat menu: sering dibuka, jadi longgar.
  menu: 60,
  // Membuat order: jarang, dan harus dibatasi ketat.
  buatOrder: 10,
  // Melihat status: polling 5 detik jadi sekitar 12 per menit; batas 60 memberi
  // ruang untuk beberapa tab terbuka tanpa ikut kena RATE_LIMITED.
  statusOrder: 60,
  // Membatalkan order: jarang.
  batalkanOrder: 20,
  // Mengirim error dari browser: batas paling ketat, karena bukan aksi bisnis
  // dan tidak boleh membanjiri tabel error_logs.
  logError: 10,
} as const;

/**
 * Mengembalikan angka batas dan durasi periode.
 * Dipakai tes supaya angka yang sama tidak ditulis dua kali di tempat berbeda.
 */
export function aturanPembatas(): { batas: number; durasiMs: number } {
  return { batas: BATASAN_PERIODE, durasiMs: DURASI_PERIODE_MS };
}
