import { z } from "zod"
import { normalizeText } from "../normalize/turkish.js"
import { AdaptationDraftSchema } from "../schemas/adaptation.js"
import type { Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"

/**
 * Olgu hafızası (DOG-116): kullanıcının "AI ile yaz"da anlattığı ve kabul
 * edilen deneyim sonraki analizlerde kanıt sayılıyor.
 *
 * Ayrı tablo yok: olgular kullanıcının uyarlamalarındaki kabul edilmiş
 * katkılardan türetiliyor. Katkı uyarlamada reddedilirse ya da uyarlama
 * silinirse olgu da düşüyor; iki kayıt arasında eşitleme gerekmiyor.
 * "Unut" katkıya `forgotten` yazıyor; o uyarlamanın kendi belgesi değişmiyor.
 *
 * Olgu, anlatıldığı işe (şirket ve unvan) bağlı. Yeni CV'de o iş yoksa olgu
 * eklenmiyor: başka bir işin altına yazmak adayın anlatmadığı bir şey olurdu.
 */
export const RememberedFactSchema = z.object({
  /** `<uyarlama>:<katkı>`; "unut" bu kimlikle çağrılıyor. */
  id: z.string(),
  company: z.string(),
  title: z.string(),
  /** Kabul edilen madde. */
  text: z.string(),
  /** Kullanıcının kendi sözleri; maddenin sourceRef'i ve doğrulamanın kaynağı. */
  answer: z.string(),
  /** Anlatıldığı gereksinim; Hesabım'da bağlam olarak. */
  requirement: z.string().nullable(),
  /** Anlatıldığı uyarlamanın oluşturulma zamanı (ISO). */
  createdAt: z.string(),
})

export type RememberedFact = z.infer<typeof RememberedFactSchema>

export interface FactSource {
  adaptationId: string
  createdAt: Date
  /** Uyarlamanın taslağı; çalışan ya da patlamış uyarlamada boş nesne. */
  draft: unknown
  /** Uyarlamanın dayandığı profil (analysisProfile ile). */
  profile: ResumeProfile | null
  requirements: Requirement[]
}

const key = (text: string) => normalizeText(text)

/** Uyarlamalardan olgu listesi; yeniden eskiye, aynı madde bir kez. */
export function factsFromAdaptations(sources: FactSource[]): RememberedFact[] {
  const facts: RememberedFact[] = []
  const seen = new Set<string>()
  const ordered = [...sources].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  for (const source of ordered) {
    const parsed = AdaptationDraftSchema.safeParse(source.draft)
    if (!parsed.success || !source.profile) continue
    for (const c of parsed.data.contributions ?? []) {
      if (c.status !== "done" || c.decision !== "accepted" || !c.text?.trim() || c.forgotten) continue
      const job = source.profile.experience[c.experienceIndex]
      if (!job || seen.has(key(c.text))) continue
      seen.add(key(c.text))
      facts.push({
        id: `${source.adaptationId}:${c.id}`,
        company: job.company,
        title: job.title,
        text: c.text,
        answer: c.answer,
        requirement: source.requirements[c.requirementIndex]?.text ?? null,
        createdAt: source.createdAt.toISOString(),
      })
    }
  }
  return facts
}

/**
 * Olguların ekleneceği iş: önce şirket ve unvan birlikte, yoksa yalnız
 * şirket. Aynı şirkette birden çok iş varsa (terfi) unvan ayırıyor.
 */
function jobIndexFor(profile: ResumeProfile, fact: RememberedFact): number {
  const company = key(fact.company)
  if (!company) return -1
  const sameCompany = profile.experience.flatMap((job, i) => (key(job.company) === company ? [i] : []))
  const sameTitle = sameCompany.find((i) => key(profile.experience[i]!.title) === key(fact.title))
  return sameTitle ?? sameCompany[0] ?? -1
}

/**
 * Olguları profile ekler: her biri anlatıldığı işin maddelerinin sonuna,
 * sourceRef olarak kullanıcının cevabıyla (kabul edilmiş katkı nasıl
 * ekleniyorsa öyle, adapt/profile.ts). Mevcut maddelerin kimlikleri
 * değişmiyor. CV'de zaten aynı madde varsa (kullanıcı uyarlanmış CV'yi
 * yeniden yüklediyse) eklenmiyor.
 */
export function withFacts(
  profile: ResumeProfile,
  facts: readonly RememberedFact[],
): { profile: ResumeProfile; applied: RememberedFact[] } {
  if (facts.length === 0) return { profile, applied: [] }
  const present = new Set(
    [...profile.experience.flatMap((job) => job.bullets), ...(profile.projects ?? []).flatMap((p) => p.bullets)].map((b) =>
      key(b.text),
    ),
  )
  const added = new Map<number, RememberedFact[]>()
  for (const fact of facts) {
    if (present.has(key(fact.text))) continue
    const index = jobIndexFor(profile, fact)
    if (index === -1) continue
    present.add(key(fact.text))
    added.set(index, [...(added.get(index) ?? []), fact])
  }
  if (added.size === 0) return { profile, applied: [] }
  return {
    profile: {
      ...profile,
      experience: profile.experience.map((job, i) => ({
        ...job,
        bullets: [...job.bullets, ...(added.get(i) ?? []).map((f) => ({ text: f.text, sourceRef: f.answer }))],
      })),
    },
    applied: [...added.values()].flat(),
  }
}

/**
 * Bir analizin gördüğü profil: CV sürümünün profili ve analize katılan
 * olgular. Analizden sonraki her adım (uyarlama, düzeltilmiş skor, indirme)
 * bunu kullanmalı; yoksa madde kimlikleri kayar ve skor başka bir profile
 * göre hesaplanır.
 */
export function analysisProfile(profile: ResumeProfile, result: unknown): ResumeProfile {
  const facts = (result as { facts?: unknown } | null)?.facts
  const parsed = z.array(RememberedFactSchema).safeParse(facts ?? [])
  return parsed.success ? withFacts(profile, parsed.data).profile : profile
}

/**
 * Kanıtı bir olgudan gelen gereksinimleri işaretler: ekran "CV'nde" yerine
 * "anlattığın deneyimde" diyor. Yüklenen CV'de bu madde yok; uyarlanan CV'ye
 * ekleniyor.
 */
export function markFactEvidence(result: ScoreResult, applied: readonly RememberedFact[]): ScoreResult {
  if (applied.length === 0) return result
  const answers = new Set(applied.map((f) => f.answer))
  return {
    ...result,
    facts: [...applied],
    requirements: result.requirements.map((r) =>
      r.evidence?.sourceRef && answers.has(r.evidence.sourceRef) ? { ...r, evidence: { ...r.evidence, fact: true } } : r,
    ),
  }
}
