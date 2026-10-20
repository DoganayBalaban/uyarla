/**
 * "Başvuruya hazır mı" (DOG-91). Jobscan'in "%75 ATS'yi geçer" gibi kanıtsız
 * bir eşiği yerine kendi ölçütümüz: zorunlu gereksinimlerin tamamı
 * karşılanıyor ve ilandaki unvan CV'de (en az kısmen) geçiyor. Sonuç sayfası
 * ve pano aynı ölçütü kullanıyor. İstemci ve sunucu ortak; bağımlılıksız.
 */

interface ResultLike {
  requirements?: Array<{ requirement: { text: string; importance: string; type?: string }; status: string }>
  excluded?: number[]
  scoringRevision?: number
  titleMatch?: { level: "exact" | "partial" | "none"; position: string } | null
}

/**
 * Karşılanmayan zorunlu gereksinimler. Kullanıcının "ilanda yok" diye
 * işaretledikleri (DOG-90), skordan çıkan kişisel nitelikler (DOG-103) ve
 * CV'den anlaşılmayan şartlar (DOG-115) eksik sayılmıyor.
 */
export function missingMustRequirements(result: unknown): Array<{ index: number; text: string }> {
  const r = result as ResultLike | null
  if (!r?.requirements) return []
  const excluded = new Set(r.excluded ?? [])
  const skipSoft = (r.scoringRevision ?? 1) >= 2
  return r.requirements
    .map((x, index) => ({ x, index }))
    .filter(
      ({ x, index }) =>
        x.status === "missing" &&
        x.requirement.importance === "must" &&
        !excluded.has(index) &&
        !(skipSoft && x.requirement.type === "soft") &&
        x.requirement.type !== "condition",
    )
    .map(({ x, index }) => ({ index, text: x.requirement.text }))
}

export interface Readiness {
  ready: boolean
  missingMust: string[]
  /** İlandaki unvan CV'de hiç geçmiyor (skorun 2. sürümünde unvan bir zorunlu gibi). */
  titleMissing: boolean
}

export function readiness(result: unknown): Readiness | null {
  const r = result as ResultLike | null
  if (!r?.requirements) return null
  const missingMust = missingMustRequirements(r).map((m) => m.text)
  const titleMissing = (r.scoringRevision ?? 1) >= 2 && r.titleMatch?.level === "none"
  return { ready: missingMust.length === 0 && !titleMissing, missingMust, titleMissing }
}

/**
 * Hazır değilse en çok ne kazandırır, tek cümle. Her zorunlu skora eşit
 * ağırlıkla giriyor; ilk eksik ilanın sırasıyla en öndeki.
 */
export function readinessHint(r: Readiness): string {
  if (r.ready) return "Başvuruya hazır: zorunlu gereksinimlerin tamamı CV'nde karşılanıyor."
  const parts: string[] = []
  if (r.missingMust.length > 0) {
    const first = `“${r.missingMust[0]}”`
    parts.push(
      r.missingMust.length === 1
        ? `Başvurmadan önce tek bir zorunlu eksik: ${first}.`
        : `Başvurmadan önce ${r.missingMust.length} zorunlu eksik; en öndeki ${first}.`,
    )
  }
  if (r.titleMissing) parts.push("İlandaki unvan CV'nde geçmiyor.")
  parts.push("Deneyiminde varsa CV'nde görünür kılmak skoru en çok artıran adım.")
  return parts.join(" ")
}
