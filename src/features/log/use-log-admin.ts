// File ini: logika halaman log Admin (/admin/log).
//
// Hook useLogAdmin mengurus dua bagian sekaligus, karena keduanya memakai pola yang
// sama (formulir filter, memuat halaman pertama, menambah halaman berikutnya):
//   1. Bagian "Aktivitas": memuat, memfilter, dan menambah halaman log aktivitas.
//   2. Bagian "Error": memuat, memfilter, dan menambah halaman log error.
//
// TIDAK ADA POLLING di halaman ini. Alasannya: halaman log dibuka saat Admin sedang
// mencari penyebab masalah, dan yang dilakukan Admin adalah membaca dan memfilter
// sendiri. Memuat ulang otomatis justru membingungkan (baris yang sedang dibaca bisa
// bergeser) dan tidak memberi informasi baru, karena tidak ada aksi dari layar ini yang
// mengubah log. Tombol "Coba lagi" sudah cukup.
//
// CARA KERJA STATE, DIPISAH AGAR MUDAH DIBACA:
//   Setiap bagian punya dua lapis filter:
//     - form     : isi formulir yang SEDANG DIKETIK Admin (belum berlaku).
//     - berlaku  : filter yang benar-benar dipakai request terakhir.
//   Tombol "Terapkan" memindahkan isian formulir ke filter yang berlaku lalu memuat
//   halaman pertama. Tombol "Atur ulang" mengosongkan keduanya dan memuat tanpa filter.
//   Kenapa filter tidak langsung berlaku saat diketik: kalau begitu, setiap ketikan huruf
//   memicu permintaan ke server dan layar berkedip terus.
//
// MENGAPA FILTER DISALURKAN SEBAGAI PARAMETER, BUKAN DIBACA DARI STATE:
//   Fungsi muatAktivitas menerima filter sebagai parameter. Alasannya, setState di React
//   bersifat asynchronous: kalau filter baru disimpan lewat setBerlakuAktivitas lalu
//   muatAktivitas dipanggil saat itu juga, muatAktivitas masih membaca filter LAMA.
//   Dengan filter dikirim sebagai parameter, tidak ada keadaan yang bisa tertinggal satu
//   langkah. Itu juga membuat fungsi muat tidak perlu dibuat ulang, sehingga interval
//   pemuatan tidak pernah terputus-putus.
//
// Mengikuti aturan di AGENTS.md: logika di src/features/, komponen tampilan di
// src/components/log/ hanya menerima props.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilLogAktivitas,
  ambilLogError,
  kirimLogErrorKeServer,
  type FilterAktivitasKirim,
  type FilterErrorKirim,
  type GagalApi,
} from "./api";
import { normalisasiKodeCari } from "./label";
import { teksLog } from "./teks";
import type {
  BarisAktivitasTampil,
  BarisErrorTampil,
} from "@/lib/server/petakan-log";

// Isi formulir filter aktivitas (yang sedang diketik).
export type FormFilterAktivitas = {
  from: string;
  to: string;
  action: string;
  actorRole: string;
  entityType: string;
  orderId: string;
};

// Isi formulir filter error (yang sedang diketik).
export type FormFilterError = {
  // Kode yang diketik Admin. Boleh huruf kecil dan spasi; dinormalkan sebelum dikirim.
  code: string;
  from: string;
  to: string;
  severity: string;
  source: string;
  orderId: string;
};

// Keadaan satu bagian log yang diteruskan ke komponen tampilan.
type KeadaanBagian<T> = {
  // Baris yang sudah dimuat, dari yang paling baru.
  items: T[];
  // true kalau masih ada halaman berikutnya.
  adaLebihBanyak: boolean;
  // true selama permintaan pertama untuk filter yang berlaku.
  memuat: boolean;
  // true saat permintaan berjalan padahal baris lama sudah tampil (mis. saat menekan
  // "Muat lebih banyak").
  memuatLebih: boolean;
  // true kalau pemuatan gagal dan belum ada baris yang bisa ditampilkan. Kalau sudah ada
  // baris, barisnya tetap dipertahankan.
  gagalMuat: boolean;
  // Pesan ramah, lengkap dengan kode ERR-xxxx kalau ada, atau null.
  pesan: string | null;
  // true kalau filter orderId yang berlaku terisi. Layar memakai ini untuk mengganti
  // catatan arah urutan.
  modeJejakOrder: boolean;
  // Muat ulang halaman pertama dengan filter yang sedang berlaku.
  muatUlang: () => void;
  // Ambil halaman berikutnya dan menambahkannya DI BAWAH baris yang sudah ada.
  muatLebihBanyak: () => void;
};

// Keadaan bagian aktivitas yang diteruskan ke komponen tampilan.
export type KeadaanAktivitas = KeadaanBagian<BarisAktivitasTampil> & {
  form: FormFilterAktivitas;
  ubahForm: (nama: keyof FormFilterAktivitas, nilai: string) => void;
  // Pindahkan isian formulir ke filter yang berlaku, lalu muat halaman pertama.
  terapkan: () => void;
  // Kosongkan filter dan muat ulang tanpa filter.
  aturUlang: () => void;
  // Isi kolom id order dengan order ini, lalu terapkan. Dipakai tombol "Lihat jejak
  // order ini".
  lihatJejakOrder: (orderId: string) => void;
};

// Keadaan bagian error yang diteruskan ke komponen tampilan.
export type KeadaanError = KeadaanBagian<BarisErrorTampil> & {
  form: FormFilterError;
  ubahForm: (nama: keyof FormFilterError, nilai: string) => void;
  terapkan: () => void;
  aturUlang: () => void;
  lihatJejakOrder: (orderId: string) => void;
};

// Keadaan seluruh halaman log.
export type KeadaanLogAdmin = {
  aktivitas: KeadaanAktivitas;
  error: KeadaanError;
};

/**
 * Mengurus logika halaman log Admin.
 *
 * Output: KeadaanLogAdmin yang diteruskan ke komponen tampilan.
 */
export function useLogAdmin(): KeadaanLogAdmin {
  // --- Bagian aktivitas ---
  const [itemsAktivitas, setItemsAktivitas] = useState<BarisAktivitasTampil[]>(
    [],
  );
  const [formAktivitas, setFormAktivitas] = useState<FormFilterAktivitas>(
    FILTER_AKTIVITAS_KOSONG,
  );
  const [berlakuAktivitas, setBerlakuAktivitas] = useState<FormFilterAktivitas>(
    FILTER_AKTIVITAS_KOSONG,
  );
  const [cursorAktivitas, setCursorAktivitas] = useState<string | null>(null);
  const [memuatAktivitas, setMemuatAktivitas] = useState(true);
  const [memuatLebihAktivitas, setMemuatLebihAktivitas] = useState(false);
  const [gagalAktivitas, setGagalAktivitas] = useState(false);
  const [pesanAktivitas, setPesanAktivitas] = useState<string | null>(null);

  // --- Bagian error ---
  const [itemsError, setItemsError] = useState<BarisErrorTampil[]>([]);
  const [formError, setFormError] =
    useState<FormFilterError>(FILTER_ERROR_KOSONG);
  const [berlakuError, setBerlakuError] =
    useState<FormFilterError>(FILTER_ERROR_KOSONG);
  const [cursorError, setCursorError] = useState<string | null>(null);
  const [memuatError, setMemuatError] = useState(true);
  const [memuatLebihError, setMemuatLebihError] = useState(false);
  const [gagalError, setGagalError] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // Flag supaya pembaruan state setelah halaman ditinggalkan diabaikan.
  const berhentiRef = useRef(false);

  // Jumlah baris yang sudah dimuat, disimpan di ref. Alasannya: baris-baris ini
  // ditambahkan di dalam fungsi muat, dan penggabungan harus membaca nilai terbaru
  // tanpa membuat fungsi muat dibuat ulang (kalau begitu, efek pemuatan ikut berulang).
  const barisAktivitasRef = useRef<BarisAktivitasTampil[]>([]);
  const barisErrorRef = useRef<BarisErrorTampil[]>([]);

  /**
   * Memuat satu halaman log aktivitas.
   *
   * Input:
   *   - form: filter yang berlaku untuk permintaan ini.
   *   - cursor: cursor halaman sebelumnya, atau null untuk halaman pertama.
   * Output: void. Hasilnya disimpan ke state.
   */
  const muatAktivitas = useCallback(
    async (form: FormFilterAktivitas, cursor: string | null) => {
      const hasil = await ambilLogAktivitas(
        keFilterAktivitasKirim(form, cursor),
      );

      if (berhentiRef.current) {
        return;
      }

      // Halaman pertama memakai status "Memuat...". Halaman berikutnya memakai penanda
      // di tombolnya, supaya baris yang sedang dibaca tidak hilang.
      if (cursor === null) {
        setMemuatAktivitas(true);
      } else {
        setMemuatLebihAktivitas(true);
      }

      if (!hasil.berhasil) {
        // Baris yang sudah tampil TIDAK dihapus. Admin sedang membaca baris-baris itu,
        // dan menghapusnya karena satu permintaan gagal membuat jejaknya hilang dari
        // layar.
        setGagalAktivitas(barisAktivitasRef.current.length === 0);
        setPesanAktivitas(susunPesanGagal(hasil.error));
        laporkanGagal("log aktivitas", hasil.error);
        return;
      }

      // Berhasil. Halaman berikutnya ditambahkan DI BAWAH baris yang sudah ada.
      const gabungan =
        cursor === null
          ? hasil.data.items
          : [...barisAktivitasRef.current, ...hasil.data.items];

      barisAktivitasRef.current = gabungan;
      setItemsAktivitas(gabungan);
      setCursorAktivitas(hasil.data.nextCursor);
      setMemuatAktivitas(false);
      setMemuatLebihAktivitas(false);
      setGagalAktivitas(false);
      setPesanAktivitas(null);
    },
    [],
  );

  /**
   * Memuat satu halaman log error.
   *
   * Input:
   *   - form: filter yang berlaku untuk permintaan ini.
   *   - cursor: cursor halaman sebelumnya, atau null untuk halaman pertama.
   * Output: void. Hasilnya disimpan ke state.
   */
  const muatError = useCallback(
    async (form: FormFilterError, cursor: string | null) => {
      const hasil = await ambilLogError(keFilterErrorKirim(form, cursor));

      if (berhentiRef.current) {
        return;
      }

      if (cursor === null) {
        setMemuatError(true);
      } else {
        setMemuatLebihError(true);
      }

      if (!hasil.berhasil) {
        setGagalError(barisErrorRef.current.length === 0);
        setPesanError(susunPesanGagal(hasil.error));
        laporkanGagal("log error", hasil.error);
        return;
      }

      const gabungan =
        cursor === null
          ? hasil.data.items
          : [...barisErrorRef.current, ...hasil.data.items];

      barisErrorRef.current = gabungan;
      setItemsError(gabungan);
      setCursorError(hasil.data.nextCursor);
      setMemuatError(false);
      setMemuatLebihError(false);
      setGagalError(false);
      setPesanError(null);
    },
    [],
  );

  /**
   * Menerapkan filter baru pada bagian aktivitas: mengosongkan baris lama, lalu memuat
   * halaman pertama dengan filter baru.
   *
   * Input: filter baru.
   * Output: void.
   *
   * Baris lama DIKOSONGKAN dengan sengaja (berbeda dari kasus gagal). Alasannya: filter
   * sudah berubah, jadi baris lama tidak lagi menjawab pertanyaan Admin, dan
   * mencampurkannya dengan hasil baru akan menyesatkan.
   */
  const terapkanAktivitas = useCallback(
    (formBaru: FormFilterAktivitas) => {
      setBerlakuAktivitas(formBaru);
      barisAktivitasRef.current = [];
      setItemsAktivitas([]);
      setCursorAktivitas(null);
      setGagalAktivitas(false);
      setPesanAktivitas(null);
      void muatAktivitas(formBaru, null);
    },
    [muatAktivitas],
  );

  /**
   * Menerapkan filter baru pada bagian error, dengan alasan yang sama seperti
   * terapkanAktivitas.
   *
   * Input: filter baru.
   * Output: void.
   */
  const terapkanError = useCallback(
    (formBaru: FormFilterError) => {
      setBerlakuError(formBaru);
      barisErrorRef.current = [];
      setItemsError([]);
      setCursorError(null);
      setGagalError(false);
      setPesanError(null);
      void muatError(formBaru, null);
    },
    [muatError],
  );

  // Muat kedua bagian sekali saat halaman dibuka.
  useEffect(() => {
    berhentiRef.current = false;

    // Pemanggilan pertama dijadwalkan lewat setTimeout 0 supaya tidak mengubah state
    // langsung di dalam badan efek.
    const langsungMuat = setTimeout(() => {
      void muatAktivitas(FILTER_AKTIVITAS_KOSONG, null);
      void muatError(FILTER_ERROR_KOSONG, null);
    }, 0);

    return () => {
      clearTimeout(langsungMuat);
      berhentiRef.current = true;
    };
  }, [muatAktivitas, muatError]);

  return {
    aktivitas: {
      items: itemsAktivitas,
      adaLebihBanyak: cursorAktivitas !== null,
      memuat: memuatAktivitas,
      memuatLebih: memuatLebihAktivitas,
      gagalMuat: gagalAktivitas,
      pesan: pesanAktivitas,
      modeJejakOrder: berlakuAktivitas.orderId !== "",
      form: formAktivitas,
      ubahForm: (nama, nilai) => {
        setFormAktivitas((sebelumnya) => ({ ...sebelumnya, [nama]: nilai }));
      },
      terapkan: () => {
        terapkanAktivitas(formAktivitas);
      },
      aturUlang: () => {
        setFormAktivitas(FILTER_AKTIVITAS_KOSONG);
        terapkanAktivitas(FILTER_AKTIVITAS_KOSONG);
      },
      muatUlang: () => {
        void muatAktivitas(berlakuAktivitas, null);
      },
      muatLebihBanyak: () => {
        // Cursor null berarti sudah baris terakhir. Tombolnya tidak muncul di kasus itu,
        // tapi pemeriksa ini mencegah permintaan sia-sia kalau tetap terpakai.
        if (cursorAktivitas === null) {
          return;
        }
        void muatAktivitas(berlakuAktivitas, cursorAktivitas);
      },
      lihatJejakOrder: (orderId) => {
        const baru: FormFilterAktivitas = {
          ...formAktivitas,
          orderId: orderId,
        };
        setFormAktivitas(baru);
        terapkanAktivitas(baru);
      },
    },
    error: {
      items: itemsError,
      adaLebihBanyak: cursorError !== null,
      memuat: memuatError,
      memuatLebih: memuatLebihError,
      gagalMuat: gagalError,
      pesan: pesanError,
      modeJejakOrder: berlakuError.orderId !== "",
      form: formError,
      ubahForm: (nama, nilai) => {
        setFormError((sebelumnya) => ({ ...sebelumnya, [nama]: nilai }));
      },
      terapkan: () => {
        terapkanError(formError);
      },
      aturUlang: () => {
        setFormError(FILTER_ERROR_KOSONG);
        terapkanError(FILTER_ERROR_KOSONG);
      },
      muatUlang: () => {
        void muatError(berlakuError, null);
      },
      muatLebihBanyak: () => {
        if (cursorError === null) {
          return;
        }
        void muatError(berlakuError, cursorError);
      },
      lihatJejakOrder: (orderId) => {
        const baru: FormFilterError = { ...formError, orderId: orderId };
        setFormError(baru);
        terapkanError(baru);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

// Formulir filter yang kosong.
//
// Dipakai sebagai nilai awal dan saat tombol "Atur ulang" ditekan. Didefinisikan
// sebagai konstanta (bukan fungsi) karena isinya tidak pernah berubah: objek ini hanya
// dibaca, tidak pernah diubah.
const FILTER_AKTIVITAS_KOSONG: FormFilterAktivitas = {
  from: "",
  to: "",
  action: "",
  actorRole: "",
  entityType: "",
  orderId: "",
};

const FILTER_ERROR_KOSONG: FormFilterError = {
  code: "",
  from: "",
  to: "",
  severity: "",
  source: "",
  orderId: "",
};

/**
 * Mengubah formulir filter aktivitas menjadi objek yang dikirim ke server.
 *
 * Input: isian formulir dan cursor halaman sebelumnya (boleh null).
 * Output: objek filter siap kirim, dengan isian yang kosong dibuang.
 *
 * Kenapa isian kosong dibuang, bukan dikirim sebagai string kosong: server akan menolak
 * nilai kosong dengan pesan "tidak sesuai", padahal Admin memang tidak mengisi apa pun.
 */
function keFilterAktivitasKirim(
  form: FormFilterAktivitas,
  cursor: string | null,
): FilterAktivitasKirim {
  const filter: FilterAktivitasKirim = {};

  if (form.from !== "") {
    filter.from = form.from;
  }
  if (form.to !== "") {
    filter.to = form.to;
  }
  if (form.action !== "") {
    filter.action = form.action;
  }
  if (form.actorRole !== "") {
    filter.actorRole = form.actorRole;
  }
  if (form.entityType !== "") {
    filter.entityType = form.entityType;
  }
  if (form.orderId !== "") {
    filter.orderId = form.orderId;
  }
  if (cursor !== null) {
    filter.cursor = cursor;
  }

  return filter;
}

/**
 * Mengubah formulir filter error menjadi objek yang dikirim ke server.
 *
 * Input: isian formulir dan cursor halaman sebelumnya (boleh null).
 * Output: objek filter siap kirim, dengan isian yang kosong dibuang.
 *
 * CATATAN SOAL KODE ERROR: kode yang diketik Admin dinormalkan lebih dulu
 * (normalisasiKodeCari). Kalau yang diketik bukan bentuk kode yang benar, kode itu TIDAK
 * dikirim sama sekali, dan filter lain di formulir tetap bisa dipakai. Ini penting:
 * kode error sering disalin dari chat customer dan mudah salah ketik, dan satu ketik
 * salah tidak boleh membuat seluruh bagian error tidak berguna.
 */
function keFilterErrorKirim(
  form: FormFilterError,
  cursor: string | null,
): FilterErrorKirim {
  const filter: FilterErrorKirim = {};

  const kode = normalisasiKodeCari(form.code);
  if (kode !== null) {
    filter.code = kode;
  }
  if (form.from !== "") {
    filter.from = form.from;
  }
  if (form.to !== "") {
    filter.to = form.to;
  }
  if (form.severity !== "") {
    filter.severity = form.severity;
  }
  if (form.source !== "") {
    filter.source = form.source;
  }
  if (form.orderId !== "") {
    filter.orderId = form.orderId;
  }
  if (cursor !== null) {
    filter.cursor = cursor;
  }

  return filter;
}

/**
 * Menyusun pesan ramah untuk kegagalan memuat.
 *
 * Input: error dari server.
 * Output: kalimat untuk ditampilkan ke Admin.
 *
 * KENAPA KODE ERR-XXXX DISISIPKAN: kode itu yang dicari di tabel error_logs
 * (docs/logging.md bagian 5). Kalau kodenya tidak ikut tampil, Admin tidak punya
 * breadcrumbs untuk mencari penyebabnya.
 */
function susunPesanGagal(error: GagalApi): string {
  if (error.code !== undefined && error.code !== "") {
    return teksLog.pesan.gagalMuatDenganKode.replace("{kode}", error.code);
  }

  return teksLog.pesan.gagalMuat;
}

/**
 * Melaporkan kegagalan memuat ke /api/log-error.
 *
 * Input: nama bagian ("log aktivitas" atau "log error") dan error dari server.
 * Output: void.
 *
 * Ini mengikuti docs/logging.md bagian 7: kegagalan memuat halaman adalah salah satu
 * kegagalan yang perlu dicatat. Yang penting: pelaporan ini TIDAK boleh membuat halaman
 * gagal, jadi hasilnya tidak ditunggu (fungsi di api.ts sudah menelan kegagalannya
 * sendiri).
 */
function laporkanGagal(namaBagian: string, error: GagalApi): void {
  void kirimLogErrorKeServer(
    "gagal_muat_status",
    "Halaman log gagal dimuat (" + namaBagian + "): " + error.type,
  );
}
