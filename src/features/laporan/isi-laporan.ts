// File ini: mengubah isi laporan dari server menjadi bentuk yang siap
// ditampilkan di layar.
//
// KENAPA LOGIKA INI DI FILE PISAH: komponen tampilan di src/components/laporan/
// HANYA menerima props dan menampilkannya. Semua yang "menghitung" (menghitung
// ulang jumlah untuk Pencocokan uang, mengubah nominal jadi rupiah, mengubah
// jam jadi WIB, menandai stok minus) harus bisa diuji tanpa browser, jadi
// ditaruh di sini.
//
// BENTUK ISI LAPORAN mengikuti docs/api-contract.md bagian 4c. Server sudah
// mengubah angka yang datang sebagai teks menjadi angka (lihat
// src/lib/server/petikan-laporan.ts), jadi di sini angka tidak perlu diurai
// lagi. Tapi pembacaan tetap ditulis aman terhadap data tak terduga: kalau
// server mengirim bentuk yang tidak diharapkan, halaman Cashier harus tetap
// tampil (dengan angka 0), bukan ikut error.
//
// File ini MURNI (tanpa React, tanpa database, tanpa panggilan API).

import { formatRupiah } from "@/features/admin/menu/format";
import { ALASAN_BATAL, type AlasanBatal } from "@/lib/alasan-batal";
import { teksLaporan } from "./teks";
import {
  formatJumlah,
  jamWib,
  tanggalJamWib,
  tanggalPanjang,
  tanggalPendek,
} from "./waktu";

// ---------------------------------------------------------------------------
// Bentuk hasil untuk tampilan
// ---------------------------------------------------------------------------

// Satu sisi dari kotak Pencocokan uang (Tunai atau QRIS).
export type SisiPencocokan = {
  // Nama metode bayar yang tampil, misal "Tunai".
  label: string;
  // Jumlah order dengan metode ini dalam angka, supaya bisa diuji tanpa teks.
  jumlahOrder: number;
  // Jumlah order dalam teks, misal "12 order".
  jumlahOrderTeks: string;
  // Nominal dalam angka.
  nominal: number;
  // Nominal dalam teks rupiah, misal "Rp 250.000".
  nominalTeks: string;
};

// Kotak Pencocokan uang: dua sisi, Tunai dan QRIS.
export type PencocokanTampil = {
  tunai: SisiPencocokan;
  qris: SisiPencocokan;
};

// Satu asal order di rincian asal order.
export type SumberTampil = {
  label: string;
  jumlahOrder: number;
  jumlahOrderTeks: string;
  nominal: number;
  nominalTeks: string;
};

// Rincian asal order: Online dan Kasir.
export type RincianSumber = {
  online: SumberTampil;
  kasir: SumberTampil;
};

// Satu baris menu terlaris.
export type MenuTerlarisTampil = {
  nama: string;
  porsi: number;
  porsiTeks: string;
  nominal: number;
  nominalTeks: string;
};

// Satu baris pemakaian bahan.
export type BahanTampil = {
  nama: string;
  // Satuan dari database: "g", "ml", atau "pcs".
  satuan: string;
  // Jumlah bahan yang terpakai hari itu, dalam teks.
  terpakaiTeks: string;
  // Sisa bahan di akhir hari itu, dalam teks. Boleh negatif.
  sisaTeks: string;
  // true kalau sisa di bawah 0. Ditandai dengan TULISAN "Minus" supaya tetap
  // terbaca saat dicetak hitam-putih (AGENTS.md aturan 9: stok boleh minus).
  minus: boolean;
};

// Satu item di dalam order.
export type ItemOrderTampil = {
  jumlah: number;
  jumlahTeks: string;
  nama: string;
  // Catatan per item, atau null kalau tidak ada. Satu menu boleh muncul dua kali
  // kalau catatannya berbeda (mis. "less sugar" dan yang biasa).
  catatan: string | null;
};

// Satu baris order di daftar order.
export type OrderTampil = {
  // Kunci untuk React. Dipakai id order kalau ada, kalau tidak dipakai nomor
  // antrean dan posisinya supaya kunci tetap unik.
  kunci: string;
  nomorAntrean: number;
  nama: string;
  // Label asal order: "Online" atau "Kasir".
  asalTeks: string;
  // Label metode bayar: "QRIS" atau "Tunai".
  metodeBayarTeks: string;
  items: ItemOrderTampil[];
  // Nominal order dalam teks rupiah.
  totalTeks: string;
  // Status order dalam teks lengkap, misal "Selesai".
  statusTeks: string;
  // Jam konfirmasi dalam WIB, misal "14:30". String kosong kalau order belum
  // punya jam konfirmasi (mis. masih menunggu konfirmasi).
  jamTeks: string;
  // true kalau waktu order diketik manual dari catatan kertas.
  waktuManual: boolean;
  // true kalau order dibatalkan. Order yang dibatalkan tidak masuk hitungan
  // total penjualan sama sekali (docs/api-contract.md bagian 4c).
  dibatalkan: boolean;
  // Alasan pembatalan dalam bahasa manusia, atau null kalau order ini bukan yang
  // dibatalkan.
  alasanTeks: string | null;
};

// Kotak ringkasan paling atas.
export type RingkasanTampil = {
  // Tanggal laporan dalam teks panjang, mis. "11 Oktober 2026".
  tanggalTeks: string;
  // Tanggal laporan dalam teks pendek, mis. "11/10/2026".
  tanggalPendek: string;
  // Jumlah order terhitung, dalam teks.
  orderTerhitungTeks: string;
  // Total penjualan dalam teks rupiah.
  totalPenjualanTeks: string;
  // Jumlah order yang dibatalkan, dalam teks.
  dibatalkanTeks: string;
  // Jumlah order yang belum selesai (masih menunggu konfirmasi), dalam teks.
  belumSelesaiTeks: string;
};

// Isi laporan yang sudah siap ditampilkan.
export type IsiLaporanTampil = {
  ringkasan: RingkasanTampil;
  pencocokan: PencocokanTampil;
  sumber: RincianSumber;
  menuTerlaris: MenuTerlarisTampil[];
  pemakaianBahan: BahanTampil[];
  orders: OrderTampil[];
};

// ---------------------------------------------------------------------------
// Pemetaan utama
// ---------------------------------------------------------------------------

/**
 * Mengubah isi laporan dari server menjadi bentuk siap tampil.
 *
 * Input: isi laporan apa adanya (hasil GET /api/reports/today atau
 *        GET /api/reports/[id]). Tipenya unknown supaya data tak terduga tidak
 *        membuat halaman error.
 * Output: IsiLaporanTampil. Kalau datanya bukan objek, hasilnya tetap berupa
 *         laporan kosong (semua angka 0, daftar kosong) supaya Cashier melihat
 *         halaman yang utuh, bukan halaman rusak.
 */
export function petakanIsiLaporan(mentah: unknown): IsiLaporanTampil {
  const laporan = objek(mentah);

  return {
    ringkasan: petakanRingkasan(
      teks(laporan.date),
      objek(laporan.totals),
      tanggalPanjang(teks(laporan.date)),
      tanggalPendek(teks(laporan.date)),
    ),
    pencocokan: hitungPencocokanUang(laporan.byPaymentMethod),
    sumber: petakanSumber(laporan.bySource),
    menuTerlaris: petakanMenuTerlaris(laporan.topMenu),
    pemakaianBahan: petakanPemakaianBahan(laporan.ingredientUsage),
    orders: petakanOrders(laporan.orders),
  };
}

/**
 * Memetakan bagian totals menjadi kotak ringkasan.
 *
 * Input:
 *   - tanggal: teks tanggal laporan dari server, mis. "2026-10-11".
 *   - totals: objek totals dari server.
 *   - tanggalTeks: tanggal panjang, mis. "11 Oktober 2026".
 *   - tanggalPendek: tanggal pendek, mis. "11/10/2026".
 * Output: RingkasanTampil.
 *
 * Kenapa tanggal diformat di luar fungsi ini: pemformatan tanggal (Intl) cukup
 * berat, sedangkan isi laporan hanya butuh tanggalnya satu kali walau dipanggil
 * beberapa kali. Koolksi ini juga yang dipakai kotak Ringkasan dan kotak
 * Pencocokan uang, jadi tanggalnya tidak boleh berbeda antara keduanya.
 */
export function petakanRingkasan(
  tanggal: string,
  totals: Record<string, unknown>,
  tanggalTeks: string,
  tanggalPendek: string,
): RingkasanTampil {
  return {
    tanggalTeks: tanggalTeks,
    tanggalPendek: tanggalPendek,
    orderTerhitungTeks: formatJumlah(totals.orderCount),
    totalPenjualanTeks: formatRupiah(totals.sales),
    dibatalkanTeks: formatJumlah(totals.cancelledCount),
    belumSelesaiTeks: formatJumlah(totals.unfinishedCount),
  };
}

/**
 * Menghitung kotak Pencocokan uang dari data per metode bayar.
 *
 * Input: objek byPaymentMethod dari server, mis.
 *        { qris: { count: 12, amount: 250000 }, tunai: { count: 5, amount: 75000 } }
 * Output: PencocokanTampil berisi sisi Tunai dan sisi QRIS.
 *
 * KENAPA DITAMPILKAN DUA ANGKA BESAR BERDAMPINGAN, BUKAN SATU NOMINAL GABUNGAN:
 *   Cashier menutup booth dengan menghitung uang yang ada. Kalau ada selisih,
 *   hampir selalu selisih itu datang dari SUATU metode bayar: misalnya satu
 *   pembayaran QRIS yang kelupaan dicatat. Satu nominal gabungan tidak
 *   memberi tahu itu, jadi kedua metode harus ditulis terpisah.
 *
 * Field yang hilang dianggap 0, bukan error. Laporan tanpa pembayaran tunai
 * sama sekali harus tetap menampilkan "Rp 0", bukan kotak kosong yang membuat
 * Cashier ragu.
 */
export function hitungPencocokanUang(
  byPaymentMethod: unknown,
): PencocokanTampil {
  const metode = objek(byPaymentMethod);

  return {
    tunai: petakanSisiPencocokan(
      objek(metode.tunai),
      teksLaporan.pencocokan.tunai,
    ),
    qris: petakanSisiPencocokan(
      objek(metode.qris),
      teksLaporan.pencocokan.qris,
    ),
  };
}

/**
 * Memetakan rincian asal order (Online dan Kasir).
 *
 * Input: objek bySource dari server: { online: { count, amount }, cashier: {...} }.
 * Output: RincianSumber.
 *
 * Kenapa nilai "cashier" dari server ditulis jadi "Kasir": server memakai nama
 * kolom source ("cashier"), sedangkan yang tampil ke pengguna adalah bahasa
 * sehari-hari (docs/prd.md bagian 8: tiap baris order punya label asal order).
 */
export function petakanSumber(bySource: unknown): RincianSumber {
  const sumber = objek(bySource);

  return {
    online: petakanSumberSatu(
      objek(sumber.online),
      teksLaporan.asalOrder.online,
    ),
    kasir: petakanSumberSatu(
      objek(sumber.cashier),
      teksLaporan.asalOrder.kasir,
    ),
  };
}

/**
 * Memetakan daftar menu terlaris.
 *
 * Input: array topMenu dari server (sudah 10 teratas menurut porsi).
 * Output: array MenuTerlarisTampil.
 */
export function petakanMenuTerlaris(topMenu: unknown): MenuTerlarisTampil[] {
  return deret(topMenu).map((satu) => {
    const baris = objek(satu);

    return {
      nama: teks(baris.name),
      porsi: angka(baris.qty),
      porsiTeks: formatJumlah(baris.qty),
      nominal: angka(baris.amount),
      nominalTeks: formatRupiah(baris.amount),
    };
  });
}

/**
 * Memetakan pemakaian bahan dan menandai sisa yang minus.
 *
 * Input: array ingredientUsage dari server.
 * Output: array BahanTampil.
 *
 * Setiap baris punya dua angka: terpakai (pemakaian hari itu, yaitu pengurangan
 * karena pesanan dikurangi pengembalian karena pembatalan) dan sisa akhir hari.
 * Sisa boleh minus, dan itu harus kelihatan (AGENTS.md aturan 9).
 */
export function petakanPemakaianBahan(ingredientUsage: unknown): BahanTampil[] {
  return deret(ingredientUsage).map((satu) => {
    const baris = objek(satu);

    return {
      nama: teks(baris.name),
      satuan: teks(baris.unit),
      terpakaiTeks: formatJumlah(baris.used),
      sisaTeks: formatJumlah(baris.stockAtEnd),
      minus: tandaStokMinus(baris.stockAtEnd),
    };
  });
}

/**
 * Memeriksa apakah sisa bahan di bawah 0 (stok minus).
 *
 * Input: nilai stockAtEnd dari server (angka, atau teks angka dari database).
 * Output: true kalau sisanya di bawah 0.
 *
 * Kenapa perlu fungsi terpisah: aturan "stok boleh minus" dipakai di dua tempat
 * (pemakaian bahan di laporan, dan panel sisa stok), dan aturannya harus sama.
 * Sisa tepat 0 BUKAN minus: 0 berarti habis, minus berarti bahan tidak cukup.
 */
export function tandaStokMinus(sisa: unknown): boolean {
  return angka(sisa) < 0;
}

/**
 * Memetakan daftar order.
 *
 * Input: array orders dari server.
 * Output: array OrderTampil, sudah urut menurut nomor antrean.
 *
 * KENAPA DIURUTKAN LAGI DI SINI: server memang sudah mengurutkannya, tapi isi
 * laporan hari ini dan laporan tersimpan boleh datang dari tempat yang berbeda.
 * Laporan harus selalu tampil urut nomor antrean supaya Cashier bisa membacanya
 * seperti daftar antrean, tanpa bergantung pada urutan balasan server.
 *
 * CATATAN SOAL ORDER YANG DIBATALKAN: order seperti ini tetap ditampilkan
 * (Cashier perlu tahu ada pesanan yang batal), tapi ditandai "Dibatalkan"
 * beserta alasannya dan TIDAK dihitung di total penjualan
 * (docs/api-contract.md bagian 4c). Nominalnya tetap ditulis supaya Cashier bisa
 * membandingkannya sendiri dengan pembayaran yang tercatat.
 */
export function petakanOrders(orders: unknown): OrderTampil[] {
  const hasil = deret(orders).map((satu, posisi) => {
    const baris = objek(satu);

    const status = teks(baris.status);
    const dibatalkan = status === "dibatalkan";
    const idOrder = teks(baris.orderId);
    const nomorAntrean = angka(baris.queueNumber);

    return {
      // Id order dipakai sebagai kunci kalau ada. Kalau tidak ada (data tak
      // terduga), posisi dan nomor antrean dipakai supaya kunci tetap unik dan
      // React tidak diberi kunci kosong.
      kunci:
        idOrder !== ""
          ? idOrder
          : "baris-" + posisi.toString() + "-" + nomorAntrean.toString(),
      nomorAntrean: nomorAntrean,
      nama: teks(baris.customerName),
      asalTeks: labelAsal(teks(baris.source)),
      metodeBayarTeks: labelMetodeBayar(teks(baris.paymentMethod)),
      items: petakanItemsOrder(baris.items),
      totalTeks: formatRupiah(baris.total),
      statusTeks: teksStatusOrder(status),
      jamTeks: jamWib(teks(baris.confirmedAt)),
      waktuManual: baris.isManualTime === true,
      dibatalkan: dibatalkan,
      alasanTeks: dibatalkan ? teksAlasanBatal(teks(baris.cancelReason)) : null,
    };
  });

  // Urut menurut nomor antrean, dari yang paling kecil.
  return hasil.sort((satu, dua) => satu.nomorAntrean - dua.nomorAntrean);
}

/**
 * Memetakan daftar item di dalam satu order.
 *
 * Input: array items dari server: [{ name, qty, note }].
 * Output: array ItemOrderTampil.
 */
export function petakanItemsOrder(items: unknown): ItemOrderTampil[] {
  return deret(items).map((satu) => {
    const baris = objek(satu);
    const catatan = teks(baris.note);

    return {
      jumlah: angka(baris.qty),
      jumlahTeks: formatJumlah(baris.qty),
      nama: teks(baris.name),
      // Catatan yang cuma spasi dianggap tidak ada, supaya tampilan tidak
      // menampilkan kurung kosong.
      catatan: catatan === "" ? null : catatan,
    };
  });
}

/**
 * Mengubah asal order dari server menjadi label yang tampil.
 *
 * Input: nilai kolom source ("online" atau "cashier").
 * Output: "Online" atau "Kasir".
 *
 * Kalau muncul nilai yang tidak dikenal, teks cadangan dipakai. Nilai mentah
 * dari database tidak boleh langsung ditulis ke layar, karena bisa berupa
 * "undefined" atau nama kolom yang tidak dipahami pengguna.
 */
export function labelAsal(source: string): string {
  if (source === "online") {
    return teksLaporan.asalOrder.online;
  }

  if (source === "cashier") {
    return teksLaporan.asalOrder.kasir;
  }

  // Nilai yang tidak dikenal (mis. nilai baru di database) tidak boleh hilang,
  // tapi juga tidak boleh ditulis mentah ke layar karena bisa berupa "undefined".
  return teksLaporan.asalOrder.tidakDiketahui;
}

/**
 * Mengubah metode bayar dari server menjadi label yang tampil.
 *
 * Input: nilai kolom payment_method ("qris" atau "tunai").
 * Output: "QRIS", "Tunai", atau "--".
 *
 * "--" dipakai kalau metode bayar kosong, yaitu order yang dibatalkan sebelum
 * punya metode bayar. Menulis metode bayar yang sebenarnya di sana akan
 * membingungkan, karena tidak ada pembayaran yang cocok.
 */
export function labelMetodeBayar(metode: string): string {
  if (metode === "qris") {
    return teksLaporan.pencocokan.qris;
  }

  if (metode === "tunai") {
    return teksLaporan.pencocokan.tunai;
  }

  return "--";
}

/**
 * Mengubah status order dari server menjadi teks laporan.
 *
 * Input: nilai kolom status.
 * Output: teks status dalam bahasa laporan.
 *
 * Kenapa berbeda dari teks status customer: di laporan semua status ditulis
 * lengkap (tidak digabung jadi "Sedang dibuat"), karena laporan dipakai untuk
 * mencocokkan uang dan Cashier perlu bisa membedakan order yang sudah dibayar
 * tapi masih di antrean dari order yang sedang dibuat.
 */
export function teksStatusOrder(status: string): string {
  switch (status) {
    case "menunggu_konfirmasi":
      return teksLaporan.daftarOrder.status.menungguKonfirmasi;
    case "antrean":
      return teksLaporan.daftarOrder.status.antrean;
    case "dikerjakan":
      return teksLaporan.daftarOrder.status.dikerjakan;
    case "selesai":
      return teksLaporan.daftarOrder.status.selesai;
    case "dibatalkan":
      return teksLaporan.daftarOrder.status.dibatalkan;
    default:
      return teksLaporan.daftarOrder.status.tidakDiketahui;
  }
}

/**
 * Mengubah alasan pembatalan dari server menjadi teks bahasa manusia.
 *
 * Input: nilai cancel_reason dari server. Boleh kosong kalau alasan tidak ada.
 * Output: teks alasannya, atau string kosong kalau tidak ada alasan sama sekali.
 *
 * CATATAN PENTING SOAL DUA BENTUK "TIDAK ADA ALASAN":
 *   1. cancelReason tidak ada (null) sama sekali -> order ini bukan yang
 *      dibatalkan. Hasilnya string kosong, dan pemanggil tidak menampilkan baris
 *      alasan.
 *   2. cancelReason ada tapi isinya string kosong -> order DIBATALKAN tapi
 *      alasannya tidak tercatat. Ini bisa terjadi untuk order lama yang
 *      dibatalkan sebelum alasan jadi wajib, atau kalau alasannya gagal dibaca.
 *      Kalau bentuk ini ikut dianggap "tidak ada", barisnya akan tampil
 *      "Dibatalkan: " tanpa isi. Jadi di sini hasilnya TEKS CADANGAN, bukan
 *      string kosong.
 */
export function teksAlasanBatal(alasan: string | null | undefined): string {
  // Bentuk 1: tidak ada alasan sama sekali.
  if (alasan === null || alasan === undefined) {
    return "";
  }

  // Bentuk 2: ada kolom alasan tapi isinya kosong (setelah spasi dipangkas).
  const bersih = alasan.trim();
  if (bersih === "") {
    return teksLaporan.alasanBatal.tanpaAlasan;
  }

  // Alasan yang dikenal: pakai kalimat yang rapi, bukan nilai mentah database.
  const label = teksLaporan.alasanBatal.label[bersih as AlasanBatal];
  if (typeof label === "string") {
    return label;
  }

  // Alasan yang tidak dikenal (mis. nilai baru di database tapi labelnya belum
  // ditambahkan). Ditampilkan nilai aslinya supaya informasinya tidak hilang.
  //
  // ALASAN_BATAL dibaca di sini supaya daftar label di teks.ts dan daftar
  // alasan resmi di src/lib/alasan-batal.ts tidak bisa berbeda diam-diam.
  // Kalau suatu alasan tidak punya label, daftar di teks.ts tidak akan lengkap
  // dan pemeriksa tipe di atas akan menandainya.
  const alasanDikenal = (ALASAN_BATAL as readonly string[]).includes(bersih);
  if (!alasanDikenal) {
    return bersih;
  }

  return bersih;
}

/**
 * Membuat judul cetak laporan.
 *
 * Input: teks tanggal laporan, mis. "2026-10-11" (format YYYY-MM-DD dari server).
 * Output: judul cetak seperti "Theodore Coffee - Laporan 11 Oktober 2026".
 *
 * Kenapa judulnya dibuat di sini: hasil cetak sering dilipat dan ditumpuk, jadi
 * tanpa nama usaha dan tanggal, tumpukan kertas tidak bisa dipilah. Menulisnya di
 * file logika (bukan di komponen) membuat judul yang sama dipakai di layar dan
 * di kertas, dan bisa diuji.
 */
export function judulCetak(tanggal: string): string {
  return teksLaporan.cetak.judul.replace("{tanggal}", tanggalPanjang(tanggal));
}

/**
 * Membuat kalimat waktu pencetakan.
 *
 * Input: waktu sekarang dalam milidetik (hasil Date.now()).
 * Output: kalimat seperti "Dicetak pada 12 Oktober 2026, 00.10".
 *
 * Input-nya berupa milidetik, bukan teks waktu, supaya pemanggil yang menentukan
 * jam berapa sekarang. Fungsi ini tetap murni dan bisa diuji dengan milidetik
 * yang ditetapkan.
 */
export function kalimatWaktuCetak(waktuSekarangMs: number): string {
  const waktu = new Date(waktuSekarangMs);

  if (Number.isNaN(waktu.getTime())) {
    return "";
  }

  return teksLaporan.cetak.waktu.replace(
    "{waktu}",
    tanggalJamWib(waktu.toISOString()),
  );
}

// ---------------------------------------------------------------------------
// Pemetaan bagian kecil
// ---------------------------------------------------------------------------

/**
 * Memetakan satu sisi Pencocokan uang (Tunai atau QRIS).
 *
 * Input: objek { count, amount } dari server (boleh kosong), dan labelnya.
 * Output: SisiPencocokan.
 */
function petakanSisiPencocokan(
  sisi: Record<string, unknown>,
  label: string,
): SisiPencocokan {
  return {
    label: label,
    jumlahOrder: angka(sisi.count),
    jumlahOrderTeks: teksJumlahOrder(sisi.count),
    nominal: angka(sisi.amount),
    nominalTeks: formatRupiah(sisi.amount),
  };
}

/**
 * Memetakan satu asal order (Online atau Kasir).
 *
 * Input: objek { count, amount } dari server, dan labelnya.
 * Output: SumberTampil.
 *
 * Bentuknya sama dengan SisiPencocokan, tapi tetap dipisah supaya maksudnya jelas
 * saat dibaca di komponen (salah satu jumlah uang, yang lain jumlah pesanan).
 */
function petakanSumberSatu(
  sisi: Record<string, unknown>,
  label: string,
): SumberTampil {
  return {
    label: label,
    jumlahOrder: angka(sisi.count),
    jumlahOrderTeks: teksJumlahOrder(sisi.count),
    nominal: angka(sisi.amount),
    nominalTeks: formatRupiah(sisi.amount),
  };
}

/**
 * Mengubah jumlah order menjadi kalimat, misal "12 order".
 *
 * Input: nilai count dari server.
 * Output: kalimat jumlah order.
 */
function teksJumlahOrder(count: unknown): string {
  return teksLaporan.pencocokan.formatJumlahOrder.replace(
    "{jumlah}",
    formatJumlah(count),
  );
}

// ---------------------------------------------------------------------------
// Pembantu membaca data yang bentuknya belum tentu benar
// ---------------------------------------------------------------------------

/**
 * Mengubah nilai apa pun menjadi objek yang bisa dibaca dengan aman.
 *
 * Input: nilai apa pun (objek, array, teks, null).
 * Output: objek aslinya kalau memang objek biasa, atau objek kosong kalau bukan.
 *
 * Kenapa perlu: server bisa mengirim bentuk yang tidak diharapkan, dan halaman
 * laporan tidak boleh ikut error hanya karena satu field hilang. Dengan ini,
// kode berikutnya bisa membaca `objek.nilai.totals` tanpa memeriksa tipe di
 * setiap langkah.
 */
function objek(nilai: unknown): Record<string, unknown> {
  if (nilai !== null && typeof nilai === "object" && !Array.isArray(nilai)) {
    return nilai as Record<string, unknown>;
  }

  return {};
}

/**
 * Mengubah nilai apa pun menjadi array.
 *
 * Input: nilai apa pun.
 * Output: array-nya kalau memang array, atau array kosong kalau bukan.
 */
function deret(nilai: unknown): unknown[] {
  if (Array.isArray(nilai)) {
    return nilai;
  }

  return [];
}

/**
 * Mengubah nilai apa pun menjadi angka.
 *
 * Input: nilai apa pun.
 * Output: angka, atau 0 kalau nilainya bukan angka yang bisa dibaca.
 *
 * Angka dari database (jsonb) bisa datang sebagai teks, jadi string angka juga
 * diterima. Koma sebagai pemisah desimal ikut diterima karena itu yang biasa
 * dipakai orang Indonesia.
 */
function angka(nilai: unknown): number {
  if (typeof nilai === "number") {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  if (typeof nilai === "string") {
    const bersih = nilai.trim().replace(",", ".");
    if (bersih === "") {
      return 0;
    }
    const hasil = Number(bersih);
    return Number.isFinite(hasil) ? hasil : 0;
  }

  return 0;
}

/**
 * Mengubah nilai apa pun menjadi teks.
 *
 * Input: nilai apa pun.
 * Output: teksnya, atau string kosong kalau bukan teks atau angka.
 *
 * null dan undefined jadi string kosong supaya tidak ada "null" atau "undefined"
 * yang ikut tampil di layar.
 */
function teks(nilai: unknown): string {
  if (typeof nilai === "string") {
    return nilai;
  }

  if (typeof nilai === "number" && Number.isFinite(nilai)) {
    return String(nilai);
  }

  return "";
}
