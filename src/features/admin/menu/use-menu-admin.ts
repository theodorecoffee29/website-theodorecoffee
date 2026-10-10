// File ini: logika halaman Menu dan Resep Admin (/admin/menu).
//
// Hook useMenuAdmin mengurus:
//   1. Memuat daftar menu (aktif dan nonaktif) beserta resepnya.
//   2. Menambah menu, mengubah menu, dan mengubah status aktif.
//   3. Membuka editor resep untuk satu menu.
//
// TIDAK ADA POLLING di halaman ini (berbeda dengan layar Cashier dan Barista).
// Alasannya: menu dan resep jarang berubah, dan yang berubah biasanya karena
// Admin sendiri yang mengedit. Jadi cukup muat ulang setelah setiap aksi.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/admin/menu/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilSemuaMenu,
  buatMenu,
  kirimLogErrorKeServer,
  ubahMenu,
  ubahStatusMenu,
  type HasilApi,
} from "./api";
import {
  cekHargaMenu,
  cekNamaMenu,
  formatRupiah,
  hargaJadiAngka,
} from "./format";
import { ringkasResep } from "./ringkasan-resep";
import { teksMenuAdmin } from "./teks";
import type { MenuTampil } from "@/lib/server/petakan-admin";

// Bentuk satu menu yang sudah disiapkan untuk tampilan: semua teks sudah jadi.
export type MenuSiapTampil = {
  menuItemId: string;
  nama: string;
  // Harga sudah diformat jadi teks rupiah, misal "Rp 20.000".
  hargaTeks: string;
  isActive: boolean;
  // Teks status untuk ditampilkan: "Aktif" atau "Nonaktif".
  teksStatus: string;
  // Ringkasan resep, misal "3 bahan" atau "Belum ada resep".
  ringkasResep: string;
  // Jumlah bahan di resep (dipakai editor dan pengujian).
  jumlahBahan: number;
};

// Keadaan halaman yang diteruskan ke komponen tampilan.
export type KeadaanMenuAdmin = {
  // Daftar menu, sudah urut dari server (urut nama).
  menu: MenuSiapTampil[];
  // True saat masih memuat untuk pertama kali.
  memuat: boolean;
  // True saat memuat gagal. Daftar yang sudah tampil tidak dihapus.
  gagalMuat: boolean;
  // Pesan aksi terakhir (sukses atau error), atau null.
  pesan: string | null;
  // True kalau pesan terakhir adalah pesan error (bukan informasi).
  pesanAdalahError: boolean;
  // Id menu yang sedang diproses, atau null.
  sedangAksi: string | null;
  // Id menu yang form ubahnya sedang terbuka, atau null.
  formUbahUntuk: string | null;
  // Isian form tambah menu.
  formTambahNama: string;
  formTambahHarga: string;
  // Pesan validasi isian form tambah (null kalau tidak ada masalah).
  pesanFormTambah: string | null;
  // Id menu yang dialog nonaktifnya sedang terbuka, atau null.
  dialogNonaktifUntuk: string | null;
  // Id menu yang editor resepnya sedang terbuka, atau null.
  editorResepUntuk: string | null;
  // Menu versi LENGKAP (dengan isi resep) untuk menu yang sedang diedit.
  // Daftar menu di atas sengaja dibuat ringan (hanya ringkasan resep), jadi
  // editor perlu bentuk lengkapnya. Ini null kalau editor tidak terbuka.
  menuLengkapUntukEditor: MenuTampil | null;
  // Menutup editor resep.
  tutupEditorResep: () => void;
  // Aksi yang dipanggil komponen tampilan.
  ubahFormTambahNama: (nama: string) => void;
  ubahFormTambahHarga: (harga: string) => void;
  kirimTambahMenu: () => void;
  bukaFormUbah: (menuItemId: string) => void;
  tutupFormUbah: () => void;
  kirimUbahMenu: (menuItemId: string, nama: string, harga: string) => void;
  bukaDialogNonaktif: (menuItemId: string) => void;
  tutupDialogNonaktif: () => void;
  konfirmasiNonaktifkan: () => void;
  bukaEditorResep: (menuItemId: string) => void;
  // Mengaktifkan menu (bukan menonaktifkan, jadi tanpa dialog konfirmasi).
  aktifkanMenu: (menuItemId: string) => void;
  tutupPesan: () => void;
  muatUlang: () => void;
};

/**
 * Mengurus logika halaman Menu dan Resep Admin.
 *
 * Output: KeadaanMenuAdmin yang diteruskan ke komponen tampilan.
 */
export function useMenuAdmin(): KeadaanMenuAdmin {
  const [menu, setMenu] = useState<MenuSiapTampil[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanAdalahError, setPesanAdalahError] = useState(false);
  const [sedangAksi, setSedangAksi] = useState<string | null>(null);
  const [formUbahUntuk, setFormUbahUntuk] = useState<string | null>(null);
  const [formTambahNama, setFormTambahNama] = useState("");
  const [formTambahHarga, setFormTambahHarga] = useState("");
  const [pesanFormTambah, setPesanFormTambah] = useState<string | null>(null);
  const [dialogNonaktifUntuk, setDialogNonaktifUntuk] = useState<string | null>(
    null,
  );
  const [editorResepUntuk, setEditorResepUntuk] = useState<string | null>(null);
  // Daftar menu versi lengkap (dengan isi resep), dipakai editor resep.
  // Dipisah dari menu di atas supaya yang tampil tetap ringan.
  const [menuLengkap, setMenuLengkap] = useState<MenuTampil[]>([]);

  // Flag supaya pemanggilan yang tertunda tidak mengubah state setelah halaman
  // ditinggalkan.
  const berhentiRef = useRef(false);

  /**
   * Memuat daftar menu satu kali.
   *
   * Output: void. Hasilnya disimpan ke state.
   */
  const muatMenu = useCallback(async () => {
    const hasil = await ambilSemuaMenu();

    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Gagal: JANGAN hapus daftar yang sudah tampil, supaya Admin masih bisa
      // membaca dan mengedit menu yang sudah terlihat.
      setGagalMuat(true);
      return;
    }

    setGagalMuat(false);
    setMenu(hasil.data.map(siapkanMenu));
    setMenuLengkap(hasil.data);
  }, []);

  // Muat daftar menu saat halaman dibuka.
  //
  // Pemanggilan ditunda satu tick supaya render pertama selesai dulu (pola yang
  // sama seperti hook Cashier dan Barista).
  useEffect(() => {
    berhentiRef.current = false;
    const langsungMuat = setTimeout(() => {
      void muatMenu();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatMenu]);

  /**
   * Memuat ulang daftar menu (tombol "Coba lagi" dan setelah setiap aksi).
   *
   * Output: void.
   */
  function muatUlang(): void {
    setMemuat(true);
    void muatMenu();
  }

  /** Mengubah isian nama pada form tambah. Output: void. */
  function ubahFormTambahNama(nama: string): void {
    setFormTambahNama(nama);
    // Pesan validasi lama dibuang supaya tidak membingungkan saat Admin
    // memperbaiki isian.
    setPesanFormTambah(null);
  }

  /** Mengubah isian harga pada form tambah. Output: void. */
  function ubahFormTambahHarga(harga: string): void {
    setFormTambahHarga(harga);
    setPesanFormTambah(null);
  }

  /**
   * Mengirim form tambah menu.
   *
   * Output: void.
   *
   * Alur:
   *   1. Periksa nama dan harga. Kalau ada yang salah, isi dikembalikan DAN
   *      pesan validasi ditampilkan.
   *   2. Panggil POST /api/admin/menu.
   *   3. Berhasil: kosongkan form dan muat ulang daftar.
   *   4. Gagal: pesan ditampilkan dan form TIDAK dikosongkan, supaya Admin tidak
   *      perlu mengetik ulang (misalnya nama yang bentrok masih tertulis).
   */
  async function kirimTambahMenu(): Promise<void> {
    const cekNama = cekNamaMenu(formTambahNama, {
      wajib: teksMenuAdmin.formMenu.pesanNamaWajib,
      maks: teksMenuAdmin.formMenu.pesanNamaMaks,
    });
    if (!cekNama.valid) {
      setPesanFormTambah(cekNama.pesan);
      return;
    }

    const cekHarga = cekHargaMenu(formTambahHarga, {
      wajib: teksMenuAdmin.formMenu.pesanHargaWajib,
      batas: teksMenuAdmin.formMenu.pesanHargaBatas,
    });
    if (!cekHarga.valid) {
      setPesanFormTambah(cekHarga.pesan);
      return;
    }

    setSedangAksi("tambah");
    setPesan(null);

    const hasil = await buatMenu({
      name: formTambahNama.trim(),
      price: hargaJadiAngka(formTambahHarga),
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Form TIDAK dikosongkan. Nama yang sudah dipakai akan hilang kalau
      // form dikosongkan, padahal Admin mungkin hanya perlu mengganti
      // sedikit.
      tampilkanKegagalan(hasil, "Gagal menambah menu", null);
      return;
    }

    // Berhasil: kosongkan form dan muat ulang daftar.
    setFormTambahNama("");
    setFormTambahHarga("");
    setPesanFormTambah(null);
    setPesan(teksMenuAdmin.pesan.menuTersimpan);
    setPesanAdalahError(false);
    void muatMenu();
  }

  /**
   * Membuka form ubah untuk satu menu.
   *
   * Input: id menu.
   * Output: void.
   */
  function bukaFormUbah(menuItemId: string): void {
    setFormUbahUntuk(menuItemId);
    setPesan(null);
  }

  /** Menutup form ubah. Output: void. */
  function tutupFormUbah(): void {
    setFormUbahUntuk(null);
  }

  /**
   * Mengirim perubahan nama dan harga menu.
   *
   * Input: id menu, nama baru, harga baru (teks).
   * Output: void.
   */
  async function kirimUbahMenu(
    menuItemId: string,
    namaBaru: string,
    hargaBaru: string,
  ): Promise<void> {
    const cekNama = cekNamaMenu(namaBaru, {
      wajib: teksMenuAdmin.formMenu.pesanNamaWajib,
      maks: teksMenuAdmin.formMenu.pesanNamaMaks,
    });
    if (!cekNama.valid) {
      setPesan(cekNama.pesan);
      setPesanAdalahError(true);
      return;
    }

    const cekHarga = cekHargaMenu(hargaBaru, {
      wajib: teksMenuAdmin.formMenu.pesanHargaWajib,
      batas: teksMenuAdmin.formMenu.pesanHargaBatas,
    });
    if (!cekHarga.valid) {
      setPesan(cekHarga.pesan);
      setPesanAdalahError(true);
      return;
    }

    setSedangAksi(menuItemId);
    setPesan(null);

    const hasil = await ubahMenu({
      menuItemId: menuItemId,
      name: namaBaru.trim(),
      price: hargaJadiAngka(hargaBaru),
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Form tetap terbuka supaya Admin bisa memperbaiki isiannya.
      setFormUbahUntuk(menuItemId);
      tampilkanKegagalan(hasil, "Gagal mengubah menu", menuItemId);
      return;
    }

    // Berhasil: tutup form dan muat ulang daftar.
    setFormUbahUntuk(null);
    setPesan(teksMenuAdmin.pesan.menuTersimpan);
    setPesanAdalahError(false);
    void muatMenu();
  }

  /**
   * Membuka dialog konfirmasi nonaktifkan menu.
   *
   * Input: id menu.
   * Output: void.
   *
   * Menonaktifkan menu mengubah apa yang dilihat customer, jadi selalu minta
   * konfirmasi dulu (dokumen Order-flow bagian 6).
   */
  function bukaDialogNonaktif(menuItemId: string): void {
    setDialogNonaktifUntuk(menuItemId);
    setPesan(null);
  }

  /** Menutup dialog nonaktifkan tanpa melakukan apa pun. Output: void. */
  function tutupDialogNonaktif(): void {
    setDialogNonaktifUntuk(null);
  }

  /**
   * Menonaktifkan menu setelah Admin memilih "Ya".
   *
   * Output: void.
   *
   * Menu tidak pernah dihapus, hanya dinonaktifkan (docs/data-model.md aturan 5).
   * Order lama yang memakai menu itu tetap utuh.
   */
  async function konfirmasiNonaktifkan(): Promise<void> {
    const menuItemId = dialogNonaktifUntuk;

    // Tidak ada dialog yang terbuka: tidak ada yang perlu dilakukan.
    if (menuItemId === null) {
      return;
    }

    setDialogNonaktifUntuk(null);
    setSedangAksi(menuItemId);
    setPesan(null);

    const hasil = await ubahStatusMenu({
      menuItemId: menuItemId,
      isActive: false,
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      tampilkanKegagalan(hasil, "Gagal menonaktifkan menu", menuItemId);
      return;
    }

    setPesan(teksMenuAdmin.pesan.menuDinonaktifkan);
    setPesanAdalahError(false);
    void muatMenu();
  }

  /**
   * Mengaktifkan menu (langsung, tanpa dialog).
   *
   * Input: id menu.
   * Output: void.
   *
   * Mengaktifkan menu tidak mengubah apa yang sudah ada, jadi tidak perlu
   * konfirmasi: yang berubah cuma menu itu kembali tampil.
   */
  async function aktifkanMenu(menuItemId: string): Promise<void> {
    setSedangAksi(menuItemId);
    setPesan(null);

    const hasil = await ubahStatusMenu({
      menuItemId: menuItemId,
      isActive: true,
    });

    setSedangAksi(null);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      tampilkanKegagalan(hasil, "Gagal mengaktifkan menu", menuItemId);
      return;
    }

    setPesan(teksMenuAdmin.pesan.menuDiaktifkan);
    setPesanAdalahError(false);
    void muatMenu();
  }

  /**
   * Membuka editor resep untuk satu menu.
   *
   * Input: id menu.
   * Output: void.
   */
  function bukaEditorResep(menuItemId: string): void {
    setEditorResepUntuk(menuItemId);
    setPesan(null);
  }

  /**
   * Menutup editor resep.
   *
   * Output: void.
   *
   * Dipakai hook editor untuk benar-benar menutup editor, baik setelah Admin
   * memilih "Tutup tanpa menyimpan" maupun setelah resep berhasil disimpan.
   * Membatalkan dialog (tetap di editor) bukan urusannya; itu ada di hook
   * editor.
   */
  function tutupEditorResep(): void {
    setEditorResepUntuk(null);
  }

  /** Menutup pesan. Output: void. */
  function tutupPesan(): void {
    setPesan(null);
    setPesanAdalahError(false);
  }

  /**
   * Menampilkan pesan gagal dari sebuah hasil pemanggilan API.
   *
   * Input: hasil yang gagal, kalimat pembuka, dan id menu terkait (boleh kosong).
   * Output: void.
   *
   * Cara kerja:
   *   1. Kalau tipenya VALIDATION_FAILED, pesan dari server dipakai APA ADANYA.
   *      Pesan itu sudah menjelaskan masalahnya (misalnya "nama ... sudah
   *      dipakai"), jadi menambah kalimat lain hanya membuatnya lebih panjang.
   *     oufduh.
   *   2. Kalau ada kode ERR-xxxx, kode itu ikut ditampilkan supaya bisa dicari
   *      di error_logs.
   *   3. Kegagalan penting dikirim ke server lewat /api/log-error.
   */
  function tampilkanKegagalan(
    hasil: HasilApi<unknown>,
    pembuka: string,
    menuItemId: string | null,
  ): void {
    if (hasil.berhasil) {
      return;
    }

    let teksPesan: string;

    if (hasil.error.type === "VALIDATION_FAILED") {
      // Pesan server dipakai apa adanya: di situlah penjelasannya.
      teksPesan = hasil.error.message;
    } else if (hasil.error.code) {
      teksPesan =
        pembuka +
        " " +
        teksMenuAdmin.pesan.aksiGagalDenganKode.replace(
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
      pembuka +
        ": " +
        hasil.error.type +
        " " +
        hasil.error.message +
        (menuItemId === null ? "" : " (menuItemId " + menuItemId + ")"),
    );
  }

  return {
    menu: menu,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesan: pesan,
    pesanAdalahError: pesanAdalahError,
    sedangAksi: sedangAksi,
    formUbahUntuk: formUbahUntuk,
    formTambahNama: formTambahNama,
    formTambahHarga: formTambahHarga,
    pesanFormTambah: pesanFormTambah,
    dialogNonaktifUntuk: dialogNonaktifUntuk,
    editorResepUntuk: editorResepUntuk,
    menuLengkapUntukEditor:
      editorResepUntuk !== null
        ? (menuLengkap.find((satu) => satu.menuItemId === editorResepUntuk) ??
          null)
        : null,
    tutupEditorResep: tutupEditorResep,
    ubahFormTambahNama: ubahFormTambahNama,
    ubahFormTambahHarga: ubahFormTambahHarga,
    kirimTambahMenu: () => {
      void kirimTambahMenu();
    },
    bukaFormUbah: bukaFormUbah,
    tutupFormUbah: tutupFormUbah,
    kirimUbahMenu: (menuItemId: string, nama: string, harga: string) => {
      void kirimUbahMenu(menuItemId, nama, harga);
    },
    bukaDialogNonaktif: bukaDialogNonaktif,
    tutupDialogNonaktif: tutupDialogNonaktif,
    konfirmasiNonaktifkan: () => {
      void konfirmasiNonaktifkan();
    },
    aktifkanMenu: (menuItemId: string) => {
      void aktifkanMenu(menuItemId);
    },
    bukaEditorResep: bukaEditorResep,
    tutupPesan: tutupPesan,
    muatUlang: muatUlang,
  };
}

/**
 * Mengubah menu dari server menjadi bentuk siap tampil.
 *
 * Input: satu menu dari server.
 * Output: MenuSiapTampil, dengan harga sudah diformat dan resep sudah diringkas.
 */
function siapkanMenu(menu: MenuTampil): MenuSiapTampil {
  return {
    menuItemId: menu.menuItemId,
    nama: menu.name,
    // formatRupiah diimport langsung di sini supaya tampilan tidak melakukan
    // perhitungan apa pun.
    hargaTeks: formatRupiah(menu.price),
    isActive: menu.isActive,
    teksStatus: menu.isActive
      ? teksMenuAdmin.daftarMenu.aktif
      : teksMenuAdmin.daftarMenu.nonaktif,
    ringkasResep: ringkasResep(menu.recipe),
    jumlahBahan: menu.recipe.length,
  };
}
