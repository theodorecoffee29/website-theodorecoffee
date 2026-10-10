// File ini: pembungkus layar Menu dan Resep Admin yang berjalan di browser.
//
// Kenapa perlu: useMenuAdmin dan useEditorResep memakai useState, useEffect, dan
// pemanggilan API, jadi hanya bisa jalan di browser. Halaman
// src/app/admin/menu/page.tsx berjalan di server (karena perlu membaca sesi),
// jadi halaman itu tidak bisa langsung memakai hook. File ini menjadi jembatan.

"use client";

import { LayarMenuAdmin } from "@/components/admin/menu/layar-menu-admin";
import {
  DialogBelumSimpan,
  EditorResep,
} from "@/components/admin/menu/editor-resep";
import { useEditorResep } from "@/features/admin/menu/use-editor-resep";
import { useMenuAdmin } from "@/features/admin/menu/use-menu-admin";
import type { MenuTampil } from "@/lib/server/petakan-admin";

// Props dari halaman server.
type PropsLayarMenuAdminClient = {
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Merakit seluruh layar Menu dan Resep Admin di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarMenuAdminClient({
  namaAkun,
  keluar,
}: PropsLayarMenuAdminClient) {
  const keadaan = useMenuAdmin();

  // Menu yang resepnya sedang diedit, atau null kalau editor tidak terbuka.
  const menuLengkap = keadaan.menuLengkapUntukEditor;

  return (
    <>
      <LayarMenuAdmin keadaan={keadaan} namaAkun={namaAkun} keluar={keluar} />

      {/*
        Editor resep dirender sebagai komponen terpisah (EditorResepBridge)
        supaya hook useEditorResep hanya dibuat ketika editor benar-benar
        dibuka. Kalau hook-nya dibuat sejak awal, daftar bahan akan dimuat
        bahkan saat tidak ada yang diedit.
      */}
      {menuLengkap !== null ? (
        <EditorResepBridge
          menu={menuLengkap}
          muatUlang={keadaan.muatUlang}
          tutupEditor={keadaan.tutupEditorResep}
        />
      ) : null}
    </>
  );
}

/**
 * Jembatan editor resep.
 *
 * Komponen ini dibuat hanya saat editor dibuka, jadi useEditorResep di dalamnya
 * aman dipanggil pada waktu yang tepat.
 */
function EditorResepBridge({
  menu,
  muatUlang,
  tutupEditor,
}: {
  // Menu versi lengkap (dengan isi resep), dari server.
  menu: MenuTampil;
  // Dipanggil setelah resep disimpan, supaya daftar menu dimuat ulang.
  muatUlang: () => void;
  // Menutup editor.
  tutupEditor: () => void;
}) {
  const keadaan = useEditorResep(menu, () => {
    muatUlang();
    tutupEditor();
  });

  return (
    <>
      <EditorResep
        keadaan={keadaan}
        namaMenu={menu.name}
        tutup={keadaan.mintaTutup}
      />

      {keadaan.dialogTutupTerbuka ? (
        <DialogBelumSimpan
          konfirmasiTutup={keadaan.konfirmasiTutup}
          batalTutup={keadaan.batalTutup}
        />
      ) : null}
    </>
  );
}
