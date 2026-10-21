import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { verifyRewrite } from "../verify/verify.js"
import { EDIT_MAX_LENGTH } from "./edit.js"
import { bulletId, projectBulletId } from "./ids.js"
import type { StructuredSection } from "../schemas/resume.js"
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

/** Maddelerin bağlı olduğu yer: bir iş ya da bir proje. */
export type BulletGroup = { kind: "experience" | "project"; index: number }

/** `bulletOrder` anahtarı: deneyimde sıra ("0"), projede "p" önekli ("p0"). */
export function groupKey(group: BulletGroup): string {
  return group.kind === "experience" ? String(group.index) : `p${group.index}`
}

/** Bir işin ya da projenin maddeleri son sırasıyla; çıkarılan ve kaldırılanlar işaretli. */
export function groupBullets(profile: ResumeProfile, draft: AdaptationDraft, group: BulletGroup): JobBullet[] {
  const source = group.kind === "experience" ? profile.experience[group.index] : profile.projects?.[group.index]
  if (!source) return []
  const idOf = (j: number) => (group.kind === "experience" ? bulletId(group.index, j) : projectBulletId(group.index, j))
  const accepted = new Map(draft.bullets.filter((b) => b.decision === "accepted").map((b) => [b.id, b.rewritten]))
  const omitted = new Set(draft.omitted ?? [])
  const removed = new Set(draft.removed ?? [])
  const flags = (id: string) => ({ omitted: omitted.has(id), removed: removed.has(id) })
  const mine = (u: { experienceIndex?: number; projectIndex?: number }) =>
    group.kind === "experience" ? u.experienceIndex === group.index && u.projectIndex === undefined : u.projectIndex === group.index

  const natural: JobBullet[] = [
    ...source.bullets.map((bullet, j) => {
      const id = idOf(j)
      // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
      return { id, text: accepted.get(id) ?? bullet.text, sourceRef: bullet.sourceRef, kind: "cv" as const, ...flags(id) }
    }),
    // Kullanıcının anlattığı deneyimden yazılanlar (DOG-94); dayanak cevabı.
    // Katkılar yalnızca işlere ekleniyor.
    ...(group.kind === "experience" ? (draft.contributions ?? []) : [])
      .filter((c) => c.experienceIndex === group.index && c.status === "done" && c.decision === "accepted" && c.text)
      .map((c) => ({ id: c.id, text: c.text!, sourceRef: c.answer, kind: "contribution" as const, ...flags(c.id) })),
    ...(draft.userBullets ?? [])
      .filter(mine)
      .map((u) => ({ id: u.id, text: u.text, sourceRef: u.text, kind: "user" as const, ...flags(u.id) })),
  ]
  return ordered(natural, draft.bulletOrder?.[groupKey(group)])
}

/** Bir işin maddeleri (deneyim grubu). */
export function jobBullets(profile: ResumeProfile, draft: AdaptationDraft, experienceIndex: number): JobBullet[] {
  return groupBullets(profile, draft, { kind: "experience", index: experienceIndex })
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

/** Bir işin ya da projenin sonuna kullanıcının yazdığı maddeyi ekler. */
export function addUserBullet(
  draft: AdaptationDraft,
  target: number | BulletGroup,
  text: string,
  context: { profile: ResumeProfile; posting: JobPostingData },
): AdaptationDraft {
  const group: BulletGroup = typeof target === "number" ? { kind: "experience", index: target } : target
  const exists = group.kind === "experience" ? context.profile.experience[group.index] : context.profile.projects?.[group.index]
  if (!exists) throw new Error("Bölüm bulunamadı")
  const value = normalize(text)
  if (!value) throw new Error("Boş metin")
  if (value.length > EDIT_MAX_LENGTH) throw new Error("Metin çok uzun")
  const existing = draft.userBullets ?? []
  const next = Math.max(0, ...existing.map((u) => Number(u.id.slice(1)) || 0)) + 1
  const verification = verifyRewrite({ rewritten: value, source: resumeText(context.profile), posting: context.posting })
  const where = group.kind === "experience" ? { experienceIndex: group.index } : { projectIndex: group.index }
  return { ...draft, userBullets: [...existing, { id: `u${next}`, ...where, text: value, verification }] }
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

/** Maddeyi işin ya da projenin içinde bir yukarı ya da aşağı taşır. */
export function moveBullet(
  draft: AdaptationDraft,
  profile: ResumeProfile,
  target: number | BulletGroup,
  id: string,
  direction: "up" | "down",
): AdaptationDraft {
  const group: BulletGroup = typeof target === "number" ? { kind: "experience", index: target } : target
  const ids = groupBullets(profile, draft, group).map((b) => b.id)
  const at = ids.indexOf(id)
  if (at === -1) throw new Error(`Madde bulunamadı: ${id}`)
  const to = direction === "up" ? at - 1 : at + 1
  if (to < 0 || to >= ids.length) return draft
  ;[ids[at], ids[to]] = [ids[to]!, ids[at]!]
  return { ...draft, bulletOrder: { ...(draft.bulletOrder ?? {}), [groupKey(group)]: ids } }
}

function withoutId(order: AdaptationDraft["bulletOrder"], id: string): AdaptationDraft["bulletOrder"] {
  if (!order) return order
  return Object.fromEntries(Object.entries(order).map(([k, ids]) => [k, ids.filter((x) => x !== id)]))
}

/**
 * Bölümü bir yukarı ya da aşağı taşır. `current` belgede şu an görünen sıra
 * (document/model sectionOrder); seçilen sıra taslağa yazılıyor.
 */
export function moveSection(
  draft: AdaptationDraft,
  current: readonly StructuredSection[],
  section: StructuredSection,
  direction: "up" | "down",
  /** Belgede içeriği olan bölümler; boş bölümün üstünden atlanıyor, yoksa taşıma görünmezdi. */
  present: ReadonlySet<StructuredSection> = new Set(current),
): AdaptationDraft {
  const order = [...current]
  const at = order.indexOf(section)
  if (at === -1) throw new Error(`Bölüm bulunamadı: ${section}`)
  const step = direction === "up" ? -1 : 1
  let to = at + step
  while (to >= 0 && to < order.length && !present.has(order[to]!)) to += step
  if (to < 0 || to >= order.length) return draft
  ;[order[at], order[to]] = [order[to]!, order[at]!]
  return { ...draft, sectionOrder: order }
}

export const SECTION_HEADING_MAX_LENGTH = 60
export const SECTION_MAX_LINES = 12

/** Kullanıcının yazdığı bir bölüm ekler (gönüllü çalışmalar, ödüller…); satırlar kontrol ediliyor. */
export function addUserSection(
  draft: AdaptationDraft,
  heading: string,
  text: string,
  context: { profile: ResumeProfile; posting: JobPostingData },
): AdaptationDraft {
  const title = normalize(heading)
  if (!title || title.length > SECTION_HEADING_MAX_LENGTH) throw new Error("Geçersiz başlık")
  const lines = text
    .split("\n")
    .map(normalize)
    .filter(Boolean)
  if (lines.length === 0 || lines.length > SECTION_MAX_LINES || lines.some((l) => l.length > EDIT_MAX_LENGTH)) {
    throw new Error("Geçersiz satırlar")
  }
  const existing = draft.userSections ?? []
  const next = Math.max(0, ...existing.map((x) => Number(x.id.slice(1)) || 0)) + 1
  const verification = verifyRewrite({ rewritten: lines.join(" "), source: resumeText(context.profile), posting: context.posting })
  return { ...draft, userSections: [...existing, { id: `s${next}`, heading: title, lines, verification }] }
}

export function removeUserSection(draft: AdaptationDraft, id: string): AdaptationDraft {
  if (!(draft.userSections ?? []).some((x) => x.id === id)) throw new Error(`Bölüm bulunamadı: ${id}`)
  return { ...draft, userSections: draft.userSections!.filter((x) => x.id !== id) }
}
