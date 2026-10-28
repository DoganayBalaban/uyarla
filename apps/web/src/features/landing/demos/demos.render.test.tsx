import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { HERO_PHASES, HERO_LOOP_MS } from "@/features/landing/demos/demoScript"
import { HeroDemo, HeroFilm } from "@/features/landing/demos/HeroDemo"
import { RequirementDemo } from "@/features/landing/demos/RequirementDemo"
import { AdaptDemo } from "@/features/landing/demos/AdaptDemo"
import { CheckDemo } from "@/features/landing/demos/CheckDemo"

/** Duman testleri: her sahne ve demo sunucuda çiziliyor, doğru içerikle. */

const at = (id: string, progress: number) => {
  let t = 0
  for (const p of HERO_PHASES) {
    if (p.id === id) return t + p.ms * progress
    t += p.ms
  }
  throw new Error(id)
}

describe("HeroFilm", () => {
  it("draws each scene from its moment", () => {
    expect(renderToStaticMarkup(<HeroFilm ms={at("upload", 0.2)} />)).toContain("CV&#x27;ni yükle")
    expect(renderToStaticMarkup(<HeroFilm ms={at("job", 0.5)} />)).toContain("İlanı yapıştır")
    expect(renderToStaticMarkup(<HeroFilm ms={at("analyze", 0.5)} />)).toContain("Analiz ediliyor")
    const score = renderToStaticMarkup(<HeroFilm ms={at("score", 0.9)} />)
    expect(score).toContain("Tek tıkla uyarla")
    expect(score).toContain("Orta uyum")
  })

  it("ends on the adapted CV with the higher score and the chosen new wording", () => {
    const html = renderToStaticMarkup(<HeroFilm ms={HERO_LOOP_MS - 1} />)
    expect(html).toContain("CV&#x27;n hazır")
    expect(html).toContain("+13")
    expect(html).toContain(">41<")
    expect(html).toContain("stroke-brand-green")
    expect(html).toContain("✓ Yeni hâli")
    expect(html).toContain("genç geliştiricilere mentorluk")
  })

  it("server-renders the player with chapters and a pause button", () => {
    const html = renderToStaticMarkup(<HeroDemo />)
    expect(html).toContain("Tanıtımı duraklat")
    expect(html).toContain("İlanı yapıştır")
    expect(html).toContain('role="img"')
  })
})

describe("feature demos", () => {
  it("requirement list opens the unmet row with its reason", () => {
    const html = renderToStaticMarkup(<RequirementDemo />)
    // Örnek CV'yle tutarlı (son inceleme): Jest CV'de var, eksik zorunlu WCAG.
    expect(html).toContain("5 gereksinimden 4&#x27;ü karşılanıyor")
    expect(html).toContain("aria-expanded=\"true\"")
    expect(html).toContain("bulunamadı")
  })

  it("adapt demo starts undecided at the base score", () => {
    const html = renderToStaticMarkup(<AdaptDemo />)
    expect(html).toContain("0/2 karar verildi")
    expect(html).toContain("28")
  })

  it("check demo starts with download locked and the reason visible", () => {
    const html = renderToStaticMarkup(<CheckDemo />)
    expect(html).toContain("Kontrol et")
    expect(html).toContain("aria-disabled=\"true\"")
    expect(html).toContain("indirme kapalı")
    expect(html).toContain("liderlik")
  })
})
