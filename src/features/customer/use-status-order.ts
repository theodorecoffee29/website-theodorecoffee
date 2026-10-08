// File ini: logika halaman status pesanan (/status/[orderId]).
//
// Hook ini mengurus:
//   1. Memuat status order dari server.
//   2. Menanya status ulang tiap 5 detik (polling) sampai statusnya final.
//   3. Membatalkan pesanan (dengan konfirmasi Ya/Tidak).
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilStatusOrder,
  batalkanOrder,
  kirimLogErrorKeServer,
  type StatusOrderResponse,
} from "./api";
import { buangOrderAktif, cariNamaCustomer } from "./penyimpan-order";
import { customerBolehBatalkan, statusSudahFinal, teksStatus } from "./status";
import { teksCustomer } from "./teks";

// Berapa milidetik satu jeda polling. docs/api-contract.md bagian 5 menetapkan
// halaman status customer memanggil setiap 5 detik.
export const INTERVAL_POLLING_MS = 5000;

// Berapa kali polling gagal berturut-turut sebelum satu log error dikirim.
// supaya tidak membanjiri log error kalau internet memang sedang putus.
const BATASAN_GAGAL_BERURUTAN = 3;

// Keadaan halaman status yang diteruskan ke komponen tampilan.
export type KeadaanStatusOrder = {
  // Status order kalau sudah termuat, atau null saat belum.
  order: StatusOrderResponse | null;
  // Nama customer yang dipakai saat memesan. Diambil dari penyimpanan di HP
  // ini, karena get_order_status tidak mengembalikan nama. Kosong kalau tidak
  // diketahui (mis. halaman dibuka dari HP lain).
  customerName: string;
  // True saat statusnya sudah final (selesai atau dibatalkan).
  sudahFinal: boolean;
  // True kalau customer boleh membatalkan (hanya saat menunggu konfirmasi).
  bolehBatalkan: boolean;
  // True saat popup konfirmasi batalkan sedang terbuka.
  dialogBatalTerbuka: boolean;
  // True saat permintaan batalkan sedang berjalan.
  sedangMembatalkan: boolean;
  // True saat masih memuat status untuk pertama kali.
  memuat: boolean;
  // True saat polling gagal (bukan memuat pertama).
  gagalMuat: boolean;
  // True kalau order-nya tidak ditemukan (id salah atau sudah dihapus).
  tidakDitemukan: boolean;
  // Teks status untuk ditampilkan.
  teksStatus: string;
  // Pesan error atau informasi tambahan, atau null.
  pesan: string | null;
  // Aksi yang dipanggil komponen tampilan.
  bukaDialogBatal: () => void;
  tutupDialogBatal: () => void;
  konfirmasiBatal: () => void;
};

/**
 * Mengurus halaman status satu order.
 *
 * Input: orderId dari alamat halaman.
 * Output: KeadaanStatusOrder yang diteruskan ke komponen tampilan.
 *
 * Cara kerja polling:
 *   - Muat sekali di awal.
 *   - Selama status belum final, ulangi setiap 5 detik.
 *   - Berhenti begitu statusnya "selesai" atau "dibatalkan".
 *   - Kalau gagal beberapa kali berturut-turut, kirim satu log error ke server.
 *
 * Kenapa berhenti saat final: setelah order selesai atau dibatalkan, statusnya
 * tidak akan berubah lagi, jadi menanyakannya hanya sia-sia.
 */
export function useStatusOrder(orderId: string): KeadaanStatusOrder {
  const [order, setOrder] = useState<StatusOrderResponse | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [tidakDitemukan, setTidakDitemukan] = useState(false);
  const [dialogBatalTerbuka, setDialogBatalTerbuka] = useState(false);
  const [sedangMembatalkan, setSedangMembatalkan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  // Menghitung polling gagal berturut-turut.
  const jumlahGagalRef = useRef(0);
  // Flag supaya interval berhenti setelah komponen dilepas.
  const berhentiRef = useRef(false);

  /**
   * Memuat status satu kali (dipakai saat pertama buka dan saat perlu memuat
   * ulang setelah pembatalan gagal).
   *
   * Output: void. Hasilnya disimpan ke state, bukan dikembalikan, supaya
   *         pemanggil tidak mengolah hasilnya.
   */
  const muatStatus = useCallback(async () => {
    const hasil = await ambilStatusOrder(orderId);

    // Kalau halaman sudah ditinggalkan, jangan perbarui apa pun.
    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      setGagalMuat(true);

      // Order tidak ada: tandai supaya halaman menampilkan pesan ramah.
      if (hasil.error.type === "ORDER_NOT_FOUND") {
        setTidakDitemukan(true);
        // Order tidak ada: buang dari daftar order aktif.
        buangOrderAktif(orderId);
      }
      return;
    }

    // Berhasil memuat.
    setGagalMuat(false);
    setTidakDitemukan(false);
    setOrder(hasil.data);

    // Ambil nama customer dari penyimpanan HP ini selagi masih ada. Kalau
    // ordernya sudah final di bawah, catatannya akan dibuang dari penyimpanan,
    // jadi diambil lebih dulu.
    setCustomerName(cariNamaCustomer(orderId));

    // Status final: buang dari daftar order aktif supaya halaman awal tidak
    // menawarkannya lagi.
    if (statusSudahFinal(hasil.data.status)) {
      buangOrderAktif(orderId);
    }
  }, [orderId]);

  // Muat status pertama kali saat halaman dibuka.
  //
  // Panggilan pertama sengaja dijadwalkan lewat setTimeout 0, bukan langsung
  // dipanggil. Alasannya: muatStatus() mengubah state, dan mengubah state
  // langsung di dalam badan efek bisa memicu render berulang. Dengan
  // menundanya satu tick, render pertama selesai dulu baru data dimuat.
  useEffect(() => {
    berhentiRef.current = false;

    const langsungMuat = setTimeout(() => {
      void muatStatus();
    }, 0);

    return () => {
      // Batalkan pemanggilan yang tertunda dan hentikan polling.
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatStatus]);

  // Polling: ulangi setiap 5 detik selama status belum final.
  useEffect(() => {
    // Jangan mulai polling kalau statusnya sudah final.
    if (order !== null && statusSudahFinal(order.status)) {
      return;
    }

    const timer = setInterval(() => {
      // Kalau halaman sudah ditinggalkan, berhenti.
      if (berhentiRef.current) {
        return;
      }

      void (async () => {
        const hasil = await ambilStatusOrder(orderId);

        if (berhentiRef.current) {
          return;
        }

        if (!hasil.berhasil) {
          // Gagal: tandai supaya muncul pesan kecil "gagal memuat, mencoba lagi".
          setGagalMuat(true);

          // Hitung kegagalan berturut-turut. Setelah cukup banyak, kirim satu
          // log error supaya Admin tahu (tidak setiap gagal, hanya satu kali).
          jumlahGagalRef.current += 1;
          if (jumlahGagalRef.current === BATASAN_GAGAL_BERURUTAN) {
            void kirimLogErrorKeServer(
              "gagal_muat_status",
              "Polling status gagal " +
                jumlahGagalRef.current +
                " kali berturut-turut",
              orderId,
            );
          }
          return;
        }

        // Sukses: reset penghitung kegagalan dan pesan gagal.
        jumlahGagalRef.current = 0;
        setGagalMuat(false);
        setTidakDitemukan(false);
        setOrder(hasil.data);

        // Status final: hentikan polling (interval akan dihapus oleh efek
        // di bawah karena order berubah) dan buang dari daftar aktif.
        if (statusSudahFinal(hasil.data.status)) {
          buangOrderAktif(orderId);
        }
      })();
    }, INTERVAL_POLLING_MS);

    // Hapus interval saat komponen dilepas atau saat order berubah (efek ini
    // dijalankan ulang kalau order berubah, dan interval lamanya dibersihkan).
    return () => {
      clearInterval(timer);
    };
    // Catatan: dependensi cukup order dan orderId.
  }, [order, orderId]);

  /**
   * Membuka popup konfirmasi batalkan.
   * Output: void.
   */
  function bukaDialogBatal(): void {
    setDialogBatalTerbuka(true);
  }

  /**
   * Menutup popup tanpa membatalkan apa pun (pilihan "Tidak").
   * Output: void.
   */
  function tutupDialogBatal(): void {
    setDialogBatalTerbuka(false);
  }

  /**
   * Membatalkan pesanan setelah pengguna memilih "Ya".
   * Output: void.
   *
   * Cara kerja:
   *   1. Panggil /api/orders/[id]/cancel.
   *   2. Kalau ORDER_STATUS_CHANGED (Cashier sudah mengonfirmasi lebih dulu),
   *      tampilkan pesannya lalu muat ulang status (docs/order-flow.md bagian 5).
   *   3. Kalau berhasil, muat ulang status supaya langsung menampilkan Dibatalkan.
   */
  async function konfirmasiBatal(): Promise<void> {
    setDialogBatalTerbuka(false);
    setSedangMembatalkan(true);
    setPesan(null);

    const hasil = await batalkanOrder(orderId);

    setSedangMembatalkan(false);

    if (!hasil.berhasil) {
      // Status sudah berubah: beri tahu pengguna, lalu muat ulang supaya
      // tampilan sesuai keadaan terbaru.
      if (hasil.error.type === "ORDER_STATUS_CHANGED") {
        setPesan(teksCustomer.status.statusSudahBerubah);
        await muatStatus();
        return;
      }

      // Gagal lain: tampilkan pesan dari server.
      setPesan(hasil.error.message || teksCustomer.status.gagalBatalkan);

      // Laporkan ke server kalau perlu.
      void kirimLogErrorKeServer(
        "gagal_aksi_staf",
        "Gagal batalkan order: " + hasil.error.type + " " + hasil.error.message,
        orderId,
      );
      return;
    }

    // Berhasil: muat ulang supaya status menampilkan Dibatalkan.
    await muatStatus();
  }

  // Status terakhir yang diketahui (dari state atau ref).
  const statusSekarang = order?.status ?? "";

  return {
    order: order,
    customerName: customerName,
    sudahFinal: order !== null && statusSudahFinal(order.status),
    bolehBatalkan: customerBolehBatalkan(statusSekarang),
    dialogBatalTerbuka: dialogBatalTerbuka,
    sedangMembatalkan: sedangMembatalkan,
    memuat: memuat,
    gagalMuat: gagalMuat,
    tidakDitemukan: tidakDitemukan,
    teksStatus: teksStatus(statusSekarang),
    pesan: pesan,
    bukaDialogBatal: bukaDialogBatal,
    tutupDialogBatal: tutupDialogBatal,
    konfirmasiBatal: () => {
      void konfirmasiBatal();
    },
  };
}
