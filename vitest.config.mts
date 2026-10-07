// Konfigurasi tes unit untuk proyek ini.
// Dipakai oleh perintah `npm run test`.
// Isinya satu-duanya: hanya file .test.ts di dalam src/ yang dijalankan sebagai tes.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const vitestConfig = defineConfig({
  resolve: {
    alias: {
      // Paket "server-only" sengaja melempar error kalau diimpor di luar
      // lingkungan server (untuk menjaga kunci rahasia). Tes berjalan di Node
      // biasa, jadi kalau dibiarkan, menguji file server akan gagal.
      // Di sini paket itu diarahkan ke berkas kosongnya, artinya tes dianggap
      // berjalan di sisi server (persis seperti kondisi sebenarnya).
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // Daftar pola file yang dianggap tes.
    include: ["src/**/*.test.ts"],
  },
});

export default vitestConfig;