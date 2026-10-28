/**
 * Tanıtım sahnelerinin örnek verisi (DOG-160). Elif kurgusal; hero ve
 * gereksinim demolarındaki kişiyle aynı. Kural (K-32, spec §6): sahnelerde
 * gösterilen her kanıt bu CV'de birebir geçiyor, "kâğıtta yok" diye
 * işaretlenen hiçbir ifade geçmiyor. scenes.test.ts bunu denetliyor.
 */

import { searchLinks, type SearchSite } from "@uyarla/core/jobSuggest/links"
import { SITE_NOTE } from "@/features/jobs/siteNotes"

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

/** Bul sahnesi: profil, sorgu, dört sitenin kendi arama sayfası. Sonuç sayısı yok; ilanı biz getirmiyoruz. */
export const JOB_SCENE: { profile: string[]; keywords: string; links: { site: SearchSite; label: string; note: string }[] } = {
  profile: [SCENE_ROLE, SCENE_CITY, "hibrit"],
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
  answer: "React ile müşteri paneli geliştirdim. Kod incelemelerine katıldım, yeni gelen geliştiricilere yardımcı oldum.",
  answerEvidence: ["Müşteri paneli projesinde React kullandım", "Kod incelemelerine katıldım"],
  letter: `Müşteri paneli projesinde React kullandım ve kod incelemelerine katıldım. ${SCENE_COMPANY}'daki arayüz geliştirme işine bu deneyimle başlamak isterim.`,
  letterEvidence: "Kod incelemelerine katıldım",
}
