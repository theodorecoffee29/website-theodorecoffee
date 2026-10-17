// Kerangka (layout) yang membungkus semua halaman.
// Dipakai Next.js App Router: apa pun di dalam <body> otomatis dapat
// style global dari globals.css dan metadata dari variabel `metadata` di bawah.

import type { Metadata } from "next";
import "./globals.css";
// Gaya khusus pencetakan laporan (@media print). Diimpor setelah globals.css
// supaya aturan cetaknya berlaku di atas gaya umum. Isinya hanya aturan cetak, jadi
// halaman lain tidak terpengaruh.
import "./cetak.css";

// Metadata yang dibaca browser dan mesin pencari untuk semua halaman.
export const metadata: Metadata = {
  title: "Theodore Coffee",
  description: "Sistem pemesanan kopi Theodore Coffee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="id" supaya bahasa halaman dibaca sebagai Bahasa Indonesia.
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
