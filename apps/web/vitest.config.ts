import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // tsconfig'teki `@/*` → `src/*` eşlemesiyle aynı.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    // Tümleşik testler ayrı yapılandırmada koşuyor (vitest.integration.config.ts):
    // Postgres istiyorlar ve DATABASE_URL yükleyen ayrı bir betiğe bağlılar.
    // Dışlanmazlarsa `pnpm test` onları da toplayıp bağlantı hatası veriyor.
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
  },
})
