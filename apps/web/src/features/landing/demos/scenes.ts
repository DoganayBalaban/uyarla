/**
 * Tanıtım sahnelerinin örnek verisi (DOG-160). Elif kurgusal; hero ve
 * gereksinim demolarındaki kişiyle aynı. Kural (K-32, spec §6): sahnelerde
 * gösterilen her kanıt bu CV'de birebir geçiyor, "kâğıtta yok" diye
 * işaretlenen hiçbir ifade geçmiyor. scenes.test.ts bunu denetliyor.
 */

import { searchLinks, type SearchSite } from "@uyarla/core/jobSuggest/links"
import { SITE_NOTE } from "@/features/jobs/siteNotes"
import { DEMO_BASE_SCORE, DEMO_BULLETS, DEMO_REQUIREMENTS, demoScore } from "@/features/landing/demos/demoScript"

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

export const JOB_PHASES = [
  { id: "profile", ms: 1500 },
  { id: "query", ms: 2500 },
  { id: "sites", ms: 3000 },
  { id: "open", ms: 2000 },
  { id: "hold", ms: 2500 },
] as const
export type JobPhase = (typeof JOB_PHASES)[number]["id"]

const JOB_KEYWORDS = "frontend geliştirici react hibrit"

/**
 * Bul sahnesi: hedef rol profilden, şehir ve çalışma şekli kullanıcının eklediği;
 * dört sitenin kendi arama sayfası. Sonuç sayısı yok; ilanı biz getirmiyoruz.
 */
export const JOB_SCENE: { role: string; added: string[]; keywords: string; links: { site: SearchSite; label: string; note: string }[] } = {
  role: SCENE_ROLE,
  added: [SCENE_CITY, "hibrit"],
  keywords: JOB_KEYWORDS,
  links: searchLinks({ keywords: JOB_KEYWORDS, city: SCENE_CITY }).map((l) => ({ site: l.site, label: l.label, note: SITE_NOTE[l.site](SCENE_CITY) })),
}

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
  answer: "Müşteri paneli projesinde React kullandım. Kod incelemelerine katıldım, yeni gelen geliştiricilere yardımcı oldum.",
  answerEvidence: ["Müşteri paneli projesinde React kullandım", "Kod incelemelerine katıldım"],
  letter: `Müşteri paneli projesinde React kullandım ve kod incelemelerine katıldım. ${SCENE_COMPANY}'daki arayüz geliştirme işine bu deneyimle başlamak isterim.`,
  letterEvidence: "Kod incelemelerine katıldım",
}

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
  after: demoScore(Object.fromEntries(DEMO_BULLETS.filter((b) => !b.flag).map((b) => [b.id, "new" as const]))),
  note: "Merhaba [ad], bugünkü görüşme için teşekkür ederim. Kod incelemesi pratiklerinizi dinlemek ilgimi artırdı.",
}

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

export const LINKEDIN_PHASES = [
  { id: "profile", ms: 1500 },
  { id: "audit", ms: 2200 },
  { id: "rewrite", ms: 3500 },
  { id: "evidence", ms: 2000 },
  { id: "hold", ms: 2500 },
] as const
export type LinkedInPhase = (typeof LINKEDIN_PHASES)[number]["id"]

/** Görünür ol sahnesi: yeni başlığın her parçası ya hedef rol ya profildeki bir satır (Elif'in profili CV'siyle aynı). */
export const LINKEDIN_SCENE: {
  before: string
  reason: string
  parts: { text: string; source: { kind: "target" } | { kind: "profile"; quote: string } }[]
} = {
  before: "Yazılım Geliştirici",
  /** Ürünün denetim metni (core/linkedin/audit headline_target). */
  reason: `Başlığında hedef unvanın (“${SCENE_ROLE}”) geçmiyor; işe alımcılar unvanla arıyor.`,
  parts: [
    { text: SCENE_ROLE, source: { kind: "target" } },
    { text: "React, TypeScript", source: { kind: "profile", quote: "React, TypeScript" } },
    { text: "Kod incelemesi", source: { kind: "profile", quote: "Kod incelemelerine katıldım" } },
  ],
}

export const CHECK_PHASES = [
  { id: "show", ms: 1500 },
  { id: "flag", ms: 2000 },
  { id: "locked", ms: 1500 },
  { id: "decide", ms: 1800 },
  { id: "open", ms: 2000 },
  { id: "hold", ms: 1500 },
] as const
export type CheckPhase = (typeof CHECK_PHASES)[number]["id"]

export const EXT_PHASES = [
  { id: "page", ms: 1500 },
  { id: "point", ms: 1300 },
  { id: "click", ms: 600 },
  { id: "open", ms: 2400 },
  { id: "score", ms: 2400 },
  { id: "hold", ms: 1800 },
] as const
export type ExtPhase = (typeof EXT_PHASES)[number]["id"]

/**
 * Eklenti sahnesi (DOG-163; 0.4.0, DOG-169): ilan sayfasında başvuru
 * düğmesinin yanındaki uyarla düğmesine basılıyor, uyarla ilan metni dolu
 * açılıyor; varsayılan CV'si olan kullanıcıda analiz
 * kendiliğinden başlıyor. Skor mevcut demo senaryosundan (28).
 */
export const EXT_SCENE = {
  host: "ornek-ilan-sitesi.com",
  title: SCENE_ROLE,
  company: SCENE_COMPANY,
  posting: [
    "React ve TypeScript ile arayüz geliştirme",
    "Birim testi (Jest, Testing Library)",
    "Kod incelemesi, genç geliştiricilere mentorluk",
  ],
  resume: "Elif_Yilmaz_CV.pdf",
  score: DEMO_BASE_SCORE,
}
