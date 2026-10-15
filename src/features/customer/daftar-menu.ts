// File ini: logika gabungan antara daftar menu dari server dan isian pengguna
// di form pesan customer.
//
// Kenapa file ini ada: daftar menu dimuat ulang otomatis tiap 30 detik
// (docs/api-contract.md bagian 5). Saat daftar berubah, isian yang sudah
// diketik pengguna (jumlah dan catatan) TIDAK boleh hilang. Istilah "gabungan"
// dipakai di sini untuk menyebut proses menempelkan isian pengguna ke daftar
// menu yang baru.
//
// File ini MURNI (tanpa server, tanpa React, tanpa browser), jadi bisa diuji
// langsung.

// Bentuk menu yang dibutuhkan file ini saja. Sengaja tidak mengimpor tipe dari
// api.ts supaya file ini benar-benar bebas dari apa pun di luar dirinya.
export type MenuRingkas = {
  id: string;
  name: string;
  price: number;
  available: boolean;
};

// Isian pengguna per menu, disimpan sebagai teks apa yang diketik di layar.
export type IsiBaris = Record<string, { qty: string; note: string }>;

// Satu baris yang ditampilkan di form pesan.
export type BarisPesananTampil = {
  menuItemId: string;
  // Nama dan harga menunya. Null kalau menu ini tidak ada lagi di daftar dari
  // server (mis. Admin menonaktifkannya).
  nama: string | null;
  harga: number | null;
  // Isian pengguna, tetap berupa teks.
  qty: string;
  note: string;
  // True kalau menu masih ada dan tidak Habis, jadi boleh dipesan.
  tersedia: boolean;
};

/**
 * Menempelkan isian pengguna ke daftar menu yang baru dimuat.
 *
 * Input: daftar menu terbaru dari server dan isian pengguna yang sudah ada.
 * Output: daftar baris yang siap ditampilkan, satu baris per menu.
 *
 * Cara kerja:
 *   1. Setiap menu dari server jadi satu baris. Isian pengguna untuk menu itu
 *      ikut diambil kalau ada (tidak dihapus kalau daftar menu berubah).
 *   2. Menu yang TIDAK ada lagi di daftar (dinonaktifkan) tapi masih punya
 *      isian pengguna tetap dibuatkan barisnya dengan tersedia = false. Isian
 *      pengguna tidak boleh hilang diam-diam; pengguna yang memutuskan
 *      menghapus baris atau mengosongkan jumlahnya.
 *   3. Baris menu yang hilang diletakkan di paling akhir supaya daftar yang
 *      normal tetap urutannya.
 */
export function susunBarisPesanan(
  daftarMenu: MenuRingkas[],
  isiBaris: IsiBaris,
): BarisPesananTampil[] {
  const baris: BarisPesananTampil[] = [];
  const idSudahDitampilkan = new Set<string>();

  for (const satuMenu of daftarMenu) {
    idSudahDitampilkan.add(satuMenu.id);
    const isi = isiBaris[satuMenu.id];

    baris.push({
      menuItemId: satuMenu.id,
      nama: satuMenu.name,
      harga: satuMenu.price,
      qty: isi?.qty ?? "",
      note: isi?.note ?? "",
      tersedia: satuMenu.available,
    });
  }

  // Menu yang hilang dari daftar tapi isiannya masih ada.
  for (const [menuItemId, isi] of Object.entries(isiBaris)) {
    if (idSudahDitampilkan.has(menuItemId)) {
      continue;
    }

    baris.push({
      menuItemId: menuItemId,
      nama: null,
      harga: null,
      qty: isi.qty,
      note: isi.note,
      // Menu tidak ada di daftar server, jadi dianggap tidak tersedia.
      tersedia: false,
    });
  }

  return baris;
}

/**
 * Memeriksa apakah satu baris benar-benar dipilih (jumlahnya lebih dari 0).
 *
 * Input: satu baris pesanan.
 * Output: true kalau qty-nya angka lebih besar dari 0.
 *
 * Kenapa perlu: baris dengan jumlah kosong atau 0 tidak ikut dikirim ke server,
 * jadi tidak boleh ikut memblokir tombol kirim.
 */
export function barisDipilih(baris: BarisPesananTampil): boolean {
  const qty = Number(baris.qty.trim());
  return Number.isFinite(qty) && qty > 0;
}

/**
 * Mencari baris yang dipilih tapi menunya sudah tidak tersedia.
 *
 * Input: daftar baris pesanan.
 * Output: baris-baris bermasalah (menu Habis atau tidak ada lagi).
 *
 * Dipakai untuk: (1) menandai baris "Tidak tersedia", (2) mematikan tombol
 * kirim, karena server pasti menolak dengan MENU_UNAVAILABLE kalau baris ini
 * ikut terkirim (docs/api-contract.md bagian 6).
 */
export function barisTidakTersediaTerpilih(
  baris: BarisPesananTampil[],
): BarisPesananTampil[] {
  return baris.filter(
    (satuBaris) => satuBaris.tersedia === false && barisDipilih(satuBaris),
  );
}

/**
 * Membuat sidik jari isi pesanan, yaitu teks ringkas yang mewakili nama dan
 * semua isian pengguna.
 *
 * Input: nama customer dan isian baris.
 * Output: teks sidik jari (JSON dengan urutan item yang sudah diurutkan).
 *
 * Kenapa perlu: idempotencyKey hanya boleh dipakai ulang kalau isi pesanan
 * sama persis. Kalau isi pesanan berubah, kunci yang lama harus diganti, supaya
 * tidak ada dua order berbeda yang memakai satu kunci.
 *
 * Urutan item sengaja disamakan (diurutkan menurut menuItemId) supaya urutan
 * baris di layar tidak ikut_memengaruhi kunci.
 */
export function sidikJariPesanan(
  nama: string,
  baris: BarisPesananTampil[],
): string {
  const itemDipakai = baris
    .filter((satuBaris) => barisDipilih(satuBaris))
    .map((satuBaris) => ({
      menuItemId: satuBaris.menuItemId,
      qty: satuBaris.qty.trim(),
      note: satuBaris.note.trim(),
    }))
    .sort((satu, dua) => satu.menuItemId.localeCompare(dua.menuItemId));

  return JSON.stringify({
    nama: nama.trim(),
    items: itemDipakai,
  });
}
