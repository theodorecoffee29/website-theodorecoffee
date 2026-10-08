// File ini: pemeriksa apakah sebuah nilai berbentuk uuid yang valid.
//
// Kenapa perlu file terpisah: pemeriksaan ini dipakai di dua sisi sekaligus.
//   1. Di SERVER, SEBELUM memanggil fungsi database yang menerima id order.
//      Id yang bukan uuid langsung dijawab ORDER_NOT_FOUND, tanpa menyentuh
//      database dan tanpa mencatat error (karena itu bukan kegagalan sistem).
//   2. Di BROWSER, SEBELUM menyimpan atau memakai id order yang dikirim server.
//      Kalau (karena bug) server mengirim id yang bukan uuid, id itu tidak boleh
//      sampai tersimpan di localStorage atau dipakai membuka halaman status.
//
// File ini MURNI (tidak memakai browser maupun server), jadi bisa dipakai di
// mana saja dan mudah diuji.

// Pola uuid standar: 8-4-4-4-12 digit heksadesimal.
// Digit ke-13 (awalan kelompok ketiga) adalah nomor versi 1-8, dan digit
// pertama kelompok keempat menandai varian (8, 9, a, atau b). Pola ini sama
// dengan yang dipakai zod (.uuid()), dan cocok dengan hasil crypto.randomUUID()
// di browser maupun gen_random_uuid() dari database.
const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Memeriksa apakah sebuah nilai berbentuk uuid yang valid.
 *
 * Input: nilai apa pun (biasanya teks dari alamat halaman atau localStorage).
 * Output: true kalau nilainya teks dan cocok pola uuid.
 *
 * Kenapa menerima "apa pun" dan bukan hanya teks: nilai yang diperiksa sering
 * datang dari luar, jadi bentuknya belum tentu teks. Nilai yang bukan teks
 * langsung dianggap tidak valid, bukan error.
 */
export function apakahUuidValid(nilai: unknown): nilai is string {
  return typeof nilai === "string" && POLA_UUID.test(nilai);
}
