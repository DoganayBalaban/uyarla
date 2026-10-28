# Tanıtım yolculuğu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tanıtım sayfası, Elif'in bir ilana başvurusunu altı adımda anlatacak: Bul, Uyarla, Başvur, Takip et, Hazırlan, Görünür ol. Her adımda motion ile oynayan bir sahne olacak.

**Architecture:**
- Sahneler hero filmiyle aynı kalıpta:
  - saf bir `…Film({ ms })` bileşeni;
  - onu zamana bağlayan ince bir `…Demo` sarmalayıcısı;
  - ortak `useScenePlayer` (ekranda görünürlük, döngü, hareket azaltma).
- Sahne verisi `scenes.ts`'te ve bir testle Elif'in örnek CV'sine karşı denetleniyor.
- Adım verisi `journey.ts`'te. Erişim çipleri `FEATURE_ROWS`'tan türetiliyor.

**Tech Stack:** Next 15 / React 19, motion 13 (`motion/react`), Tailwind, CSS modules (`landing.module.css`), vitest, `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-10-28-tanitim-yolculuk-design.md`

## Global Constraints

- Ekranda yüzde, kalan süre, sonuç sayısı ya da uydurma istatistik yok. Skor sayıları yalnızca mevcut demo senaryosundan: 28 → 41.
- Örnek kişi Elif Yılmaz, Frontend Geliştirici ilanı, kurgusal şirket "Kuzey Yazılım". Gerçek şirket adı yok.
- Ekran etiketleri ürünün kendi sabitleri:
  - `STAGE_LABEL` (`@/features/applications/board`),
  - `SECTION_LABELS` ve `STATUS_LABELS` (`@/features/linkedin/sections`),
  - `searchLinks` (`@uyarla/core/jobSuggest/links`).
- Web, core'u yalnızca alt yollardan içe aktarır (K-68).
- Her sahne 10–14 saniyelik döngü. %30 görününce başlar, çıkınca durur. Hareket azaltmada son kare.
- Kapsayıcı `role="figure"` ve `aria-label` taşır. İçindeki hareketli içerik `aria-hidden`.
- Kod adları İngilizce; yorumlar ve arayüz metni Türkçe.
- `git add` her zaman açık dosya yollarıyla yapılır; dizin verilmez (eval/runs dosyaları girer).
- Teslim: test dalına 4 PR, squash. Her PR'dan sonra yerelde göster.

## Review Focus

1. **390 px genişlik.** Yolculuk şeridi kendi içinde kayar, sayfa yatay kaymaz. Sahne kartları taşmaz. Görev 5 ve her sahne görevinin elle kontrol adımı bunu kontrol eder.
2. **Hareket azaltma açık.** Her sahne son karesinde anlamlı metni gösterir ("Kopyalandı", "Kâğıtta yok", "Yakında"). Her sahne görevinin çizim testi `ms = loop - 1`'de bunu kontrol eder.
3. **Ekran dışındaki sahne durur.** Üç sahne aynı anda saat yürütmez. `sceneClock` saf testi (Görev 4) ve elle kontrol.
4. **Bağlantıyla atlama.** `#takip` gibi bir bağlantıya gidince bölüm başlığı yapışkan şeridin altında kalmaz (`scroll-margin-top`). Görev 5'in elle adımı.
5. **Koyu tema.** Erişim çipleri ve sahne kartları koyu temada okunur. Görev 5 ve 12'nin elle adımı.

---

## Dosya haritası

| Dosya | Görev | Ne |
|---|---|---|
| `apps/web/src/features/landing/demos/demoScript.ts` | 1 | `phaseAt`, `loopMs`, `phaseReached` genel; `heroPhaseAt` onların üstünde |
| `apps/web/src/features/landing/demos/scenes.ts` | 2, 7–11 | `ELIF_CV`, beş sahnenin verisi ve aşamaları |
| `apps/web/src/features/landing/demos/scenes.test.ts` | 2, 7–11 | Senaryo tutarlılığı |
| `apps/web/src/features/billing/plans.ts` | 3 | "İş arama bağlantıları" satırı |
| `apps/web/src/features/landing/journey.ts` (+ test) | 3 | `JOURNEY`, `accessChips` |
| `apps/web/src/features/landing/demos/useScenePlayer.ts` (+ test) | 4 | `sceneClock`, `useScenePlayer`, `Scene` |
| `apps/web/src/features/landing/components/JourneyRail.tsx` | 5 | Şerit |
| `apps/web/src/features/landing/LandingPage.tsx`, `landing.module.css` | 5, 12 | Yeni düzen |
| `apps/web/src/features/landing/LandingPage.render.test.tsx` | 5, 12 | Sayfa duman testi |
| `apps/web/src/features/landing/demos/sceneList.tsx` | 6–11 | Vitrin listesi |
| `apps/web/src/components/ui-showcase/SceneShowcase.tsx`, `apps/web/src/app/ui/landing/page.tsx` | 6 | Yerel vitrin |
| `apps/web/src/features/jobs/siteNotes.ts` | 7 | `SITE_NOTE` paylaşılır |
| `apps/web/src/features/landing/demos/{JobSearch,Apply,Board,Interview,LinkedIn}Demo.tsx` | 7–11 | Sahneler |
| `apps/web/src/features/landing/demos/scenes.render.test.tsx` | 7–11 | Sahne çizim testleri |
| `apps/web/src/features/landing/faq.ts` | 12 | 3 soru |

PR sınırları:
- PR 1: Görev 1–6.
- PR 2: Görev 7–8.
- PR 3: Görev 9–10.
- PR 4: Görev 11–12.

Her PR `test`'ten açılan ayrı bir dalda: `tanitim-1-altyapi`, `tanitim-2-bul-basvur`, `tanitim-3-takip-hazirlan`, `tanitim-4-linkedin-metin`. Spec commit'i (`tanitim-spec` dalı) PR 1'e dahil.

Test komutları (`apps/web` içinde):
- birim: `pnpm exec vitest run <yol>`
- tip: `pnpm exec tsc --noEmit`

---

### Task 1: Genel aşama yardımcıları

**Files:**
- Modify: `apps/web/src/features/landing/demos/demoScript.ts:10-33`
- Test: `apps/web/src/features/landing/demos/demoScript.test.ts`

**Interfaces:**
- Produces:
  - `type Phase<Id extends string = string> = { id: Id; ms: number }`
  - `phaseAt<Id extends string>(phases: readonly Phase<Id>[], ms: number): { phase: Id; progress: number }`
  - `loopMs(phases: readonly Phase[]): number`
  - `phaseReached<Id extends string>(phases: readonly Phase<Id>[], current: Id, target: Id): boolean`

  `heroPhaseAt` ve `HERO_LOOP_MS` aynı davranışla kalıyor.

- [ ] **Step 1: Write the failing test** — `demoScript.test.ts`'in import listesine `phaseAt, loopMs, phaseReached` ekle, dosyanın sonuna:

```ts
describe("phaseAt, loopMs, phaseReached", () => {
  const P = [
    { id: "a", ms: 100 },
    { id: "b", ms: 300 },
  ] as const

  it("finds the phase and its progress, looping", () => {
    expect(loopMs(P)).toBe(400)
    expect(phaseAt(P, 0)).toEqual({ phase: "a", progress: 0 })
    expect(phaseAt(P, 250)).toEqual({ phase: "b", progress: 0.5 })
    expect(phaseAt(P, 399).phase).toBe("b")
    expect(phaseAt(P, 400)).toEqual({ phase: "a", progress: 0 })
    expect(phaseAt(P, -100)).toEqual({ phase: "b", progress: 2 / 3 })
  })

  it("tells whether a phase has been reached", () => {
    expect(phaseReached(P, "b", "a")).toBe(true)
    expect(phaseReached(P, "a", "b")).toBe(false)
    expect(phaseReached(P, "b", "b")).toBe(true)
  })

  it("keeps the hero helper identical", () => {
    for (const ms of [0, 1799, 1800, 5000, HERO_LOOP_MS - 1, HERO_LOOP_MS + 7]) {
      expect(heroPhaseAt(ms)).toEqual(phaseAt(HERO_PHASES, ms))
    }
  })
})
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/demos/demoScript.test.ts`
Expected: FAIL. `phaseAt is not a function`.

- [ ] **Step 3: Implement** — `demoScript.ts`'te `HeroPhaseId` tipinin üstüne ekle:

```ts
/** Bir sahnenin bir aşaması: adı ve süresi. */
export type Phase<Id extends string = string> = { id: Id; ms: number }

/** Aşamaların toplam süresi; bir döngü. */
export function loopMs(phases: readonly Phase[]): number {
  return phases.reduce((t, p) => t + p.ms, 0)
}

/** Döngünün `ms` anında hangi aşamada ve aşamanın yüzde kaçında olunduğu. */
export function phaseAt<Id extends string>(phases: readonly Phase<Id>[], ms: number): { phase: Id; progress: number } {
  const loop = loopMs(phases)
  let t = ((ms % loop) + loop) % loop
  for (const p of phases) {
    if (t < p.ms) return { phase: p.id, progress: t / p.ms }
    t -= p.ms
  }
  return { phase: phases[0]!.id, progress: 0 }
}

/** `current` aşaması `target`'a gelmiş ya da geçmiş mi. */
export function phaseReached<Id extends string>(phases: readonly Phase<Id>[], current: Id, target: Id): boolean {
  const index = (id: Id) => phases.findIndex((p) => p.id === id)
  return index(current) >= index(target)
}
```

Ardından `HERO_PHASES`'in tipini `Phase<HeroPhaseId>[]` yap. `HERO_LOOP_MS = loopMs(HERO_PHASES)` olsun. `heroPhaseAt`'in gövdesi `return phaseAt(HERO_PHASES, ms)` olsun.

- [ ] **Step 4: Run** aynı komut. Expected: PASS. Ayrıca `pnpm exec vitest run src/features/landing` → hepsi PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/landing/demos/demoScript.ts apps/web/src/features/landing/demos/demoScript.test.ts
git commit -m "Tanıtım yolculuğu: genel aşama yardımcıları (DOG-160)"
```

---

### Task 2: Elif'in örnek CV'si ve tutarlılık yardımcısı

**Files:**
- Create: `apps/web/src/features/landing/demos/scenes.ts`
- Create: `apps/web/src/features/landing/demos/scenes.test.ts`

**Interfaces:**
- Produces:
  - `ELIF_CV: string`
  - `inCv(quote: string): boolean` (birebir, büyük/küçük harf duyarlı)
  - `SCENE_COMPANY = "Kuzey Yazılım"`
  - `SCENE_ROLE = "Frontend Geliştirici"`
  - `SCENE_CITY = "İstanbul"`

- [ ] **Step 1: Write the failing test** `scenes.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEMO_BULLETS } from "@/features/landing/demos/demoScript"
import { ELIF_CV, inCv } from "@/features/landing/demos/scenes"

/** Sahnelerin örnek verisi uydurma kuralına uyuyor mu (spec §6). */
describe("Elif's sample CV", () => {
  it("contains the original wording of every adapted bullet", () => {
    for (const b of DEMO_BULLETS) {
      const original = b.segments.filter((x) => x.kind !== "add").map((x) => x.text).join("").trim()
      expect(inCv(original), original).toBe(true)
    }
  })

  it("matches quotes exactly, not loosely", () => {
    expect(inCv("Kod incelemelerine katıldım")).toBe(true)
    expect(inCv("kod incelemelerine katıldım")).toBe(false)
    expect(ELIF_CV).not.toContain("12 geliştirici")
  })
})
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/demos/scenes.test.ts`. Expected: FAIL. Modül yok.

- [ ] **Step 3: Implement** `scenes.ts`:

```ts
/**
 * Tanıtım sahnelerinin örnek verisi (DOG-160). Elif kurgusal; hero ve
 * gereksinim demolarındaki kişiyle aynı. Kural (K-32, spec §6): sahnelerde
 * gösterilen her kanıt bu CV'de birebir geçiyor, "kâğıtta yok" diye
 * işaretlenen hiçbir ifade geçmiyor. scenes.test.ts bunu denetliyor.
 */

export const SCENE_COMPANY = "Kuzey Yazılım"
export const SCENE_ROLE = "Frontend Geliştirici"
export const SCENE_CITY = "İstanbul"

export const ELIF_CV = [
  "Elif Yılmaz",
  "Yazılım Geliştirici",
  "Deneyim",
  "Müşteri paneli projesinde React kullandım.",
  "Kod incelemelerine katıldım ve yeni gelen geliştiricilere yardımcı oldum.",
  "Bileşenler için Jest ile birim testleri yazdım.",
  "Stajyerlerin uyumuna destek oldum.",
  "Beceriler",
  "React, TypeScript, JavaScript, HTML, CSS, Git",
].join("\n")

/** Alıntı CV'de birebir geçiyor mu. */
export function inCv(quote: string): boolean {
  return ELIF_CV.includes(quote)
}
```

- [ ] **Step 4: Run** aynı komut. Expected: PASS. Dördüncü maddenin eski hâli "Stajyerlerin uyumuna destek oldum." CV'de var.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts
git commit -m "Tanıtım yolculuğu: örnek CV ve tutarlılık testi (DOG-160)"
```

---

### Task 3: Yolculuk verisi ve erişim çipleri

**Files:**
- Modify: `apps/web/src/features/billing/plans.ts:54-64` (satır ekle)
- Modify: `apps/web/src/features/billing/plans.test.ts` (satır beklentisi)
- Create: `apps/web/src/features/landing/journey.ts`
- Create: `apps/web/src/features/landing/journey.test.ts`

**Interfaces:**
- Produces:
  - `type StepId = "bul" | "uyarla" | "basvur" | "takip" | "hazirlan" | "gorunur"`
  - `JOURNEY: JourneyStep[]`, ve `JourneyStep = { id: StepId; number: string; name: string; title: string; text: string; bullets: string[]; rows: { label: FeatureLabel; short: string }[] }`
  - `accessChips(step: JourneyStep): { short: string; access: string; paid: boolean }[]`
  - `accessText(free: string | boolean): string`

- [ ] **Step 1: Write the failing test** `journey.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { FEATURE_ROWS } from "@/features/billing/plans"
import { JOURNEY, accessChips, accessText } from "@/features/landing/journey"

describe("journey (DOG-160)", () => {
  it("has the six steps in order with anchors", () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"])
    expect(JOURNEY.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05", "06"])
  })

  it("only points at rows the pricing table has", () => {
    const labels = new Set<string>(FEATURE_ROWS.map((r) => r.label))
    for (const s of JOURNEY) for (const r of s.rows) expect(labels.has(r.label), r.label).toBe(true)
  })

  it("words access from the pricing table", () => {
    expect(accessText(true)).toBe("Ücretsiz")
    expect(accessText("Ayda 1")).toBe("Ayda 1 ücretsiz")
    expect(accessText(false)).toBe("Abonelikte")
  })

  it("shows both a free and a paid chip where a step mixes them", () => {
    const linkedin = accessChips(JOURNEY.find((s) => s.id === "gorunur")!)
    expect(linkedin.some((c) => !c.paid)).toBe(true)
    expect(linkedin.some((c) => c.paid)).toBe(true)
    expect(accessChips(JOURNEY.find((s) => s.id === "bul")!)).toEqual([{ short: "İş arama", access: "Ücretsiz", paid: false }])
  })
})
```

Ayrıca `plans.test.ts`'e:

```ts
  it("lists job search links as free (DOG-160)", () => {
    expect(FEATURE_ROWS.find((r) => r.label === "İş arama bağlantıları")).toEqual({ label: "İş arama bağlantıları", free: true, paid: true })
  })
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/journey.test.ts src/features/billing/plans.test.ts`. Expected: FAIL. Modül yok, satır yok.

- [ ] **Step 3: Implement**
  - `plans.ts`: `FEATURE_ROWS`'ta "Başvuru panosu, takip mesajı ve teşekkür notu" satırından sonra `{ label: "İş arama bağlantıları", free: true, paid: true },` ekle.
  - `journey.ts`:

```ts
import { FEATURE_ROWS } from "@/features/billing/plans"

/**
 * Tanıtım sayfasındaki başvuru yolculuğu (DOG-160, K-108). Erişim çipleri
 * paket tablosunun satırlarından türetiliyor; fiyat tablosu değişince
 * tanıtım metni de değişiyor.
 */

export type StepId = "bul" | "uyarla" | "basvur" | "takip" | "hazirlan" | "gorunur"
type FeatureLabel = (typeof FEATURE_ROWS)[number]["label"]

export type JourneyStep = {
  id: StepId
  number: string
  name: string
  title: string
  text: string
  bullets: string[]
  rows: { label: FeatureLabel; short: string }[]
}

export const JOURNEY: JourneyStep[] = [
  {
    id: "bul",
    number: "01",
    name: "Bul",
    title: "Doğru ilanı bul.",
    text: "Profilindeki rol ve şehirle hazır arama kurar; Kariyer.net, LinkedIn, Jooble ve Careerjet'i doğru sorguyla açar.",
    bullets: ["Rolün ve becerilerin sorguya eklenir", "Her sitenin kendi kuralına göre bağlantı", "İlanları biz toplamayız; site kendi sayfasında açılır"],
    rows: [{ label: "İş arama bağlantıları", short: "İş arama" }],
  },
  {
    id: "uyarla",
    number: "02",
    name: "Uyarla",
    title: "CV'ni o ilana göre uyarla.",
    text: "İlanı gereksinimlerine ayırır, kanıtını CV'nde arar ve maddelerini ilanın diliyle yeniden yazar.",
    bullets: [],
    rows: [
      { label: "İlan analizi ve uyum skoru", short: "Skor" },
      { label: "CV uyarlama (ön yazı ve PDF/DOCX dahil)", short: "Uyarlama" },
    ],
  },
  {
    id: "basvur",
    number: "03",
    name: "Başvur",
    title: "Ön yazı ve form yanıtları hazır.",
    text: "“Kendini tanıt”, “140 karakterde neden sen” gibi form sorularını gönderdiğin CV'den yanıtlar. Karakter sınırını kod denetler.",
    bullets: ["Sınır aşılmaz", "Her cümle CV'ne dayanır", "Biz göndermeyiz; kopyalayıp sen yapıştırırsın"],
    rows: [
      { label: "CV uyarlama (ön yazı ve PDF/DOCX dahil)", short: "Ön yazı" },
      { label: "Başvuru formu yanıtları", short: "Form yanıtları" },
    ],
  },
  {
    id: "takip",
    number: "04",
    name: "Takip et",
    title: "Başvurularını tek panoda takip et.",
    text: "Her analiz bir kart. Skor düşükken başvurmadan önce uyarır; başvurduktan sonra takip mesajı, mülakattan sonra teşekkür notu taslağı hazırlar.",
    bullets: ["Kaydedildi, Başvuruldu, Mülakat, Teklif", "Düşük skorda “önce uyarla” hatırlatması", "Alıcının adı uydurulmaz, [ad] olarak kalır"],
    rows: [{ label: "Başvuru panosu, takip mesajı ve teşekkür notu", short: "Pano ve mesajlar" }],
  },
  {
    id: "hazirlan",
    number: "05",
    name: "Hazırlan",
    title: "Mülakata kendi CV'nle hazırlan.",
    text: "Sorular ilandan, cevapların kanıtı CV'nden gelir. Yazılı pratikte cevabını STAR yapısına göre değerlendirir; CV'nde olmayan iddiayı işaretler.",
    bullets: ["Her soru CV'deki kanıtıyla", "STAR: durum, görev, eylem, sonuç", "Kâğıtta olmayan iddia odada da yok"],
    rows: [
      { label: "Mülakat hazırlık paketi", short: "Hazırlık paketi" },
      { label: "Yazılı mülakat pratiği", short: "Pratik" },
    ],
  },
  {
    id: "gorunur",
    number: "06",
    name: "Görünür ol",
    title: "LinkedIn profilin de hazır.",
    text: "Profilini hedef rolüne göre denetler; başlık, hakkında ve deneyim için CV'ne dayanan öneriler yazar.",
    bullets: ["Bölüm bölüm: Başlık, Hakkında, Deneyim, Beceriler", "Her öneri CV'ndeki bir satıra dayanır", "Eklentiyle profilini aktar (yakında)"],
    rows: [
      { label: "LinkedIn teşhisi ve başlık önerileri", short: "Teşhis ve başlık" },
      { label: "LinkedIn hakkında ve deneyim yazımı", short: "Hakkında ve deneyim" },
    ],
  },
]

export function accessText(free: string | boolean): string {
  if (free === true) return "Ücretsiz"
  if (free === false) return "Abonelikte"
  return `${free} ücretsiz`
}

export function accessChips(step: JourneyStep): { short: string; access: string; paid: boolean }[] {
  return step.rows.map((r) => {
    const row = FEATURE_ROWS.find((x) => x.label === r.label)!
    return { short: r.short, access: accessText(row.free), paid: row.free === false }
  })
}
```

- [ ] **Step 4: Run** aynı komut. Expected: PASS. Sonra `pnpm exec vitest run src/features/billing` → PASS. PlansView testleri satır sayısına bağlıysa güncelle ve Ruling yaz.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/billing/plans.ts apps/web/src/features/billing/plans.test.ts apps/web/src/features/landing/journey.ts apps/web/src/features/landing/journey.test.ts
git commit -m "Tanıtım yolculuğu: adımlar ve erişim çipleri (DOG-160)"
```

---

### Task 4: Ortak sahne oynatıcısı

**Files:**
- Create: `apps/web/src/features/landing/demos/useScenePlayer.tsx`
- Create: `apps/web/src/features/landing/demos/useScenePlayer.test.ts`

**Interfaces:**
- Consumes: `loopMs`, `Phase` (Görev 1).
- Produces:
  - `sceneClock(clock: number, delta: number, loop: number, running: boolean): number`
  - `shownMs(clock: number, loop: number, reduced: boolean): number`
  - `useScenePlayer(loop: number): { ref: React.RefObject<HTMLDivElement | null>; ms: number }`
  - `Scene({ label, phases, children }: { label: string; phases: readonly Phase[]; children: (ms: number) => React.ReactNode })`

- [ ] **Step 1: Write the failing test** `useScenePlayer.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sceneClock, shownMs } from "@/features/landing/demos/useScenePlayer"

describe("scene clock (DOG-160)", () => {
  it("advances only while running and wraps at the loop", () => {
    expect(sceneClock(100, 16, 1000, true)).toBe(116)
    expect(sceneClock(100, 16, 1000, false)).toBe(100)
    expect(sceneClock(990, 16, 1000, true)).toBe(6)
  })

  it("clips the jump after a background tab", () => {
    expect(sceneClock(0, 5000, 10000, true)).toBe(64)
  })

  it("shows the last frame under reduced motion", () => {
    expect(shownMs(300, 1000, true)).toBe(999)
    expect(shownMs(300, 1000, false)).toBe(300)
  })
})
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/demos/useScenePlayer.test.ts`. Expected: FAIL. Modül yok.

- [ ] **Step 3: Implement** `useScenePlayer.tsx`:

```tsx
"use client"

import { useAnimationFrame, useInView, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { loopMs, type Phase } from "@/features/landing/demos/demoScript"
import s from "@/features/landing/landing.module.css"

/** Bir sonraki saat değeri; sekme arka plandan dönünce gelen sıçrama 64 ms'e kırpılıyor. */
export function sceneClock(clock: number, delta: number, loop: number, running: boolean): number {
  if (!running) return clock
  return (clock + Math.min(delta, 64)) % loop
}

/** Gösterilen an: hareket azaltmada döngünün son karesi. */
export function shownMs(clock: number, loop: number, reduced: boolean): number {
  return reduced ? loop - 1 : clock
}

/**
 * Tanıtım sahnelerinin saati (DOG-160). Yalnız sahne ekrandayken yürüyor;
 * üç sahne aynı anda oynamıyor. Hareket azaltmada son kare duruyor.
 */
export function useScenePlayer(loop: number) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const reduced = useReducedMotion() ?? false
  const [clock, setClock] = useState(0)
  useAnimationFrame((_, delta) => {
    if (inView && !reduced) setClock((c) => sceneClock(c, delta, loop, true))
  })
  return { ref, ms: shownMs(clock, loop, reduced) }
}

/** Sahne kabı: ekran okuyucuya tek cümle, içerik aria-hidden. */
export function Scene({
  label,
  phases,
  children,
}: {
  label: string
  phases: readonly Phase[]
  children: (ms: number) => React.ReactNode
}) {
  const { ref, ms } = useScenePlayer(loopMs(phases))
  return (
    <div ref={ref} role="figure" aria-label={label} className={`${s.mock} ${s.mockWide}`}>
      <div aria-hidden="true">{children(ms)}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run** aynı komut ve `pnpm exec tsc --noEmit`. Expected: PASS, tip hatası yok.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/landing/demos/useScenePlayer.tsx apps/web/src/features/landing/demos/useScenePlayer.test.ts
git commit -m "Tanıtım yolculuğu: ortak sahne oynatıcısı (DOG-160)"
```

---

### Task 5: Yolculuk şeridi ve yeni sayfa düzeni

**Files:**
- Create: `apps/web/src/features/landing/components/JourneyRail.tsx`
- Modify: `apps/web/src/features/landing/LandingPage.tsx` (STEPS ve BENTO_ITEMS ile bölümleri değişir; satır 27–48, 106–146, 222–320)
- Modify: `apps/web/src/features/landing/landing.module.css` (sona ekle)
- Create: `apps/web/src/features/landing/LandingPage.render.test.tsx`

**Interfaces:**
- Consumes: `JOURNEY`, `accessChips`, `StepId` (Görev 3).
- Produces:
  - `JourneyRail({ steps }: { steps: { id: StepId; number: string; name: string }[] })`
  - `LandingPage` içinde `STEP_VISUAL: Partial<Record<StepId, React.ReactNode>>`. Sonraki görevler buraya kendi sahnesini ekler.

- [ ] **Step 1: Write the failing test** `LandingPage.render.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LandingPage } from "@/features/landing/LandingPage"

describe("LandingPage journey (DOG-160)", () => {
  const html = renderToStaticMarkup(<LandingPage />)

  it("has the rail and the six step sections", () => {
    expect(html).toContain('id="yolculuk"')
    for (const id of ["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('href="#takip"')
  })

  it("labels access from the pricing table", () => {
    expect(html).toContain("İş arama")
    expect(html).toContain("Abonelikte")
    expect(html).toContain("Ayda 1 ücretsiz")
  })

  it("drops the three-step and bento blocks, keeps the adapt demos", () => {
    expect(html).not.toContain("Üç adım. Kayıt yok, kurulum yok.")
    expect(html).not.toContain("Başvur, uyarla, takip et.")
    expect(html).toContain("Olmayan bir deneyimi asla eklemez.")
  })
})
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/LandingPage.render.test.tsx`. Expected: FAIL. `id="yolculuk"` yok. Çizim, client bileşenlerinde hata verirse önce o hatayı çöz; mevcut demolar `renderToStaticMarkup` ile zaten çiziliyor.

- [ ] **Step 3: Implement**

`JourneyRail.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import type { StepId } from "@/features/landing/journey"
import s from "@/features/landing/landing.module.css"

/**
 * Yolculuk şeridi (DOG-160): altı adım, her biri kendi bölümüne bağlantı.
 * Görünen bölüm vurgulanıyor. Dar ekranda şerit kendi içinde kayıyor.
 */
export function JourneyRail({ steps }: { steps: { id: StepId; number: string; name: string }[] }) {
  const [active, setActive] = useState<StepId | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id as StepId)
      },
      { rootMargin: "-30% 0px -60% 0px" },
    )
    for (const step of steps) {
      const el = document.getElementById(step.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [steps])

  return (
    <nav id="yolculuk" aria-label="Başvuru yolculuğu" className={s.journeyRail}>
      <ol className={s.journeyRailList}>
        {steps.map((step) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              aria-current={active === step.id ? "step" : undefined}
              className={`${s.journeyRailStep} ${active === step.id ? s.journeyRailStepActive : ""}`}
            >
              <span className={s.journeyRailNumber}>{step.number}</span>
              {step.name}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

`LandingPage.tsx` değişiklikleri:
1. `STEPS` ve `BENTO_ITEMS` sabitlerini sil.
2. `import { JOURNEY, accessChips, type StepId } from "@/features/landing/journey"` ve `import { JourneyRail } from "@/features/landing/components/JourneyRail"` ekle.
3. `FEATURES` sabiti kalıyor; "Uyarla" bölümünde kullanılıyor.
4. `PERSONAS`'tan sonra:

```tsx
/** Her adımın sahnesi; sahnesi gelmemiş adım yalnızca metinle (PR 2–4 dolduruyor). */
const STEP_VISUAL: Partial<Record<StepId, React.ReactNode>> = {}

function AccessChips({ step }: { step: (typeof JOURNEY)[number] }) {
  return (
    <ul className={s.accessChips} aria-label="Erişim">
      {accessChips(step).map((c) => (
        <li key={c.short} className={`${s.accessChip} ${c.paid ? s.accessChipPaid : ""}`}>
          {c.short} · {c.access}
        </li>
      ))}
    </ul>
  )
}
```

5. "Nasıl çalışır" bölümünü (`<section id="nasil" …>…</section>`) ve "Özellik blokları" bölümünü (`<section id="ozellikler" …>`) tamamen sil. "Başvur, uyarla, takip et." bento bölümünü (`<section className={s.section}>` … `BENTO_ITEMS.map`) de sil. Yerine:

```tsx
        {/* ——— Başvuru yolculuğu (DOG-160) ——— */}
        <JourneyRail steps={JOURNEY} />
        {JOURNEY.map((step, i) => (
          <section key={step.id} id={step.id} className={`${s.section} ${s.journeySection} ${i % 2 === 1 ? s.sectionTinted : ""}`}>
            <div className={s.container}>
              {step.id === "uyarla" ? (
                <>
                  <div className={s.sectionHeader}>
                    <span className={s.sectionLabel}>
                      {step.number} · {step.name}
                    </span>
                    <h2 className={s.h2}>{step.title}</h2>
                    <p className={s.sectionLead}>{step.text}</p>
                    <AccessChips step={step} />
                  </div>
                  {FEATURES.map((o, j) => (
                    <div key={o.label} className={`${s.feature} ${j % 2 === 1 ? s.featureReversed : ""}`}>
                      <div className={s.featureText}>
                        <span className={s.sectionLabel}>{o.label}</span>
                        <h3 className={s.h2}>{o.title}</h3>
                        <p className={s.sectionLead}>{o.text}</p>
                        <ul className={s.tickList}>
                          {o.bullets.map((m) => (
                            <li key={m}>
                              <span className={s.tick}>
                                <Icon name="check" size={14} />
                              </span>
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className={s.featureVisual}>{o.visual}</div>
                    </div>
                  ))}
                  {/* Çıktı bloğu: önceki "Özellik blokları" bölümündeki <div className={`${s.feature} ${s.featureReversed}`}> … </div> aynen buraya taşınır. */}
                </>
              ) : (
                <div className={`${s.feature} ${i % 2 === 1 ? s.featureReversed : ""}`}>
                  <div className={s.featureText}>
                    <span className={s.sectionLabel}>
                      {step.number} · {step.name}
                    </span>
                    <h2 className={s.h2}>{step.title}</h2>
                    <p className={s.sectionLead}>{step.text}</p>
                    <ul className={s.tickList}>
                      {step.bullets.map((m) => (
                        <li key={m}>
                          <span className={s.tick}>
                            <Icon name="check" size={14} />
                          </span>
                          {m}
                        </li>
                      ))}
                    </ul>
                    <AccessChips step={step} />
                  </div>
                  {STEP_VISUAL[step.id] && <div className={s.featureVisual}>{STEP_VISUAL[step.id]}</div>}
                </div>
              )}
            </div>
          </section>
        ))}
```

Çıktı bloğu silinen bölümden kesilip yorumun yerine aynen yapıştırılır. Yorum satırı kalmaz.

6. Hero'daki "Nasıl çalışır?" düğmesinin `href`'i `#nasil` yerine `#yolculuk` olur.

`landing.module.css` sonuna:

```css
/* ——— Başvuru yolculuğu (DOG-160) ——— */
.journeyRail {
  position: sticky;
  top: 0;
  z-index: 20;
  border-block: 1px solid var(--border);
  background: color-mix(in oklab, var(--background) 88%, transparent);
  backdrop-filter: blur(8px);
}
.journeyRailList {
  display: flex;
  gap: 0.25rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 0.5rem 1rem;
  overflow-x: auto;
  scrollbar-width: none;
  list-style: none;
}
.journeyRailList::-webkit-scrollbar {
  display: none;
}
.journeyRailStep {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
  transition: background-color 0.2s, color 0.2s;
}
.journeyRailStep:hover {
  color: var(--foreground);
}
.journeyRailStepActive {
  background: color-mix(in oklab, var(--primary) 12%, transparent);
  color: var(--foreground);
  font-weight: 600;
}
.journeyRailNumber {
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  color: var(--primary);
}
.journeySection {
  scroll-margin-top: 3.5rem;
}
.accessChips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding: 0;
  list-style: none;
}
.accessChip {
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--brand-green) 35%, transparent);
  background: color-mix(in oklab, var(--brand-green) 10%, transparent);
  padding: 0.2rem 0.65rem;
  font-size: 0.8125rem;
}
.accessChipPaid {
  border-color: color-mix(in oklab, var(--primary) 35%, transparent);
  background: color-mix(in oklab, var(--primary) 10%, transparent);
}
```

CSS değişken adlarını (`--border`, `--primary`, `--brand-green`, `--muted-foreground`, `--background`) `landing.module.css`'in mevcut kullanımıyla karşılaştır. Farklıysa dosyanın kullandığını al ve Ruling yaz.

- [ ] **Step 4: Run** test, `pnpm exec vitest run src/features/landing` ve `pnpm exec tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Elle kontrol** — yerel sunucu `http://localhost:3001/`, oturumsuz.
  - 1440 px, açık ve koyu: şerit yapışkan, kaydırınca aktif adım değişiyor, `#takip` bağlantısında başlık şeridin altında kalmıyor.
  - 390 px: şerit kendi içinde kayıyor, `document.documentElement.scrollWidth <= innerWidth`.
  - Konsolda hata yok.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/landing/components/JourneyRail.tsx apps/web/src/features/landing/LandingPage.tsx apps/web/src/features/landing/landing.module.css apps/web/src/features/landing/LandingPage.render.test.tsx
git commit -m "Tanıtım yolculuğu: şerit ve altı adımlı düzen (DOG-160)"
```

---

### Task 6: Yerel sahne vitrini

**Files:**
- Create: `apps/web/src/features/landing/demos/sceneList.tsx`
- Create: `apps/web/src/components/ui-showcase/SceneShowcase.tsx`
- Create: `apps/web/src/app/ui/landing/page.tsx`

**Interfaces:**
- Consumes: `HERO_PHASES`, `HeroFilm`, `Phase`.
- Produces: `SCENE_LIST: { id: string; name: string; phases: readonly Phase[]; Film: (p: { ms: number }) => React.ReactNode }[]`. Görev 7–11 her biri buna bir öge ekler.

- [ ] **Step 1: Implement** (vitrin yalnızca yerelde; davranışı elle kontrol ediliyor, birim testi yok).

`sceneList.tsx`:

```tsx
import type { Phase } from "@/features/landing/demos/demoScript"
import { HERO_PHASES } from "@/features/landing/demos/demoScript"
import { HeroFilm } from "@/features/landing/demos/HeroDemo"

/** Vitrinde (`/ui/landing`) kare kare bakılan sahneler. */
export const SCENE_LIST: { id: string; name: string; phases: readonly Phase[]; Film: (p: { ms: number }) => React.ReactNode }[] = [
  { id: "hero", name: "Hero", phases: HERO_PHASES, Film: HeroFilm },
]
```

`SceneShowcase.tsx`:

```tsx
"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { loopMs, phaseAt } from "@/features/landing/demos/demoScript"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"
import s from "@/features/landing/landing.module.css"

/** Tanıtım sahneleri, an seçilerek (DOG-160). Yalnızca yerelde. */
export function SceneShowcase() {
  const [id, setId] = useState(SCENE_LIST[0]!.id)
  const [ms, setMs] = useState(0)
  const scene = SCENE_LIST.find((x) => x.id === id)!
  const loop = loopMs(scene.phases)
  const { phase } = phaseAt(scene.phases, ms)
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <ToggleGroup type="single" variant="outline" value={id} onValueChange={(v) => v && (setId(v), setMs(0))}>
        {SCENE_LIST.map((x) => (
          <ToggleGroupItem key={x.id} value={x.id}>
            {x.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap gap-2 text-sm">
        {scene.phases.map((p, i) => {
          const start = scene.phases.slice(0, i).reduce((t, q) => t + q.ms, 0)
          return (
            <button key={p.id} type="button" className={`rounded border px-2 py-1 ${p.id === phase ? "bg-muted font-semibold" : ""}`} onClick={() => setMs(start + p.ms - 1)}>
              {p.id}
            </button>
          )
        })}
      </div>
      <input type="range" min={0} max={loop - 1} value={ms} onChange={(e) => setMs(Number(e.target.value))} className="w-full" aria-label="An" />
      <div className={`${s.mock} ${s.mockWide}`}>
        <scene.Film ms={ms} />
      </div>
    </main>
  )
}
```

`app/ui/landing/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { SceneShowcase } from "@/components/ui-showcase/SceneShowcase"

export const metadata = { title: "Tanıtım sahneleri · uyarla" }

/** Tanıtım sahneleri kare kare (DOG-160). Yalnızca yerelde; üretimde 404. */
export default function LandingScenesPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <SceneShowcase />
}
```

- [ ] **Step 2: Run** `pnpm exec tsc --noEmit` → temiz. Tarayıcıda `http://localhost:3001/ui/landing`: Hero seçili, kaydırıcıyla kareler değişiyor.

- [ ] **Step 3: Commit, ardından PR 1**

```bash
git add apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/components/ui-showcase/SceneShowcase.tsx apps/web/src/app/ui/landing/page.tsx
git commit -m "Tanıtım yolculuğu: yerel sahne vitrini (DOG-160)"
```

PR 1: `tanitim-spec` dalı `tanitim-1-altyapi` olarak yeniden adlandırılır (spec commit'i dahil). Push ve `gh pr create --base test`. Vercel SUCCESS olunca squash ile birleştir. `test`'i çek, sonraki dalı ondan aç.

---

### Task 7: Bul sahnesi

**Files:**
- Create: `apps/web/src/features/jobs/siteNotes.ts`
- Modify: `apps/web/src/features/jobs/components/JobSearch.tsx:18-24` (`SITE_NOTE` buradan silinip import edilir)
- Modify: `apps/web/src/features/landing/demos/scenes.ts`, `scenes.test.ts`
- Create: `apps/web/src/features/landing/demos/JobSearchDemo.tsx`
- Create: `apps/web/src/features/landing/demos/scenes.render.test.tsx`
- Modify: `apps/web/src/features/landing/demos/sceneList.tsx`, `apps/web/src/features/landing/LandingPage.tsx` (`STEP_VISUAL.bul`)

**Interfaces:**
- Produces:
  - `SITE_NOTE: Record<SearchSite, (city: string | null) => string>` (`@/features/jobs/siteNotes`)
  - `JOB_PHASES`, `JOB_SCENE: { profile: string[]; keywords: string; links: { site: SearchSite; label: string; note: string }[] }`
  - `JobSearchFilm({ ms })`, `JobSearchDemo()`

- [ ] **Step 1: Write the failing tests**

`scenes.test.ts`'e (import'a `JOB_SCENE` ekle):

```ts
describe("job search scene", () => {
  it("uses the product's own links and notes, and shows no result counts", () => {
    expect(JOB_SCENE.links.map((l) => l.label)).toEqual(["Kariyer.net", "LinkedIn", "Jooble", "Careerjet"])
    expect(JOB_SCENE.links.find((l) => l.site === "linkedin")!.note).toBe("İstanbul, Türkiye")
    expect(JOB_SCENE.links.find((l) => l.site === "kariyernet")!.note).toBe("Şehri sitede seçersin")
    expect(JSON.stringify(JOB_SCENE)).not.toMatch(/\d+ (ilan|sonuç)/)
  })
})
```

`scenes.render.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loopMs } from "@/features/landing/demos/demoScript"
import { JOB_PHASES } from "@/features/landing/demos/scenes"
import { JobSearchDemo, JobSearchFilm } from "@/features/landing/demos/JobSearchDemo"

/** Her sahne son karesinde (hareket azaltma) anlamlı metni gösteriyor. */
describe("scenes (DOG-160)", () => {
  it("job search ends with the four sites and the query", () => {
    const html = renderToStaticMarkup(<JobSearchFilm ms={loopMs(JOB_PHASES) - 1} />)
    for (const label of ["Kariyer.net", "LinkedIn", "Jooble", "Careerjet"]) expect(html).toContain(label)
    expect(html).toContain("frontend geliştirici react")
    expect(renderToStaticMarkup(<JobSearchDemo />)).toContain('role="figure"')
  })
})
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/features/landing/demos/scenes.test.ts src/features/landing/demos/scenes.render.test.tsx`. Expected: FAIL. Dışa aktarımlar yok.

- [ ] **Step 3: Implement**

`siteNotes.ts`: `JobSearch.tsx`'teki `SITE_NOTE` sabitini ve yorumunu aynen buraya taşı, başına `import type { SearchSite } from "@uyarla/core/jobSuggest/links"` ve `export` ekle. `JobSearch.tsx`'te sabiti sil, `import { SITE_NOTE } from "@/features/jobs/siteNotes"` ekle.

`scenes.ts` sonuna:

```ts
import { searchLinks, type SearchSite } from "@uyarla/core/jobSuggest/links"
import { SITE_NOTE } from "@/features/jobs/siteNotes"

export const JOB_PHASES = [
  { id: "profile", ms: 1500 },
  { id: "query", ms: 2500 },
  { id: "sites", ms: 3000 },
  { id: "open", ms: 2000 },
  { id: "hold", ms: 2500 },
] as const
export type JobPhase = (typeof JOB_PHASES)[number]["id"]

const JOB_KEYWORDS = "frontend geliştirici react hibrit"

/** Bul sahnesi: profil, sorgu, dört sitenin kendi arama sayfası. Sonuç sayısı yok; ilanı biz getirmiyoruz. */
export const JOB_SCENE: { profile: string[]; keywords: string; links: { site: SearchSite; label: string; note: string }[] } = {
  profile: [SCENE_ROLE, SCENE_CITY, "hibrit"],
  keywords: JOB_KEYWORDS,
  links: searchLinks({ keywords: JOB_KEYWORDS, city: SCENE_CITY }).map((l) => ({ site: l.site, label: l.label, note: SITE_NOTE[l.site](SCENE_CITY) })),
}
```

Import'lar dosyanın başına taşınır.

`JobSearchDemo.tsx`:

```tsx
"use client"

import { ExternalLink, Search } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { JOB_PHASES, JOB_SCENE, type JobPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Bul sahnesinin `ms` anındaki karesi. Saf. */
export function JobSearchFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(JOB_PHASES, ms)
  const at = (id: JobPhase) => phaseReached(JOB_PHASES, phase, id)
  const query = phase === "query" ? typedSlice(JOB_SCENE.keywords, progress) : at("sites") ? JOB_SCENE.keywords : ""
  return (
    <div className="space-y-4">
      <div>
        <p className={s.mockLabel}>İş ara</p>
        <p className={s.mockTitle}>{JOB_SCENE.profile.join(" · ")}</p>
      </div>
      <div className="flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{query}</span>
        {phase === "query" && <span className="inline-block h-4 w-px animate-pulse bg-foreground" />}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {JOB_SCENE.links.map((l, i) => {
          const shown = at("sites") && (phase !== "sites" || progress >= i / JOB_SCENE.links.length)
          const pressed = at("open") && l.site === "linkedin"
          return (
            <li
              key={l.site}
              style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(6px)" }}
              className={`rounded-lg border bg-background p-3 transition-all duration-300 ${pressed ? "border-primary" : ""}`}
            >
              <p className="text-sm font-semibold">{l.label}</p>
              <p className="text-xs text-muted-foreground">{l.note}</p>
              <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${pressed ? "text-primary" : "text-muted-foreground"}`}>
                Aç <ExternalLink size={12} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function JobSearchDemo() {
  return (
    <Scene label="İş arama: profildeki rol ve şehirle kurulan sorgu Kariyer.net, LinkedIn, Jooble ve Careerjet'in kendi arama sayfalarında açılıyor." phases={JOB_PHASES}>
      {(ms) => <JobSearchFilm ms={ms} />}
    </Scene>
  )
}
```

- `sceneList.tsx`'e `{ id: "bul", name: "Bul", phases: JOB_PHASES, Film: JobSearchFilm }` ekle.
- `LandingPage.tsx`'te `STEP_VISUAL`'a `bul: <JobSearchDemo />` ekle.

- [ ] **Step 4: Run** test, `pnpm exec vitest run src/features/jobs src/features/landing` ve `pnpm exec tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Elle kontrol** — `/ui/landing` → Bul, aşamalar sırayla. `/` → `#bul` sahnesi ekrana girince oynuyor, çıkınca duruyor. 390 px'te kartlar taşmıyor.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/jobs/siteNotes.ts apps/web/src/features/jobs/components/JobSearch.tsx apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts apps/web/src/features/landing/demos/JobSearchDemo.tsx apps/web/src/features/landing/demos/scenes.render.test.tsx apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/features/landing/LandingPage.tsx
git commit -m "Tanıtım yolculuğu: Bul sahnesi (DOG-160)"
```

---

### Task 8: Başvur sahnesi

**Files:**
- Modify: `scenes.ts`, `scenes.test.ts`, `scenes.render.test.tsx`, `sceneList.tsx`, `LandingPage.tsx`
- Create: `apps/web/src/features/landing/demos/ApplyDemo.tsx`

**Interfaces:**
- Produces:
  - `APPLY_PHASES`
  - `APPLY_SCENE: { question: string; limit: number; answer: string; answerEvidence: string[]; letter: string; letterEvidence: string }`
  - `ApplyFilm`, `ApplyDemo`

- [ ] **Step 1: Write the failing tests**

`scenes.test.ts`'e:

```ts
describe("apply scene", () => {
  it("keeps the answer within its limit and every claim in the CV", () => {
    expect(APPLY_SCENE.answer.length).toBeLessThanOrEqual(APPLY_SCENE.limit)
    expect(APPLY_SCENE.limit).toBe(140)
    for (const q of [...APPLY_SCENE.answerEvidence, APPLY_SCENE.letterEvidence]) expect(inCv(q), q).toBe(true)
  })
})
```

`scenes.render.test.tsx`'e:

```tsx
  it("apply ends copied, within the limit, with the CV source", () => {
    const html = renderToStaticMarkup(<ApplyFilm ms={loopMs(APPLY_PHASES) - 1} />)
    expect(html).toContain("Kopyalandı")
    expect(html).toContain("Sınır içinde")
    expect(html).toContain(`${APPLY_SCENE.answer.length}/140`)
    expect(html).toContain("CV&#x27;nden")
  })
```

- [ ] **Step 2: Run** iki test dosyası. Expected: FAIL.

- [ ] **Step 3: Implement**

`scenes.ts`'e:

```ts
export const APPLY_PHASES = [
  { id: "question", ms: 1200 },
  { id: "answer", ms: 3500 },
  { id: "check", ms: 1300 },
  { id: "letter", ms: 3000 },
  { id: "copy", ms: 1500 },
  { id: "hold", ms: 2000 },
] as const
export type ApplyPhase = (typeof APPLY_PHASES)[number]["id"]

/** Başvur sahnesi: form sorusu ve ön yazı; her cümle CV'den, sınır kodla denetleniyor. */
export const APPLY_SCENE = {
  question: "140 karakterde neden sen?",
  limit: 140,
  answer: "React ile müşteri paneli geliştirdim. Kod incelemelerine katıldım, yeni gelen geliştiricilere yardımcı oldum.",
  answerEvidence: ["Müşteri paneli projesinde React kullandım", "Kod incelemelerine katıldım"],
  letter: `Müşteri paneli projesinde React kullandım ve kod incelemelerine katıldım. ${SCENE_COMPANY}'daki arayüz geliştirme işine bu deneyimle başlamak isterim.`,
  letterEvidence: "Kod incelemelerine katıldım",
}
```

`ApplyDemo.tsx`:

```tsx
"use client"

import { Check, Copy } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { APPLY_PHASES, APPLY_SCENE, type ApplyPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Başvur sahnesinin `ms` anındaki karesi. Saf. */
export function ApplyFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(APPLY_PHASES, ms)
  const at = (id: ApplyPhase) => phaseReached(APPLY_PHASES, phase, id)
  const answer = phase === "answer" ? typedSlice(APPLY_SCENE.answer, progress) : at("check") ? APPLY_SCENE.answer : ""
  return (
    <div className="space-y-4">
      <div>
        <p className={s.mockLabel}>Başvuru formu</p>
        <p className={s.mockTitle}>{APPLY_SCENE.question}</p>
      </div>
      <div className="rounded-lg border bg-background p-3 text-sm">
        <p className="min-h-10">{answer}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {answer.length}/{APPLY_SCENE.limit}
          </span>
          {at("check") && (
            <span className="inline-flex items-center gap-1 font-medium text-brand-green">
              <Check size={12} /> Sınır içinde
            </span>
          )}
        </div>
      </div>
      <div style={{ opacity: at("letter") ? 1 : 0 }} className="rounded-lg border bg-background p-3 text-sm transition-opacity duration-500">
        <p className={s.mockLabel}>Ön yazı</p>
        <p className="mt-1">{APPLY_SCENE.letter}</p>
        <p className="mt-2 inline-block rounded bg-brand-green/10 px-2 py-0.5 text-xs">CV&apos;nden: “{APPLY_SCENE.letterEvidence}”</p>
      </div>
      <div className="flex justify-end">
        <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${at("copy") ? "border-brand-green text-brand-green" : ""}`}>
          {at("copy") ? <Check size={12} /> : <Copy size={12} />} {at("copy") ? "Kopyalandı" : "Kopyala"}
        </span>
      </div>
    </div>
  )
}

export function ApplyDemo() {
  return (
    <Scene label="Başvuru formu: “140 karakterde neden sen?” sorusu CV'deki cümlelerle sınır içinde yanıtlanıyor; ön yazı paragrafı kaynağını gösteriyor ve kopyalanıyor." phases={APPLY_PHASES}>
      {(ms) => <ApplyFilm ms={ms} />}
    </Scene>
  )
}
```

- `sceneList.tsx` ve `STEP_VISUAL`'a `basvur` ekle.

- [ ] **Step 4: Run** testler ve tsc. Expected: PASS.

- [ ] **Step 5: Elle kontrol** — vitrin ve `/#basvur`, 390 px.

- [ ] **Step 6: Commit, ardından PR 2**

```bash
git add apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts apps/web/src/features/landing/demos/scenes.render.test.tsx apps/web/src/features/landing/demos/ApplyDemo.tsx apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/features/landing/LandingPage.tsx
git commit -m "Tanıtım yolculuğu: Başvur sahnesi (DOG-160)"
```

---

### Task 9: Takip et sahnesi

**Files:**
- Modify: `scenes.ts`, `scenes.test.ts`, `scenes.render.test.tsx`, `sceneList.tsx`, `LandingPage.tsx`
- Create: `apps/web/src/features/landing/demos/BoardDemo.tsx`

**Interfaces:**
- Consumes: `STAGE_LABEL`, `STAGES` (`@/features/applications/board`), `DEMO_REQUIREMENTS`, `DEMO_BASE_SCORE`, `demoScore`, `DEMO_BULLETS`.
- Produces:
  - `BOARD_PHASES`
  - `BOARD_SCENE: { position: string; missingMust: number; before: number; after: number; note: string }`
  - `BoardFilm`, `BoardDemo`

- [ ] **Step 1: Write the failing tests**

`scenes.test.ts`'e:

```ts
describe("board scene", () => {
  it("takes the gate count and scores from the existing demo story", () => {
    const missingMust = DEMO_REQUIREMENTS.filter((r) => r.importance === "Zorunlu" && !r.evidence).length
    expect(BOARD_SCENE.missingMust).toBe(missingMust)
    expect(BOARD_SCENE.before).toBe(28)
    expect(BOARD_SCENE.after).toBe(41)
    expect(BOARD_SCENE.note).toContain("[ad]")
  })
})
```

`scenes.render.test.tsx`'e:

```tsx
  it("board ends in the interview column with a thank-you draft", () => {
    const html = renderToStaticMarkup(<BoardFilm ms={loopMs(BOARD_PHASES) - 1} />)
    for (const label of ["Kaydedildi", "Başvuruldu", "Mülakat", "Teklif", "Olmadı"]) expect(html).toContain(label)
    expect(html).toContain("[ad]")
    expect(html).toContain(">41<")
    const gate = renderToStaticMarkup(<BoardFilm ms={BOARD_GATE_MS} />)
    expect(gate).toContain("Önce uyarlamak ister misin?")
    expect(gate).toContain(`${BOARD_SCENE.missingMust} zorunlu gereksinim CV&#x27;nde görünmüyor`)
  })
```

- [ ] **Step 2: Run** Expected: FAIL.

- [ ] **Step 3: Implement**

`scenes.ts`'e (import'a `DEMO_REQUIREMENTS, DEMO_BASE_SCORE, DEMO_BULLETS, demoScore` eklenir):

```ts
export const BOARD_PHASES = [
  { id: "card", ms: 1200 },
  { id: "drag", ms: 1500 },
  { id: "gate", ms: 2500 },
  { id: "adapted", ms: 1800 },
  { id: "interview", ms: 1500 },
  { id: "note", ms: 3000 },
  { id: "hold", ms: 1500 },
] as const
export type BoardPhase = (typeof BOARD_PHASES)[number]["id"]

/** Kapının açıldığı an: vitrin ve test için. */
export const BOARD_GATE_MS = 1200 + 1500 + 1250

/** Takip et sahnesi: kapı sayısı ve skorlar mevcut demo senaryosundan; alıcının adı uydurulmuyor. */
export const BOARD_SCENE = {
  position: `${SCENE_ROLE} · ${SCENE_COMPANY}`,
  missingMust: DEMO_REQUIREMENTS.filter((r) => r.importance === "Zorunlu" && !r.evidence).length,
  before: DEMO_BASE_SCORE,
  after: demoScore(Object.fromEntries(DEMO_BULLETS.filter((b) => !b.flag).map((b) => [b.id, "new"]))),
  note: "Merhaba [ad], bugünkü görüşme için teşekkür ederim. Kod incelemesi pratiklerinizi dinlemek ilgimi artırdı.",
}
```

`BoardDemo.tsx`:

```tsx
"use client"

import { STAGE_LABEL, STAGES } from "@/features/applications/board"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { BOARD_PHASES, BOARD_SCENE, type BoardPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Takip et sahnesinin `ms` anındaki karesi. Saf. */
export function BoardFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(BOARD_PHASES, ms)
  const at = (id: BoardPhase) => phaseReached(BOARD_PHASES, phase, id)
  const column = at("interview") ? "interview" : at("adapted") ? "applied" : "saved"
  const score = at("adapted") ? BOARD_SCENE.after : BOARD_SCENE.before
  const note = phase === "note" ? typedSlice(BOARD_SCENE.note, progress) : at("hold") ? BOARD_SCENE.note : ""
  return (
    <div className="space-y-3">
      <p className={s.mockLabel}>Başvurular</p>
      <div className="grid grid-cols-5 gap-1.5">
        {STAGES.map((stage) => (
          <div key={stage} className="min-h-24 rounded-lg bg-background p-1.5">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{STAGE_LABEL[stage]}</p>
            {stage === column && (
              <div
                className={`mt-1.5 rounded-md border bg-card p-1.5 text-[11px] shadow-xs transition-transform ${phase === "drag" ? "translate-x-3 rotate-2" : ""}`}
              >
                <p className="line-clamp-2 font-medium">{BOARD_SCENE.position}</p>
                <p className={`mt-1 font-semibold tabular-nums ${at("adapted") ? "text-brand-green" : "text-brand-amber"}`}>{score}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {phase === "gate" && (
        <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
          <p className="font-semibold">Önce uyarlamak ister misin?</p>
          <p className="mt-1 text-muted-foreground">{BOARD_SCENE.missingMust} zorunlu gereksinim CV&apos;nde görünmüyor.</p>
          <div className="mt-2 flex justify-end gap-2 text-xs">
            <span className="rounded border px-2 py-1">Yine de başvur</span>
            <span className="rounded bg-primary px-2 py-1 text-primary-foreground">Uyarla</span>
          </div>
        </div>
      )}
      {at("note") && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className={s.mockLabel}>Teşekkür notu taslağı</p>
          <p className="mt-1">
            {note.split("[ad]").map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 && <mark className="rounded bg-brand-amber/20 px-0.5">[ad]</mark>}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

export function BoardDemo() {
  return (
    <Scene label="Başvuru panosu: düşük skorlu kart başvurulmadan önce uyarlama öneriyor; uyarlanınca 41 skorla Başvuruldu'ya, sonra Mülakat'a geçiyor ve teşekkür notu taslağı hazırlanıyor." phases={BOARD_PHASES}>
      {(ms) => <BoardFilm ms={ms} />}
    </Scene>
  )
}
```

`typedSlice` "[ad]"ı yarıda keserse `split` parçalı gösterir. Bu kabul edilebilir; son karede tam.

- `sceneList.tsx` ve `STEP_VISUAL`'a `takip` ekle.

- [ ] **Step 4: Run** testler ve tsc. Expected: PASS. Not: `scenes.ts` `@/features/applications/board`'u içe aktarmıyor; yalnızca `BoardDemo` aktarıyor. `board.ts` istemci dışı bağımlılık getirirse (prisma vb.) tsc veya çizim testi bunu gösterir. Getirirse yalnızca `STAGES`/`STAGE_LABEL`'ı içeren hafif bir modüle ayır ve Ruling yaz.

- [ ] **Step 5: Elle kontrol** — vitrin, `/#takip`, 390 px (beş sütun dar ekranda sığıyor mu; sığmıyorsa `grid-cols-5` yerine yatay kaydırma ekle ve Ruling yaz).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts apps/web/src/features/landing/demos/scenes.render.test.tsx apps/web/src/features/landing/demos/BoardDemo.tsx apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/features/landing/LandingPage.tsx
git commit -m "Tanıtım yolculuğu: Takip et sahnesi (DOG-160)"
```

---

### Task 10: Hazırlan sahnesi

**Files:**
- Modify: `scenes.ts`, `scenes.test.ts`, `scenes.render.test.tsx`, `sceneList.tsx`, `LandingPage.tsx`
- Create: `apps/web/src/features/landing/demos/InterviewDemo.tsx`

**Interfaces:**
- Produces:
  - `INTERVIEW_PHASES`
  - `INTERVIEW_SCENE: { question: string; evidence: string; answer: string; star: { label: string; ok: boolean }[]; notOnPaper: string }`
  - `InterviewFilm`, `InterviewDemo`

- [ ] **Step 1: Write the failing tests**

`scenes.test.ts`'e:

```ts
describe("interview scene", () => {
  it("grounds the question in the CV and flags a claim that is not on paper", () => {
    expect(inCv(INTERVIEW_SCENE.evidence)).toBe(true)
    expect(INTERVIEW_SCENE.answer).toContain(INTERVIEW_SCENE.notOnPaper)
    expect(inCv(INTERVIEW_SCENE.notOnPaper)).toBe(false)
    expect(INTERVIEW_SCENE.star.map((x) => x.label)).toEqual(["Durum", "Görev", "Eylem", "Sonuç"])
  })
})
```

`scenes.render.test.tsx`'e:

```tsx
  it("interview ends with STAR feedback and the not-on-paper flag", () => {
    const html = renderToStaticMarkup(<InterviewFilm ms={loopMs(INTERVIEW_PHASES) - 1} />)
    expect(html).toContain("Kâğıtta yok")
    expect(html).toContain(INTERVIEW_SCENE.notOnPaper)
    expect(html).toContain("Sonuç")
  })
```

- [ ] **Step 2: Run** Expected: FAIL.

- [ ] **Step 3: Implement**

`scenes.ts`'e:

```ts
export const INTERVIEW_PHASES = [
  { id: "question", ms: 1500 },
  { id: "evidence", ms: 1200 },
  { id: "answer", ms: 3500 },
  { id: "feedback", ms: 2500 },
  { id: "flag", ms: 2000 },
  { id: "hold", ms: 1500 },
] as const
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number]["id"]

/** Hazırlan sahnesi: soru CV'deki kanıtla; cevaptaki "12 geliştirici" CV'de yok, işaretleniyor. */
export const INTERVIEW_SCENE = {
  question: "Bir kod incelemesinde görüş ayrılığını nasıl çözdün?",
  evidence: "Kod incelemelerine katıldım",
  answer: "12 geliştiricilik ekipte bir bileşenin yapısında anlaşamadık. İki seçeneği örnekle yazıp incelemede karşılaştırdık ve birini seçtik.",
  star: [
    { label: "Durum", ok: true },
    { label: "Görev", ok: true },
    { label: "Eylem", ok: true },
    { label: "Sonuç", ok: false },
  ],
  notOnPaper: "12 geliştirici",
}
```

`InterviewDemo.tsx`:

```tsx
"use client"

import { Check, Minus, TriangleAlert } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { INTERVIEW_PHASES, INTERVIEW_SCENE, type InterviewPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Hazırlan sahnesinin `ms` anındaki karesi. Saf. */
export function InterviewFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(INTERVIEW_PHASES, ms)
  const at = (id: InterviewPhase) => phaseReached(INTERVIEW_PHASES, phase, id)
  const answer = phase === "answer" ? typedSlice(INTERVIEW_SCENE.answer, progress) : at("feedback") ? INTERVIEW_SCENE.answer : ""
  return (
    <div className="space-y-3">
      <div>
        <p className={s.mockLabel}>Mülakat sorusu</p>
        <p className={s.mockTitle}>{INTERVIEW_SCENE.question}</p>
        {at("evidence") && <p className="mt-1 inline-block rounded bg-brand-green/10 px-2 py-0.5 text-xs">CV: “{INTERVIEW_SCENE.evidence}”</p>}
      </div>
      <div className="min-h-16 rounded-lg border bg-background p-3 text-sm">
        <p className={s.mockLabel}>Cevabın</p>
        <p className="mt-1">{answer}</p>
      </div>
      {at("feedback") && (
        <ul className="grid grid-cols-4 gap-1.5 text-xs">
          {INTERVIEW_SCENE.star.map((x) => (
            <li key={x.label} className={`flex items-center gap-1 rounded-md border px-2 py-1 ${x.ok ? "" : "text-muted-foreground"}`}>
              {x.ok ? <Check size={12} className="text-brand-green" /> : <Minus size={12} />} {x.label}
            </li>
          ))}
        </ul>
      )}
      {at("flag") && (
        <p className="flex items-start gap-2 rounded-lg bg-brand-amber/10 p-2.5 text-sm">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-brand-amber" />
          <span>
            <strong>Kâğıtta yok:</strong> “{INTERVIEW_SCENE.notOnPaper}” CV&apos;nde geçmiyor.
          </span>
        </p>
      )}
    </div>
  )
}

export function InterviewDemo() {
  return (
    <Scene label="Mülakat pratiği: soru CV'deki kanıtıyla geliyor; cevap STAR yapısına göre değerlendiriliyor ve CV'de olmayan “12 geliştirici” ifadesi işaretleniyor." phases={INTERVIEW_PHASES}>
      {(ms) => <InterviewFilm ms={ms} />}
    </Scene>
  )
}
```

- `sceneList.tsx` ve `STEP_VISUAL`'a `hazirlan` ekle.

- [ ] **Step 4: Run** testler ve tsc. Expected: PASS.

- [ ] **Step 5: Elle kontrol** — vitrin, `/#hazirlan`, 390 px (STAR satırı 4 sütun sığıyor mu).

- [ ] **Step 6: Commit, ardından PR 3**

```bash
git add apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts apps/web/src/features/landing/demos/scenes.render.test.tsx apps/web/src/features/landing/demos/InterviewDemo.tsx apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/features/landing/LandingPage.tsx
git commit -m "Tanıtım yolculuğu: Hazırlan sahnesi (DOG-160)"
```

---

### Task 11: Görünür ol sahnesi

**Files:**
- Modify: `scenes.ts`, `scenes.test.ts`, `scenes.render.test.tsx`, `sceneList.tsx`, `LandingPage.tsx`
- Create: `apps/web/src/features/landing/demos/LinkedInDemo.tsx`

**Interfaces:**
- Consumes: `SECTION_LABELS`, `STATUS_LABELS` (`@/features/linkedin/sections`).
- Produces:
  - `LINKEDIN_PHASES`
  - `LINKEDIN_SCENE: { before: string; reason: string; parts: { text: string; source: { kind: "target" } | { kind: "cv"; quote: string } }[] }`
  - `LinkedInFilm`, `LinkedInDemo`

- [ ] **Step 1: Write the failing tests**

`scenes.test.ts`'e:

```ts
describe("linkedin scene", () => {
  it("builds the new headline only from the target role and the CV", () => {
    for (const p of LINKEDIN_SCENE.parts) {
      if (p.source.kind === "cv") expect(inCv(p.source.quote), p.source.quote).toBe(true)
      else expect(p.text).toBe(SCENE_ROLE)
    }
  })
})
```

`scenes.render.test.tsx`'e:

```tsx
  it("linkedin ends with the rewritten headline, its sources and the coming-soon extension", () => {
    const html = renderToStaticMarkup(<LinkedInFilm ms={loopMs(LINKEDIN_PHASES) - 1} />)
    expect(html).toContain("Başlık")
    expect(html).toContain("Geliştirilebilir")
    for (const p of LINKEDIN_SCENE.parts) expect(html).toContain(p.text)
    expect(html).toContain("Hedef rolün")
    expect(html).toContain("Yakında")
  })
```

- [ ] **Step 2: Run** Expected: FAIL.

- [ ] **Step 3: Implement**

`scenes.ts`'e:

```ts
export const LINKEDIN_PHASES = [
  { id: "profile", ms: 1500 },
  { id: "audit", ms: 2200 },
  { id: "rewrite", ms: 3500 },
  { id: "evidence", ms: 2000 },
  { id: "hold", ms: 2500 },
] as const
export type LinkedInPhase = (typeof LINKEDIN_PHASES)[number]["id"]

/** Görünür ol sahnesi: yeni başlığın her parçası ya hedef rol ya CV'deki bir satır. */
export const LINKEDIN_SCENE: {
  before: string
  reason: string
  parts: { text: string; source: { kind: "target" } | { kind: "cv"; quote: string } }[]
} = {
  before: "Yazılım Geliştirici",
  reason: "Hedef rolünü ve öne çıkan becerini söylemiyor.",
  parts: [
    { text: SCENE_ROLE, source: { kind: "target" } },
    { text: "React, TypeScript", source: { kind: "cv", quote: "React, TypeScript" } },
    { text: "Kod incelemesi", source: { kind: "cv", quote: "Kod incelemelerine katıldım" } },
  ],
}
```

`LinkedInDemo.tsx`:

```tsx
"use client"

import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { LINKEDIN_PHASES, LINKEDIN_SCENE, type LinkedInPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import { SECTION_LABELS, STATUS_LABELS } from "@/features/linkedin/sections"
import s from "@/features/landing/landing.module.css"

const NEW_HEADLINE = LINKEDIN_SCENE.parts.map((p) => p.text).join(" · ")

/** Görünür ol sahnesinin `ms` anındaki karesi. Saf. */
export function LinkedInFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(LINKEDIN_PHASES, ms)
  const at = (id: LinkedInPhase) => phaseReached(LINKEDIN_PHASES, phase, id)
  const headline = phase === "rewrite" ? typedSlice(NEW_HEADLINE, progress) : at("evidence") ? NEW_HEADLINE : LINKEDIN_SCENE.before
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">EY</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Elif Yılmaz</p>
          <p className="truncate text-sm text-muted-foreground">{headline}</p>
        </div>
      </div>
      {at("audit") && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="flex items-center gap-2">
            <span className="font-medium">{SECTION_LABELS.headline}</span>
            <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs">{STATUS_LABELS.improve}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{LINKEDIN_SCENE.reason}</p>
        </div>
      )}
      {at("evidence") && (
        <ul className="grid gap-1.5 text-xs">
          {LINKEDIN_SCENE.parts.map((p) => (
            <li key={p.text} className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-medium">{p.text}</span>
              <span className="rounded bg-brand-green/10 px-1.5 py-0.5">{p.source.kind === "cv" ? `CV: “${p.source.quote}”` : "Hedef rolün"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-right text-xs text-muted-foreground">
        Eklentiyle profilini aktar · <span className="rounded-full border px-1.5 py-0.5">Yakında</span>
      </p>
    </div>
  )
}

export function LinkedInDemo() {
  return (
    <Scene label="LinkedIn denetimi: “Yazılım Geliştirici” başlığı geliştirilebilir bulunuyor ve hedef rol ile CV'deki becerilerden “Frontend Geliştirici · React, TypeScript · Kod incelemesi” olarak yeniden yazılıyor." phases={LINKEDIN_PHASES}>
      {(ms) => <LinkedInFilm ms={ms} />}
    </Scene>
  )
}
```

- `sceneList.tsx` ve `STEP_VISUAL`'a `gorunur` ekle.

- [ ] **Step 4: Run** testler ve tsc. Expected: PASS. `@/features/linkedin/sections` core'dan yalnızca tip aktarıyor; tsc temiz olmalı.

- [ ] **Step 5: Elle kontrol** — vitrin, `/#gorunur`, 390 px.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/landing/demos/scenes.ts apps/web/src/features/landing/demos/scenes.test.ts apps/web/src/features/landing/demos/scenes.render.test.tsx apps/web/src/features/landing/demos/LinkedInDemo.tsx apps/web/src/features/landing/demos/sceneList.tsx apps/web/src/features/landing/LandingPage.tsx
git commit -m "Tanıtım yolculuğu: Görünür ol sahnesi (DOG-160)"
```

---

### Task 12: SSS, dürüstlük metni, hero rozeti ve alt metni

**Files:**
- Modify: `apps/web/src/features/landing/faq.ts`
- Modify: `apps/web/src/features/landing/LandingPage.tsx` (hero rozeti ve alt metni, dürüstlük ilkeleri)
- Modify: `apps/web/src/features/landing/LandingPage.render.test.tsx`

- [ ] **Step 1: Write the failing test** `LandingPage.render.test.tsx`'e:

```tsx
  it("tells the whole journey up top and answers the new questions (DOG-160)", () => {
    expect(html).toContain("Mülakat hazırlığı ve LinkedIn denetimi")
    expect(html).toContain("başvur, takip et, mülakata hazırlan")
    expect(html).toContain("Başvuru formlarını siz mi dolduruyorsunuz?")
    expect(html).toContain("Mülakat hazırlığında sorular nereden geliyor?")
    expect(html).toContain("LinkedIn profilimi nasıl denetliyorsunuz?")
    expect(html).toContain("Gönderimi sen yaparsın")
  })
```

- [ ] **Step 2: Run** Expected: FAIL.

- [ ] **Step 3: Implement**
  - **Hero rozeti:**
    ```tsx
    <span className={s.heroBadgeTag}>Yeni</span>
    Mülakat hazırlığı ve LinkedIn denetimi
    <span className={s.heroBadgeMore}>: başvurunun her adımında</span>
    ```
    `href="/login"` yerine `href="#hazirlan"` olsun.
  - **Hero alt metni:** "İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve ilana özel hâle getir; sonra başvur, takip et, mülakata hazırlan. Deneyimini uydurmadan." Test küçük harfli "başvur, takip et, mülakata hazırlan" parçasını arıyor.
  - **Dürüstlük ilkeleri:** üçüncü ilke "Son söz senin" kalıyor. Dördüncü ilke ekleniyor:
    ```ts
    { icon: "mail" as const, b: "Gönderimi sen yaparsın", m: "Ön yazı, form yanıtı ve mesajları biz göndermeyiz; kopyalayıp sen gönderirsin." }
    ```
    `Icon`'da `mail` adı var (BENTO'da kullanılıyordu). `principles` ızgarası dört öğeye göre bozuluyorsa CSS'i iki sütuna çevir ve Ruling yaz.
  - **`faq.ts`:** "Uyarlama ücretli mi?" sorusundan sonra üç soru ekle:

```ts
  {
    s: "Mülakat hazırlığında sorular nereden geliyor?",
    c: "İlandan ve başvurduğun CV'den. Her sorunun yanında CV'ndeki kanıtı durur. Yazılı pratikte cevabını STAR yapısına göre değerlendiririz; CV'nde olmayan bir sayı ya da iddia kullanırsan “kâğıtta yok” diye işaretleriz. Abonelikte.",
  },
  {
    s: "LinkedIn profilimi nasıl denetliyorsunuz?",
    c: "Profil metnini yapıştırırsın ya da PDF olarak yüklersin; hedef rolüne göre başlık, hakkında, deneyim ve beceriler bölümlerini tek tek değerlendiririz. Teşhis ve başlık önerileri ücretsiz; hakkında ve deneyim yazımı abonelikte. Eklentiyle tek tıkla aktarım yakında.",
  },
  {
    s: "Başvuru formlarını siz mi dolduruyorsunuz?",
    c: "Hayır. Form sorularına, ön yazına ve takip mesajlarına CV'ne dayanan taslaklar hazırlarız; karakter sınırını kod denetler. Hiçbirini biz göndermeyiz, kopyalayıp sen yapıştırırsın.",
  },
```

    LinkedIn cevabındaki "PDF olarak yüklersin" ifadesini `AuditStart.tsx`'teki gerçek giriş yollarıyla karşılaştır. Farklıysa cevabı ürüne uydur ve Ruling yaz.

- [ ] **Step 4: Run** `pnpm exec vitest run src/features/landing` ve tsc. Expected: PASS.

- [ ] **Step 5: Elle kontrol (son)**
  - `/` baştan sona 1440 açık/koyu ve 390 px.
  - Hareket azaltma açık (DevTools → Rendering → prefers-reduced-motion: reduce): sahneler son karede, şerit çalışıyor.
  - Konsolda hata yok.
  - `scrollWidth <= innerWidth`.

- [ ] **Step 6: Commit, ardından PR 4**

```bash
git add apps/web/src/features/landing/faq.ts apps/web/src/features/landing/LandingPage.tsx apps/web/src/features/landing/LandingPage.render.test.tsx
git commit -m "Tanıtım yolculuğu: SSS, dürüstlük ve hero metni (DOG-160)"
```

Bunu tam takım izler:
- `pnpm test` (kökten);
- `cd apps/web && pnpm exec tsc --noEmit`;
- son inceleme;
- test → main (kullanıcı akışına göre).
