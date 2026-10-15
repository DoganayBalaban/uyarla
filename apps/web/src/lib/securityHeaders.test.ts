import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"

interface HeaderRule {
  source: string
  headers: Array<{ key: string; value: string }>
}

async function siteHeaders(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers!()) as HeaderRule[]
  const all = rules.find((r) => r.source === "/:path*")
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]))
}

describe("security headers (DOG-26)", () => {
  it("are sent on every page", async () => {
    // #58'de next.config.mjs yeniden yazılırken başlıklar sessizce silindi ve
    // üretim iki hafta CSP'siz çalıştı. Bu test o tür bir silmeyi yakalıyor.
    const headers = await siteHeaders()
    expect(headers["X-Frame-Options"]).toBe("DENY")
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["Permissions-Policy"]).toContain("camera=()")
    expect(nextConfig.poweredByHeader).toBe(false)
  })

  it("CSP closes external scripts, framing, foreign form posts and base hijacking", async () => {
    const csp = (await siteHeaders())["Content-Security-Policy"] ?? ""
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ]) {
      expect(csp).toContain(directive)
    }
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'(;|$)/)
    // Tarayıcıdaki hata izleme (DOG-62) Sentry'nin AB alımına gönderiyor.
    expect(csp).toMatch(/connect-src 'self' https:\/\/\*\.ingest\.de\.sentry\.io/)
  })

  it("no component injects raw HTML", () => {
    // 'unsafe-inline' kabulünün dayanağı: XSS'e karşı asıl savunma React'in
    // kaçışlaması. dangerouslySetInnerHTML bu savunmayı deliyor.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) {
          if (readFileSync(path, "utf8").includes("dangerouslySetInnerHTML")) offenders.push(path)
        }
      }
    }
    walk(join(__dirname, ".."))
    expect(offenders).toEqual([])
  })
})
