import type { DocumentOutline, Draft } from "@/features/adaptation/types"

/**
 * Belge görünümünün satırları (DOG-93): önceki ve sonraki hâl yan yana değil,
 * aynı satırda. Ekran hangi kipte olursa olsun aynı veriden çiziliyor.
 *
 * Madde kimliği konumdan geliyor ("deneyim-madde", core/adapt/profile.ts
 * bulletId); karar bekleyen maddeyi işaretlemek için taslakla buradan
 * eşleşiyor.
 */
export interface DocumentLine {
  /** Maddenin kimliği; özetin kimliği yok. */
  id: string | null
  before: string
  after: string
  changed: boolean
  /** Karar bekliyor: indirilecek hâlde eski metin duruyor. */
  pending: boolean
  /** Tek sayfa için çıkarıldı (DOG-93): indirilecek belgede yok, geri alınabilir. */
  omitted: boolean
  /** Kullanıcı kaldırdı (DOG-92): indirilecek belgede yok, geri alınabilir. */
  removed: boolean
  /** Kullanıcının kendi yazdığı madde (DOG-92); kaldırınca siliniyor. */
  userWritten: boolean
}

export interface DocumentSections {
  headline: string | null
  summary: DocumentLine | null
  experience: Array<{ company: string; title: string; dates: string; bullets: DocumentLine[] }>
  /** Proje maddeleri de uyarlanıyor (DOG-105); kimlikleri "p<proje>-<madde>". */
  projects: Array<{ name: string; role: string | null; dates: string | null; bullets: DocumentLine[] }>
  skills: Array<{ name: string; added: boolean }>
}

export function documentSections(
  document: { before: DocumentOutline; after: DocumentOutline },
  draft: Pick<Draft, "bullets" | "omitted" | "removed" | "userBullets">,
): DocumentSections {
  const { before, after } = document
  const pending = new Set(draft.bullets.filter((b) => b.decision === "pending").map((b) => b.id))
  const omitted = new Set(draft.omitted ?? [])
  const removed = new Set(draft.removed ?? [])
  const userWritten = new Set((draft.userBullets ?? []).map((u) => u.id))
  const line = (b: string, a: string, id: string | null = null): DocumentLine => ({
    id,
    before: b,
    after: a,
    changed: b !== a,
    pending: id !== null && pending.has(id),
    omitted: id !== null && omitted.has(id),
    removed: id !== null && removed.has(id),
    userWritten: id !== null && userWritten.has(id),
  })
  // CV'deki maddenin önceki hâli kimliğinden ("deneyim-madde"); katkı ve
  // kullanıcı maddesinin önceki hâli yok, tamamı eklenmiş.
  const beforeOf = (id: string) => {
    const m = /^(\d+)-(\d+)$/.exec(id)
    return m ? (before.experience[Number(m[1])]?.bullets[Number(m[2])] ?? "") : ""
  }
  const beforeSkills = new Set(before.skills)

  return {
    headline: after.headline,
    summary: before.summary || after.summary ? line(before.summary ?? "", after.summary ?? "") : null,
    experience: after.experience.map((job, i) => ({
      company: job.company,
      title: job.title,
      dates: [job.startDate, job.endDate].filter(Boolean).join(" – "),
      bullets: job.bullets.map((text, j) => {
        // Kimlik varsa (DOG-92) sıra değişse de doğru eşleşiyor; eski
        // yanıtlarda konum. Önceki hâlde olmayan madde katkı ya da kullanıcı maddesi.
        const id = job.bulletIds?.[j] ?? `${i}-${j}`
        return line(job.bulletIds ? beforeOf(id) : (before.experience[i]?.bullets[j] ?? ""), text, id)
      }),
    })),
    projects: (after.projects ?? []).map((p, i) => ({
      name: p.name,
      role: p.role,
      dates: p.dates,
      bullets: p.bullets.map((text, j) =>
        line(before.projects?.[i]?.bullets[j] ?? "", text, `p${i}-${j}`),
      ),
    })),
    skills: after.skills.map((name) => ({ name, added: !beforeSkills.has(name) })),
  }
}
