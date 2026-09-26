import { defineConfig } from "vitest/config"

/**
 * Gerçek veritabanına karşı koşan testler. Ayrı yapılandırma: bunlar Postgres
 * ister ve normal `pnpm test` çalışırken ayakta olmayabilir.
 */
export default defineConfig({
  test: { include: ["lib/**/*.integration.test.ts"], testTimeout: 30000 },
})
