// File ini: mengubah baris order dari database menjadi bentuk yang boleh
// dikirim ke layar Barista.
//
// Kenapa file ini terpisah dan tidak langsung mengirim hasil query: layar
// Barista DILARANG memuat harga, total, atau data pembayaran
// (docs/pemissions.md bagian 2: "Layar Barista hanya menampilkan nomor antrean,
// nama customer, item + jumlah, dan catatan"). Kalau kita langsung mengirim
// objek dari database, satu kolom yang terlewat bisa membocorkan harga ke layar
// Barista. Karena itu fungsi ini MEMBANGUN objek baru dan hanya memilih field
// yang boleh tampil. Field lain otomatis tidak ikut, seandainya ada.
//
// File ini MURNI (tanpa database), jadi bisa diuji langsung.

// Bentuk satu baris order seperti yang dibaca dari database.
//
// order_items dibiarkan bertipe unknown karena isinya datang dari database dan
// bentuknya bisa berbeda-beda. Fungsi pemeta yang mengeceknya, bukan tipe ini.
export type BarisOrderAntrean = {
  id: string;
  queue_number: number;
  customer_name: string;
  status: string;
  order_items: unknown;
  // Kolom lain dari database (misalnya total atau payments) sengaja DITOLERI
  // di tipe ini, jadi tipe ini menyatakan apa yang DIPAKAI, bukan apa yang ada.
  // Index signature ini membolehkan kolom tambahan tetap ikut terbawa di tes,
  // supaya kita bisa membuktikan pemeta tetap membuang kolom harga.
  [kolomLain: string]: unknown;
};

// Bentuk item di antrean Barista: hanya nama, jumlah, dan catatan.
export type ItemAntreanBarista = {
  name: string;
  qty: number;
  note: string | null;
};

// Bentuk satu order di antrean Barista. Sengaja tidak ada field harga, total,
// maupun pembayaran di sini.
export type OrderAntreanBarista = {
  orderId: string;
  queueNumber: number;
  customerName: string;
  items: ItemAntreanBarista[];
  status: string;
};

/**
 * Mengubah daftar baris order menjadi daftar order untuk layar Barista.
 *
 * Input: baris order dari database (sudah diurutkan dari yang paling lama).
 * Output: daftar order yang hanya berisi field yang boleh dilihat Barista.
 *
 * Cara kerja: setiap baris diubah menjadi objek baru. Field harga, total,
 * dan pembayaran tidak pernah ikut karena tidak disebut di sini.
 */
export function petakanAntreanBarista(
  baris: BarisOrderAntrean[],
): OrderAntreanBarista[] {
  return baris.map((satuBaris) => ({
    orderId: satuBaris.id,
    queueNumber: satuBaris.queue_number,
    customerName: satuBaris.customer_name,
    items: petakanItem(satuBaris.order_items),
    status: satuBaris.status,
  }));
}

/**
 * Mengubah isi kolom order_items menjadi daftar item untuk Barista.
 *
 * Input: hasil baca kolom order_items dari database.
 * Output: daftar { name, qty, note }.
 *
 * Kenapa memeriksa bentuknya: kolom order_items bisa berupa array berisi objek,
 * tapi kalau isinya tidak sesuai, kita lebih ingin mengirim daftar kosong
 * daripada membuat halaman error.
 */
function petakanItem(orderItems: unknown): ItemAntreanBarista[] {
  // Kalau bukan array, tidak ada item yang bisa ditampilkan.
  if (!Array.isArray(orderItems)) {
    return [];
  }

  const hasil: ItemAntreanBarista[] = [];

  for (const satuItem of orderItems) {
    // Lewati entri yang bukan objek.
    if (satuItem === null || typeof satuItem !== "object") {
      continue;
    }

    // Ambil field yang boleh ditampilkan. Perhatikan: price_snapshot dan
    // subtotal sengaja TIDAK diambil.
    const kolom = satuItem as Record<string, unknown>;

    // name_snapshot dipakai karena itu nama menu SAAT dipesan (docs/data-model.md),
    // jadi walau menu nanti diubah, nama di antrean tetap sama seperti di order.
    const name = kolom.name_snapshot;
    if (typeof name !== "string") {
      continue;
    }

    const qty = kolom.qty;
    if (typeof qty !== "number") {
      continue;
    }

    const note = kolom.note;
    hasil.push({
      name: name,
      qty: qty,
      note: typeof note === "string" ? note : null,
    });
  }

  return hasil;
}
