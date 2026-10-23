import { hasQuantity } from "../format/measurable.js"
import { containsKeyword } from "../normalize/turkish.js"
import { findCliches } from "../text/cliches.js"
import { descriptionLines, toResumeProfile, type LinkedInProfileData } from "./profileData.js"
import { ABOUT_MIN_WORDS, SKILLS_MIN, linkedinReport, type ScoredPosting } from "./report.js"
import { HEADLINE_MAX_CHARS, type LinkedInReport } from "./reportRecord.js"

/**
 * LinkedIn profil denetiminin teşhisi (spec §4.2). Saf ve LLM'siz: aynı
 * profil her seferinde aynı sonucu veriyor, bu yüzden ücretsiz. Eşikler yön
 * gösterir, LinkedIn kuralı değildir; ekran da böyle söylüyor.
 */
export const HEADLINE_SHORT_CHARS = 60
export const ABOUT_HOOK_CHARS = 200

export type AuditSectionId = "headline" | "about" | "experience" | "education" | "certifications" | "skills" | "postings"
export type AuditSectionStatus = "strong" | "improve" | "missing" | "info"
export type AuditCheckId =
  | "headline_empty"
  | "headline_default"
  | "headline_target"
  | "headline_short"
  | "headline_keywords"
  | "about_missing"
  | "about_short"
  | "about_hook"
  | "about_cliche"
  | "experience_missing"
  | "exp_description_missing"
  | "exp_no_measurable"
  | "exp_dates_missing"
  | "education_missing"
  | "education_first_job"
  | "skills_few"
  | "skills_evidenced_missing"

export interface AuditCheck {
  id: AuditCheckId
  status: "ok" | "warn" | "missing"
  text: string
  /** Deneyim kontrollerinde rolün sırası. */
  role?: number
}
export interface AuditSection {
  id: AuditSectionId
  status: AuditSectionStatus
  checks: AuditCheck[]
}
export interface SkillAdvice {
  /** Hedefin istediği, deneyimde geçen ama beceri listesinde olmayanlar. */
  add: Array<{ term: string; evidence: string }>
  /** Listede öne alınması önerilenler (hedefle ilgili olanlar). */
  pinFirst: string[]
}
export interface LinkedInAuditReport {
  sections: AuditSection[]
  summary: { passed: number; total: number }
  skills: SkillAdvice
  /** Hedef rol ya da ilan olmadığı, ya da beceri listesinin tamamı okunamadığı için yapılmayan kontroller. */
  skipped: AuditCheckId[]
  postings: LinkedInReport["postings"]
  commonMissing: LinkedInReport["commonMissing"]
}
export interface AuditContext {
  targetRole: string | null
  goal: string | null
  scored: readonly ScoredPosting[]
}

const ok = (id: AuditCheckId, text: string, role?: number): AuditCheck => ({ id, status: "ok", text, ...(role !== undefined ? { role } : {}) })
const warn = (id: AuditCheckId, text: string, role?: number): AuditCheck => ({ id, status: "warn", text, ...(role !== undefined ? { role } : {}) })
const missing = (id: AuditCheckId, text: string): AuditCheck => ({ id, status: "missing", text })
const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const fold = (t: string) => t.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim()

export function sectionStatus(checks: readonly AuditCheck[]): AuditSectionStatus {
  if (checks.some((c) => c.status === "missing")) return "missing"
  if (checks.some((c) => c.status === "warn")) return "improve"
  return "strong"
}

/** Hedef unvanlar: hedef rol, yoksa seçilen ilanların unvanları ("A / B" ayrı ayrı). */
function targetTitles(ctx: AuditContext): string[] {
  const raw = ctx.targetRole?.trim() ? [ctx.targetRole] : ctx.scored.map((s) => s.position)
  return [...new Set(raw.flatMap((t) => t.split("/")).map((t) => t.trim()).filter(Boolean))]
}

/** İlanların beceri kavramları (eşleşen ve eksik), "/" ile ayrılanlar parçalarına. */
function demandedSkills(scored: readonly ScoredPosting[]): string[] {
  const terms = scored.flatMap((s) =>
    s.result.requirements
      .filter((r, i) => r.requirement.type === "skill" && !(s.excluded ?? []).includes(i))
      .flatMap((r) => [...(r.matchedConcepts ?? []), ...(r.missingConcepts ?? [])]),
  )
  return [...new Set(terms.flatMap((t) => t.split("/")).map((t) => t.trim()).filter((t) => t && t.split(/\s+/).length <= 3))]
}

function headlineChecks(p: LinkedInProfileData, targets: string[], mustTerms: string[]): AuditCheck[] {
  const headline = p.headline?.trim()
  if (!headline) {
    return [missing("headline_empty", "Başlığın boş. İşe alımcı seni önce başlığınla görüyor; hedef unvanını ve 2–3 güçlü becerini yaz.")]
  }
  const checks: AuditCheck[] = []
  const role = p.experience[0]
  const defaults = role
    ? [
        role.title,
        ...(role.company
          ? [`${role.title} at ${role.company}`, `${role.company} şirketinde ${role.title}`, `${role.title} · ${role.company}`, `${role.title} - ${role.company}`, `${role.title}, ${role.company}`]
          : []),
      ].map(fold)
    : []
  checks.push(
    defaults.includes(fold(headline))
      ? warn("headline_default", "Başlığın LinkedIn'in varsayılanı gibi: yalnızca unvan ve şirket. Unvanının yanına alanını ve güçlü becerilerini ekle.")
      : ok("headline_default", "Başlığın varsayılan biçimde değil."),
  )
  if (targets.length > 0) {
    const hit = targets.find((t) => containsKeyword(headline, t))
    checks.push(
      hit
        ? ok("headline_target", `Başlığında hedef unvan (“${hit}”) geçiyor.`)
        : warn("headline_target", `Başlığında hedef unvanın (${targets.slice(0, 3).map((t) => `“${t}”`).join(", ")}) geçmiyor; işe alımcılar unvanla arıyor.`),
    )
  }
  checks.push(
    headline.length < HEADLINE_SHORT_CHARS
      ? warn("headline_short", `Başlığın ${headline.length} karakter. Aramada görünen kelimeler burada; ${HEADLINE_MAX_CHARS} karaktere kadar alanı kullanabilirsin.`)
      : ok("headline_short", "Başlığın alanı iyi kullanıyor."),
  )
  if (mustTerms.length > 0) {
    const hit = mustTerms.find((t) => containsKeyword(headline, t))
    checks.push(
      hit
        ? ok("headline_keywords", `Başlığında ilanların istediği bir kavram (“${hit}”) var.`)
        : warn("headline_keywords", `İlanlarının zorunlu kavramlarından hiçbiri başlığında yok (${mustTerms.slice(0, 3).join(", ")}).`),
    )
  }
  return checks
}

function aboutChecks(p: LinkedInProfileData, hookTerms: string[]): AuditCheck[] {
  const about = p.about?.trim()
  if (!about) {
    return [missing("about_missing", "“Hakkında” bölümün boş. Ne yaptığını, en güçlü sonucunu ve ne aradığını 3–5 cümleyle anlat.")]
  }
  const checks: AuditCheck[] = []
  const count = words(about)
  checks.push(
    count < ABOUT_MIN_WORDS
      ? warn("about_short", `“Hakkında” bölümün ${count} kelime; en az ${ABOUT_MIN_WORDS} kelimeyle bir somut sonucunu da yaz.`)
      : ok("about_short", "“Hakkında” bölümün yeterince uzun."),
  )
  if (hookTerms.length > 0) {
    const head = about.slice(0, ABOUT_HOOK_CHARS)
    const hit = hookTerms.find((t) => containsKeyword(head, t))
    checks.push(
      hit
        ? ok("about_hook", "İlk iki satırında rolün ya da güçlü bir becerin var.")
        : warn("about_hook", "“Daha fazla gör”den önce görünen ilk iki satırda rolün ya da en güçlü becerin geçmiyor; okuyan çoğu zaman orada duruyor."),
    )
  }
  const cliches = findCliches(about)
  checks.push(
    cliches.length > 0
      ? warn("about_cliche", `Klişe ifadeler var (${cliches.slice(0, 3).map((c) => `“${c.phrase}”`).join(", ")}); aynı özelliği gösteren bir deneyim yaz.`)
      : ok("about_cliche", "Klişe ifade yok."),
  )
  return checks
}

function experienceChecks(p: LinkedInProfileData): AuditCheck[] {
  if (p.experience.length === 0) return [missing("experience_missing", "Deneyim bölümün boş. Staj, gönüllü iş ya da proje de buraya girer.")]
  const checks: AuditCheck[] = []
  p.experience.forEach((e, role) => {
    const lines = descriptionLines(e.description)
    if (lines.length === 0) {
      checks.push(warn("exp_description_missing", `“${e.title}” rolünün açıklaması boş. 2–3 maddeyle ne yaptığını ve sonucunu yaz.`, role))
    } else {
      checks.push(
        lines.some(hasQuantity)
          ? ok("exp_no_measurable", `“${e.title}” açıklamasında ölçülebilir sonuç var.`, role)
          : warn("exp_no_measurable", `“${e.title}” açıklamasında ölçülebilir sonuç yok. Bildiğin bir sayı ekle: kişi, yüzde, süre, bütçe.`, role),
      )
    }
    checks.push(
      e.dateRange?.trim()
        ? ok("exp_dates_missing", `“${e.title}” rolünün tarihleri var.`, role)
        : warn("exp_dates_missing", `“${e.title}” rolünün tarihleri yok; işe alımcı süreyi tarihten okuyor.`, role),
    )
  })
  return checks
}

function educationChecks(p: LinkedInProfileData, goal: string | null): AuditCheck[] {
  if (p.education.length === 0) return [missing("education_missing", "Eğitim bölümün boş. Mezun olduğun ya da okuduğun okulu ekle.")]
  const checks = [ok("education_missing", "Eğitim bölümün dolu.")]
  if (goal === "first_job") {
    checks.push(
      p.education.some((e) => e.description?.trim())
        ? ok("education_first_job", "Eğitiminde bir proje ya da ilgili dersler var.")
        : warn("education_first_job", "İlk işini arıyorsan eğitimine bir proje ya da ilgili dersler ekle; deneyimin yerine en çok bu okunuyor."),
    )
  }
  return checks
}

function skillAdvice(p: LinkedInProfileData, targets: string[], demanded: string[]): SkillAdvice {
  const listed = p.skills.join("\n")
  const lines = [...p.experience.flatMap((e) => descriptionLines(e.description)), ...(p.about ? [p.about] : [])]
  const add: SkillAdvice["add"] = []
  for (const term of demanded) {
    if (containsKeyword(listed, term)) continue
    const evidence = lines.find((line) => containsKeyword(line, term))
    if (evidence && !add.some((a) => fold(a.term) === fold(term))) add.push({ term, evidence })
  }
  const relevant = [...demanded, ...targets]
  const pinFirst = p.skills.filter((s) => relevant.some((t) => containsKeyword(s, t) || containsKeyword(t, s))).slice(0, 5)
  return { add, pinFirst }
}

export function auditProfile(p: LinkedInProfileData, ctx: AuditContext): LinkedInAuditReport {
  const targets = targetTitles(ctx)
  const base = linkedinReport(toResumeProfile(p), ctx.scored, { targetRole: ctx.targetRole })
  const mustTerms = base.commonMissing.filter((m) => m.must).map((m) => m.term)
  const demanded = demandedSkills(ctx.scored)
  const hookTerms = [...targets, ...p.skills.slice(0, 10)]
  const skills = skillAdvice(p, targets, demanded)

  // Profil sayfası ve LinkedIn PDF'i becerilerin yalnızca bir kısmını gösteriyor:
  // sayı "tümünü göster"den; bilinmiyorsa okunan kısım yetiyorsa geçiyor, yetmiyorsa kontrol yok.
  const partialSkills = p.truncated.skills
  const skillTotal = partialSkills ? partialSkills.total : p.skills.length
  const skillChecks: AuditCheck[] = []
  if (skillTotal !== null) {
    skillChecks.push(
      skillTotal < SKILLS_MIN
        ? warn("skills_few", `Profilinde ${skillTotal} beceri var; deneyiminde geçenleri ekle.`)
        : ok("skills_few", `Profilinde ${skillTotal} beceri var.`),
    )
  } else if (p.skills.length >= SKILLS_MIN) {
    skillChecks.push(ok("skills_few", `Profilinde en az ${p.skills.length} beceri var.`))
  }
  if (ctx.scored.length > 0) {
    const terms = skills.add.map((a) => a.term).join(", ")
    skillChecks.push(
      skills.add.length > 0
        ? warn(
            "skills_evidenced_missing",
            partialSkills
              ? `Deneyiminde geçen ama okunan beceri listende olmayanlar: ${terms}; tam listende yoksa ekle.`
              : `Deneyiminde geçen ama beceri listende olmayanlar: ${terms}.`,
          )
        : ok("skills_evidenced_missing", "İlanlarının istediği ve deneyiminde geçen beceriler listende var."),
    )
  }

  const scoredSection = (id: AuditSectionId, checks: AuditCheck[]): AuditSection => ({ id, status: sectionStatus(checks), checks })
  const sections: AuditSection[] = [
    scoredSection("headline", headlineChecks(p, targets, mustTerms)),
    scoredSection("about", aboutChecks(p, hookTerms)),
    scoredSection("experience", experienceChecks(p)),
    scoredSection("education", educationChecks(p, ctx.goal)),
    { id: "certifications", status: "info", checks: [] },
    scoredSection("skills", skillChecks),
  ]
  if (ctx.scored.length > 0) {
    sections.push({ id: "postings", status: base.commonMissing.length > 0 ? "improve" : "strong", checks: [] })
  }

  const all = sections.flatMap((s) => s.checks)
  const skipped: AuditCheckId[] = []
  if (targets.length === 0) skipped.push("headline_target")
  if (!skillChecks.some((c) => c.id === "skills_few")) skipped.push("skills_few")
  if (hookTerms.length === 0 && p.about?.trim()) skipped.push("about_hook")

  return {
    sections,
    summary: { passed: all.filter((c) => c.status === "ok").length, total: all.length },
    skills,
    skipped,
    postings: base.postings,
    commonMissing: base.commonMissing,
  }
}

/**
 * Başlık yazımına verilen beceriler: hedefle ilgili olanlar, deneyimde kanıtı
 * olanlar, sonra profilin ilk becerileri. İlan yoksa ilk ikisi çoğu zaman boş;
 * satır boş kalırsa model profilden kendisi seçip uyduruyordu (son inceleme).
 */
export function headlineStrengths(report: Pick<LinkedInAuditReport, "skills">, profile: LinkedInProfileData): string[] {
  const all = [...report.skills.pinFirst, ...report.skills.add.map((a) => a.term), ...profile.skills.slice(0, 6)]
  return all.filter((s, i) => all.findIndex((t) => fold(t) === fold(s)) === i).slice(0, 8)
}

const RANK: Record<AuditSectionStatus, number> = { missing: 0, improve: 1, strong: 2, info: 2 }

/** Önceki taramaya göre fark; ilk taramada null. */
export function compareAudits(
  prev: LinkedInAuditReport | null,
  next: LinkedInAuditReport,
): { passedDelta: number; improved: AuditSectionId[] } | null {
  if (!prev) return null
  const before = new Map(prev.sections.map((s) => [s.id, s.status]))
  return {
    passedDelta: next.summary.passed - prev.summary.passed,
    improved: next.sections.filter((s) => before.has(s.id) && RANK[s.status] > RANK[before.get(s.id)!]).map((s) => s.id),
  }
}
