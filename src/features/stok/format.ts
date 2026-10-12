// File ini: mengubah angka stok menjadi teks yang enak dibaca orang Indonesia.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.
//
// Kenapa perlu: angka stok bisa mencapai ribuan (mis. 12500 gram). Kalau
// ditulis apa adanya jadi "12500", sulit dibaca sekilas di layar Cashier yang
// sudah padat. Dalam kebiasaan Indonesia, ribuan dipisah dengan titik dan
// desimal dengan koma: "12.500" dan "1,25".

/**
 * Mengubah angka stok menjadi teks dengan pemisah ribuan titik dan desimal koma.
 *
 * Input: angka apa pun (termasuk yang berasal dari database sebagai teks).
 * Output: teks yang enak dibaca, mis. 12500 -> "12.500" dan 1.25 -> "1,25".
 *
 * Angka desimal dibulatkan ke tiga angka di belakang koma, sama dengan batas
 * kolom numeric(12,3) di database (docs/data-model.md aturan 11). Tanpa
 * pembulatan, angka seperti 0.30000000000000004 akan tampil dengan semua
 * desimalnya dan terlihat seperti kerusakan.
 */
export function formatStokIndonesia(nilai: number): string {
  // Angka yang tidak valid (NaN, Infinity) ditulis sebagai 0 supaya tampilan
  // tidak menampilkan "NaN" yang membingungkan.
  if (!Number.isFinite(nilai)) {
    return "0";
  }

  // Locale id-ID sudah memakai konvensi Indonesia: titik untuk ribuan dan koma
  // untuk desimal (12500 -> "12.500", 1.25 -> "1,25").
  //
  // Penting: jangan memakai locale en-US lalu menukar karakternya secara manual.
  // Pertukaran seperti itu mudah salah (mis. menukar titik desimal jadi koma
  // sebelum ribuan, sehingga 12.500 jadi 12,500). Memakai locale yang memang
  // benar lebih aman dan lebih pendek.
  return nilai.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}
