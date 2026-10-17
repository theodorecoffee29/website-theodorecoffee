// File ini: membuat dan membaca "cursor" (penanda lanjutan) untuk halaman log.
//
// KONSEP CURSOR (dijelaskan sekali di sini):
//   Halaman log bisa berisi ribuan baris, jadi tidak semua dikirim sekaligus.
//   Server mengirim 50 baris pertama PLUS satu penanda yang menunjuk ke baris
//   terakhir yang dikirim. Saat Admin menekan "Muat lebih banyak", browser
//   mengirim penanda itu kembali, dan server mengambil 50 baris SETELAH penanda
//   itu. Jadi penanda cukup satu kalimat pendek, bukan nomor halaman yang rapuh
//   (kalau ada baris baru yang masuk di tengah, nomor halaman bisa melompat dan
//   satu baris terlewat atau tampil dua kali).
//
// KENAPA CURSOR BERISI DUA BUKAN SATU:
//   Penandanya (at, id), bukan cuma waktu. Alasannya, beberapa baris bisa punya
//   waktu yang sama persis (mis. satu order yang konfirmasi, mencatat pembayaran,
//   dan mengurangi stok dalam satu transaksi, jadi ketiganya bertimestamp
//   identik). Kalau hanya memakai waktu, baris-baris dengan waktu sama itu bisa
//   terlewat atau tampil dua kali. Dengan memakai (waktu, id), setiap baris punya
//   posisi yang pasti dan tidak pernah berubah.
//
// File ini MURNI (tanpa database, tanpa React), jadi bisa diuji langsung.

// Batas panjang cursor yang diterima. Cursor yang dibuat file ini cuma beberapa
// puluh karakter; batas ini hanya supaya request berisi string raksasa tidak ikut
// diurai.
export const MAKSIMAL_CURSOR = 300;

// Bentuk satu cursor setelah dibaca.
export type Cursor = {
  // Waktu baris terakhir yang sudah dikirim, format timestamptz database.
  at: string;
  // Id baris terakhir yang sudah dikirim.
  id: string;
};

// Arah pengurutan halaman log.
export type ArahUrut = "terbaru" | "terlama";

/**
 * Membuat cursor dari waktu dan id baris terakhir yang dikirim.
 *
 * Input:
 *   - at: waktu baris terakhir (timestamptz database).
 *   - id: id baris terakhir (uuid).
 * Output: cursor sebagai teks siap dikirim di query string.
 *
 * Cara kerja: kedua nilai digabung jadi JSON, lalu diubah ke base64url.
 *
 * KENAPA base64url: base64 biasa mengandung karakter "+", "/", dan "=", yang
 * bermasalah di dalam query string (harus di-encode lagi). base64url memakai hanya
 * huruf, angka, "-" dan "_", jadi bisa langsung ditaruh di alamat tanpa encode.
 *
 * Kenapa JSON dan bukan "waktu|id": supaya pemisahnya tidak pernah ambigu, dan
 * menambah field baru nanti tidak mengubah format yang sudah tersimpan di browser.
 */
export function buatCursor(at: string, id: string): string {
  const isi = JSON.stringify({ at: at, id: id });

  return Buffer.from(isi, "utf8").toString("base64url");
}

/**
 * Membaca cursor dari teks yang datang di query string.
 *
 * Input: teks cursor dari query string (boleh tidak ada atau string kosong).
 * Output: { at, id } kalau cursor-nya benar, atau null kalau tidak ada, rusak, atau
 *         bukan bentuk yang punya file ini.
 *
 * KENAPA CURSOR RUSAK DIPERLAKUKAN PALING AMAN (DIJADIKAN "TIDAK ADA"):
 *   Cursor datang dari browser, jadi isinya tidak bisa dipercaya. Cursor yang rusak
 *   TIDAK boleh membuat permintaan gagal dengan error 500, karena itu akan membuat
 *   halaman log tidak bisa dibuka sama sekali. Cursor yang tidak terbaca
 *   diperlakukan sama seperti tidak ada cursor: server mengirim halaman paling awal.
 *   Efeknya Admin melihat halaman pertama lagi, bukan kehilangan data.
 */
export function bacaCursor(teks: string | null | undefined): Cursor | null {
  if (teks === null || teks === undefined) {
    return null;
  }

  const dipangkas = teks.trim();
  if (dipangkas === "" || dipangkas.length > MAKSIMAL_CURSOR) {
    return null;
  }

  // base64url dibaca dengan "base64url" supaya "+" dan "/" tidak muncul.
  let isiTeks: string;
  try {
    isiTeks = Buffer.from(dipangkas, "base64url").toString("utf8");
  } catch {
    // Teksnya bukan base64 yang valid.
    return null;
  }

  // Isinya harus bisa diubah jadi JSON.
  let isi: unknown;
  try {
    isi = JSON.parse(isiTeks);
  } catch {
    return null;
  }

  if (isi === null || typeof isi !== "object" || Array.isArray(isi)) {
    return null;
  }

  const kolom = isi as Record<string, unknown>;
  if (typeof kolom.at !== "string" || kolom.at === "") {
    return null;
  }
  if (typeof kolom.id !== "string" || kolom.id === "") {
    return null;
  }

  // Waktu harus benar-benar bisa dibaca sebagai waktu. Kalau tidak, filter lanjutan
  // yang dibuat dari cursor ini akan salah, dan Admin bisa melihat halaman yang sama
  // berulang kali.
  const waktu = new Date(kolom.at);
  if (Number.isNaN(waktu.getTime())) {
    return null;
  }

  return { at: kolom.at, id: kolom.id };
}

/**
 * Membangun satu nilai untuk .or() dari syarat-syarat yang harus berlaku BERSAMAAN
 * (AND) di dalam masing-masing kelompok, dan ANTAR kelompok harus BERLAKAN
 * (OR).
 *
 * Input:
 *   - kelompok: daftar syarat AND. Setiap elemen adalah daftar syarat atas satu
 *     kolom, mis. ["order_id.eq.ABC"].
 *   - cursor: cursor baris terakhir yang sudah dikirim, atau null.
 *   - arah: "terbaru" (baru ke lama, halaman bawaan) atau "terlama" (lama ke baru,
 *           dipakai saat Admin menelusuri satu order).
 * Output: teks untuk .or(), atau null kalau tidak ada satu pun syarat.
 *
 * KENAPA SEMUA SYARAT HARUS DIGABUNG KE SATU .or() (BUKAN LEBIH DARI SATU PANGGILAN):
 *   supabase-js hanya punya SATU parameter query or=. Kalau .or() dipanggil dua
 *   kali, panggilan kedua MENGGANTI yang pertama, jadi filter yang ditulis pertama
 *   hilang tanpa jejak. Untuk log, satu filter yang hilang berarti Admin melihat
 *   daftar yang bukan yang dia minta, dan itu lebih buruk daripada error yang terlihat.
 *
 * KENAPA KALAU Cursor DAN SYARAT LAINNYA BERSAMAAN, SYARATNYA DIBAGIKAN (DISTRIBUSI):
 *   Yang benar adalah: (A atau B) DAN cursor. Tapi PostgREST hanya bisa menulis OR di
 *   tingkat paling atas, sehingga (A atau B) DAN cursor harus ditulis ulang sebagai
 *   (A DAN cursor) atau (B DAN cursor). Aturan matematika untuk ini:
 *     (A atau B) dan C  sama dengan  (A dan C) atau (B dan C)
 *   Karena itu setiap kelompok syarat dikalikan dengan setiap syarat cursor.
 *
 * Contoh bentuk yang dihasilkan (arah "terbaru", syarat order_id = ABC):
 *   and(order_id.eq.ABC,at.lt.2026-10-11T10:00:00+07:00),
 *   and(order_id.eq.ABC,at.eq.2026-10-11T10:00:00+07:00,id.lt.XYZ)
 */
export function filterAtau(
  kelompok: string[][],
  cursor: Cursor | null,
  arah: ArahUrut,
): string | null {
  // lt = "less than" (lebih kecil), gt = "greater than" (lebih besar).
  const pembanding = arah === "terbaru" ? "lt" : "gt";

  // Syarat cursor dalam bentuk dua kelompok:
  //   1. waktunya SETELAH waktu cursor (dan tidak sama), atau
  //   2. waktunya SAMA dengan waktu cursor, TAPI id-nya lebih kecil (urut id).
  // Kelompok kedua inilah yang memastikan tidak ada baris yang terlewat atau tampil
  // dua kali saat beberapa baris punya waktu yang identik.
  const kelompokCursor: string[][] =
    cursor === null
      ? []
      : [
          ["at." + pembanding + "." + cursor.at],
          ["at.eq." + cursor.at, "id." + pembanding + "." + cursor.id],
        ];

  // Tidak ada cursor: syarat-syarat lain cukup disambung langsung.
  if (kelompokCursor.length === 0) {
    return gabungAtau(kelompok);
  }

  // Tidak ada syarat lain: yang dipakai hanya syarat cursor.
  if (kelompok.length === 0) {
    return gabungAtau(kelompokCursor);
  }

  // Dua-duanya ada: bagikan (lihat penjelasan di kepala fungsi).
  const hasil: string[][] = [];
  for (const satuKelompok of kelompok) {
    for (const satuKelompokCursor of kelompokCursor) {
      hasil.push([...satuKelompok, ...satuKelompokCursor]);
    }
  }

  return gabungAtau(hasil);
}

/**
 * Menggabungkan kelompok-kelompok menjadi teks untuk .or().
 *
 * Input: daftar kelompok syarat (tiap kelompok harus berlaku bersama).
 * Output: teks berisi kelompok yang dipisah koma, atau null kalau tidak ada.
 *
 * Kelompok yang hanya punya satu syarat tidak dibungkus and(), supaya teksnya
 * tetap pendek dan mudah dibaca di log server.
 */
function gabungAtau(kelompok: string[][]): string | null {
  if (kelompok.length === 0) {
    return null;
  }

  const bagian = kelompok.map((satu) =>
    satu.length === 1 ? satu[0] : "and(" + satu.join(",") + ")",
  );

  return bagian.join(",");
}
