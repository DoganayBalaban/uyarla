import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Web, @uyarla/core'u yalnızca alt yollardan içe aktarıyor (K-68).
 *
 * Ana giriş PDF okuma, pdfkit, docx, S3 ve LLM istemcisini de çekiyor; onu
 * içe aktaran her route Vercel'de ayrı fonksiyona düşüyordu ve Hobby'nin 12
 * fonksiyon sınırına dayanmıştık (13). Alt yollarla 4.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe("core imports (K-68)", () => {
  it("never imports the @uyarla/core barrel", () => {
    const root = join(__dirname, "..")
    const offenders = sourceFiles(root).filter((f) => /from\s+["']@uyarla\/core["']/.test(readFileSync(f, "utf8")))
    expect(offenders).toEqual([])
  })
})
