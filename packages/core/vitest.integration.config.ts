import { defineConfig } from "vitest/config"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Gerçek LM Studio'ya çağrı yapan testler. Yavaş ve deterministik değiller,
 * bu yüzden normal koşudan ayrılar (spec §12).
 * Çalıştırma: pnpm --filter @uyarla/core test:integration
 */

/**
 * .env depo kökünde; testler LLM_BASE_URL ve LLM_MODEL'i oradan almalı.
 * dotenv bağımlılığı eklemek yerine dosya burada okunuyor — ihtiyaç
 * "KEY=value satırlarını oku" kadar basit.
 */
function kokEnviOku(): Record<string, string> {
  const yol = resolve(import.meta.dirname, "../../.env")
  if (!existsSync(yol)) return {}

  const env: Record<string, string> = {}
  for (const satir of readFileSync(yol, "utf8").split("\n")) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith("#")) continue
    const ayrac = temiz.indexOf("=")
    if (ayrac === -1) continue
    const anahtar = temiz.slice(0, ayrac).trim()
    const deger = temiz.slice(ayrac + 1).trim().replace(/^["']|["']$/g, "")
    env[anahtar] = deger
  }
  return env
}

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    env: kokEnviOku(),
  },
})
