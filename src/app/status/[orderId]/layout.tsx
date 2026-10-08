// File ini: metadata untuk halaman status pesanan.
//
// Kenapa file terpisah: halaman /status/[orderId] harus berupa Client Component
// (karena membaca localStorage dan memanggil API), sedangkan metadata harus
// diekspor dari file Server Component. Karena itu metadata ditaruh di layout
// terpisah yang tetap Server Component.
//
// Kenapa noindex: halaman ini menampilkan status pesanan seseorang, jadi tidak
// boleh masuk mesin pencari (docs/pemissions.md bagian 3: "Halaman status
// customer dipasang noindex"). Field robots di bawah memberi tahu crawler
// untuk tidak mengindeks halaman ini.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status pesanan - Theodore Coffee",
  description: "Status pesanan kamu di Theodore Coffee.",
  // robots: memberi tahu mesin pencari jangan mengindeks halaman ini.
  robots: {
    index: false,
    follow: false,
  },
};

export default function LayoutStatus({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
