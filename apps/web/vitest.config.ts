import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // tsconfig'teki `@/*` → `src/*` eşlemesiyle aynı.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Next'in kendi JSX dönüşümü gibi otomatik çalışma zamanı; bileşenler React'i içe aktarmıyor.
  esbuild: { jsx: "automatic" },
  test: {
    // .tsx: bileşen duman testleri (renderToStaticMarkup, DOM yok).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Tümleşik testler ayrı yapılandırmada koşuyor (vitest.integration.config.ts):
    // Postgres istiyorlar ve DATABASE_URL yükleyen ayrı bir betiğe bağlılar.
    // Dışlanmazlarsa `pnpm test` onları da toplayıp bağlantı hatası veriyor.
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
  },
})
