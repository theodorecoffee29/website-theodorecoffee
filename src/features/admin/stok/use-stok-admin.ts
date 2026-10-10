// File ini: logika halaman Stok Admin (/admin/stok).
//
// Hook useStokAdmin mengurus:
//   1. Memuat daftar bahan beserta stoknya.
//   2. Menambah bahan baru.
//   3. Mengubah nama bahan.
//   4. Menambah stok (restock) dan mengoreksi stok, keduanya lewat dialog
//      konfirmasi yang menampilkan hasil perubahannya sebelum disimpan.
//   5. Membuka riwayat pergerakan satu bahan.
//
// TIDAK ADA POLLING di halaman ini. Alasannya: perubahan stok biasanya karena
// Admin sendiri yang bekerja, atau karena Barista mengerjakan pesanan (yang
// memang bisa mengubah stok dari sisi lain). Daftar dimuat ulang setelah setiap
// aksi Admin selesai, jadi tidak perlu menebak-nebak perubahan dari luar.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/admin/stok/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatStok,
  ambilSemuaBahan,
  buatBahan,
  kirimLogErrorKeServer,
  koreksiStok,
  tambahStok,
  ubahNamaBahan,
  type HasilApi,
} from "./api";
import { angkaJadiAngka, cekAngka, formatAngkaIndonesia } from "./angka";
import {
  petakanRiwayat,
  stokMinus,
  perkiraanStokSesudah,
  type RiwayatTampil,
} from "./perhitungan";
import { jamWibStok } from "./waktu";
import { teksStokAdmin } from "./teks";

// Bentuk satu bahan yang sudah disiapkan untuk tampilan.
export type BahanSiapTampil = {
  ingredientId: string;
  nama: string;
  // Satuan singkat: "g", "ml", atau "pcs".
  satuan: string;
  // Label satuan yang lebih panjang, misal "Gram (g)".
  satuanPanjang: string;
  // Stok dalam bentuk teks gaya Indonesia, misal "5.000" atau "0,25".
  stokTeks: string;
  // Stok sebagai angka (dipakai untuk perhitungan dialog).
  stokAngka: number;
  // true kalau stoknya di bawah 0 (perlu dikoreksi).
  minus: boolean;
};

// Keadaan halaman yang diteruskan ke komponen tampilan.
export type KeadaanStokAdmin = {
  bahan: BahanSiapTampil[];
  memuat: boolean;
  gagalMuat: boolean;
  pesan: string | null;
  pesanAdalahError: boolean;
  sedangAksi: string | null;

  // Form tambah bahan.
  formTambahNama: string;
  formTambahSatuan: string;
  formTambahStok: string;
  pesanFormTambah: string | null;
  // Pesan validasi satuan (terpisah karena satuan punya pesan sendiri).
  pesanSatuan: string | null;

  // Form ubah nama bahan.
  formUbahUntuk: string | null;

  // Dialog restock.
  dialogRestockUntuk: string | null;
  formRestockJumlah: string;
  formRestockCatatan: string;
  pesanRestock: string | null;
  // Perkiraan stok sesudah menambah (angka), untuk dialog.
  perkiraanRestock: number;

  // Dialog koreksi stok.
  dialogKoreksiUntuk: string | null;
  formKoreksiFisik: string;
  formKoreksiAlasan: string;
  pesanKoreksi: string | null;
  // Selisih koreksi (angka), untuk dialog.

  // Riwayat.
  riwayatUntuk: string | null;
  riwayat: RiwayatTampil[];
  memuatRiwayat: boolean;

  // Aksi.
  ubahFormTambahNama: (nilai: string) => void;
  ubahFormTambahSatuan: (nilai: string) => void;
  ubahFormTambahStok: (nilai: string) => void;
  kirimTambahBahan: () => void;
  bukaFormUbah: (ingredientId: string) => void;
  tutupFormUbah: () => void;
  kirimUbahNama: (ingredientId: string, nama: string) => void;
  bukaDialogRestock: (ingredientId: string) => void;
  tutupDialogRestock: () => void;
  ubahRestockJumlah: (nilai: string) => void;
  ubahRestockCatatan: (nilai: string) => void;
  konfirmasiRestock: () => void;
  bukaDialogKoreksi: (ingredientId: string) => void;
  tutupDialogKoreksi: () => void;
  ubahKoreksiFisik: (nilai: string) => void;
  ubahKoreksiAlasan: (nilai: string) => void;
  konfirmasiKoreksi: () => void;
  bukaRiwayat: (ingredientId: string) => void;
  tutupRiwayat: () => void;
  tutupPesan: () => void;
  muatUlang: () => void;
};

/**
 * Mengurus logika halaman Stok Admin.
 *
 * Output: KeadaanStokAdmin yang diteruskan ke komponen tampilan.
 */
export function useStokAdmin(): KeadaanStokAdmin {
  const [bahan, setBahan] = useState<BahanSiapTampil[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanAdalahError, setPesanAdalahError] = useState(false);
  const [sedangAksi, setSedangAksi] = useState<string | null>(null);

  // Form tambah.
  const [formTambahNama, setFormTambahNama] = useState("");
  const [formTambahSatuan, setFormTambahSatuan] = useState("");
  const [formTambahStok, setFormTambahStok] = useState("");
  const [pesanFormTambah, setPesanFormTambah] = useState<string | null>(null);
  const [pesanSatuan, setPesanSatuan] = useState<string | null>(null);

  // Form ubah nama.
  const [formUbahUntuk, setFormUbahUntuk] = useState<string | null>(null);

  // Dialog restock.
  const [dialogRestockUntuk, setDialogRestockUntuk] = useState<string | null>(
    null,
  );
  const [formRestockJumlah, setFormRestockJumlah] = useState("");
  const [formRestockCatatan, setFormRestockCatatan] = useState("");
  const [pesanRestock, setPesanRestock] = useState<string | null>(null);

  // Dialog koreksi.
  const [dialogKoreksiUntuk, setDialogKoreksiUntuk] = useState<string | null>(
    null,
  );
  const [formKoreksiFisik, setFormKoreksiFisik] = useState("");
  const [formKoreksiAlasan, setFormKoreksiAlasan] = useState("");
  const [pesanKoreksi, setPesanKoreksi] = useState<string | null>(null);

  // Riwayat.
  const [riwayatUntuk, setRiwayatUntuk] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatTampil[]>([]);
  const [memuatRiwayat, setMemuatRiwayat] = useState(false);

  // Flag supaya pemanggilan tertunda tidak mengubah state setelah halaman
  // ditinggalkan.
  const berhentiRef = useRef(false);

  /**
   * Memuat daftar bahan satu kali.
   *
   * Output: void.
   */
  const muatBahan = useCallback(async () => {
    const hasil = await ambilSemuaBahan();

    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // JANGAN hapus daftar yang sudah tampil, supaya Admin masih bisa
      // membacanya walau koneksi sedang bermasalah.
      setGagalMuat(true);
      return;
    }

    setGagalMuat(false);
    setBahan(hasil.data.map(siapkanBahan));
  }, []);

  // Muat daftar bahan saat halaman dibuka.
  useEffect(() => {
    berhentiRef.current = false;
    const langsungMuat = setTimeout(() => {
      void muatBahan();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatBahan]);

  /** Muat ulang daftar bahan. Output: void. */
  function muatUlang(): void {
    setMemuat(true);
    void muatBahan();
  }

  /** Mengubah isian nama form tambah. Output: void. */
  function ubahFormTambahNama(nilai: string): void {
    setFormTambahNama(nilai);
    setPesanFormTambah(null);
  }

  /** Mengubah isian stok awal form tambah. Output: void. */
  function ubahFormTambahStok(nilai: string): void {
    setFormTambahStok(nilai);
    setPesanFormTambah(null);
  }

  /**
   * Mengubah pilihan satuan.
   *
   * Output: void.
   *
   * Satuan TIDAK punya nilai bawaan: Admin wajib memilih sendiri, karena satuan
   * tidak bisa diubah setelah bahan dibuat (docs/api-contract.md bagian 4b).
   */
  function ubahFormTambahSatuan(nilai: string): void {
    setFormTambahSatuan(nilai);
    setPesanSatuan(null);
  }

  /**
   * Mengirim form tambah bahan.
   *
   * Output: void.
   *
   * Alur:
   *   1. Periksa nama, satuan, dan stok awal.
   *   2. Panggil POST /api/admin/ingredients.
   *   3. Berhasil: kosongkan form dan muat ulang daftar.
   *   4. Gagal: pesan ditampilkan dan form TIDAK dikosongkan, supaya Admin tidak
   *      perlu mengetik ulang.
   */
  async function kirimTambahBahan(): Promise<void> {
    const cekNama = cekNamaBahan(formTambahNama);
    if (!cekNama.valid) {
      setPesanFormTambah(cekNama.pesan);
      return;
    }

    // Satuan wajib dipilih: tidak ada nilai bawaan.
    if (formTambahSatuan === "") {
      setPesanSatuan(teksStokAdmin.pesan.satuanWajib);
      return;
    }

    // Stok awal opsional: kalau kosong, dianggap 0 (tidak mengirim apa pun).
    let stokAwal: number | undefined;
    if (formTambahStok.trim() !== "") {
      const cekStok = cekAngka(
        formTambahStok,
        pesanAngkaYangDipakai(),
        true, // boleh nol: stok awal 0 berarti belum ada stok
      );
      if (!cekStok.valid) {
        setPesanFormTambah(cekStok.pesan);
        return;
      }
      stokAwal = angkaJadiAngka(formTambahStok);
    }

    setSedangAksi("tambah");
    setPesan(null);

    const hasil = await buatBahan({
      name: formTambahNama.trim(),
      unit: formTambahSatuan,
      ...(stokAwal === undefined ? {} : { initialStock: stokAwal }),
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Form TIDAK dikosongkan.
      tampilkanKegagalan(hasil, "Gagal menambah bahan");
      return;
    }

    // Berhasil: kosongkan form.
    setFormTambahNama("");
    setFormTambahSatuan("");
    setFormTambahStok("");
    setPesanFormTambah(null);
    setPesan(teksStokAdmin.pesan.bahanDitambah);
    setPesanAdalahError(false);
    void muatBahan();
  }

  /**
   * Membuka form ubah nama untuk satu bahan.
   *
   * Output: void.
   */
  function bukaFormUbah(ingredientId: string): void {
    setFormUbahUntuk(ingredientId);
    setPesan(null);
  }

  /** Menutup form ubah. Output: void. */
  function tutupFormUbah(): void {
    setFormUbahUntuk(null);
  }

  /**
   * Mengirim perubahan nama bahan.
   *
   * Output: void.
   *
   * Satuan tidak ikut dikirim: satuan tidak bisa diubah
   * (docs/api-contract.md bagian 4b).
   */
  async function kirimUbahNama(
    ingredientId: string,
    namaBaru: string,
  ): Promise<void> {
    const cekNama = cekNamaBahan(namaBaru);
    if (!cekNama.valid) {
      setPesan(cekNama.pesan);
      setPesanAdalahError(true);
      return;
    }

    setSedangAksi(ingredientId);
    setPesan(null);

    const hasil = await ubahNamaBahan({
      ingredientId: ingredientId,
      name: namaBaru.trim(),
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Form tetap terbuka supaya Admin bisa memperbaiki isiannya.
      setFormUbahUntuk(ingredientId);
      tampilkanKegagalan(hasil, "Gagal mengubah bahan");
      return;
    }

    setFormUbahUntuk(null);
    setPesan(teksStokAdmin.pesan.bahanTersimpan);
    setPesanAdalahError(false);
    void muatBahan();
  }

  /**
   * Membuka dialog konfirmasi restock.
   *
   * Output: void.
   *
   * Stok awal dialog diisi dengan stok sekarang, supaya Admin langsung tahu
   * berapa yang akan ditambah dari posisi sekarang.
   */
  function bukaDialogRestock(ingredientId: string): void {
    setDialogRestockUntuk(ingredientId);
    setFormRestockJumlah("");
    setFormRestockCatatan("");
    setPesanRestock(null);
    setPesan(null);
  }

  /** Menutup dialog restock. Output: void. */
  function tutupDialogRestock(): void {
    setDialogRestockUntuk(null);
  }

  /** Mengubah isian jumlah restock. Output: void. */
  function ubahRestockJumlah(nilai: string): void {
    setFormRestockJumlah(nilai);
    setPesanRestock(null);
  }

  /** Mengubah isian catatan restock. Output: void. */
  function ubahRestockCatatan(nilai: string): void {
    setFormRestockCatatan(nilai);
  }

  /**
   * Menambah stok setelah Admin mengonfirmasi dialog.
   *
   * Output: void.
   */
  async function konfirmasiRestock(): Promise<void> {
    const ingredientId = dialogRestockUntuk;
    if (ingredientId === null) {
      return;
    }

    // Jumlah restock harus lebih dari 0.
    const cek = cekAngka(
      formRestockJumlah,
      pesanAngkaYangDipakai(),
      false, // tidak boleh nol: menambah 0 tidak masuk akal
    );
    if (!cek.valid) {
      setPesanRestock(cek.pesan);
      return;
    }

    // Catatan opsional, maksimal 100 karakter.
    if (formRestockCatatan.length > 100) {
      setPesanRestock(teksStokAdmin.pesan.catatanMaks);
      return;
    }

    setSedangAksi(ingredientId);
    setPesan(null);

    const hasil = await tambahStok({
      ingredientId: ingredientId,
      qty: angkaJadiAngka(formRestockJumlah),
      ...(formRestockCatatan.trim() === ""
        ? {}
        : { note: formRestockCatatan.trim() }),
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Dialog tetap terbuka supaya Admin tidak perlu mengetik ulang.
      setDialogRestockUntuk(ingredientId);
      tampilkanKegagalan(hasil, "Gagal menambah stok");
      return;
    }

    setDialogRestockUntuk(null);
    setPesan(teksStokAdmin.pesan.stokDitambah);
    setPesanAdalahError(false);
    void muatBahan();
  }

  /**
   * Membuka dialog konfirmasi koreksi stok.
   *
   * Output: void.
   *
   * Isian jumlah hasil hitung diisi dengan stok sekarang, supaya Admin melihat
   * posisi sekarang sebagai titik awal sebelum mengoreksi.
   */
  function bukaDialogKoreksi(ingredientId: string): void {
    const bahanSekarang = cariBahan(ingredientId);
    setDialogKoreksiUntuk(ingredientId);
    // Awalnya diisi stok sekarang; Admin mengubahnya ke angka hasil hitung.
    setFormKoreksiFisik(
      bahanSekarang !== undefined
        ? formatAngkaIndonesia(bahanSekarang.stokAngka)
        : "",
    );
    setFormKoreksiAlasan("");
    setPesanKoreksi(null);
    setPesan(null);
  }

  /** Menutup dialog koreksi. Output: void. */
  function tutupDialogKoreksi(): void {
    setDialogKoreksiUntuk(null);
  }

  /** Mengubah isian jumlah hasil hitung fisik. Output: void. */
  function ubahKoreksiFisik(nilai: string): void {
    setFormKoreksiFisik(nilai);
    setPesanKoreksi(null);
  }

  /** Mengubah isian alasan koreksi. Output: void. */
  function ubahKoreksiAlasan(nilai: string): void {
    setFormKoreksiAlasan(nilai);
  }

  /**
   * Mengoreksi stok setelah Admin mengonfirmasi dialog.
   *
   * Output: void.
   */
  async function konfirmasiKoreksi(): Promise<void> {
    const ingredientId = dialogKoreksiUntuk;
    if (ingredientId === null) {
      return;
    }

    // Jumlah hasil hitung boleh 0 (artinya habis), tapi tidak boleh negatif.
    const cek = cekAngka(formKoreksiFisik, pesanAngkaYangDipakai(), true);
    if (!cek.valid) {
      setPesanKoreksi(cek.pesan);
      return;
    }

    // Alasan wajib diisi, 1 sampai 100 karakter.
    const alasan = formKoreksiAlasan.trim();
    if (alasan.length < 1) {
      setPesanKoreksi(teksStokAdmin.pesan.alasanWajib);
      return;
    }
    if (alasan.length > 100) {
      setPesanKoreksi(teksStokAdmin.pesan.alasanMaks);
      return;
    }

    setSedangAksi(ingredientId);
    setPesan(null);

    const hasil = await koreksiStok({
      ingredientId: ingredientId,
      newQty: angkaJadiAngka(formKoreksiFisik),
      reason: alasan,
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      setDialogKoreksiUntuk(ingredientId);
      tampilkanKegagalan(hasil, "Gagal mengoreksi stok");
      return;
    }

    setDialogKoreksiUntuk(null);
    setPesan(teksStokAdmin.pesan.stokDikoreksi);
    setPesanAdalahError(false);
    void muatBahan();
  }

  /**
   * Membuka riwayat pergerakan satu bahan.
   *
   * Output: void.
   *
   * Riwayat dimuat saat dialog dibuka, bukan sejak halaman dibuka, supaya tidak
   * ada permintaan yang tidak perlu.
   */
  function bukaRiwayat(ingredientId: string): void {
    setRiwayatUntuk(ingredientId);
    setRiwayat([]);
    setMemuatRiwayat(true);
    setPesan(null);

    void (async () => {
      const hasil = await ambilRiwayatStok(ingredientId);

      if (berhentiRef.current) {
        return;
      }

      setMemuatRiwayat(false);

      if (!hasil.berhasil) {
        tampilkanKegagalan(hasil, "Gagal memuat riwayat stok");
        return;
      }

      setRiwayat(hasil.data.map((satu) => petakanRiwayat(satu, jamWibStok)));
    })();
  }

  /** Menutup riwayat. Output: void. */
  function tutupRiwayat(): void {
    setRiwayatUntuk(null);
    setRiwayat([]);
  }

  /** Menutup pesan. Output: void. */
  function tutupPesan(): void {
    setPesan(null);
    setPesanAdalahError(false);
  }

  /**
   * Menampilkan pesan gagal dari sebuah hasil pemanggilan API.
   *
   * Output: void.
   *
   * Untuk VALIDATION_FAILED, pesan dari server dipakai APA ADANYA (itulah yang
   * menjelaskan masalahnya). Untuk kegagalan lain, pesan ramah plus kode
   * ERR-xxxx kalau ada, dan errornya dikirim ke server lewat /api/log-error.
   */
  function tampilkanKegagalan(hasil: HasilApi<unknown>, pembuka: string): void {
    if (hasil.berhasil) {
      return;
    }

    let teksPesan: string;

    if (hasil.error.type === "VALIDATION_FAILED") {
      teksPesan = hasil.error.message;
    } else if (hasil.error.code) {
      teksPesan =
        pembuka +
        " " +
        teksStokAdmin.pesan.aksiGagalDenganKode.replace(
          "{kode}",
          hasil.error.code,
        );
    } else {
      teksPesan = pembuka + " " + hasil.error.message;
    }

    setPesan(teksPesan);
    setPesanAdalahError(true);

    void kirimLogErrorKeServer(
      "gagal_aksi_staf",
      pembuka + ": " + hasil.error.type + " " + hasil.error.message,
    );
  }

  // Perhitungan untuk dialog restock.
  // Dialog koreksi tidak membutuhkan nilai di sini: stok tercatat dan selisihnya
  // dihitung oleh komponen dialog dari daftar bahan yang sudah ada di state.
  const bahanRestock = cariBahan(dialogRestockUntuk);

  // Perkiraan stok sesudah restock (kalau jumlahnya sudah valid).
  const perkiraanRestock =
    bahanRestock !== undefined && cekAngkaSaja(formRestockJumlah)
      ? perkiraanStokSesudah(
          bahanRestock.stokAngka,
          angkaJadiAngka(formRestockJumlah),
        )
      : (bahanRestock?.stokAngka ?? 0);

  return {
    bahan: bahan,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    pesanAdalahError: pesanAdalahError,
    sedangAksi: sedangAksi,

    formTambahNama: formTambahNama,
    formTambahSatuan: formTambahSatuan,
    formTambahStok: formTambahStok,
    pesanFormTambah: pesanFormTambah,
    pesanSatuan: pesanSatuan,

    formUbahUntuk: formUbahUntuk,

    dialogRestockUntuk: dialogRestockUntuk,
    formRestockJumlah: formRestockJumlah,
    formRestockCatatan: formRestockCatatan,
    pesanRestock: pesanRestock,
    perkiraanRestock: perkiraanRestock,

    dialogKoreksiUntuk: dialogKoreksiUntuk,
    formKoreksiFisik: formKoreksiFisik,
    formKoreksiAlasan: formKoreksiAlasan,
    pesanKoreksi: pesanKoreksi,

    riwayatUntuk: riwayatUntuk,
    riwayat: riwayat,
    memuatRiwayat: memuatRiwayat,

    ubahFormTambahNama: ubahFormTambahNama,
    ubahFormTambahSatuan: ubahFormTambahSatuan,
    ubahFormTambahStok: ubahFormTambahStok,
    kirimTambahBahan: () => {
      void kirimTambahBahan();
    },
    bukaFormUbah: bukaFormUbah,
    tutupFormUbah: tutupFormUbah,
    kirimUbahNama: (ingredientId: string, nama: string) => {
      void kirimUbahNama(ingredientId, nama);
    },
    bukaDialogRestock: bukaDialogRestock,
    tutupDialogRestock: tutupDialogRestock,
    ubahRestockJumlah: ubahRestockJumlah,
    ubahRestockCatatan: ubahRestockCatatan,
    konfirmasiRestock: () => {
      void konfirmasiRestock();
    },
    bukaDialogKoreksi: bukaDialogKoreksi,
    tutupDialogKoreksi: tutupDialogKoreksi,
    ubahKoreksiFisik: ubahKoreksiFisik,
    ubahKoreksiAlasan: ubahKoreksiAlasan,
    konfirmasiKoreksi: () => {
      void konfirmasiKoreksi();
    },
    bukaRiwayat: bukaRiwayat,
    tutupRiwayat: tutupRiwayat,
    tutupPesan: tutupPesan,
    muatUlang: muatUlang,
  };

  /**
   * Mencari satu bahan dari daftar.
   *
   * Input: id bahan (boleh null kalau tidak sedang ada dialog terbuka).
   * Output: bahan yang dicari, atau undefined kalau tidak ada.
   *
   * Fungsi ini dibuat DI DALAM hook supaya bisa membaca daftar bahan terbaru
   * tanpa perlu dibaca lewat parameter. Fungsi di dalam hook boleh dideklarasikan
   * di mana saja, asalkan SEBELUM dipakai.
   */
  function cariBahan(ingredientId: string | null): BahanSiapTampil | undefined {
    if (ingredientId === null) {
      return undefined;
    }
    return bahan.find((satu) => satu.ingredientId === ingredientId);
  }
}

// -----------------------------------------------------------------------------
// Pembantu di luar hook
// -----------------------------------------------------------------------------

/**
 * Memeriksa nama bahan.
 *
 * Output: HasilCek dari file format (dipakai ulang supaya aturannya sama).
 */
function cekNamaBahan(nama: string): { valid: boolean; pesan: string | null } {
  const namaBersih = nama.trim();

  if (namaBersih.length === 0) {
    return { valid: false, pesan: teksStokAdmin.pesan.namaWajib };
  }

  if (namaBersih.length > 60) {
    return { valid: false, pesan: teksStokAdmin.pesan.namaMaks };
  }

  return { valid: true, pesan: null };
}

// Pesan angka yang dipakai (dari teks.ts).
function pesanAngkaYangDipakai() {
  return {
    wajib: teksStokAdmin.pesanAngka.wajib,
    positif: teksStokAdmin.pesanAngka.positif,
    nolBoleh: teksStokAdmin.pesanAngka.nolBoleh,
    desimal: teksStokAdmin.pesanAngka.desimal,
    maks: teksStokAdmin.pesanAngka.maks,
    tidakValid: teksStokAdmin.pesanAngka.tidakValid,
  };
}

// Memeriksa apakah teks angka boleh dipakai (untuk menghitung perkiraan tanpa
// menampilkan pesan). Dipakai supaya perkiraan tidak menampilkan NaN.
function cekAngkaSaja(teks: string): boolean {
  return cekAngka(teks, pesanAngkaYangDipakai(), false).valid;
}

// Mengubah bahan dari server menjadi bentuk siap tampil.
function siapkanBahan(bahan: {
  ingredientId: string;
  name: string;
  unit: string;
  stockQty: number;
}): BahanSiapTampil {
  return {
    ingredientId: bahan.ingredientId,
    nama: bahan.name,
    satuan: bahan.unit,
    satuanPanjang: labelSatuanPanjang(bahan.unit),
    stokTeks: formatAngkaIndonesia(bahan.stockQty),
    stokAngka: bahan.stockQty,
    minus: stokMinus(bahan.stockQty),
  };
}

// Mengubah satuan singkat ("g") menjadi label panjang ("Gram (g)").
function labelSatuanPanjang(satuan: string): string {
  switch (satuan) {
    case "g":
      return teksStokAdmin.daftarBahan.satuan.g;
    case "ml":
      return teksStokAdmin.daftarBahan.satuan.ml;
    case "pcs":
      return teksStokAdmin.daftarBahan.satuan.pcs;
    default:
      return satuan;
  }
}
