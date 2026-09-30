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
function readRootEnv(): Record<string, string> {
  const envPath = resolve(import.meta.dirname, "../../.env")
  if (!existsSync(envPath)) return {}

  const env: Record<string, string> = {}
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")
    env[key] = value
  }
  return env
}

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    env: readRootEnv(),
  },
})
