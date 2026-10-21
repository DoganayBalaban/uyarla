import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"

/**
 * Kullanıcının gereksinim düzeltmeleri (DOG-90).
 *
 * Kalıcı hariç tutma kavram düzeyinde: gereksinim metni ilandan ilana
 * değişiyor, kavram kanonik. Bir gereksinim ancak BÜTÜN kavramları listedeyse
 * otomatik hariç; "Docker ve Kubernetes"te yalnız Docker'ı hariç tutmuş biri
 * Kubernetes'i de kaybetmemeli.
 */

/**
 * İşaretin nedeni. `found_in_cv` hariç tutmuyor, yalnızca bildirim: kanıtı
 * olmayan bir şeyi skordan silmek uydurmanın skor tarafı olurdu.
 */
export type ExclusionReason = "not_in_posting" | "irrelevant" | "found_in_cv"

/** `analysis`: yalnız bu ilanda · `always`: listeye de yazıldı · `profile`: listeden otomatik geldi. */
export type ExclusionScope = "analysis" | "always" | "profile"

export interface ExclusionMark {
  reason: Exclude<ExclusionReason, "found_in_cv">
  scope: ExclusionScope
}

/** Hariç tutmayan "CV'mde var ama bulunamadı" bildirimi; değerlendirme verisi. */
export interface RequirementReport {
  index: number
  reason: "found_in_cv"
  at: string
}

/** Listede saklanan anahtar: Türkçe küçük harf, boşluk sadeleştirilmiş. */
export function conceptKey(term: string): string {
  return term.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr")
}

/** Bütün kavramları kullanıcının listesinde olan gereksinimlerin sırası. */
export function profileExclusions(posting: JobPostingData, keys: Iterable<string>): number[] {
  const list = new Set(keys)
  if (list.size === 0) return []
  const out: number[] = []
  posting.requirements.forEach((r, i) => {
    if (r.concepts.length === 0) return
    const covered = r.concepts.every((c) => [c.term, ...c.synonyms].some((t) => list.has(conceptKey(t))))
    if (covered) out.push(i)
  })
  return out
}

/** İlanın yanlış okunmuş şartının düzeltmesi: deneyimde en az yıl, eğitimde kabul edilen terimler. */
export interface RequirementCorrection {
  minYears?: number
  terms?: string[]
}

/**
 * Unvan düzeltmesi (DOG-134): ilanın unvanı yanlış okunduysa kullanıcının
 * yazdığı unvan. Kabul edilmesi için ilan metninde geçmesi gerekiyor; ilanın
 * düzeltmesi, CV hakkında bir beyan değil.
 */
export function positionInPosting(rawText: string | null | undefined, position: string): boolean {
  return !!rawText && containsKeyword(rawText, position)
}

/** Düzeltme taşıyabilen gereksinim; `minYears` metinden okunan yılın yerine geçiyor. */
export type CorrectedRequirement = Requirement & { minYears?: number }

/**
 * Düzeltmeleri uygulanmış ilan; asıl ilan değişmiyor. Terim düzeltmesi
 * kavramları değiştiriyor, yani çağıran kavram vektörlerini düzeltilmiş
 * ilandan (conceptTexts) üretmeli.
 */
export function correctPosting(
  posting: JobPostingData,
  corrections: Record<number | string, RequirementCorrection>,
  /** Unvan düzeltmesi (DOG-134); yoksa ilanın okunan unvanı. */
  position?: string | null,
): JobPostingData {
  return {
    ...posting,
    position: position?.trim() || posting.position,
    requirements: posting.requirements.map((r, i): CorrectedRequirement => {
      const fix = corrections[i]
      if (!fix) return r
      let next: CorrectedRequirement = r
      if (typeof fix.minYears === "number" && fix.minYears > 0) next = { ...next, minYears: fix.minYears }
      const terms = (fix.terms ?? []).map((t) => t.trim()).filter(Boolean)
      if (terms.length > 0) next = { ...next, concepts: terms.map((term) => ({ term, synonyms: [] })) }
      return next
    }),
  }
}
