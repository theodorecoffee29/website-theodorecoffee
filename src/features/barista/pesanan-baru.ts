// File ini: mendeteksi pesanan baru yang muncul di antara dua hasil polling.
//
// Kenapa perlu: halaman Barista mengambil antrean tiap 3 detik
// (docs/api-contract.md bagian 5). Penanda "Pesanan baru: nomor 5" hanya boleh
// muncul untuk pesanan yang MASIH BARU terlihat, bukan untuk semua pesanan yang
// ada saat halaman dibuka. Kalau tidak, spanduk akan muncul setiap kali polling
// menemukan apa pun yang belum "dibaca".
//
// File ini MURNI (tanpa React dan tanpa API), jadi mudah diuji.

// Bentuk minimum pesanan yang dipakai di file ini.
export type PesananPantau = {
  orderId: string;
  queueNumber: number;
  status: string;
};

/**
 * Mencari pesanan yang belum pernah terlihat sebelumnya.
 *
 * Input:
 *   - sebelumnya: daftar pesanan dari hasil polling sebelumnya,
 *   - sekarang: daftar pesanan dari hasil polling yang baru saja diterima,
 *   - sudahPernahMuat: true kalau daftar sebelumnya BUKAN pemuatan pertama.
 * Output: daftar pesanan yang ADA di "sekarang" tapi TIDAK ada di "sebelumnya".
 *
 * Kenapa perlu parameter sudahPernahMuat: daftar kosong belum tentu berarti
 * pemuatan pertama. Kalau polling sempat gagal, daftar sebelumnya bisa kosong
 * sementara halamannya sudah terbuka lama. Tanpa parameter ini, semua pesanan
// akan dianggap baru begitu koneksi pulih, dan spanduk akan menyala terus. Jadi
 * penanda "sudah pernah muat" harus dibawa secara terpisah, bukan disimpulkan
 * dari isi daftar.
 *
 * Kenapa memakai orderId sebagai pembeda: orderId adalah uuid yang unik dan
 * tidak pernah berubah, sedangkan nomor antrean berulang tiap hari.
 */
export function cariPesananBaru(
  sebelumnya: PesananPantau[],
  sekarang: PesananPantau[],
  sudahPernahMuat: boolean,
): PesananPantau[] {
  // Pemuatan pertama: tidak ada penanda apa pun.
  if (!sudahPernahMuat) {
    return [];
  }

  const idYangSudahTerlihat = new Set<string>();
  for (const satu of sebelumnya) {
    idYangSudahTerlihat.add(satu.orderId);
  }

  const hasil: PesananPantau[] = [];
  for (const satu of sekarang) {
    if (!idYangSudahTerlihat.has(satu.orderId)) {
      hasil.push(satu);
    }
  }

  return hasil;
}

/**
 * Menghitung berapa pesanan yang berstatus Baru masuk (antrean).
 *
 * Input: daftar pesanan.
 * Output: jumlahnya.
 *
 * Dipakai untuk judul tab browser, misal "(3) Barista" kalau ada tiga pesanan
 * yang belum dimulai.
 */
export function hitungBaruMasuk(pesanan: PesananPantau[]): number {
  let jumlah = 0;
  for (const satu of pesanan) {
    if (satu.status === "antrean") {
      jumlah += 1;
    }
  }
  return jumlah;
}

/**
 * Menentukan isi spanduk pesanan baru.
 *
 * Input: daftar pesanan baru dari cariPesananBaru (boleh kosong), dan pola
 *        kalimatnya.
 * Output: teks spanduk, atau null kalau tidak ada pesanan baru (artinya
 *         spanduk tidak boleh tampil).
 *
 * Contoh:
 *   satu pesanan baru -> "Pesanan baru: nomor 5"
 *   dua pesanan baru  -> "2 pesanan baru"
 *   tidak ada         -> null
 *
 * Untuk lebih dari satu, dipakai kalimat jamak berisi jumlah saja. Alasannya:
 * daftar antrean bisa panjang, dan menyebut semua nomornya membuat spanduk
 * terpotong di layar laptop yang kecil.
 */
export function teksSpandukBaru(
  pesananBaru: PesananPantau[],
  teks: {
    satu: string;
    banyak: string;
  },
): string | null {
  if (pesananBaru.length === 0) {
    return null;
  }

  if (pesananBaru.length === 1) {
    return teks.satu.replace("{n}", String(pesananBaru[0].queueNumber));
  }

  return teks.banyak.replace("{jumlah}", String(pesananBaru.length));
}
