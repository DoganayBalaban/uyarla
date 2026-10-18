/**
 * Tanıtım sayfasındaki canlı demoların senaryosu. Demolar sunucuya gitmez;
 * gerçek ekranların kopyası, önceden yazılmış örnek veriyle oynar.
 *
 * Uydurma ilkesi burada da bağlayıcı (K-32): "yeni hâl" metinleri eski
 * maddede olmayan bir olgu eklemiyor; abartılı madde işaretli ve skoru
 * artırmıyor. Sayılar ürünün güncel eşikleriyle (scoreStatus) tutarlı.
 */

export type HeroPhaseId = "upload" | "job" | "analyze" | "score" | "adapt" | "hold"

/** Hero filminin sahneleri; toplamı bir döngü. */
export const HERO_PHASES: { id: HeroPhaseId; ms: number }[] = [
  { id: "upload", ms: 1800 },
  { id: "job", ms: 2600 },
  { id: "analyze", ms: 2000 },
  { id: "score", ms: 2400 },
  { id: "adapt", ms: 3400 },
  { id: "hold", ms: 2200 },
]

export const HERO_LOOP_MS = HERO_PHASES.reduce((t, p) => t + p.ms, 0)

/** Döngünün `ms` anında hangi sahnede ve sahnenin yüzde kaçında olunduğu. */
export function heroPhaseAt(ms: number): { phase: HeroPhaseId; progress: number } {
  let t = ((ms % HERO_LOOP_MS) + HERO_LOOP_MS) % HERO_LOOP_MS
  for (const p of HERO_PHASES) {
    if (t < p.ms) return { phase: p.id, progress: t / p.ms }
    t -= p.ms
  }
  return { phase: "upload", progress: 0 }
}

/** Daktilo efekti: metnin `progress` oranı kadarı. */
export function typedSlice(text: string, progress: number): string {
  const p = Math.min(1, Math.max(0, progress))
  return text.slice(0, Math.round(text.length * p))
}

export const HERO_FILE_NAME = "Elif_Yilmaz_CV.pdf"
export const HERO_JOB_TEXT =
  "Frontend Geliştirici — React ve TypeScript ile arayüz geliştirme, birim testi (Jest), kod incelemesi, genç geliştiricilere mentorluk."
export const HERO_STAGES = ["CV okunuyor", "İlan gereksinimlere ayrılıyor", "Kanıtlar eşleştiriliyor"]
export const HERO_MISSING = ["Birim testi", "Kod incelemesi", "Mentorluk"]

export type Segment = { text: string; kind: "same" | "del" | "add" }

export type DemoBullet = {
  id: string
  label: string
  segments: Segment[]
  /** Yeni hâlin dayandığı ifade; üründeki "… ifadene dayanıyor" satırı. */
  evidence: { term: string; quote: string }[]
  /** Kabul edilince skora katkı. İşaretli maddede 0: abartı skor kazandırmaz. */
  gain: number
  /** Uydurma kontrolünün gerekçesi; varsa madde işaretli. */
  flag?: string
}

export const DEMO_BASE_SCORE = 28

export const DEMO_BULLETS: DemoBullet[] = [
  {
    id: "b2",
    label: "Madde 2",
    segments: [
      { text: "Kod incelemelerine katıldım ", kind: "same" },
      { text: "(kod incelemesi) ", kind: "add" },
      { text: "ve yeni gelen geliştiricilere yardımcı ", kind: "same" },
      { text: "oldum.", kind: "del" },
      { text: " oldum (genç geliştiricilere mentorluk).", kind: "add" },
    ],
    evidence: [
      { term: "kod incelemesi", quote: "Kod incelemelerine katıldım" },
      { term: "genç geliştiricilere mentorluk", quote: "yeni gelen geliştiricilere yardımcı oldum" },
    ],
    gain: 7,
  },
  {
    id: "b4",
    label: "Madde 4",
    segments: [
      { text: "Bileşenler için Jest ile birim testleri ", kind: "same" },
      { text: "yazdım.", kind: "del" },
      { text: " yazdım ve birim testi yazma alışkanlığı edindim.", kind: "add" },
    ],
    evidence: [{ term: "birim testi yazma alışkanlığı", quote: "Bileşenler için Jest ile birim testleri yazdım" }],
    gain: 6,
  },
  {
    id: "b5",
    label: "Madde 5",
    segments: [
      { text: "Stajyerlerin uyumuna destek oldum.", kind: "del" },
      { text: " 4 kişilik ekibe liderlik ettim.", kind: "add" },
    ],
    evidence: [],
    gain: 0,
    flag: "Orijinal maddede “liderlik” ve “4 kişi” geçmiyor. Bu ifade deneyimini abartıyor olabilir.",
  },
]

export type Decision = "new" | "old"
export type Decisions = Partial<Record<string, Decision>>

export function demoScore(decisions: Decisions): number {
  return DEMO_BULLETS.reduce((s, b) => s + (decisions[b.id] === "new" ? b.gain : 0), DEMO_BASE_SCORE)
}

export function decidedCount(decisions: Decisions): number {
  return DEMO_BULLETS.filter((b) => decisions[b.id]).length
}

/** Ürün kuralı: işaretli maddelere karar verilmeden indirme açılmaz. */
export function downloadUnlocked(decisions: Decisions): boolean {
  return DEMO_BULLETS.every((b) => !b.flag || decisions[b.id] !== undefined)
}

/** Gereksinim demosu: her eşleşme CV'deki kanıtıyla. */
export const DEMO_REQUIREMENTS: {
  text: string
  importance: "Zorunlu" | "Tercihen"
  evidence?: { quote: string; section: string }
  why?: string
}[] = [
  {
    text: "React ile arayüz geliştirme",
    importance: "Zorunlu",
    evidence: { quote: "Müşteri paneli projesinde React kullandım", section: "Deneyim" },
  },
  { text: "TypeScript", importance: "Zorunlu", evidence: { quote: "TypeScript", section: "Beceriler" } },
  {
    text: "Birim testi (Jest, Testing Library)",
    importance: "Zorunlu",
    why: "CV'nde “test”, “Jest” ya da bir karşılığı geçmiyor. Yaptıysan bir maddede anlatman yeter.",
  },
  {
    text: "Web erişilebilirliği (WCAG)",
    importance: "Tercihen",
    why: "“Erişilebilirlik”, “a11y” veya “WCAG” bulunamadı.",
  },
  {
    text: "Ekiple kod incelemesi",
    importance: "Tercihen",
    evidence: { quote: "Haftalık kod incelemelerine katıldım", section: "Deneyim" },
  },
]

/** `p`'nin [a, b] aralığındaki yerini 0–1'e yayar (sahne içi alt adımlar için). */
export function span(p: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (p - a) / (b - a)))
}

/** Yavaş başlayıp yavaş biten geçiş (easeInOutCubic). */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
