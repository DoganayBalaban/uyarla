import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as esbuild from "esbuild"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"
import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"

/**
 * Sayfa betiği eklentinin derlemesiyle (scripts/build.mjs: küçültülmüş,
 * chrome120) kurulup sayfaya kaynağından kopyalanınca da çalışmalı. Ad koruyan
 * bir derleme (tsx, keepNames) `__name(...)` ekliyor ve sayfada patlıyor;
 * vitest'in kendi dönüşümü bunu göstermez. esbuild jsdom ortamında çalışmadığı
 * için sayfa burada elle kuruluyor.
 */
async function runBuilt(options: esbuild.BuildOptions = {}): Promise<ProfileSnapshot> {
  const out = await esbuild.build({ entryPoints: [resolve(process.cwd(), "src/profileCollector.ts")], bundle: true, format: "iife", globalName: "uyarlaCollector", target: "chrome120", minify: true, write: false, ...options })
  const dom = new JSDOM(readFileSync(resolve(process.cwd(), "src/fixtures/linkedin-own-profile.html"), "utf8"), { url: "https://www.linkedin.com/in/deniz-aksoy/", runScripts: "outside-only" })
  const mod = dom.window.eval(`${out.outputFiles![0]!.text};uyarlaCollector`) as { collectProfileSnapshot: () => ProfileSnapshot }
  return dom.window.eval(`(${mod.collectProfileSnapshot.toString()})()`) as ProfileSnapshot
}

describe("collectProfileSnapshot (eklentinin derlemesiyle)", () => {
  it("runs in the page as the extension's build ships it", async () => {
    const s = await runBuilt()
    expect(s).toMatchObject({ own: true, name: "Deniz Aksoy" })
    expect(s.sections.experience!.items).toHaveLength(4)
  })
})
