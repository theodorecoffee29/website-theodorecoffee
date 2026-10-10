// File ini: logika editor resep satu menu.
//
// Hook useEditorResep mengurus:
//   1. Daftar bahan yang boleh dipilih (bahan yang belum dipakai di resep).
//   2. Tambah, hapus, dan ubah takaran pada baris resep.
//   3. Menyimpan seluruh resep ke server (PUT, mengganti semua).
//   4. Peringatan kalau ditutup tanpa menyimpan.
//
// File ini MURNI teamed dengan file editor-resep.ts (aturan aturannya) supaya
// aturan mudah diuji tanpa browser.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ambilSemuaBahan, kirimLogErrorKeServer, simpanResep } from "./api";
import {
  MAKSIMAL_BARIS,
  adaPerubahan,
  bahanBelumDipakai,
  hapusBarisResep,
  masihBisaTambah,
  tambahBarisResep,
  type HasilOperasi,
} from "./editor-resep";
import { cekTakaran, takaranJadiAngka } from "./takaran";
import { teksMenuAdmin } from "./teks";
import type {
  BarisResepTampil,
  BahanTampil,
  MenuTampil,
} from "@/lib/server/petakan-admin";

// Keadaan editor resep yang diteruskan ke komponen tampilan.
export type KeadaanEditorResep = {
  // Baris resep yang sedang diedit (dengan takaran yang diketik, berupa teks).
  baris: {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    takaranTeks: string;
  }[];
  // Bahan yang belum dipakai di resep, untuk pilihan "Tambah bahan".
  pilihanBahan: BahanTampil[];
  // True kalau masih bisa menambah baris (kurang dari 20).
  bisaTambah: boolean;
  // True kalau ada perubahan yang belum disimpan.
  belumDisimpan: boolean;
  // True saat daftar bahan sedang dimuat.
  memuatBahan: boolean;
  // True saat sedang menyimpan resep.
  sedangMenyimpan: boolean;
  // Pesan error atau informasi, atau null.
  pesan: string | null;
  // Pesan validasi takaran pada baris tertentu (ingredientId), atau null.
  pesanTakaran: string | null;
  // True kalau dialog "tutup tanpa menyimpan" sedang terbuka.
  dialogTutupTerbuka: boolean;
  // Aksi yang dipanggil komponen tampilan.
  tambahBahan: (ingredientId: string) => void;
  hapusBaris: (ingredientId: string) => void;
  ubahTakaran: (ingredientId: string, takaranTeks: string) => void;
  simpan: () => void;
  mintaTutup: () => void;
  konfirmasiTutup: () => void;
  batalTutup: () => void;
  tutupPesan: () => void;
  // Dipanggil setelah resep tersimpan, supaya daftar menu dimuat ulang.
  onTersimpan: () => void;
};

/**
 * Mengurus logika editor resep untuk satu menu.
 *
 * Input:
 *   - menu: menu yang resepnya sedang diedit (untuk knows resep awalnya),
 *   - onTersimpan: dipanggil setelah resep berhasil disimpan.
 * Output: KeadaanEditorResep yang diteruskan ke komponen tampilan.
 */
export function useEditorResep(
  menu: MenuTampil,
  onTersimpan: () => void,
): KeadaanEditorResep {
  // Resep ASLI (dari server), dipakai untuk mendeteksi perubahan.
  const resepAsli: HasilOperasi = menu.recipe;
  const menuItemId = menu.menuItemId;

  // Baris yang sedang diedit. Menyimpan TEKS takaran (bukan angka) supaya
  // Admin bisa mengetik angka kosong atau koma tanpa langsung jadi angka.
  const [baris, setBaris] = useState<
    {
      ingredientId: string;
      ingredientName: string;
      unit: string;
      takaranTeks: string;
    }[]
  >(() => resepAsli.map(keBarisDenganTeks));

  // Semua bahan (untuk pilihan tambah). Dimuat sekali saat editor dibuka.
  const [semuaBahan, setSemuaBahan] = useState<BahanTampil[]>([]);
  const [memuatBahan, setMemuatBahan] = useState(true);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanTakaran, setPesanTakaran] = useState<string | null>(null);
  const [dialogTutupTerbuka, setDialogTutupTerbuka] = useState(false);

  // Flag supaya pemanggilan tertunda tidak mengubah state setelah ditutup.
  const berhentiRef = useRef(false);

  // Resep ASLI disimpan dalam state, terpisah dari baris yang sedang diedit.
  // Dipakai untuk membandingkan "ada perubahan belum disimpan". Setelah resep berhasil
  // disimpan, state ini diperbarui supaya perbandingannya jadi sama lagi.
  const [resepAsliTersimpan, setResepAsliTersimpan] =
    useState<HasilOperasi>(resepAsli);

  /**
   * Memuat daftar bahan sekali saat editor dibuka.
   *
   * Output: void.
   */
  const muatBahan = useCallback(async () => {
    const hasil = await ambilSemuaBahan();

    if (berhentiRef.current) {
      return;
    }

    setMemuatBahan(false);

    if (!hasil.berhasil) {
      setPesan(hasil.error.message);
      return;
    }

    setSemuaBahan(hasil.data);
  }, []);

  // Muat bahan saat editor dibuka.
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

  /**
   * Menambah bahan ke resep.
   *
   * Input: ingredientId bahan yang dipilih.
   * Output: void.
   */
  function tambahBahan(ingredientId: string): void {
    const bahan = semuaBahan.find((satu) => satu.ingredientId === ingredientId);
    if (!bahan) {
      return;
    }

    // Ubah ke bentuk BarisResepTampil supaya aturan tambah/hapus bisa dipakai.
    const daftarSekarang = keOperasi(baris);
    const baru = tambahBarisResep(daftarSekarang, {
      ingredientId: bahan.ingredientId,
      ingredientName: bahan.name,
      unit: bahan.unit,
      qtyPerPortion: 1,
    });

    // Kalau panjangnya sama, berarti tambahan ditolak (bahan sudah dipakai atau
    // daftar penuh). Tampilkan pesan yang sesuai.
    if (baru.length === daftarSekarang.length) {
      if (sudahAdaBahan(daftarSekarang, ingredientId)) {
        setPesan(teksMenuAdmin.editorResep.pesanBahanGanda);
      } else {
        setPesan(
          teksMenuAdmin.editorResep.barisPenuh.replace(
            "{maksimal}",
            String(MAKSIMAL_BARIS),
          ),
        );
      }
      return;
    }

    setPesan(null);
    setBaris(baru.map(keBarisDenganTeks));
  }

  /**
   * Menghapus satu baris resep.
   *
   * Input: ingredientId baris yang dihapus.
   * Output: void.
   */
  function hapusBaris(ingredientId: string): void {
    setBaris(
      hapusBarisResep(keOperasi(baris), ingredientId).map(keBarisDenganTeks),
    );
    setPesan(null);
  }

  /**
   * Mengubah takaran satu baris.
   *
   * Input: ingredientId baris, dan takaran baru (sebagai teks dari isian).
   * Output: void.
   *
   * Takaran tidak divalidasi di sini supaya Admin bebas mengetik (misalnya
   * "0," saat sedang mengetik 0,25). Validasi baru dijalankan saat menyimpan.
   */
  function ubahTakaran(ingredientId: string, takaranTeks: string): void {
    setBaris((sebelumnya) =>
      sebelumnya.map((satu) =>
        satu.ingredientId === ingredientId
          ? { ...satu, takaranTeks: takaranTeks }
          : satu,
      ),
    );
    setPesanTakaran(null);
  }

  /**
   * Menyimpan seluruh resep ke server.
   *
   * Output: void.
   *
   * Alur:
   *   1. Periksa SEMUA takaran. Kalau ada yang tidak valid, tampilkan pesannya
   *      dan jangan kirim apa pun ke server (resep yang terkirim tidak boleh
   *      ada baris yang tidak valid).
   *   2. Kalau semua valid, kirim seluruh baris (PUT = mengganti semua).
   *   3. Resep kosong diizinkan: artinya menu dianggap selalu tersedia.
   */
  async function simpan(): Promise<void> {
    // Periksa semua takaran dulu.
    const barisSiap: { ingredientId: string; qtyPerPortion: number }[] = [];
    for (const satu of baris) {
      const cek = cekTakaran(satu.takaranTeks, pesanTakaranYangDipakai());
      if (!cek.valid) {
        setPesanTakaran(cek.pesan);
        setPesan(cek.pesan);
        return;
      }
      barisSiap.push({
        ingredientId: satu.ingredientId,
        // Takaran dikoma diubah titik dan jadi angka sebelum dikirim.
        qtyPerPortion: takaranJadiAngka(satu.takaranTeks),
      });
    }

    setSedangMenyimpan(true);
    setPesan(null);

    const hasil = await simpanResep({
      menuItemId: menuItemId,
      lines: barisSiap,
    });

    setSedangMenyimpan(false);

    if (berhentiRef.current) {
      return;
    }

    if (!hasil.berhasil) {
      // Resep tidak diubah (server menolak), jadi baris yang diketik tetap ada.
      if (hasil.error.type === "VALIDATION_FAILED") {
        setPesan(hasil.error.message);
      } else if (hasil.error.code) {
        setPesan(
          teksMenuAdmin.pesan.aksiGagalDenganKode.replace(
            "{kode}",
            hasil.error.code,
          ),
        );
      } else {
        setPesan(hasil.error.message);
      }

      void kirimLogErrorKeServer(
        "gagal_aksi_staf",
        "Gagal menyimpan resep menu " +
          menuItemId +
          ": " +
          hasil.error.type +
          " " +
          hasil.error.message,
      );
      return;
    }

    // Berhasil. Resep ASLI disalin dari hasil server. Nama dan satuan diambil dari
    // baris yang sedang diedit (baris itu sudah punya nama dan satuan dari
    // server saat editor dibuka, atau saat Admin menambah bahan baru), jadi tidak
    // perlu kueri tambahan.
    const barisBaru: HasilOperasi = hasil.data.lines.map((satu) => {
      const barisLama = baris.find((b) => b.ingredientId === satu.ingredientId);
      return {
        ingredientId: satu.ingredientId,
        ingredientName: barisLama?.ingredientName ?? "",
        unit: barisLama?.unit ?? "",
        qtyPerPortion: satu.qtyPerPortion,
      };
    });

    // Resep ASLI diperbarui ke yang baru saja disimpan, dan baris yang diedit
    // disalin dari situ. Karena keduanya berasal dari nilai yang sama, penanda
    // "ada perubahan belum disimpan" otomatis hilang.
    setResepAsliTersimpan(barisBaru);
    setBaris(barisBaru.map(keBarisDenganTeks));
    setPesan(teksMenuAdmin.pesan.resepTersimpan);
    onTersimpan();
  }

  /**
   * Meminta menutup editor.
   *
   * Output: void.
   *
   * Kalau ada perubahan yang belum disimpan, dialog konfirmasi dibuka dulu
   * supaya perubahan tidak hilang tanpa sengaja. Kalau tidak ada perubahan,
   * editor langsung ditutup (lewat pemanggil yang memeriksa belumDisimpan).
   */
  function mintaTutup(): void {
    if (adaPerubahan(keOperasi(baris), resepAsliTersimpan)) {
      setDialogTutupTerbuka(true);
      return;
    }
    // Tidak ada perubahan: pemanggil menutup editor.
    onTersimpan();
  }

  /**
   * Menutup editor tanpa menyimpan (setelah konfirmasi).
   *
   * Output: void. Memanggil onTersimpan supaya editor ditutup, dan perubahan
   * dibuang.
   */
  function konfirmasiTutup(): void {
    setDialogTutupTerbuka(false);
    // Kembalikan baris ke resep asli, supaya kalau editor dibuka lagi isinya
    // sesuai dengan yang tersimpan.
    setBaris(resepAsliTersimpan.map(keBarisDenganTeks));
    onTersimpan();
  }

  /** Membatalkan penutupan (tetap di editor). Output: void. */
  function batalTutup(): void {
    setDialogTutupTerbuka(false);
  }

  /** Menutup pesan. Output: void. */
  function tutupPesan(): void {
    setPesan(null);
  }

  // Bahan yang belum dipakai: dipakai di pilihan "Tambah bahan".
  const pilihanBahan = bahanBelumDipakai(semuaBahan, keOperasi(baris));

  // Apakah masih bisa menambah baris.
  const bisaTambah = masihBisaTambah(keOperasi(baris));

  // Apakah ada perubahan yang belum disimpan.
  const belumDisimpan = adaPerubahan(keOperasi(baris), resepAsliTersimpan);

  return {
    baris: baris,
    pilihanBahan: pilihanBahan,
    bisaTambah: bisaTambah,
    belumDisimpan: belumDisimpan,
    memuatBahan: memuatBahan,
    sedangMenyimpan: sedangMenyimpan,
    pesan: pesan,
    pesanTakaran: pesanTakaran,
    dialogTutupTerbuka: dialogTutupTerbuka,
    tambahBahan: tambahBahan,
    hapusBaris: hapusBaris,
    ubahTakaran: ubahTakaran,
    simpan: () => {
      void simpan();
    },
    mintaTutup: mintaTutup,
    konfirmasiTutup: konfirmasiTutup,
    batalTutup: batalTutup,
    tutupPesan: tutupPesan,
    onTersimpan: onTersimpan,
  };
}

// -----------------------------------------------------------------------------
// Pembantu
// -----------------------------------------------------------------------------

/**
 * Mengubah baris yang sedang diedit (takaran berupa teks) menjadi bentuk
 * operasi (takaran berupa angka), supaya aturan di editor-resep.ts bisa dipakai.
 *
 * Input: baris yang sedang diedit.
 * Output: HasilOperasi (takaran berupa angka).
 *
 * Takaran yang belum diubah dari bawaan 1 tetap dianggap 1 (dipakai saat baris
 * baru ditambahkan). Kalau teksnya tidak valid, dipakai 1 supaya tidak
 *Ketidakpastian; validasi sebenarnya dilakukan saat menyimpan.
 */
function keOperasi(
  baris: {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    takaranTeks: string;
  }[],
): HasilOperasi {
  return baris.map((satu) => ({
    ingredientId: satu.ingredientId,
    ingredientName: satu.ingredientName,
    unit: satu.unit,
    // aslinya harus angka; kalau teksnya kosong (baru ditambahkan), pakai 1.
    qtyPerPortion:
      satu.takaranTeks === "" ? 1 : takaranJadiAngka(satu.takaranTeks),
  }));
}

/**
 * Mengubah baris operasi menjadi baris yang siap ditampilkan (takaran sebagai
 * teks).
 *
 * Input: HasilOperasi.
 * Output: baris dengan takaranTeks.
 */
function keBarisDenganTeks(satu: BarisResepTampil): {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  takaranTeks: string;
} {
  return {
    ingredientId: satu.ingredientId,
    ingredientName: satu.ingredientName,
    unit: satu.unit,
    // Takaran dari server dikembalikan seperti apa adanya (angka jadi teks).
    takaranTeks: String(satu.qtyPerPortion),
  };
}

// Pesan yang dipakai untuk memeriksa takaran (dari teks.ts).
function pesanTakaranYangDipakai() {
  return {
    wajib: teksMenuAdmin.editorResep.pesanTakaranWajib,
    positif: teksMenuAdmin.editorResep.pesanTakaranPositif,
    desimal: teksMenuAdmin.editorResep.pesanTakaranDesimal,
    maks: teksMenuAdmin.editorResep.pesanTakaranMaks,
  };
}

// Memeriksa apakah bahan sudah dipakai di daftar resep sekarang.
// Dipakai untuk membedakan alasan tambahan ditolak: bahan ganda atau daftar penuh.
function sudahAdaBahan(daftar: HasilOperasi, ingredientId: string): boolean {
  return daftar.some((satu) => satu.ingredientId === ingredientId);
}
