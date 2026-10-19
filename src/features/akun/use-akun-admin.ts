// File ini: logika halaman Kelola Akun (/admin/akun).
//
// Hook useAkunAdmin mengurus:
//   1. Memuat daftar akun.
//   2. Form tambah akun, termasuk membuat password acak.
//   3. Tampilan password SATU KALI setelah akun dibuat atau password diganti, lalu
//      membuangnya dari memori tampilan setelah ditutup.
//   4. Dialog ubah akun (nama dan peran).
//   5. Dialog konfirmasi nonaktifkan atau aktifkan.
//   6. Dialog reset password.
//
// TIDAK ADA POLLING di halaman ini. Alasannya: daftar akun jarang berubah, dan yang
// berubah hanya oleh Admin sendiri (yang sedang memakai halaman ini dan sudah melihat
// hasilnya). Poll otomatis tidak memberi informasi baru, hanya membebani server.
//
// SOAL VALIDASI DI BROWSER:
//   Halaman ini TIDAK menyalin aturan validasi server (panjang nama, aturan password,
//   dan lain-lain). Alasannya: aturan server sudah diuji dan itu satu-satunya yang
//   menentukan hasil akhir. Aturan yang disalin di sini pasti bisa berbeda dari server
//   setelah salah satunya diubah. Jadi browser hanya mengirim apa adanya, lalu
//   menampilkan pesan yang dikembalikan server apa adanya.
//
// SOAL TIDAK ADA STATE "TERKIRIM":
//   Semua aksi memakai satu lapis state saja: isian form dibaca saat tombol ditekan,
//   lalu dikirim apa adanya. Ini cukup karena formnya pendek dan tidak perlu optimistic
//   update, dan membuat satu lapis state saja jauh lebih mudah dibaca dan dilacak.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/akun/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilDaftarAkun,
  buatAkun,
  kirimLogErrorKeServer,
  resetPasswordAkun,
  ubahAkun,
  ubahStatusAkun,
  type AkunTampil,
  type GagalApi,
} from "./api";
import { buatPasswordAcak } from "./password-acak";
import { teksAkun } from "./teks";

// Isi form tambah akun.
export type FormBuatAkun = {
  name: string;
  email: string;
  role: string;
  password: string;
};

// Isi form ubah akun.
export type FormUbahAkun = {
  name: string;
  role: string;
};

// Dialog yang sedang terbuka.
//
// Akun ikut disimpan supaya dialog bisa menampilkan nama dan email tanpa
// perlu mencari lagi di daftar.
export type DialogTerbuka =
  | { jenis: "ubah"; akun: AkunTampil }
  | { jenis: "status"; akun: AkunTampil }
  | { jenis: "reset"; akun: AkunTampil };

// Password yang baru saja dibuat atau diganti, untuk ditampilkan satu kali.
//
// Tipsnya: password HANYA ada di sini selama dialognya terbuka. Begitu ditutup,
// nilainya diganti string kosong (lihat tutupPasswordSekali). Jadi kalau Admin menutup
// dialog tanpa mencatat, passwordnya benar hilang dan harus di-reset ulang.
export type PasswordSekaliTampil = {
  // Email akun yang passwordnya baru dibuat.
  email: string;
  // Passwordnya. String kosong setelah dialog ditutup.
  password: string;
  // true kalau password ini hasil reset, bukan hasil pembuatan akun baru.
  dariReset: boolean;
};

// Keadaan halaman yang diteruskan ke komponen tampilan.
export type KeadaanAkunAdmin = {
  daftar: AkunTampil[];

  // Keadaan pemuatan daftar.
  memuat: boolean;
  gagalMuat: boolean;
  pesanGagalMuat: string | null;
  muatUlang: () => void;

  // Pesan aksi (sukses atau error).
  pesan: string | null;
  pesanAdalahError: boolean;
  tutupPesan: () => void;

  // true selama salah satu aksi berjalan, supaya semua tombol dinonaktifkan.
  sedangAksi: boolean;

  // Form tambah akun.
  formBuat: FormBuatAkun;
  ubahFormBuat: (nama: keyof FormBuatAkun, nilai: string) => void;
  acakPasswordBaru: () => void;
  kirimBuat: () => void;

  // Password yang tampil satu kali, atau null.
  passwordSekali: PasswordSekaliTampil | null;
  tutupPasswordSekali: () => void;

  // Dialog yang sedang terbuka, atau null.
  dialog: DialogTerbuka | null;
  tutupDialog: () => void;

  // Isi form ubah (dipakai dialog ubah).
  formUbah: FormUbahAkun;
  ubahFormUbah: (nama: keyof FormUbahAkun, nilai: string) => void;
  kirimUbah: () => void;

  // Dialog konfirmasi status aktif.
  kirimStatus: () => void;

  // Dialog reset password.
  passwordReset: string;
  ubahPasswordReset: (nilai: string) => void;
  acakPasswordReset: () => void;
  kirimReset: () => void;

  // Pembuka dialog.
  bukaDialogUbah: (akun: AkunTampil) => void;
  bukaDialogStatus: (akun: AkunTampil) => void;
  bukaDialogReset: (akun: AkunTampil) => void;
};

/**
 * Mengurus logika halaman Kelola Akun.
 *
 * Output: KeadaanAkunAdmin yang diteruskan ke komponen tampilan.
 */
export function useAkunAdmin(): KeadaanAkunAdmin {
  // Daftar dan pemuatannya.
  const [daftar, setDaftar] = useState<AkunTampil[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [pesanGagalMuat, setPesanGagalMuat] = useState<string | null>(null);

  // Pesan aksi dan penanda aksi yang sedang berjalan.
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanAdalahError, setPesanAdalahError] = useState(false);
  const [sedangAksi, setSedangAksi] = useState(false);

  // Form tambah.
  const [formBuat, setFormBuat] = useState<FormBuatAkun>(FORM_BUAT_KOSONG);

  // Form ubah dan reset password.
  const [formUbah, setFormUbah] = useState<FormUbahAkun>(FORM_UBAH_KOSONG);
  const [passwordReset, setPasswordReset] = useState("");

  // Dialog dan password satu kali.
  const [dialog, setDialog] = useState<DialogTerbuka | null>(null);
  const [passwordSekali, setPasswordSekali] =
    useState<PasswordSekaliTampil | null>(null);

  // Flag supaya pembaruan state setelah halaman ditinggalkan diabaikan.
  const berhentiRef = useRef(false);
  // Jumlah baris daftar yang sudah termuat, disimpan di ref supaya fungsi muat tidak
  // perlu dibuat ulang setiap daftar berubah.
  const barisRef = useRef<AkunTampil[]>([]);

  /**
   * Memuat daftar akun satu kali.
   *
   * Output: void. Hasilnya disimpan ke state.
   */
  const muat = useCallback(async () => {
    const hasil = await ambilDaftarAkun();

    if (berhentiRef.current) {
      return;
    }

    setMemuat(false);

    if (!hasil.berhasil) {
      // Daftar yang sudah tampil TIDAK dihapus: Admin mungkin sedang membacanya.
      setGagalMuat(barisRef.current.length === 0);
      setPesanGagalMuat(susunPesanGagal(hasil.error));
      return;
    }

    barisRef.current = hasil.data;
    setDaftar(hasil.data);
    setGagalMuat(false);
    setPesanGagalMuat(null);
  }, []);

  // Muat daftar sekali saat halaman dibuka.
  useEffect(() => {
    berhentiRef.current = false;

    // Pemanggilan pertama dijadwalkan lewat setTimeout 0 supaya tidak mengubah state
    // langsung di dalam badan efek.
    const langsungMuat = setTimeout(() => {
      void muat();
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muat]);

  /**
   * Mengganti satu akun di daftar dengan hasil aksi yang baru saja berhasil.
   *
   * Input: akun setelah diubah.
   * Output: void.
   *
   * Kenapa tidak memuat ulang daftar: daftar akun biasanya kecil dan Admin sedang
   * membacanya. Memuat ulang membuat posisi layar terasa bergeser.
   */
  const gantiDiDaftar = useCallback((akunBaru: AkunTampil) => {
    const baru = barisRef.current.map((satu) =>
      satu.id === akunBaru.id ? akunBaru : satu,
    );

    barisRef.current = baru;
    setDaftar(baru);
  }, []);

  /**
   * Menutup dialog yang sedang dibuka dan mengosongkan isiannya.
   *
   * Output: void.
   *
   * Isian dialog ikut dikosongkan supaya dialog berikutnya tidak dimulai dari isian
   * lama. Password pun ikut dibuang (lihat setPasswordReset("") di sini).
   */
  const tutupDialog = useCallback(() => {
    setDialog(null);
    setFormUbah(FORM_UBAH_KOSONG);
    setPasswordReset("");
  }, []);

  /**
   * Menutup tampilan password satu kali dan MENGHAPUSNYA dari memori tampilan.
   *
   * Output: void.
   *
   * DISINI nilai password diganti string kosong, bukan hanya dialognya yang
   * disembunyikan. Kalau hanya dialognya yang disembunyikan, passwordnya masih
   * tertinggal di state dan bisa terbaca lewat alat devs di browser.
   */
  const tutupPasswordSekali = useCallback(() => {
    setPasswordSekali((sebelumnya) =>
      sebelumnya === null ? null : { ...sebelumnya, password: "" },
    );
  }, []);

  /**
   * Menampilkan pesan kegagalan dan, kalau perlu, mengirim log ke /api/log-error.
   *
   * Input: nama aksi (mis. "buat akun"), error dari server, dan true kalau errornya
   *        VALIDATION_FAILED.
   * Output: void.
   *
   * KENAPA VALIDATION_FAILED TIDAK DIKIRIM KE /api/log-error: itu kesalahan pengisian
   * form oleh Admin sendiri, bukan kegagalan sistem (docs/api-contract.md bagian 6
   * menyebut VALIDATION_FAILED tidak dicatat). Mengirimnya akan membuat error_logs
   * penuh baris yang tidak berguna.
   *
   * KENAPA ISI FORM TIDAK IKUT DIKIRIM: yang dikirim hanya nama aksi dan tipe error.
   * Isi form tidak ikut, jadi tidak ada password, email, atau nama akun yang bisa bocor
   * ke tabel error_logs yang tidak bisa dihapus.
   */
  function tampilkanGagal(
    aksi: string,
    error: GagalApi,
    validasi: boolean,
  ): void {
    setPesan(susunPesanGagal(error));
    setPesanAdalahError(true);

    if (!validasi) {
      void kirimLogErrorKeServer(
        "gagal_aksi_staf",
        "Kelola akun gagal (" + aksi + "): " + error.type,
      );
    }
  }

  /**
   * Mengirim pembuatan akun baru.
   *
   * Input: isian form yang sedang diketik.
   * Output: void.
   *
   * KEGAGALAN VALIDATION_FAILED: isian form TIDAK dikosongkan, kecuali kolom password.
   * Alasannya: nama atau email yang salah ketik harus bisa diperbaiki tanpa mengetik
   * ulang semuanya. Password dikosongkan karena Admin sudah mengetiknya sekali, dan
   * kalau nanti berhasil dia bisa memakai tombol "Buat password acak" lagi.
   *
   * CATATAN SOAL PASSWORD: nilai password dari form diteruskan ke server untuk dikirim ke
   * Supabase Auth, DAN ditampilkan satu kali lewat passwordSekali. Selain dua tempat
   * itu, nilainya tidak masuk ke mana pun: tidak masuk daftar akun, tidak masuk pesan,
   * dan tidak masuk log.
   */
  async function kirimBuat(data: FormBuatAkun): Promise<void> {
    setSedangAksi(true);

    const hasil = await buatAkun({
      name: data.name,
      email: data.email,
      role: data.role,
      password: data.password,
    });

    if (berhentiRef.current) {
      return;
    }

    setSedangAksi(false);

    if (!hasil.berhasil) {
      // Kolom password dikosongkan, isian lain dipertahankan.
      setFormBuat((sebelumnya) => ({ ...sebelumnya, password: "" }));
      tampilkanGagal(
        "buat akun",
        hasil.error,
        hasil.error.type === "VALIDATION_FAILED",
      );
      return;
    }

    // Berhasil. Form dikosongkan, lalu daftar dimuat ulang supaya email dan waktu
    // dibuat yang tampil berasal dari server (bukan dari browser).
    setFormBuat(FORM_BUAT_KOSONG);
    void muat();

    // Password ditampilkan satu kali. Dialog ini yang membuat Admin bisa mencatatnya.
    setPasswordSekali({
      email: hasil.data.email,
      password: data.password,
      dariReset: false,
    });
  }

  /**
   * Mengirim perubahan nama dan peran.
   *
   * Input: akun yang jadi sasaran dan isian form dialog.
   * Output: void.
   */
  async function kirimUbah(
    akun: AkunTampil,
    data: FormUbahAkun,
  ): Promise<void> {
    setSedangAksi(true);

    const hasil = await ubahAkun(akun.id, { name: data.name, role: data.role });

    if (berhentiRef.current) {
      return;
    }

    setSedangAksi(false);

    if (!hasil.berhasil) {
      // Isian dialog dipertahankan supaya Admin bisa memperbaiki dan mencoba lagi
      // tanpa mengetik ulang.
      tampilkanGagal(
        "ubah akun",
        hasil.error,
        hasil.error.type === "VALIDATION_FAILED",
      );
      return;
    }

    gantiDiDaftar(hasil.data);
    tutupDialog();
  }

  /**
   * Mengirim perubahan status aktif dari dialog konfirmasi.
   *
   * Input: akun yang jadi sasaran.
   * Output: void.
   */
  async function kirimStatus(akun: AkunTampil): Promise<void> {
    setSedangAksi(true);

    const hasil = await ubahStatusAkun(akun.id, !akun.isActive);

    if (berhentiRef.current) {
      return;
    }

    setSedangAksi(false);

    if (!hasil.berhasil) {
      tutupDialog();
      tampilkanGagal("ubah status akun", hasil.error, false);
      return;
    }

    gantiDiDaftar(hasil.data);
    tutupDialog();
  }

  /**
   * Mengirim password baru dari dialog reset.
   *
   * Input: akun yang jadi sasaran dan password barunya.
   * Output: void.
   *
   * Kalau gagal, kolom password di dialog dikosongkan supaya Admin tidak salah
   * mengira password yang salah itu sudah terpakai.
   */
  async function kirimReset(akun: AkunTampil, password: string): Promise<void> {
    setSedangAksi(true);

    const hasil = await resetPasswordAkun(akun.id, password);

    if (berhentiRef.current) {
      return;
    }

    setSedangAksi(false);

    if (!hasil.berhasil) {
      setPasswordReset("");
      tampilkanGagal(
        "reset password",
        hasil.error,
        hasil.error.type === "VALIDATION_FAILED",
      );
      return;
    }

    // Berhasil: dialog ditutup, lalu password baru ditampilkan satu kali.
    tutupDialog();
    setPasswordSekali({
      email: akun.email,
      password: password,
      dariReset: true,
    });
  }

  return {
    daftar: daftar,
    memuat: memuat,
    gagalMuat: gagalMuat,
    pesanGagalMuat: pesanGagalMuat,
    muatUlang: () => {
      void muat();
    },

    pesan: pesan,
    pesanAdalahError: pesanAdalahError,
    tutupPesan: () => {
      setPesan(null);
    },
    sedangAksi: sedangAksi,

    formBuat: formBuat,
    ubahFormBuat: (nama, nilai) => {
      setFormBuat((sebelumnya) => ({ ...sebelumnya, [nama]: nilai }));
    },
    acakPasswordBaru: () => {
      setFormBuat((sebelumnya) => ({
        ...sebelumnya,
        password: buatPasswordAcak(),
      }));
      setPesan(teksAkun.formBuat.pesanAcak);
      setPesanAdalahError(false);
    },
    kirimBuat: () => {
      void kirimBuat(formBuat);
    },

    passwordSekali: passwordSekali,
    tutupPasswordSekali: tutupPasswordSekali,

    dialog: dialog,
    tutupDialog: tutupDialog,

    formUbah: formUbah,
    ubahFormUbah: (nama, nilai) => {
      setFormUbah((sebelumnya) => ({ ...sebelumnya, [nama]: nilai }));
    },
    kirimUbah: () => {
      if (dialog === null || dialog.jenis !== "ubah") {
        return;
      }
      void kirimUbah(dialog.akun, formUbah);
    },

    kirimStatus: () => {
      if (dialog === null || dialog.jenis !== "status") {
        return;
      }
      void kirimStatus(dialog.akun);
    },

    passwordReset: passwordReset,
    ubahPasswordReset: (nilai) => {
      setPasswordReset(nilai);
    },
    acakPasswordReset: () => {
      setPasswordReset(buatPasswordAcak());
    },
    kirimReset: () => {
      if (dialog === null || dialog.jenis !== "reset") {
        return;
      }
      void kirimReset(dialog.akun, passwordReset);
    },

    bukaDialogUbah: (akun) => {
      // Form dialog diisi dari akun yang dipilih, jadi Admin tidak perlu mengetik ulang.
      setFormUbah({ name: akun.name, role: akun.role });
      setDialog({ jenis: "ubah", akun: akun });
    },
    bukaDialogStatus: (akun) => {
      setDialog({ jenis: "status", akun: akun });
    },
    bukaDialogReset: (akun) => {
      setPasswordReset("");
      setDialog({ jenis: "reset", akun: akun });
    },
  };
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

// Form tambah yang kosong. Didefinisikan sebagai konstanta karena isinya tidak pernah
// berubah: objek ini hanya dibaca.
const FORM_BUAT_KOSONG: FormBuatAkun = {
  name: "",
  email: "",
  // Peran TIDAK punya nilai bawaan. Admin wajib memilih sendiri, dan server juga menolak
  // nilai kosong, jadi pilihan kosong di layar memaksa Admin memutuskan.
  role: "",
  password: "",
};

// Form ubah yang kosong.
const FORM_UBAH_KOSONG: FormUbahAkun = {
  name: "",
  role: "",
};

/**
 * Menyusun pesan ramah untuk kegagalan.
 *
 * Input: error dari server.
 * Output: kalimat untuk ditampilkan ke Admin.
 *
 * KENAPA KODE ERR-XXXX DISISIPKAN: kode itu yang dicari di tabel error_logs
 * (docs/logging.md bagian 5). Kalau kodenya tidak ikut tampil, Admin tidak punya jejak
 * untuk mencari penyebabnya.
 */
function susunPesanGagal(error: GagalApi): string {
  if (error.code !== undefined && error.code !== "") {
    return teksAkun.pesan.gagalDenganKode.replace("{kode}", error.code);
  }

  return error.message !== "" ? error.message : teksAkun.pesan.gagal;
}
