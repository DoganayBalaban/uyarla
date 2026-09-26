import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    // Tümleşik testler ayrı yapılandırmada koşuyor (vitest.integration.config.ts):
    // Postgres istiyorlar ve DATABASE_URL yükleyen ayrı bir betiğe bağlılar.
    // Dışlanmazlarsa `pnpm test` onları da toplayıp bağlantı hatası veriyor.
    exclude: ["lib/**/*.integration.test.ts", "node_modules/**"],
  },
})
