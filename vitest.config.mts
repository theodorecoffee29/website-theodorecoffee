// Konfigurasi tes unit untuk proyek ini.
// Dipakai oleh perintah `npm run test`.
// Isinya satu-duanya: hanya file .test.ts di dalam src/ yang dijalankan sebagai tes.

import { defineConfig } from "vitest/config";

const vitestConfig = defineConfig({
  test: {
    // Daftar pola file yang dianggap tes.
    include: ["src/**/*.test.ts"],
  },
});

export default vitestConfig;
