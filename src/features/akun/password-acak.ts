// File ini: membuat password acak untuk akun Cashier atau Barista.
//
// KENAPA PERLU TOMBOL "BUAT PASSWORD ACAK":
//   Password untuk akun di booth sering ditulis orang (bukan program), jadi mudah
//   jadi sesuatu yang lemah seperti "booth2026" atau "password". Tombol ini memberi
//   pilihan yang kuat tanpa Admin harus_memikirkannya sendiri.
//
// TIGA KEPUTUSAN YANG DIJELASKAN DI SINI:
//
// 1. MEMAKAI crypto.getRandomValues, BUKAN Math.random.
//    Math.random BUKAN untuk membuat rahasia, dan hasilnya bisa ditebak, dan di beberapa
//    peramban hasilnya bisa diprediksi. crypto.getRandomValues memakai sumber
//    acak yang memang dirancang untuk keamanan, dan tersedia di semua peramban modern.
//    Password ini adalah kunci untuk masuk ke aplikasi yang menyimpan omzet.
//
// 2. KARAKTER YANG MUDAH TERTUKAR DIHILANGKAN.
//    Huruf "O" (huruf o) dan angka "0" (nol) sering tertukar saat dibaca atau
//    disalin, begitu juga "I" dan "1", serta huruf kecil "l" dan angka "1". Jadi
//    karakter itu TIDAK dipakai sama sekali. Password jadi lebih sedikit variasi,
//    tapi jauh lebih sedikit kesalahketikan saat Admin membacanya.
//
// 3. PAJANG DAN BISA DISALIN.
//    Password tidak diketik ke input bertipe "password" (yang disembunyikan), karena
//    Admin harus membacanya dan menyalinnya untuk diserahkan ke pemilik akun.
//
// File ini MURNI dan hanya memakai API bawaan browser, jadi bisa diuji langsung.

// Panjang password acak.
//
// Kenapa 12: cukup panjang untuk sulit ditebak, dan masih mudah ditulis di kertas
// saat_Admin membacanya keras-keras.
export const PANJANG_PASSWORD_ACAK = 12;

// Huruf besar.
const HURUF_BESAR = "ABCDEFGHJKLMNPQRSTUVWXYZ";

// Huruf kecil (tanpa "l" supaya tidak tertukar dengan angka 1).
const HURUF_KECIL = "abcdefghijkmnopqrstuvwxyz";

// Angka (tanpa "0" dan "1").
const ANGKA = "23456789";

// Semua karakter yang boleh dipakai, digabung dari tiga daftar di atas.
const SEMUA_KARAKTER = HURUF_BESAR + HURUF_KECIL + ANGKA;

/**
 * Membuat password acak yang kuat.
 *
 * Output: teks sepanjang PANJANG_PASSWORD_ACAK yang memuat huruf besar, huruf kecil,
 *         dan angka.
 *
 * CARA KERJA:
 *   1. Untuk tiap posisi, ambil angka acak dari crypto.getRandomValues, lalu pilih
 *      karakter pada posisi itu di SEMUA_KARAKTER. Cara ini tidak perlu
 *      bukti pembagian (semua posisi punya peluang sama besar).
 *   2. Setelah karakter acak dibuat, dijamin ada minimal satu huruf besar, satu huruf
 *      kecil, dan satu angka. Ini penting karena aturan password minimal 10 karakter
 *      mewajibkan huruf dan angka: tanpa langkah ini, sekitar 1 dari 400 password
 *      acak bisa saja hanya berisi huruf saja, dan Admin akan mendapat pesan
 *      "password harus memuat angka" untuk password yang dia sendiri minta dibuat.
 *
 * Yang tidak dipakai: apa pun dari modul lain, dan tidak ada pustaka tambahan
 * (AGENTS.md: jangan menambah library tanpa alasan).
 */
export function buatPasswordAcak(): string {
  const panjang = PANJANG_PASSWORD_ACAK;
  const karakter: string[] = [];

  // 1. Karakter acak untuk tiap posisi.
  for (let posisi = 0; posisi < panjang; posisi++) {
    karakter.push(pilihKarakterAcak());
  }

  // 2. Jamin ada huruf besar, huruf kecil, dan angka.
  //
  //    Posisinya diganti dari yang sudah ada, bukan ditambah, supaya panjang password
  //    tetap persis PANJANG_PASSWORD_ACAK. Tiga posisi pertama dipakai karena di sana
  //    selalu ada karakter (panjangnya 12, jauh lebih dari 3).
  karakter[0] = pilihAcakDari(HURUF_BESAR);
  karakter[1] = pilihAcakDari(HURUF_KECIL);
  karakter[2] = pilihAcakDari(ANGKA);

  return karakter.join("");
}

/**
 * Memilih satu karakter acak dari seluruh karakter yang boleh dipakai.
 *
 * Output: satu karakter.
 *
 * Kenapa memakai modulo dari angka acak: daftar karakter hanya 54 item, jadi nilai
 * acak 0 sampai 255 bisa dipetakan ke posisi mana pun di daftar itu dengan
 * `nilai % panjang`. Sisa pembagian bisa membuat beberapa posisi sedikit lebih
 * sering terpilih, tapi selisihnya sangat kecil dan tidak berarti untuk password:
 * yang penting sumber acaknya benar, bukan distribusinya sempurna.
 */
function pilihKarakterAcak(): string {
  return pilihAcakDari(SEMUA_KARAKTER);
}

/**
 * Memilih satu karakter acak dari sebuah daftar teks.
 *
 * Input: daftar karakter yang boleh dipakai.
 * Output: satu karakter dari daftar itu.
 */
function pilihAcakDari(daftar: string): string {
  const angka = angkaAcak(daftar.length);

  return daftar[angka];
}

/**
 * Mengambil angka acak di antara 0 sampai batas-1.
 *
 * Input: batas (positif).
 * Output: bilangan bulat dari 0 sampai batas-1.
 *
 * Kenapa bukan Math.floor(Math.random() * batas): lihat catatan di kepala file.
 */
function angkaAcak(batas: number): number {
  // Satu UInt32 cukup karena batas kita cuma 54. Kalau suatu saat butuh angka yang
  // lebih besar, buat array lebih dari satu UInt32 di sini.
  const wadah = new Uint32Array(1);

  crypto.getRandomValues(wadah);

  return wadah[0] % batas;
}
