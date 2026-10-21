import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { verifyRewrite } from "../verify/verify.js"
import { EDIT_MAX_LENGTH } from "./edit.js"
import { bulletId } from "./ids.js"
import { resumeText } from "./targets.js"

/**
 * Deneyim maddelerini ekleme, kaldırma ve taşıma (DOG-92, serbest
 * düzenleyicinin ilk adımı). Bir işin maddeleri tek yerden kuruluyor
 * (`jobBullets`): indirilen belge (applyAdaptation) ve ekrandaki belge
 * görünümü aynı listeyi kullanıyor, ikisi ayrışamaz.
 *
 * Kullanıcının yazdığı madde, düzenlemedeki gibi (K-83) CV'nin tamamına ve
 * ilana karşı kontrol ediliyor; CV'de olmayan sayı ya da ilan terimi "kontrol
 * et" uyarısı alıyor ama engellenmiyor: yazan kullanıcı.
 */

export interface JobBullet {
  id: string
  text: string
  /** Doğrulamanın kaynağı: CV'deki madde, katkıda cevap, kullanıcı maddesinde kendisi. */
  sourceRef: string
  kind: "cv" | "contribution" | "user"
  /** Tek sayfa için çıkarıldı (DOG-93). */
  omitted: boolean
  /** Kullanıcı kaldırdı. */
  removed: boolean
}

/** Bir işin maddeleri son sırasıyla; çıkarılan ve kaldırılanlar işaretli. */
export function jobBullets(profile: ResumeProfile, draft: AdaptationDraft, experienceIndex: number): JobBullet[] {
  const job = profile.experience[experienceIndex]
  if (!job) return []
  const accepted = new Map(draft.bullets.filter((b) => b.decision === "accepted").map((b) => [b.id, b.rewritten]))
  const omitted = new Set(draft.omitted ?? [])
  const removed = new Set(draft.removed ?? [])
  const flags = (id: string) => ({ omitted: omitted.has(id), removed: removed.has(id) })

  const natural: JobBullet[] = [
    ...job.bullets.map((bullet, j) => {
      const id = bulletId(experienceIndex, j)
      // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
      return { id, text: accepted.get(id) ?? bullet.text, sourceRef: bullet.sourceRef, kind: "cv" as const, ...flags(id) }
    }),
    // Kullanıcının anlattığı deneyimden yazılanlar (DOG-94); dayanak cevabı.
    ...(draft.contributions ?? [])
      .filter((c) => c.experienceIndex === experienceIndex && c.status === "done" && c.decision === "accepted" && c.text)
      .map((c) => ({ id: c.id, text: c.text!, sourceRef: c.answer, kind: "contribution" as const, ...flags(c.id) })),
    ...(draft.userBullets ?? [])
      .filter((u) => u.experienceIndex === experienceIndex)
      .map((u) => ({ id: u.id, text: u.text, sourceRef: u.text, kind: "user" as const, ...flags(u.id) })),
  ]
  return ordered(natural, draft.bulletOrder?.[String(experienceIndex)])
}

/** Sırada geçenler önce, o sırayla; geçmeyenler (yeni eklenenler) doğal sırayla sonda. */
function ordered<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  return items
    .map((item, i) => ({ item, i, r: rank.get(item.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item)
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim()

/** Bir işin sonuna kullanıcının yazdığı maddeyi ekler. */
export function addUserBullet(
  draft: AdaptationDraft,
  experienceIndex: number,
  text: string,
  context: { profile: ResumeProfile; posting: JobPostingData },
): AdaptationDraft {
  if (!context.profile.experience[experienceIndex]) throw new Error("İş bulunamadı")
  const value = normalize(text)
  if (!value) throw new Error("Boş metin")
  if (value.length > EDIT_MAX_LENGTH) throw new Error("Metin çok uzun")
  const existing = draft.userBullets ?? []
  const next = Math.max(0, ...existing.map((u) => Number(u.id.slice(1)) || 0)) + 1
  const verification = verifyRewrite({ rewritten: value, source: resumeText(context.profile), posting: context.posting })
  return { ...draft, userBullets: [...existing, { id: `u${next}`, experienceIndex, text: value, verification }] }
}

/**
 * Maddeyi belgeden kaldırır. Kullanıcının kendi maddesi tümden siliniyor;
 * CV'deki madde ve katkı geri alınabilir şekilde işaretleniyor.
 */
export function removeBullet(draft: AdaptationDraft, id: string): AdaptationDraft {
  if ((draft.userBullets ?? []).some((u) => u.id === id)) {
    return { ...draft, userBullets: draft.userBullets!.filter((u) => u.id !== id), bulletOrder: withoutId(draft.bulletOrder, id) }
  }
  const removed = new Set(draft.removed ?? [])
  removed.add(id)
  return { ...draft, removed: [...removed] }
}

/** Kaldırılan ya da tek sayfa için çıkarılan maddeyi geri alır. */
export function restoreBullet(draft: AdaptationDraft, id: string): AdaptationDraft {
  return {
    ...draft,
    removed: (draft.removed ?? []).filter((x) => x !== id),
    omitted: (draft.omitted ?? []).filter((x) => x !== id),
  }
}

/** Maddeyi işin içinde bir yukarı ya da aşağı taşır. */
export function moveBullet(
  draft: AdaptationDraft,
  profile: ResumeProfile,
  experienceIndex: number,
  id: string,
  direction: "up" | "down",
): AdaptationDraft {
  const ids = jobBullets(profile, draft, experienceIndex).map((b) => b.id)
  const at = ids.indexOf(id)
  if (at === -1) throw new Error(`Madde bulunamadı: ${id}`)
  const to = direction === "up" ? at - 1 : at + 1
  if (to < 0 || to >= ids.length) return draft
  ;[ids[at], ids[to]] = [ids[to]!, ids[at]!]
  return { ...draft, bulletOrder: { ...(draft.bulletOrder ?? {}), [String(experienceIndex)]: ids } }
}

function withoutId(order: AdaptationDraft["bulletOrder"], id: string): AdaptationDraft["bulletOrder"] {
  if (!order) return order
  return Object.fromEntries(Object.entries(order).map(([k, ids]) => [k, ids.filter((x) => x !== id)]))
}
