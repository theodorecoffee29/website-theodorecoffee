// File ini: mengubah pesanan dari server menjadi bentuk final yang masuk ke
// komponen tampilan Barista.
//
// Kenapa file ini ada: layar Barista DILARANG memuat harga, total, atau data
// pembayaran (docs/pemissions.md bagian 2). Server sudah menyaringnya
// (src/lib/server/petakan-antrean.ts), tapi lapisan kedua di sisi klien
// memastikan hook Barista TIDAK PERNAH mengirim field harga atau pembayaran ke
// komponen.
//
// File ini MURNI (tanpa React dan tanpa API), jadi mudah diuji.

// Bentuk pesanan yang masuk ke komponen Barista.
//
// Field di sini adalah FIELD FINAL: kalau sebuah field tidak ada di tipe ini,
// komponen tidak bisa menampilkannya. Perhatikan tidak ada total, price,
// subtotal, maupun payment.
export type PesananUntukTampil = {
  orderId: string;
  // Nomor antrean, ditampilkan besar supaya mudah dibaca.
  queueNumber: number;
  customerName: string;
  items: {
    name: string;
    qty: number;
    note: string | null;
  }[];
  // Teks status untuk Barista: "Baru masuk" atau "Sedang dikerjakan".
  teksStatus: string;
  // Status mentah, dipakai untuk menentukan tombol mana yang tampil
  // ("antrean" -> Mulai, "digerjakan" -> Selesai).
  status: string;
};

// Bentuk pesanan dari server (isi field boleh lebih banyak dari yang dipakai).
type PesananDariServer = {
  orderId: string;
  queueNumber: number;
  customerName: string;
  items: {
    name: string;
    qty: number;
    note: string | null;
  }[];
  status: string;
};

/**
 * Mengubah daftar pesanan dari server menjadi daftar pesanan untuk tampilan.
 *
 * Input: pesanan dari server (hasil petakan-anterrean.ts).
 * Output: PesananUntukTampil.
 *
 * Fungsi ini membangun objek BARU dan hanya menyalin field yang boleh tampil.
 * Field lain yang mungkin ada di data server (mis. total atau payment, kalau
 * suatu saat server berubah) TIDAK ikut karena tidak disebut di sini.
 */
export function siapkanUntukTampil(
  pesanan: PesananDariServer[],
  pemetaStatus: (status: string) => string,
): PesananUntukTampil[] {
  return pesanan.map((satu) => ({
    orderId: satu.orderId,
    queueNumber: satu.queueNumber,
    customerName: satu.customerName,
    items: satu.items.map((satuItem) => ({
      name: satuItem.name,
      qty: satuItem.qty,
      note: satuItem.note,
    })),
    teksStatus: pemetaStatus(satu.status),
    status: satu.status,
  }));
}
