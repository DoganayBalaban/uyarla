import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Tanıtım sayfasının tarayıcıya giden kodu hafif kalsın (DOG-161). Pano
 * sahnesi aşama adları için board.ts'i alınca zod (≈440 KB) sayfaya
 * giriyordu. Bu test sahnelerden başlayıp içe aktarmaları izliyor; tip
 * içe aktarmaları derlemede silindiği için sayılmıyor.
 */
const WEB_SRC = resolve(__dirname, "../..")
const CORE_SRC = resolve(WEB_SRC, "../../../packages/core/src")
const ENTRIES = [
  "features/landing/demos/HeroDemo.tsx",
  "features/landing/demos/RequirementDemo.tsx",
  "features/landing/demos/AdaptDemo.tsx",
  "features/landing/demos/CheckDemo.tsx",
  "features/landing/demos/JobSearchDemo.tsx",
  "features/landing/demos/ApplyDemo.tsx",
  "features/landing/demos/BoardDemo.tsx",
  "features/landing/demos/InterviewDemo.tsx",
  "features/landing/demos/LinkedInDemo.tsx",
  "features/landing/components/JourneyRail.tsx",
]

function resolveFile(base: string): string | null {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

/** Değer olarak içe aktarılan modüller (import type ve export type hariç). */
function valueImports(source: string): string[] {
  const out: string[] = []
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^'"]*?)\s*from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g
  for (const m of source.matchAll(re)) {
    if (m[5]) out.push(m[5])
    else if (!m[2]) out.push(m[4]!)
  }
  return out
}

/** Sahnelerden ulaşılan bütün dış paketler ve dosyalar. */
function graph(): { packages: Set<string>; files: Set<string> } {
  const packages = new Set<string>()
  const files = new Set<string>()
  const queue = ENTRIES.map((e) => join(WEB_SRC, e))
  while (queue.length) {
    const file = queue.pop()!
    if (files.has(file)) continue
    files.add(file)
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      let target: string | null = null
      if (spec.startsWith("@/")) target = resolveFile(join(WEB_SRC, spec.slice(2)))
      else if (spec.startsWith("@uyarla/core/")) target = resolveFile(join(CORE_SRC, spec.slice("@uyarla/core/".length)))
      else if (spec.startsWith(".")) target = resolveFile(resolve(dirname(file), spec))
      else packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!)
      if (target && /\.tsx?$/.test(target)) queue.push(target)
    }
  }
  return { packages, files }
}

describe("landing bundle (DOG-161)", () => {
  const { packages, files } = graph()

  it("walks the scenes", () => {
    expect(files.size).toBeGreaterThan(ENTRIES.length)
    expect(packages.has("motion")).toBe(true)
  })

  it("does not pull zod into the landing page", () => {
    expect([...packages]).not.toContain("zod")
  })

  it("takes the board stages from the leaf module, not the board logic", () => {
    expect([...files].some((f) => f.endsWith("features/applications/board.ts"))).toBe(false)
  })
})
