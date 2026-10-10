// File ini: logika editor resep (tambah, hapus, ubah takaran) dalam bentuk MURNI.
//
// Kenapa dipisah dari komponen: aturan-aturan ini adalah keputusan layar yang
// mudah salah, dan jauh lebih mudah diuji di sini daripada lewat klik di
// browser. Semua operasi mengembalikan daftar BARU (tidak mengubah daftar yang
// diberikan), supaya React bisa diberi tahu perubahannya.
//
// Aturan mengikuti docs/api-contract.md bagian 4b: 0 sampai 20 baris, bahan tidak
// boleh ganda, dan qtyPerPortion lebih dari 0.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

import type { BarisResepTampil } from "@/lib/server/petakan-admin";

// Maksimal baris resep (docs/api-contract.md bagian 4b).
export const MAKSIMAL_BARIS = 20;

// Hasil satu operasi: daftar baris yang sudah diperbarui.
export type HasilOperasi = BarisResepTampil[];

/**
 * Menambah satu bahan ke daftar resep.
 *
 * Input:
 *   - daftar: baris resep sekarang,
 *   - bahan: bahan yang akan ditambahkan (id, nama, satuan).
 * Output: daftar baris yang baru.
 *
 * Aturan:
 *   - bahan yang sudah ada di resep TIDAK ditambah lagi (cegah bahan ganda),
 *   - daftar tidak boleh melebihi 20 baris.
 *
 * Kalau bahan sudah dipakai atau daftar penuh, daftar dikembalikan apa adanya.
 * Pemanggil tidak perlu memeriksa dulu; cukup melihat hasilnya tidak berubah.
 * (Pemanggil tetap perlu menampilkan pesan, itu urusannya.)
 */
export function tambahBarisResep(
  daftar: HasilOperasi,
  bahan: BarisResepTampil,
): HasilOperasi {
  // Cegah bahan ganda: satu bahan hanya boleh muncul sekali di resep.
  if (sudahDipakai(daftar, bahan.ingredientId)) {
    return daftar;
  }

  // Batas 20 baris.
  if (daftar.length >= MAKSIMAL_BARIS) {
    return daftar;
  }

  // Takaran default saat ditambahkan. Admin masih boleh mengubahnya.
  // Default 1 adalah nilai yang wajar untuk satuå•ä½å’Œ dan tidak nol (takaran 0
  // tidak masuk akal karena berarti bahan tidak dipakai).
  return [
    ...daftar,
    {
      ingredientId: bahan.ingredientId,
      ingredientName: bahan.ingredientName,
      unit: bahan.unit,
      qtyPerPortion: 1,
    },
  ];
}

/**
 * Menghapus satu baris resep.
 *
 * Input: daftar baris resep, dan ingredientId baris yang akan dihapus.
 * Output: daftar baris yang baru.
 *
 * Baris yang tidak ada tidak membuat error: daftar dikembalikan apa adanya.
 */
export function hapusBarisResep(
  daftar: HasilOperasi,
  ingredientId: string,
): HasilOperasi {
  return daftar.filter((satu) => satu.ingredientId !== ingredientId);
}

/**
 * Mengubah takaran satu baris resep.
 *
 * Input: daftar baris resep, ingredientId baris yang diubah, dan takaran baru.
 * Output: daftar baris yang baru.
 *
 * Takaran baru sudah berupa angka (hasil takaranJadiAngka di file takaran.ts).
 * Kalau barisnya tidak ada, daftar dikembalikan apa adanya.
 */
export function ubahTakaranBaris(
  daftar: HasilOperasi,
  ingredientId: string,
  takaranBaru: number,
): HasilOperasi {
  return daftar.map((satu) => {
    if (satu.ingredientId !== ingredientId) {
      return satu;
    }
    return { ...satu, qtyPerPortion: takaranBaru };
  });
}

/**
 * Memeriksa apakah suatu bahan sudah dipakai di resep.
 *
 * Input: daftar baris resep, dan ingredientId yang dicari.
 * Output: true kalau bahan itu sudah ada di daftar.
 *
 * Dipakai juga untuk menyaring daftar pilihan bahan: bahan yang sudah dipakai
 * tidak boleh dipilih lagi.
 */
export function sudahDipakai(
  daftar: HasilOperasi,
  ingredientId: string,
): boolean {
  return daftar.some((satu) => satu.ingredientId === ingredientId);
}

/**
 * Menyaring daftar bahan menjadi bahan yang belum dipakai di resep.
 *
 * Input: semua bahan dari GET /api/admin/ingredients, dan baris resep sekarang.
 * Output: bahan yang belum dipakai di resep (boleh ditambahkan).
 *
 * Dipakai supaya pilihan "Tambah bahan" tidak menampilkan bahan yang sudah ada
 * di resep: kalau tidak, Admin bisa menambah bahan yang sama dua kali.
 */
export function bahanBelumDipakai<T extends { ingredientId: string }>(
  semuaBahan: T[],
  daftar: HasilOperasi,
): T[] {
  return semuaBahan.filter(
    (satu) =>
      !daftar.some((satuResep) => satuResep.ingredientId === satu.ingredientId),
  );
}

/**
 * Memeriksa apakah daftar resep sudah mencapai batas 20 baris.
 *
 * Input: daftar baris resep.
 * Output: true kalau sudah 20 baris atau lebih (sudah penuh).
 */
export function resepsPenuh(daftar: HasilOperasi): boolean {
  return daftar.length >= MAKSIMAL_BARIS;
}

/**
 * Memeriksa apakah daftar resep masih bisa ditambah.
 *
 * Input: daftar baris resep.
 * Output: true kalau masih ada tempat (kurang dari 20 baris).
 */
export function masihBisaTambah(daftar: HasilOperasi): boolean {
  return daftar.length < MAKSIMAL_BARIS;
}

/**
 * Membandingkan dua daftar resep: apakah isinya sama?
 *
 * Input: dua daftar baris resep.
 * Output: true kalau keduanya berisi bahan dan takaran yang sama persis, dengan
 *         urutan yang sama.
 *
 * Ini dipakai untuk mendeteksi "ada perubahan belum disimpan". Urutan ikut
 * dibandingkan karena Admin yang menyusun ulang baris memang mengubah resepnya.
 *
 * Cara membandingkan: jumlah baris harus sama, lalu tiap baris di posisi yang
 * sama harus punya ingredientId dan qtyPerPortion yang sama. Perbandingan
 * qtyPerPortion memakai ===, jadi nilainya harus benar-benar sama.
 */
export function resepSama(
  daftarSatu: HasilOperasi,
  daftarDua: HasilOperasi,
): boolean {
  if (daftarSatu.length !== daftarDua.length) {
    return false;
  }

  for (let index = 0; index < daftarSatu.length; index += 1) {
    const barisSatu = daftarSatu[index];
    const barisDua = daftarDua[index];

    if (
      barisSatu.ingredientId !== barisDua.ingredientId ||
      barisSatu.qtyPerPortion !== barisDua.qtyPerPortion
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Memeriksa apakah daftar resep sudah BERUBAH dari daftar aslinya.
 *
 * Input: daftar sekarang, dan daftar asal (yang tersimpan di server).
 * Output: true kalau ada perubahan yang belum disimpan.
 *
 * Ini yang dipakai untuk mengaktifkan tombol "Simpan resep" dan untuk
 * menampilkan penanda "ada perubahan belum disimpan".
 */
export function adaPerubahan(
  daftarSekarang: HasilOperasi,
  daftarAsli: HasilOperasi,
): boolean {
  return !resepSama(daftarSekarang, daftarAsli);
}
