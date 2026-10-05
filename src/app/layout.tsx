// Kerangka (layout) yang membungkus semua halaman.
// Dipakai Next.js App Router: apa pun di dalam <body> otomatis dapat
// style global dari globals.css dan metadata dari variabel `metadata` di bawah.

import type { Metadata } from "next";
import "./globals.css";

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
