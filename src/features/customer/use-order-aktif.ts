// File ini: logika halaman awal customer ("/").
//
// Hook ini mengurus tiga hal:
//   1. Membaca daftar order aktif dari localStorage.
//   2. Menanyakan status setiap order ke server, lalu membuang yang sudah
//      selesai, dibatalkan, atau tidak ditemukan.
//   3. Memutuskan apa yang ditampilkan: form pesan, daftar order aktif, atau
//      langsung membuka status satu order.
//
// Mengikuti aturan di AGENTS.md: logika ada di src/features/, komponen
// tampilan di src/components/ hanya menerima props.

"use client";

import { useEffect, useState } from "react";
import { ambilStatusOrder } from "./api";
import { bacaOrderAktif, gantiOrderAktif } from "./penyimpan-order";
import { statusMasihAktif } from "./status";

// Apa yang sedang ditampilkan di halaman awal.
export type TampilanBeranda =
  // Sedang membaca localStorage atau menanyakan status ke server.
  | { keadaan: "memuat" }
  // Tidak ada order aktif: tampilkan form pesan.
  | { keadaan: "form" }
  // Ada beberapa order aktif: tampilkan daftar.
  | { keadaan: "daftar"; orderAktif: OrderAktif[] }
  // Gagal memuat menu dari server: tampilkan pesan + tombol coba lagi.
  | { keadaan: "gagal"; pesan: string };

// Satu order aktif beserta nomor antreannya.
//
// CATATAN: nama customer TIDAK ikut ditampilkan di sini. Fungsi
// get_order_status sengaja tidak mengembalikan nama (hanya status, nomor
// antrean, item, dan total), dan kita tidak mau menambah panggilan API hanya
// untuk nama. Karena semua order aktif di daftar ini milik HP yang sama,
// menampilkan nomor antrean sudah cukup untuk memilih.
export type OrderAktif = {
  orderId: string;
  queueNumber: number;
};

/**
 * Memeriksa daftar order aktif lalu memberi tahu halaman ini apa yang harus
 * ditampilkan.
 *
 * Output: TampilanBeranda.
 *
 * Cara kerja:
 *   1. Baca id order dari localStorage. Kalau tidak ada, langsung tampilkan form.
 *   2. Tanya status setiap id ke server (satu per satu).
 *   3. Order yang masih aktif dikumpulkan; yang lain dibuang.
 *   4. Tulis ulang daftar yang tersisa ke localStorage, supaya order yang sudah
 *      selesai tidak muncul lagi di lain waktu.
 *   5. Kalau hanya ada satu order aktif, halaman ini akan diarahkan ke statusnya
 *      (pen-arahan dilakukan di file halaman).
 *
 * Catatan: satu per satu (bukan sekaligus) supaya mudah dibaca dan tidak
// hammered server sekaligus. Jumlah order aktif dari satu HP biasanya sangat
 * sedikit (biasanya 1), jadi ini cepat.
 */
export function useOrderAktif(): TampilanBeranda {
  const [tampilan, setTampilan] = useState<TampilanBeranda>({ keadaan: "memuat" });

  // useEffect hanya berjalan di browser, jadi localStorage aman dipakai di sini.
  useEffect(() => {
    // Flag ini mencegah penyetelan state setelah komponen dilepas (mis. karena
    // pengguna sudah pindah halaman).
    let masihJalan = true;

    async function periksa() {
      const daftarId = bacaOrderAktif();

      // Tidak ada order tersimpan: form pesan.
      if (daftarId.length === 0) {
        setTampilan({ keadaan: "form" });
        return;
      }

      // Tanya status setiap order satu per satu.
      const orderYangAktif: OrderAktif[] = [];

      for (const satuId of daftarId) {
        const hasil = await ambilStatusOrder(satuId);

        // Gagal sementara (internet putus): order ini diamkan dulu supaya
        // tidak ikut terbuang. Kalau order-nya memang sudah tidak ada,
        // server membalas ORDER_NOT_FOUND (lihat di bawah).
        if (!hasil.berhasil) {
          if (hasil.error.type === "ORDER_NOT_FOUND") {
            // Order benar-benar tidak ada: buang.
            continue;
          }

          // Error lain: biarkan tetap di daftar, jangan dibuang.
          continue;
        }

        const data = hasil.data;
        if (statusMasihAktif(data.status)) {
          orderYangAktif.push({
            orderId: satuId,
            queueNumber: data.queueNumber,
          });
        }
        // Status selain itu (selesai/dibatalkan/tidak dikenal): dibuang.
      }

      // Tulis ulang daftar supaya yang sudah selesai tidak muncul lagi.
      gantiOrderAktif(orderYangAktif.map((satu) => satu.orderId));

      if (!masihJalan) {
        return;
      }

      // Kalau tidak ada order aktif: form pesan.
      // Kalau ada (satu atau lebih): tampilkan daftar. Kalau tepat satu, hook
      // useOrderAktifRedirect yang mengarahkan ke halaman statusnya.
      if (orderYangAktif.length === 0) {
        setTampilan({ keadaan: "form" });
      } else {
        setTampilan({ keadaan: "daftar", orderAktif: orderYangAktif });
      }
    }

    void periksa();

    // Bersihkan saat komponen dilepas.
    return () => {
      masihJalan = false;
    };
  }, []);

  return tampilan;
}
