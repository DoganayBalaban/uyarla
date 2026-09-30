import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * Gerçek veritabanına karşı koşan testler. Ayrı yapılandırma: bunlar Postgres
 * ister ve normal `pnpm test` çalışırken ayakta olmayabilir.
 */
export default defineConfig({
  // tsconfig'teki `@/*` → `src/*` eşlemesiyle aynı.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.integration.test.ts"], testTimeout: 30000 },
})
