# LinkedIn profil denetimi: uygulama planı

> **Ajanlar için:** Gerekli alt skill: `superpowers:subagent-driven-development` (önerilen) ya da `superpowers:executing-plans`. Görevi adım adım uygula; adımlar onay kutulu (`- [ ]`).

**Amaç:** Kullanıcının LinkedIn profilini (eklenti ya da PDF) bölüm bölüm teşhis eden ve yeniden yazan `/linkedin` sayfası.

**Mimari:**
- Profil tek bir yapıya (`LinkedInProfileData`) çevriliyor.
- Teşhis core'da saf kurallarla yapılıyor.
- Yazım worker'da yapay zekâyla yapılıyor ve profile karşı doğrulanıyor.
- Web, kayıt (`LinkedInAudit`) üzerinden yokluyor. Paket yoksa kilitli yazımları yanıttan çıkarıyor.
- Eklenti, kullanıcının kendi profil sayfasından görünen satırları topluyor. Core'daki saf çözücü bunları profile çeviriyor.

**Teknoloji:** TypeScript, Next 15 (app router), React 19, TanStack Query, axios, zod, Prisma (Neon), BullMQ worker, Chrome MV3 eklentisi (esbuild), vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-linkedin-profil-denetimi-design.md`

## Genel kısıtlar

- **Adlandırma:** Kod isimleri İngilizce. Yorumlar ve kullanıcıya görünen metin Türkçe. `dangerouslySetInnerHTML` yok.
- **Kütüphaneler:**
  - İstemcide istek `@/lib/api` (axios) + TanStack Query. Bileşende çıplak `fetch` yok.
  - Form RHF + zod.
  - Uygulama içi bağlantı `next/link`.
- **Web ile core:** Web core'u yalnızca alt yollardan içe aktarıyor (`@uyarla/core/linkedin/...`). Kök `@uyarla/core` web'de yok (K-68).
- **Sunucu LinkedIn'e istek atmıyor.** Fotoğraf yok; eklenti fotoğraf adresini de okumuyor.
- **Sayılar:**
  - Günde 5 tarama (`RATE_LIMITS.linkedinAudit = { limit: 5, windowSeconds: 86400 }`) ve `RATE_LIMITS.registered`.
  - Kullanıcı başına son 5 kayıt tutuluyor.
  - Tarama başına en çok 3 yeniden deneme.
  - 10 dakikadan eski `running` takılmış sayılıyor.
- **Eklenti verisi:**
  - Gövde en çok 64 KB.
  - Her metin en çok 3.000 karakter.
  - En çok 30 deneyim, 15 eğitim, 50 sertifika, 100 beceri, 20 dil.
- **Eşikler:**
  - `HEADLINE_MAX_CHARS` = 120.
  - `HEADLINE_SHORT_CHARS` = 60.
  - `ABOUT_MIN_WORDS` = 40.
  - `ABOUT_HOOK_CHARS` = 200.
  - `ABOUT_TARGET_WORDS` = 60–200.
  - `SKILLS_MIN` = 5.
  - `MAX_REWRITTEN_ROLES` = 8.
  - `HEADLINE_OPTIONS` = 3.
- **Ücret kapısı:**
  - Ücretsiz: teşhis, başlık alternatifleri, beceri önerileri.
  - Pakette (`hasLivePass` ya da admin): hakkında ve deneyim yazımları.
  - Kilitli metin yanıtta hiçbir yerde geçmiyor.
- **Git akışı:**
  - Her PR `test` dalından açılıyor, `gh pr create --base test`, squash ile birleşiyor.
  - `git add` yalnızca açık yollarla yapılıyor (dizin verilmiyor; `eval/runs` commit'e girmesin).
  - Commit mesajının sonunda `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` var.
- **Doğrulama:**
  - Her PR'dan önce `pnpm --filter @uyarla/web exec tsc --noEmit -p .`, `pnpm --filter @uyarla/worker exec tsc --noEmit -p .`, ilgili `vitest run`.
  - Arayüz PR'larında yerelde 1440 ve 390 px (açık ve koyu).
- **Canlıya alma:** Main'e geçiş yalnızca Görev 14'te, Railway worker dağıtımı ve üretim göçüyle birlikte.

## İnceleme odağı

1. **İngilizce profil:** "Software Engineer at Acme" başlığı varsayılan sayılmalı. İngilizce profilin önerileri İngilizce olmalı. Türkçe klişe listesi İngilizce metinde yanlış uyarı vermemeli. → Görev 2 ve Görev 4 testleri.
2. **Hedef rol yok, ilan da yok:** Hedefe bağlı kontroller düşmüş sayılmamalı, `skipped`'e girmeli; özet onları saymamalı. → Görev 2 testi.
3. **Çift tıklama ya da iki sekme:** Süren tarama varken gelen ikinci `POST` yeni kayıt açmamalı; 409 ve süren kaydın kimliği dönmeli. → Görev 6 testi.
4. **Kilitli metin sızıntısı:** Paketsiz yanıtın JSON'unda hakkında ve deneyim metinleri hiçbir alanda geçmemeli. → Görev 6 testi.
5. **Bozuk ya da büyük eklenti verisi:** 64 KB üstü ya da şemaya uymayan gövde 500 değil, açıklamalı 400 dönmeli. Sayfa "PDF ile dene" diyebilmeli. → Görev 6 ve Görev 12 testleri.

---

## PR 1: Veri ve teşhis

Dal: `git checkout test && git pull && git checkout -b linkedin-denetim-1-tesis`

### Görev 0: Linear kaydı

Kayıt plan yazılırken açıldı: **DOG-157** (Todo). Spec başlığına işlendi.

- [ ] **Adım 1:** Uygulama başlarken DOG-157'yi "In Progress" yap.

### Görev 1: Profil yapısı ve dönüşümler

**Dosyalar:**
- Oluştur: `packages/core/src/linkedin/profileData.ts`
- Oluştur: `packages/core/src/linkedin/testProfile.ts` (testlerin ortak kurgusal profili; test dosyasından dışa aktarmak, içe aktaran dosyada testleri ikinci kez koşturur)
- Test: `packages/core/src/linkedin/profileData.test.ts`

**Arayüzler:**
- Üretir: `PROFILE_LIMITS`, `LinkedInProfileDataSchema`, `type LinkedInProfileData`, `splitDateRange(range: string | null): { start: string; end: string }`, `descriptionLines(text: string | null): string[]`, `toResumeProfile(p: LinkedInProfileData): ResumeProfile`, `fromResumeProfile(r: ResumeProfile): LinkedInProfileData`.

- [ ] **Adım 1: Kırmızı test**

```ts
// packages/core/src/linkedin/profileData.test.ts
import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import {
  LinkedInProfileDataSchema,
  PROFILE_LIMITS,
  descriptionLines,
  fromResumeProfile,
  splitDateRange,
  toResumeProfile,
} from "./profileData.js"
import { deniz } from "./testProfile.js"
```

```ts
// packages/core/src/linkedin/testProfile.ts
import type { LinkedInProfileData } from "./profileData.js"

/** Testlerin ortak kurgusal profili (eval cv-d-pazarlama); gerçek kişi değil. */
export const deniz = (over: Partial<LinkedInProfileData> = {}): LinkedInProfileData => ({
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık performans pazarlaması deneyimim var.",
  experience: [
    {
      title: "Performance Marketing Specialist",
      company: "Moda Sepeti",
      dateRange: "Mar 2023 - Present · 2 yrs 8 mos",
      location: "İstanbul, Türkiye",
      description: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panoları hazırladım.",
    },
  ],
  education: [{ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: null }],
  certifications: [{ name: "Google Ads Search Certification", issuer: "Google", date: "Oca 2024" }],
  skills: ["Google Ads", "Looker Studio"],
  languages: ["İngilizce"],
  truncated: {},
  ...over,
})
```

```ts
// profileData.test.ts devamı
describe("splitDateRange", () => {
  it("splits LinkedIn date ranges and drops the duration", () => {
    expect(splitDateRange("Mar 2023 - Present · 2 yrs 8 mos")).toEqual({ start: "Mar 2023", end: "Present" })
    expect(splitDateRange("Oca 2020 – Ara 2022")).toEqual({ start: "Oca 2020", end: "Ara 2022" })
    expect(splitDateRange("2021")).toEqual({ start: "2021", end: "2021" })
    expect(splitDateRange(null)).toEqual({ start: "", end: "" })
  })
})

describe("descriptionLines", () => {
  it("keeps non-empty lines without bullet marks", () => {
    expect(descriptionLines("• Bir\n\n- İki \n  ")).toEqual(["Bir", "İki"])
    expect(descriptionLines(null)).toEqual([])
  })
})

describe("toResumeProfile", () => {
  it("maps sections so the existing helpers can read the profile", () => {
    const r = toResumeProfile(deniz())
    expect(r.fullName).toBe("Deniz Aksoy")
    expect(r.summary).toContain("performans pazarlaması")
    expect(r.experience[0]).toMatchObject({ company: "Moda Sepeti", startDate: "Mar 2023", endDate: "Present" })
    expect(r.experience[0]!.bullets.map((b) => b.text)).toEqual(["Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.", "GA4 panoları hazırladım."])
    expect(r.experience[0]!.bullets[0]!.sourceRef).toBe(r.experience[0]!.bullets[0]!.text)
    expect(r.education[0]).toMatchObject({ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", startDate: "2017", endDate: "2021" })
    expect(r.certifications).toEqual(["Google Ads Search Certification"])
  })
})

describe("fromResumeProfile (PDF yolu)", () => {
  it("turns a parsed PDF profile into profile data with bullets as the description", () => {
    const resume: ResumeProfile = {
      fullName: "Deniz Aksoy",
      headline: "Pazarlama",
      summary: null,
      experience: [{ company: "Acme", title: "Uzman", startDate: "2022", endDate: "halen", bullets: [{ text: "Bir", sourceRef: "Bir" }, { text: "İki", sourceRef: "İki" }] }],
      education: [{ school: "ODTÜ", degree: "Lisans", field: "İşletme", startDate: "2016", endDate: "2020" }],
      skills: ["SQL"],
      languages: [],
      certifications: ["PMP"],
    }
    expect(fromResumeProfile(resume)).toEqual({
      name: "Deniz Aksoy",
      headline: "Pazarlama",
      about: null,
      experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - halen", location: null, description: "Bir\nİki" }],
      education: [{ school: "ODTÜ", degree: "Lisans, İşletme", dateRange: "2016 - 2020", description: null }],
      certifications: [{ name: "PMP", issuer: null, date: null }],
      skills: ["SQL"],
      languages: [],
      truncated: {},
    })
  })
})

describe("LinkedInProfileDataSchema", () => {
  it("trims text and accepts a normal profile", () => {
    const parsed = LinkedInProfileDataSchema.parse({ ...deniz(), headline: "  Başlık  " })
    expect(parsed.headline).toBe("Başlık")
  })

  it("rejects oversized text and too many items", () => {
    expect(LinkedInProfileDataSchema.safeParse({ ...deniz(), about: "a".repeat(PROFILE_LIMITS.text + 1) }).success).toBe(false)
    const many = Array.from({ length: PROFILE_LIMITS.experience + 1 }, () => deniz().experience[0]!)
    expect(LinkedInProfileDataSchema.safeParse({ ...deniz(), experience: many }).success).toBe(false)
  })
})
```

- [ ] **Adım 2: Kırmızıyı gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/profileData.test.ts`
Beklenen: FAIL, "Cannot find module './profileData.js'".

- [ ] **Adım 3: Uygula**

```ts
// packages/core/src/linkedin/profileData.ts
import { z } from "zod"
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * LinkedIn profil denetiminin tek profil yapısı (spec §3.1). Eklenti bunu
 * kullanıcının kendi profil sayfasından üretiyor; PDF yolunda CV okuyucusunun
 * profilinden çevriliyor. Teşhis ve yazım yalnızca bunu görüyor.
 */
export const PROFILE_LIMITS = { text: 3000, experience: 30, education: 15, certifications: 50, skills: 100, languages: 20 } as const

const text = z.string().trim().max(PROFILE_LIMITS.text)
const optionalText = text.nullable()
const required = z.string().trim().min(1).max(PROFILE_LIMITS.text)
const count = z.object({ shown: z.number().int().min(0), total: z.number().int().min(0).nullable() })

export const LinkedInProfileDataSchema = z.object({
  name: optionalText,
  headline: optionalText,
  about: optionalText,
  experience: z
    .array(z.object({ title: required, company: optionalText, dateRange: optionalText, location: optionalText, description: optionalText }))
    .max(PROFILE_LIMITS.experience),
  education: z
    .array(z.object({ school: required, degree: optionalText, dateRange: optionalText, description: optionalText }))
    .max(PROFILE_LIMITS.education),
  certifications: z.array(z.object({ name: required, issuer: optionalText, date: optionalText })).max(PROFILE_LIMITS.certifications),
  skills: z.array(required).max(PROFILE_LIMITS.skills),
  languages: z.array(required).max(PROFILE_LIMITS.languages),
  /** Ana profil sayfası bölümü kısalttıysa: gösterilen ve toplam (spec §5.1). */
  truncated: z.object({ experience: count, education: count, certifications: count, skills: count }).partial(),
})

export type LinkedInProfileData = z.infer<typeof LinkedInProfileDataSchema>

/** "Mar 2023 - Present · 2 yrs 8 mos" → başlangıç ve bitiş; süre atılıyor. */
export function splitDateRange(range: string | null): { start: string; end: string } {
  if (!range?.trim()) return { start: "", end: "" }
  const main = range.split("·")[0]!.trim()
  const [start = "", end] = main.split(/\s+[-–—]\s+/)
  return { start: start.trim(), end: (end ?? start).trim() }
}

/** Açıklamanın dolu satırları, madde işaretleri atılmış. */
export function descriptionLines(description: string | null): string[] {
  return (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•●▪◦\-–*·]+/, "").trim())
    .filter(Boolean)
}

/**
 * Mevcut yardımcıların (resumeFacts, headlineTitles, resumeLanguage,
 * verifyCoverLetter) okuduğu biçim. Madde metni kaynağın kendisi: doğrulama
 * bununla karşılaştırıyor.
 */
export function toResumeProfile(p: LinkedInProfileData): ResumeProfile {
  return {
    fullName: p.name,
    headline: p.headline,
    summary: p.about,
    experience: p.experience.map((e) => {
      const { start, end } = splitDateRange(e.dateRange)
      return {
        company: e.company ?? "",
        title: e.title,
        startDate: start,
        endDate: end,
        bullets: descriptionLines(e.description).map((line) => ({ text: line, sourceRef: line })),
      }
    }),
    education: p.education.map((e) => {
      const { start, end } = splitDateRange(e.dateRange)
      return { school: e.school, degree: e.degree, field: null, startDate: start || null, endDate: end || null }
    }),
    skills: p.skills,
    languages: p.languages,
    certifications: p.certifications.map((c) => c.name),
  }
}

/** PDF yolu: CV okuyucusunun profili; maddeler açıklama oluyor, kısaltma yok. */
export function fromResumeProfile(r: ResumeProfile): LinkedInProfileData {
  const range = (start: string | null | undefined, end: string | null | undefined) => [start, end].filter(Boolean).join(" - ") || null
  return {
    name: r.fullName,
    headline: r.headline,
    about: r.summary,
    experience: r.experience.map((e) => ({
      title: e.title,
      company: e.company || null,
      dateRange: range(e.startDate, e.endDate),
      location: null,
      description: e.bullets.map((b) => b.text).join("\n") || null,
    })),
    education: r.education.map((e) => ({
      school: e.school,
      degree: [e.degree, e.field].filter(Boolean).join(", ") || null,
      dateRange: range(e.startDate, e.endDate),
      description: null,
    })),
    certifications: r.certifications.map((name) => ({ name, issuer: null, date: null })),
    skills: r.skills,
    languages: r.languages,
    truncated: {},
  }
}
```

- [ ] **Adım 4: Yeşili gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/profileData.test.ts`
Beklenen: PASS (7 test).

- [ ] **Adım 5: Commit**

```bash
git add packages/core/src/linkedin/profileData.ts packages/core/src/linkedin/testProfile.ts packages/core/src/linkedin/profileData.test.ts
git commit -m "LinkedIn profil yapısı ve dönüşümler (DOG-157)"
```

### Görev 2: Teşhis motoru

**Dosyalar:**
- Oluştur: `packages/core/src/linkedin/audit.ts`
- Test: `packages/core/src/linkedin/audit.test.ts`

**Arayüzler:**
- Tüketir: `LinkedInProfileData`, `descriptionLines`, `toResumeProfile` (Görev 1); `linkedinReport`, `ScoredPosting`, `ABOUT_MIN_WORDS`, `SKILLS_MIN` (`./report.js`); `HEADLINE_MAX_CHARS` (`./reportRecord.js`); `findCliches` (`../text/cliches.js`); `hasQuantity` (`../format/measurable.js`); `containsKeyword` (`../normalize/turkish.js`).
- Üretir:
  - Sabitler: `HEADLINE_SHORT_CHARS`, `ABOUT_HOOK_CHARS`.
  - Tipler: `AuditSectionId`, `AuditSectionStatus`, `AuditCheckId`, `AuditCheck`, `AuditSection`, `SkillAdvice`, `LinkedInAuditReport`, `AuditContext`.
  - Fonksiyonlar: `auditProfile(profile, ctx): LinkedInAuditReport`, `sectionStatus(checks): AuditSectionStatus`, `compareAudits(prev, next)`.

- [ ] **Adım 1: Kırmızı test**

```ts
// packages/core/src/linkedin/audit.test.ts
import { describe, expect, it } from "vitest"
import type { ScoreResult } from "../score/score.js"
import { auditProfile, compareAudits, sectionStatus, type AuditContext } from "./audit.js"
import type { ScoredPosting } from "./report.js"
import { deniz } from "./testProfile.js"

const ctx = (over: Partial<AuditContext> = {}): AuditContext => ({ targetRole: "Performance Marketing Specialist", goal: null, scored: [], ...over })
const section = (r: ReturnType<typeof auditProfile>, id: string) => r.sections.find((s) => s.id === id)!
const check = (r: ReturnType<typeof auditProfile>, id: string) => r.sections.flatMap((s) => s.checks).find((c) => c.id === id)

describe("auditProfile · başlık", () => {
  it("marks an empty headline as missing", () => {
    const r = auditProfile(deniz({ headline: null }), ctx())
    expect(section(r, "headline").status).toBe("missing")
    expect(check(r, "headline_empty")?.status).toBe("missing")
  })

  it("flags LinkedIn's default 'title at company' headline, also in English", () => {
    const r = auditProfile(deniz({ headline: "Performance Marketing Specialist at Moda Sepeti" }), ctx())
    expect(check(r, "headline_default")?.status).toBe("warn")
    const tr = auditProfile(deniz({ headline: "Performance Marketing Specialist · Moda Sepeti" }), ctx())
    expect(check(tr, "headline_default")?.status).toBe("warn")
  })

  it("checks the target role and length", () => {
    const r = auditProfile(deniz({ headline: "Pazarlama | Google Ads, GA4, Looker Studio, Meta reklamları ve e-ticaret büyümesi" }), ctx({ targetRole: "Dijital Pazarlama Uzmanı" }))
    expect(check(r, "headline_target")?.status).toBe("warn")
    expect(check(r, "headline_short")?.status).toBe("ok")
    expect(check(auditProfile(deniz({ headline: "Pazarlamacı" }), ctx()), "headline_short")?.status).toBe("warn")
  })

  it("skips target checks without a target role or postings instead of failing them", () => {
    const r = auditProfile(deniz({ headline: "Pazarlamacı" }), ctx({ targetRole: null }))
    expect(check(r, "headline_target")).toBeUndefined()
    expect(r.skipped).toContain("headline_target")
    const counted = r.sections.flatMap((s) => s.checks).length
    expect(r.summary.total).toBe(counted)
  })
})

describe("auditProfile · hakkında", () => {
  it("missing, short, hook and clichés", () => {
    expect(section(auditProfile(deniz({ about: null }), ctx()), "about").status).toBe("missing")
    expect(check(auditProfile(deniz(), ctx()), "about_short")?.status).toBe("warn")
    const long = `Performance Marketing Specialist olarak ${"e-ticaret markalarında kampanya yönetiyorum ".repeat(8)}`
    const r = auditProfile(deniz({ about: long }), ctx())
    expect(check(r, "about_short")?.status).toBe("ok")
    expect(check(r, "about_hook")?.status).toBe("ok")
    const cliche = auditProfile(deniz({ about: `${long} Takım oyuncusuyum ve stres altında çalışabilirim.` }), ctx())
    expect(check(cliche, "about_cliche")?.status).toBe("warn")
  })

  it("does not call an English about text a cliché by Turkish rules", () => {
    const en = `I am a performance marketing specialist managing Meta and Google campaigns for e-commerce brands. ${"I report results weekly with GA4 dashboards. ".repeat(6)}`
    expect(check(auditProfile(deniz({ about: en }), ctx()), "about_cliche")?.status).toBe("ok")
  })
})

describe("auditProfile · deneyim, eğitim, beceriler", () => {
  it("checks each role: description, measurable result, dates", () => {
    const r = auditProfile(
      deniz({
        experience: [
          { title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "Kampanya yönettim ve raporladım." },
          { title: "Asistan", company: "Beta", dateRange: null, location: null, description: null },
        ],
      }),
      ctx(),
    )
    const checks = section(r, "experience").checks
    expect(checks.find((c) => c.id === "exp_no_measurable" && c.role === 0)?.status).toBe("warn")
    expect(checks.find((c) => c.id === "exp_description_missing" && c.role === 1)?.status).toBe("warn")
    expect(checks.find((c) => c.id === "exp_dates_missing" && c.role === 1)?.status).toBe("warn")
    expect(section(r, "experience").status).toBe("improve")
    expect(section(auditProfile(deniz({ experience: [] }), ctx()), "experience").status).toBe("missing")
  })

  it("education: missing, and a project hint for a first job seeker", () => {
    expect(section(auditProfile(deniz({ education: [] }), ctx()), "education").status).toBe("missing")
    expect(check(auditProfile(deniz(), ctx({ goal: "first_job" })), "education_first_job")?.status).toBe("warn")
    expect(check(auditProfile(deniz(), ctx()), "education_first_job")).toBeUndefined()
  })

  it("certifications are informational", () => {
    expect(section(auditProfile(deniz(), ctx()), "certifications")).toMatchObject({ status: "info", checks: [] })
  })

  it("skills: few, and evidenced concepts missing from the list", () => {
    const posting: ScoredPosting = {
      analysisId: "a1",
      position: "Dijital Pazarlama Uzmanı",
      company: null,
      result: {
        score: 40,
        requirements: [
          { requirement: { text: "GA4", type: "skill", importance: "must", concepts: [] }, status: "matched", matchedConcepts: ["GA4"], missingConcepts: [] },
          { requirement: { text: "Excel", type: "skill", importance: "must", concepts: [] }, status: "missing", matchedConcepts: [], missingConcepts: ["Excel"] },
        ],
        missingKeywords: ["Excel"],
      } as unknown as ScoreResult,
    }
    const r = auditProfile(deniz(), ctx({ scored: [posting] }))
    expect(check(r, "skills_few")?.status).toBe("warn")
    expect(check(r, "skills_evidenced_missing")?.status).toBe("warn")
    expect(r.skills.add).toEqual([{ term: "GA4", evidence: "GA4 panoları hazırladım." }])
    expect(section(r, "postings").status).toBe("improve")
    expect(r.commonMissing.map((m) => m.term)).toEqual(["Excel"])
  })
})

describe("sectionStatus, summary, compareAudits", () => {
  it("worst check decides the section", () => {
    expect(sectionStatus([{ id: "about_short", status: "ok", text: "" }])).toBe("strong")
    expect(sectionStatus([{ id: "about_short", status: "warn", text: "" }])).toBe("improve")
    expect(sectionStatus([{ id: "about_missing", status: "missing", text: "" }, { id: "about_short", status: "ok", text: "" }])).toBe("missing")
  })

  it("summary counts passed checks", () => {
    const r = auditProfile(deniz(), ctx())
    const all = r.sections.flatMap((s) => s.checks)
    expect(r.summary).toEqual({ passed: all.filter((c) => c.status === "ok").length, total: all.length })
  })

  it("compares two audits", () => {
    const before = auditProfile(deniz({ headline: null }), ctx())
    const after = auditProfile(deniz({ headline: "Performance Marketing Specialist | Google Ads, GA4, Looker Studio, e-ticaret büyümesi" }), ctx())
    const diff = compareAudits(before, after)!
    expect(diff.improved).toContain("headline")
    expect(diff.passedDelta).toBeGreaterThan(0)
    expect(compareAudits(null, after)).toBeNull()
  })
})
```

- [ ] **Adım 2: Kırmızıyı gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/audit.test.ts`
Beklenen: FAIL, "Cannot find module './audit.js'".

- [ ] **Adım 3: Uygula**

```ts
// packages/core/src/linkedin/audit.ts
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
  /** Hedef rol ya da ilan olmadığı için yapılmayan kontroller. */
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
    ? [role.title, ...(role.company ? [`${role.title} at ${role.company}`, `${role.title} · ${role.company}`, `${role.title} - ${role.company}`, `${role.title}, ${role.company}`] : [])].map(fold)
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
    if (!e.dateRange?.trim()) checks.push(warn("exp_dates_missing", `“${e.title}” rolünün tarihleri yok; işe alımcı süreyi tarihten okuyor.`, role))
  })
  return checks
}

function educationChecks(p: LinkedInProfileData, goal: string | null): AuditCheck[] {
  if (p.education.length === 0) return [missing("education_missing", "Eğitim bölümün boş. Mezun olduğun ya da okuduğun okulu ekle.")]
  const checks = [ok("education_missing", "Eğitim bölümün dolu.")]
  if (goal === "first_job" && p.education.every((e) => !e.description?.trim())) {
    checks.push(warn("education_first_job", "İlk işini arıyorsan eğitimine bir proje ya da ilgili dersler ekle; deneyimin yerine en çok bu okunuyor."))
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

  const skillChecks: AuditCheck[] = [
    p.skills.length < SKILLS_MIN
      ? warn("skills_few", `Profilinde ${p.skills.length} beceri var; deneyiminde geçenleri ekle.`)
      : ok("skills_few", `Profilinde ${p.skills.length} beceri var.`),
  ]
  if (ctx.scored.length > 0) {
    skillChecks.push(
      skills.add.length > 0
        ? warn("skills_evidenced_missing", `Deneyiminde geçen ama beceri listende olmayanlar: ${skills.add.map((a) => a.term).join(", ")}.`)
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
```

- [ ] **Adım 4: Yeşili gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/audit.test.ts`
Beklenen: PASS. Klişe testi düşerse `findCliches`'in yakaladığı ifadeyi `text/cliches.ts`'den alıp test metnini ona göre düzelt; kural değişmesin.

- [ ] **Adım 5: Dışa aktar ve commit**

`packages/core/src/index.ts` içinde `export * from "./linkedin/suggest.js"` satırının altına ekle:

```ts
export * from "./linkedin/profileData.js"
export * from "./linkedin/audit.js"
```

```bash
cd packages/core && pnpm exec tsc --noEmit && pnpm exec vitest run src/linkedin && cd ../..
git add packages/core/src/linkedin/audit.ts packages/core/src/linkedin/audit.test.ts packages/core/src/index.ts
git commit -m "LinkedIn profil teşhisi: bölüm kontrolleri ve özet (DOG-157)"
```

### Görev 3: Tablo, göç, hesap silme ve dışa aktarma

**Dosyalar:**
- Değiştir: `packages/db/prisma/schema.prisma` (User ilişkisi, yeni model ve enumlar)
- Oluştur: `packages/db/prisma/migrations/<zaman>_linkedin_denetimi/migration.sql` (Prisma üretiyor)
- Değiştir: `apps/web/src/server/deleteAccount.ts` (`DELETION_ORDER`)
- Değiştir: `apps/web/src/server/dataExport.ts` (`EXPORTED_TABLES`, `UserDataExport`, `collectUserData`)
- Test: `apps/web/src/server/dataExport.test.ts`, `apps/web/src/server/deleteAccount.test.ts` (mevcut)

**Arayüzler:**
- Üretir: Prisma modeli `LinkedInAudit` (istemcide `prisma.linkedInAudit`), enumlar `LinkedInAuditSource` (`extension`, `pdf`) ve `LinkedInAuditStatus` (`running`, `done`, `failed`).

- [ ] **Adım 1: Şema**

`schema.prisma`'da `model User` içinde `excludedConcepts ExcludedConcept[]` satırının altına ekle:

```prisma
  // LinkedIn profil denetimi (spec 2026-10-22); son 5 tarama.
  linkedinAudits LinkedInAudit[]
```

Dosyanın sonuna ekle:

```prisma
/// LinkedIn profil denetimi: profil, teşhis ve yazımlar (spec 2026-10-22).
model LinkedInAudit {
  id          String              @id @default(cuid())
  userId      String
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  source      LinkedInAuditSource
  /// PDF yolunda kütüphanedeki CV.
  resumeId    String?
  /// LinkedInProfileData; PDF yolunda okuma bitene kadar boş.
  profile     Json?
  targetRole  String?
  analysisIds String[]
  status      LinkedInAuditStatus @default(running)
  /// reading | checking | writing; bitince null.
  stage       String?
  report      Json?
  rewrites    Json?
  /// Düşen yazımların yeniden denenme sayısı; en çok 3.
  retries     Int                 @default(0)
  createdAt   DateTime            @default(now())

  @@index([userId, createdAt])
}

enum LinkedInAuditSource {
  extension
  pdf
}

enum LinkedInAuditStatus {
  running
  done
  failed
}
```

- [ ] **Adım 2: Göçü üret ve uygula (yerel)**

Çalıştır: `cd packages/db && pnpm migrate --name linkedin_denetimi && pnpm generate && cd ../..`
Beklenen: `migrations/<zaman>_linkedin_denetimi/migration.sql` oluşur. İçinde `CREATE TABLE "LinkedInAudit"` ve iki `CREATE TYPE` var. "Your database is now in sync".

- [ ] **Adım 3: Kırmızı test (silme ve dışa aktarma eşitliği)**

Önce `pnpm --filter @uyarla/web exec vitest run src/server/dataExport.test.ts src/server/deleteAccount.test.ts` ile mevcut testlerin yeşil olduğunu gör. Sonra `DELETION_ORDER`'a, `"user"` satırından önce `"linkedInAudit",` ekle. Testi yeniden çalıştır.
Beklenen: `dataExport.test.ts` FAIL ("EXPORTED_TABLES … DELETION_ORDER" eşitliği).

- [ ] **Adım 4: Dışa aktarmayı tamamla**

`apps/web/src/server/dataExport.ts` içinde üç değişiklik:

1. `EXPORTED_TABLES` listesinde `"emailConsent",` satırının altına `"linkedInAudit",` ekle.
2. `UserDataExport` arayüzünde `emailConsents: Record<string, unknown>[]` satırının altına ekle:

```ts
  /** LinkedIn profil denetimleri: okunan profil, teşhis ve yazımlar (spec 2026-10-22). */
  linkedinAudits: Record<string, unknown>[]
```

3. `collectUserData` içinde değişkenleri ve sorguyu ekle. Dizinin başı şöyle olsun:

```ts
  const [user, accounts, sessions, resumes, jobPostings, analyses, accessPasses, excludedConcepts, emailLogs, emailConsents, linkedinAudits] = await Promise.all([
```

`db.emailConsent.findMany({...})` çağrısından sonra, dizi kapanmadan:

```ts
    db.linkedInAudit.findMany({
      where: { userId },
      select: { source: true, profile: true, targetRole: true, status: true, report: true, rewrites: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
```

Dönen nesnede `emailConsents,` satırının altına `linkedinAudits,` ekle. README dizisinde "analizler, uyarlamalar ve ön yazılar." satırını "analizler, uyarlamalar, ön yazılar ve LinkedIn denetimleri." yap.

- [ ] **Adım 5: Yeşili gör**

Çalıştır: `pnpm --filter @uyarla/web exec vitest run src/server/dataExport.test.ts src/server/deleteAccount.test.ts && pnpm --filter @uyarla/web exec tsc --noEmit -p .`
Beklenen: PASS, tip hatası yok. `deleteAccount.test.ts`'deki sahte istemci `DELETION_ORDER`'dan kurulduğu için yeni tabloyu kendiliğinden kapsıyor.

- [ ] **Adım 6: Commit ve PR 1**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations apps/web/src/server/deleteAccount.ts apps/web/src/server/dataExport.ts
git commit -m "LinkedInAudit tablosu; hesap silme ve dışa aktarma kapsıyor (DOG-157)"
git push -u origin linkedin-denetim-1-tesis
gh pr create --base test --title "LinkedIn denetimi 1/5: profil yapısı, teşhis, tablo (DOG-157)" --body "<özet + doğrulama>"
```

`packages/db/prisma/migrations` dizini yalnızca yeni göç klasörünü içerdiği için burada dizin vermek güvenli. `git status` ile yalnızca o klasörün eklendiğini gör. Yerel doğrulamadan sonra `gh pr merge --squash --delete-branch`.

---

## PR 2: İş ve yazım

Dal: `git checkout test && git pull && git checkout -b linkedin-denetim-2-is`

### Görev 4: Yazım (yapay zekâ) ve doğrulama

**Dosyalar:**
- Oluştur: `packages/core/src/linkedin/rewrite.ts`
- Test: `packages/core/src/linkedin/rewrite.test.ts`
- Değiştir: `packages/core/src/index.ts` (dışa aktarım)

**Arayüzler:**
- Tüketir: `LinkedInProfileData`, `toResumeProfile`, `descriptionLines` (Görev 1); `resumeFacts`, `verifyCoverLetter` (`../cover/letter.js`); `resumeLanguage` (`../normalize/language.js`); `headlineTitles` (`./suggest.js`); `HEADLINE_MAX_CHARS`, `LinkedInSuggestion` (`./reportRecord.js`).
- Üretir:
  - Sabitler: `MAX_REWRITTEN_ROLES`, `HEADLINE_OPTIONS`.
  - Tip: `LinkedInRewrites`.
  - Fonksiyonlar:
    - `experienceTemplate(language: "tr" | "en"): string`
    - `capHeadline(text: string): string`
    - `writeLinkedInRewrites(llm, input): Promise<{ rewrites: LinkedInRewrites; tokens: number }>`
    - `mergeRetried(previous: LinkedInRewrites, fresh: LinkedInRewrites): LinkedInRewrites`
    - `hasFailedRewrites(r: LinkedInRewrites): boolean`

- [ ] **Adım 1: Kırmızı test**

```ts
// packages/core/src/linkedin/rewrite.test.ts
import { describe, expect, it, vi } from "vitest"
import { HEADLINE_MAX_CHARS } from "./reportRecord.js"
import { deniz } from "./testProfile.js"
import { capHeadline, experienceTemplate, hasFailedRewrites, mergeRetried, writeLinkedInRewrites, type LinkedInRewrites } from "./rewrite.js"

const profileReply = {
  basliklar: ["Performance Marketing Specialist | Google Ads, GA4", "Performance Marketing | Meta ve Google reklamları", "E-ticaret büyümesi | Google Ads, Looker Studio"],
  hakkinda: "Moda Sepeti'nde Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönetiyorum.",
}
const experienceReply = { aciklamalar: [{ sira: 1, metin: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panolarıyla haftalık rapor hazırladım." }] }

function llmWith(...replies: unknown[]) {
  const extract = vi.fn()
  for (const r of replies) extract.mockImplementationOnce(async () => (r instanceof Error ? Promise.reject(r) : { data: r, tokens: 10 }))
  return { extract } as never
}

describe("writeLinkedInRewrites", () => {
  it("writes three headlines, an about text and each described role, verified", async () => {
    const { rewrites, tokens } = await writeLinkedInRewrites(llmWith(profileReply, experienceReply), { profile: deniz(), targetRole: null, strengths: ["Google Ads"], postings: [] })
    expect(tokens).toBe(20)
    if (rewrites.headline.status !== "done" || rewrites.about.status !== "done") throw new Error("beklenmedik")
    expect(rewrites.headline.options).toHaveLength(3)
    expect(rewrites.about.suggestion.verification.status).toBe("ok")
    expect(rewrites.experience).toEqual([{ index: 0, status: "done", suggestion: expect.objectContaining({ text: experienceReply.aciklamalar[0]!.metin }) }])
  })

  it("flags a rewritten line whose number is not in the profile", async () => {
    const reply = { aciklamalar: [{ sira: 1, metin: "• Satışları %50 artırdım." }] }
    const { rewrites } = await writeLinkedInRewrites(llmWith(profileReply, reply), { profile: deniz(), targetRole: null, strengths: [], postings: [] })
    const role = rewrites.experience[0]!
    expect(role.status === "done" && role.suggestion.verification.status).toBe("flagged")
  })

  it("gives a template, not a rewrite, for a role without a description", async () => {
    const profile = deniz({ experience: [{ title: "Asistan", company: "Beta", dateRange: "2020 - 2021", location: null, description: null }] })
    const llm = llmWith(profileReply)
    const { rewrites } = await writeLinkedInRewrites(llm, { profile, targetRole: null, strengths: [], postings: [] })
    expect(rewrites.experience).toEqual([{ index: 0, status: "template", text: experienceTemplate("tr") }])
    // Açıklamalı rol yoksa deneyim çağrısı yapılmıyor.
    expect((llm as unknown as { extract: ReturnType<typeof vi.fn> }).extract).toHaveBeenCalledTimes(1)
  })

  it("marks only the part whose call failed", async () => {
    const { rewrites } = await writeLinkedInRewrites(llmWith(profileReply, new Error("zaman aşımı")), { profile: deniz(), targetRole: null, strengths: [], postings: [] })
    expect(rewrites.headline.status).toBe("done")
    expect(rewrites.experience).toEqual([{ index: 0, status: "failed" }])
    expect(hasFailedRewrites(rewrites)).toBe(true)
  })

  it("writes English for an English profile", async () => {
    const llm = llmWith(profileReply, experienceReply)
    const en = deniz({
      headline: "Performance Marketing Specialist",
      about: "I manage Meta and Google campaigns for e-commerce brands and report results weekly with GA4 dashboards.",
      experience: [{ title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: "Mar 2023 - Present", location: null, description: "• Managed Meta campaigns with a monthly budget of 1.2 million TL.\n• Built weekly GA4 dashboards for the marketing team." }],
      education: [{ school: "Marmara University", degree: "Bachelor's, Business", dateRange: "2017 - 2021", description: null }],
      languages: ["English"],
    })
    await writeLinkedInRewrites(llm, { profile: en, targetRole: null, strengths: [], postings: [] })
    const input = (llm as unknown as { extract: ReturnType<typeof vi.fn> }).extract.mock.calls[0]![0].input as string
    expect(input).toContain("DİL: İngilizce")
  })
})

describe("capHeadline, mergeRetried, experienceTemplate", () => {
  it("cuts a long headline at the last separator", () => {
    const long = `Performance Marketing Specialist | ${"Google Ads, ".repeat(20)}GA4`
    const cut = capHeadline(long)
    expect(cut.length).toBeLessThanOrEqual(HEADLINE_MAX_CHARS)
    expect(cut.endsWith(",")).toBe(false)
  })

  it("replaces only failed parts on retry", () => {
    const previous: LinkedInRewrites = {
      headline: { status: "done", options: [{ text: "Eski", verification: { status: "ok", issues: [] } }] },
      about: { status: "failed" },
      experience: [{ index: 0, status: "failed" }, { index: 1, status: "template", text: "şablon" }],
    }
    const fresh: LinkedInRewrites = {
      headline: { status: "done", options: [{ text: "Yeni", verification: { status: "ok", issues: [] } }] },
      about: { status: "done", suggestion: { text: "Hakkında", verification: { status: "ok", issues: [] } } },
      experience: [{ index: 0, status: "done", suggestion: { text: "Rol", verification: { status: "ok", issues: [] } } }, { index: 1, status: "template", text: "şablon" }],
    }
    const merged = mergeRetried(previous, fresh)
    expect(merged.headline).toEqual(previous.headline)
    expect(merged.about.status).toBe("done")
    expect(merged.experience[0]!.status).toBe("done")
    expect(hasFailedRewrites(merged)).toBe(false)
  })

  it("templates use placeholders, never invented facts", () => {
    expect(experienceTemplate("tr")).toMatch(/\[.+\]/)
    expect(experienceTemplate("en")).toMatch(/\[.+\]/)
  })
})
```

- [ ] **Adım 2: Kırmızıyı gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/rewrite.test.ts`
Beklenen: FAIL, "Cannot find module './rewrite.js'".

- [ ] **Adım 3: Uygula**

```ts
// packages/core/src/linkedin/rewrite.ts
import { z } from "zod"
import { resumeFacts, verifyCoverLetter } from "../cover/letter.js"
import type { LlmProvider } from "../llm/types.js"
import { resumeLanguage } from "../normalize/language.js"
import type { JobPostingData } from "../schemas/job.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { descriptionLines, toResumeProfile, type LinkedInProfileData } from "./profileData.js"
import { HEADLINE_MAX_CHARS, type LinkedInSuggestion } from "./reportRecord.js"
import { headlineTitles } from "./suggest.js"

/**
 * LinkedIn profil denetiminin yazımları (spec §4.3). Kural ön yazıyla aynı:
 * yalnızca profildeki olgular; her metin verifyCoverLetter'dan geçiyor.
 * Açıklaması boş rolde yazım yok, köşeli parantezli şablon var.
 */
export const MAX_REWRITTEN_ROLES = 8
export const HEADLINE_OPTIONS = 3

export interface LinkedInRewrites {
  headline: { status: "done"; options: LinkedInSuggestion[] } | { status: "failed" }
  about: { status: "done"; suggestion: LinkedInSuggestion } | { status: "failed" }
  experience: Array<
    { index: number } & ({ status: "done"; suggestion: LinkedInSuggestion } | { status: "failed" } | { status: "template"; text: string })
  >
}

export const LINKEDIN_PROFILE_PROMPT = `Sana bir adayın LinkedIn profilinden çıkarılmış bilgiler, kullanabileceği
unvanlar ve profilinde KANITI OLAN beceriler verilecek. İki şey yaz.

1. "basliklar": ${HEADLINE_OPTIONS} farklı LinkedIn başlığı. Biçim: "Unvan | beceri, beceri, beceri".
   - Unvan olarak YALNIZCA "UNVANLAR" satırındakilerden birini kullan.
   - Becerileri YALNIZCA "BECERİLER" satırından ya da profilde geçenlerden seç.
   - Her biri en fazla ${HEADLINE_MAX_CHARS} karakter. Sıfat, slogan, emoji yok.
   - Üçü birbirinden farklı vurgu yapsın (unvan, alan, sonuç).
2. "hakkinda": LinkedIn "Hakkında" bölümü. 60–200 kelime, 3–5 cümle.
   - İlk iki cümle rolünü ve en güçlü sonucunu söylesin; okuyan çoğu zaman orada duruyor.
   - YALNIZCA profilde yazan deneyim, sayı ve sonuçları kullan. Yeni bir
     deneyim, beceri, sayı ya da başarı EKLEME. Süreyi tarihlerden HESAPLAMA.
   - "HEDEF" satırı varsa son cümlede ne aradığını yaz; yoksa yazma.
   - Klişe ("tutkulu", "sonuç odaklı", "dinamik", "passionate", "team player") yok.

Hepsi "DİL" satırındaki dilde olsun. Türkçe ise birinci tekil şahıs.`

export const LINKEDIN_EXPERIENCE_PROMPT = `Sana bir adayın LinkedIn deneyimleri, her biri kendi
açıklamasıyla verilecek. Her rolün açıklamasını yeniden yaz.

- Her rol için "sira" (verilen rol numarası) ve "metin" döndür.
- "metin" 2–5 madde; her madde "• " ile başlasın, tek satır olsun.
- Her madde bir eylemle başlasın ve sonucu söylesin.
- YALNIZCA o rolün açıklamasında ve profilde yazan bilgileri kullan. Yeni iş,
  araç, sayı, yüzde ya da sonuç EKLEME. Açıklamadaki sayıları AYNEN koru.
- Klişe ve abartı yok.

Hepsi "DİL" satırındaki dilde olsun.`

const ProfileReplySchema = z.object({ basliklar: z.array(z.string()), hakkinda: z.string() })
const ExperienceReplySchema = z.object({ aciklamalar: z.array(z.object({ sira: z.number().int(), metin: z.string() })) })

/** Fazlası son ayraçtan kesiliyor (DOG-69 ile aynı kural). */
export function capHeadline(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ")
  if (clean.length <= HEADLINE_MAX_CHARS) return clean
  const cut = clean.slice(0, HEADLINE_MAX_CHARS)
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf("|"))
  return (at > 0 ? cut.slice(0, at) : cut).trim().replace(/[|,]$/, "").trim()
}

/** Hedef verilmediyse "… arıyorum" cümlesi kullanıcının beyanı değil (DOG-69). */
function dropSeeking(text: string, targetRole: string | null): string {
  if (targetRole?.trim()) return text.trim()
  const kept = (text.match(/[^.!?]+[.!?]+/g) ?? [text]).filter((s) => !/arıyorum|arayışındayım|seeking|looking for/i.test(s)).join("").trim()
  return kept || text.trim()
}

export function experienceTemplate(language: "tr" | "en"): string {
  return language === "en"
    ? "• [What you did, e.g. a task you owned] which [measurable result: number, percent, time]\n• Using [tool or method], [what you achieved]"
    : "• [Ne yaptın: üstlendiğin bir iş] ile [ölçülebilir sonuç: sayı, yüzde, süre]\n• [Kullandığın araç ya da yöntem] kullanarak [ne başardın]"
}

/** Doğrulamanın ilan terimi kontrolü için: seçilen ilanlar tek ilanda; ilan yoksa boş. */
function checkPosting(postings: readonly JobPostingData[], language: "tr" | "en"): JobPostingData {
  const first = postings[0]
  return first
    ? { ...first, requirements: postings.flatMap((p) => p.requirements) }
    : { position: "", company: null, seniority: null, language, requirements: [] }
}

export interface RewriteInput {
  profile: LinkedInProfileData
  targetRole: string | null
  /** Teşhisin "öne al" becerileri ve ilanlarda kanıtı olanlar. */
  strengths: string[]
  postings: readonly JobPostingData[]
}

export async function writeLinkedInRewrites(llm: LlmProvider, input: RewriteInput): Promise<{ rewrites: LinkedInRewrites; tokens: number }> {
  const resume = toResumeProfile(input.profile)
  const language = resumeLanguage(resume) === "en" ? "en" : "tr"
  const languageLine = `DİL: ${language === "en" ? "İngilizce" : "Türkçe"}`
  const facts = resumeFacts(resume)
  const source = input.targetRole?.trim() ? `${facts}\nHedef: ${input.targetRole.trim()}` : facts
  const posting = checkPosting(input.postings, language)
  const verify = (texts: string[]) => verifyCoverLetter(texts, source, posting).map((p) => ({ text: p.text, verification: p.verification }))
  let tokens = 0

  let headline: LinkedInRewrites["headline"] = { status: "failed" }
  let about: LinkedInRewrites["about"] = { status: "failed" }
  try {
    const reply = await llm.extract<unknown>({
      prompt: LINKEDIN_PROFILE_PROMPT,
      schemaName: "linkedin_profile",
      schema: toJsonSchema(ProfileReplySchema),
      input: [
        `PROFİL\n${facts}`,
        `UNVANLAR: ${headlineTitles(resume, input.targetRole).join(" · ") || "—"}`,
        `BECERİLER: ${input.strengths.join(", ") || "—"}`,
        input.targetRole?.trim() ? `HEDEF: ${input.targetRole.trim()}` : null,
        languageLine,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })
    tokens += reply.tokens
    const parsed = ProfileReplySchema.parse(reply.data)
    const options = [...new Set(parsed.basliklar.map(capHeadline).filter(Boolean))].slice(0, HEADLINE_OPTIONS)
    if (options.length > 0) headline = { status: "done", options: verify(options) }
    const aboutText = dropSeeking(parsed.hakkinda, input.targetRole)
    if (aboutText) about = { status: "done", suggestion: verify([aboutText])[0]! }
  } catch (error) {
    console.error("[linkedin-rewrite] başlık ve hakkında yazılamadı", error)
  }

  const roles = input.profile.experience.slice(0, MAX_REWRITTEN_ROLES).map((e, index) => ({ e, index, lines: descriptionLines(e.description) }))
  const described = roles.filter((r) => r.lines.length > 0)
  const experience: LinkedInRewrites["experience"] = roles
    .filter((r) => r.lines.length === 0)
    .map((r) => ({ index: r.index, status: "template" as const, text: experienceTemplate(language) }))
  if (described.length > 0) {
    try {
      const reply = await llm.extract<unknown>({
        prompt: LINKEDIN_EXPERIENCE_PROMPT,
        schemaName: "linkedin_experience",
        schema: toJsonSchema(ExperienceReplySchema),
        input: [
          ...described.map((r, i) => `ROL ${i + 1}: ${r.e.title}${r.e.company ? ` — ${r.e.company}` : ""}${r.e.dateRange ? ` (${r.e.dateRange})` : ""}\n${r.lines.map((l) => `• ${l}`).join("\n")}`),
          languageLine,
        ].join("\n\n"),
      })
      tokens += reply.tokens
      const parsed = ExperienceReplySchema.parse(reply.data)
      described.forEach((r, i) => {
        const text = parsed.aciklamalar.find((a) => a.sira === i + 1)?.metin.trim()
        experience.push(text ? { index: r.index, status: "done", suggestion: verify([text])[0]! } : { index: r.index, status: "failed" })
      })
    } catch (error) {
      console.error("[linkedin-rewrite] deneyimler yazılamadı", error)
      for (const r of described) experience.push({ index: r.index, status: "failed" })
    }
  }
  experience.sort((a, b) => a.index - b.index)
  return { rewrites: { headline, about, experience }, tokens }
}

export function hasFailedRewrites(r: LinkedInRewrites): boolean {
  return r.headline.status === "failed" || r.about.status === "failed" || r.experience.some((e) => e.status === "failed")
}

/** Yeniden denemede yalnızca düşen parçalar değişiyor; bitmiş metin kullanıcının gözü önünde değişmesin. */
export function mergeRetried(previous: LinkedInRewrites, fresh: LinkedInRewrites): LinkedInRewrites {
  return {
    headline: previous.headline.status === "failed" ? fresh.headline : previous.headline,
    about: previous.about.status === "failed" ? fresh.about : previous.about,
    experience: previous.experience.map((e) => (e.status === "failed" ? (fresh.experience.find((f) => f.index === e.index) ?? e) : e)),
  }
}
```

`packages/core/src/index.ts`'e `export * from "./linkedin/rewrite.js"` ekle.

- [ ] **Adım 4: Yeşili gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin && pnpm exec tsc --noEmit`
Beklenen: PASS. "%50" testi `verifyCoverLetter`'ın sayı kontrolüne dayanıyor. Düşerse `checkNumbers`'ın yüzdeyi nasıl okuduğuna bak (`cover/letter.ts`) ve test sayısını kaynakta olmayan bir tam sayıyla değiştir ("• 37 müşteri kazandım.").

- [ ] **Adım 5: Commit**

```bash
git add packages/core/src/linkedin/rewrite.ts packages/core/src/linkedin/rewrite.test.ts packages/core/src/index.ts
git commit -m "LinkedIn denetimi: başlık, hakkında ve deneyim yazımları, doğrulamalı (DOG-157)"
```

### Görev 5: Worker işi `linkedin-audit`

**Dosyalar:**
- Değiştir: `apps/worker/src/adapt-queue.ts` (iş adı ve verisi)
- Oluştur: `apps/worker/src/linkedin-audit-pipeline.ts`
- Test: `apps/worker/src/linkedin-audit-pipeline.test.ts`
- Değiştir: `apps/worker/src/index.ts` (dağıtım dalı)

**Arayüzler:**
- Tüketir: `auditProfile`, `fromResumeProfile`, `toResumeProfile`, `writeLinkedInRewrites`, `mergeRetried`, `LinkedInProfileData`, `LinkedInAuditReport`, `LinkedInRewrites`, `ScoredPosting`, `extractResumeProfile`, `resumeParserKey` (`@uyarla/core`); `scoreProfile` (`@uyarla/core/score/live`).
- Üretir:
  - `LINKEDIN_AUDIT_JOB = "linkedin-audit"`.
  - `interface LinkedInAuditJobData { auditId: string; retry?: boolean }`.
  - `runLinkedInAudit(deps, input)`.
  - `LinkedInAuditStore`, `prismaLinkedInAuditStore`.

- [ ] **Adım 1: İş adı**

`adapt-queue.ts`'de `LINKEDIN_REPORT_JOB` bloğunun altına ekle:

```ts
/** LinkedIn profil denetimi (spec 2026-10-22); kayıt `LinkedInAudit` tablosunda "running". */
export const LINKEDIN_AUDIT_JOB = "linkedin-audit"

export interface LinkedInAuditJobData {
  auditId: string
  /** Düşen yazımları yeniden dene; teşhis yeniden yapılmıyor. */
  retry?: boolean
}
```

- [ ] **Adım 2: Kırmızı test**

```ts
// apps/worker/src/linkedin-audit-pipeline.test.ts
import { describe, expect, it, vi } from "vitest"
import type { LinkedInProfileData, LinkedInRewrites, ResumeProfile } from "@uyarla/core"
import { runLinkedInAudit, type LinkedInAuditContext, type LinkedInAuditStore } from "./linkedin-audit-pipeline.js"

const profile: LinkedInProfileData = {
  name: "Deniz Aksoy",
  headline: "Pazarlama",
  about: null,
  experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "• Meta kampanyalarını yönettim." }],
  education: [],
  certifications: [],
  skills: ["Google Ads"],
  languages: [],
  truncated: {},
}
const llm = {
  extract: vi
    .fn()
    .mockResolvedValueOnce({ data: { basliklar: ["Uzman | Google Ads"], hakkinda: "Meta kampanyalarını yönetiyorum." }, tokens: 5 })
    .mockResolvedValueOnce({ data: { aciklamalar: [{ sira: 1, metin: "• Meta kampanyalarını yönettim." }] }, tokens: 5 }),
}
const embedding = { embed: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])) }

function storeWith(audit: Partial<LinkedInAuditContext["audit"]>) {
  const updates: Array<Record<string, unknown>> = []
  const store: LinkedInAuditStore = {
    getContext: async () => ({
      audit: { id: "au1", status: "running", source: "extension", resumeId: null, profile, targetRole: null, analysisIds: [], report: null, rewrites: null, ...audit },
      goal: null,
      postings: [],
    }),
    resumeProfile: vi.fn(async () => ({ fullName: "Deniz", headline: null, summary: null, experience: [], education: [], skills: [], languages: [], certifications: [] }) as ResumeProfile),
    update: async (_id, data) => {
      updates.push(data)
    },
  }
  return { store, updates }
}

describe("runLinkedInAudit", () => {
  it("reads, checks, writes and saves the result in order", async () => {
    const { store, updates } = storeWith({})
    await runLinkedInAudit({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(updates.map((u) => u.stage ?? u.status)).toEqual(["reading", "checking", "writing", "done"])
    expect(updates[2]!.report).toBeTruthy()
    expect((updates[3]!.rewrites as LinkedInRewrites).headline.status).toBe("done")
  })

  it("turns the PDF's parsed profile into profile data first", async () => {
    const { store, updates } = storeWith({ source: "pdf", resumeId: "r1", profile: null })
    await runLinkedInAudit({ llm: { extract: vi.fn(async () => ({ data: { basliklar: [], hakkinda: "" }, tokens: 0 })) } as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(store.resumeProfile).toHaveBeenCalled()
    expect((updates.find((u) => "profile" in u)!.profile as LinkedInProfileData).name).toBe("Deniz")
  })

  it("does nothing for an audit that is no longer running", async () => {
    const { store, updates } = storeWith({ status: "done" })
    await runLinkedInAudit({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(updates).toEqual([])
  })

  it("on retry rewrites only failed parts and keeps the report", async () => {
    const failed: LinkedInRewrites = { headline: { status: "done", options: [{ text: "Eski", verification: { status: "ok", issues: [] } }] }, about: { status: "failed" }, experience: [] }
    const { store, updates } = storeWith({ status: "running", report: { sections: [], summary: { passed: 0, total: 0 }, skills: { add: [], pinFirst: [] }, skipped: [], postings: [], commonMissing: [] }, rewrites: failed })
    const retryLlm = { extract: vi.fn(async () => ({ data: { basliklar: ["Yeni"], hakkinda: "Meta kampanyalarını yönetiyorum." }, tokens: 1 })) }
    await runLinkedInAudit({ llm: retryLlm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1", retry: true })
    const saved = updates.at(-1)!
    expect(saved.status).toBe("done")
    const rewrites = saved.rewrites as LinkedInRewrites
    expect(rewrites.headline.status === "done" && rewrites.headline.options[0]!.text).toBe("Eski")
    expect(rewrites.about.status).toBe("done")
    expect(updates.some((u) => "report" in u)).toBe(false)
  })
})
```

- [ ] **Adım 3: Kırmızıyı gör**

Çalıştır: `cd apps/worker && pnpm exec vitest run src/linkedin-audit-pipeline.test.ts`
Beklenen: FAIL, modül yok.

- [ ] **Adım 4: Uygula**

```ts
// apps/worker/src/linkedin-audit-pipeline.ts
import {
  auditProfile,
  extractResumeProfile,
  fromResumeProfile,
  mergeRetried,
  resumeParserKey,
  toResumeProfile,
  writeLinkedInRewrites,
  type ScoredPosting,
} from "@uyarla/core"
import type { EmbeddingProvider, JobPostingData, LinkedInAuditReport, LinkedInProfileData, LinkedInRewrites, LlmProvider, ResumeProfile } from "@uyarla/core"
import { scoreProfile } from "@uyarla/core/score/live"
import { prisma } from "@uyarla/db"
import type { LinkedInAuditJobData } from "./adapt-queue.js"
import { prismaStore } from "./store.js"

export interface LinkedInAuditContext {
  audit: {
    id: string
    status: "running" | "done" | "failed"
    source: "extension" | "pdf"
    resumeId: string | null
    profile: LinkedInProfileData | null
    targetRole: string | null
    analysisIds: string[]
    report: LinkedInAuditReport | null
    rewrites: LinkedInRewrites | null
  }
  goal: string | null
  postings: Array<{ analysisId: string; position: string; company: string | null; posting: JobPostingData; excluded: number[] }>
}

export interface LinkedInAuditStore {
  getContext(auditId: string): Promise<LinkedInAuditContext | null>
  /** PDF yolu: CV'nin ayrıştırılmış profili; aynı model ve istemle ayrıştırıldıysa o sürüm (DOG-59). */
  resumeProfile(resumeId: string, parse: (text: string) => Promise<ResumeProfile>, parserKey: string): Promise<ResumeProfile>
  update(
    auditId: string,
    data: Partial<{ status: "running" | "done" | "failed"; stage: string | null; profile: LinkedInProfileData; report: LinkedInAuditReport; rewrites: LinkedInRewrites }>,
  ): Promise<void>
}

/**
 * LinkedIn profil denetimi (spec §4.1). Aşamalar kayda yazılıyor (DOG-136);
 * ekran yalnızca bunu gösteriyor. Yeniden denemede yalnızca düşen yazımlar.
 */
export async function runLinkedInAudit(
  deps: { llm: LlmProvider; embedding: EmbeddingProvider; modelId: string; store: LinkedInAuditStore },
  input: LinkedInAuditJobData,
): Promise<void> {
  const context = await deps.store.getContext(input.auditId)
  if (!context || context.audit.status !== "running") return
  const { audit } = context
  const postings = context.postings.map((p) => p.posting)

  if (input.retry) {
    if (!audit.profile || !audit.report || !audit.rewrites) return
    const { rewrites } = await writeLinkedInRewrites(deps.llm, { profile: audit.profile, targetRole: audit.targetRole, strengths: audit.report.skills.pinFirst, postings })
    await deps.store.update(audit.id, { status: "done", stage: null, rewrites: mergeRetried(audit.rewrites, rewrites) })
    return
  }

  await deps.store.update(audit.id, { stage: "reading" })
  let profile = audit.profile
  if (audit.source === "pdf") {
    if (!audit.resumeId) throw new Error("PDF denetiminde CV yok")
    const resume = await deps.store.resumeProfile(audit.resumeId, async (text) => (await extractResumeProfile(deps.llm, text)).data, resumeParserKey(deps.modelId))
    profile = fromResumeProfile(resume)
    await deps.store.update(audit.id, { profile })
  }
  if (!profile) throw new Error("Denetimde profil yok")

  await deps.store.update(audit.id, { stage: "checking" })
  const resume = toResumeProfile(profile)
  const scored: ScoredPosting[] = []
  for (const p of context.postings) {
    const result = await scoreProfile({ profile: resume, posting: p.posting }, deps.embedding)
    scored.push({ analysisId: p.analysisId, position: p.position, company: p.company, result, excluded: p.excluded })
  }
  const report = auditProfile(profile, { targetRole: audit.targetRole, goal: context.goal, scored })

  await deps.store.update(audit.id, { stage: "writing", report })
  const { rewrites } = await writeLinkedInRewrites(deps.llm, { profile, targetRole: audit.targetRole, strengths: report.skills.pinFirst, postings })
  await deps.store.update(audit.id, { status: "done", stage: null, rewrites })
}

/** LinkedInAuditStore'un Prisma uygulaması. */
export const prismaLinkedInAuditStore: LinkedInAuditStore = {
  async getContext(auditId) {
    const row = await prisma.linkedInAudit.findUnique({ where: { id: auditId }, include: { user: { select: { id: true, goal: true } } } })
    if (!row) return null
    const analyses = await prisma.analysis.findMany({
      // Sahiplik: yalnızca denetim sahibinin analizleri.
      where: { id: { in: row.analysisIds }, userId: row.user.id, status: "done" },
      select: { id: true, result: true, jobPosting: true },
    })
    return {
      audit: {
        id: row.id,
        status: row.status,
        source: row.source,
        resumeId: row.resumeId,
        profile: (row.profile ?? null) as LinkedInProfileData | null,
        targetRole: row.targetRole,
        analysisIds: row.analysisIds,
        report: (row.report ?? null) as LinkedInAuditReport | null,
        rewrites: (row.rewrites ?? null) as LinkedInRewrites | null,
      },
      goal: row.user.goal,
      postings: analyses.map((a) => ({
        analysisId: a.id,
        position: a.jobPosting.position,
        company: a.jobPosting.company,
        posting: {
          position: a.jobPosting.position,
          company: a.jobPosting.company,
          seniority: a.jobPosting.seniority as never,
          language: a.jobPosting.language as never,
          requirements: a.jobPosting.requirements as never,
        },
        excluded: (a.result as { excluded?: number[] } | null)?.excluded ?? [],
      })),
    }
  },

  async resumeProfile(resumeId, parse, parserKey) {
    const parsed = await prismaStore.findParsedVersion(resumeId, parserKey)
    if (parsed) return parsed.profile
    const profile = await parse(await prismaStore.getResumeText(resumeId))
    await prismaStore.saveResumeVersion(resumeId, profile, parserKey)
    return profile
  },

  async update(auditId, data) {
    await prisma.linkedInAudit.update({ where: { id: auditId }, data: data as never })
  },
}
```

- [ ] **Adım 5: Kuyruk dağıtımı**

`index.ts`'de içe aktarmaları genişlet: `LINKEDIN_AUDIT_JOB`, `type LinkedInAuditJobData` (adapt-queue'dan) ve `import { prismaLinkedInAuditStore, runLinkedInAudit } from "./linkedin-audit-pipeline.js"`. `if (job.name === LINKEDIN_REPORT_JOB) {` bloğunun hemen üstüne ekle:

```ts
    // LinkedIn profil denetimi (spec 2026-10-22).
    if (job.name === LINKEDIN_AUDIT_JOB) {
      const data = job.data as unknown as LinkedInAuditJobData
      try {
        await runLinkedInAudit({ llm, embedding, modelId: llmConfig.model, store: prismaLinkedInAuditStore }, data)
      } catch (error) {
        const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
        if (error instanceof PermanentError || lastAttempt) {
          // Yeniden denemede teşhis ve bitmiş yazımlar duruyor: kayıt "done"a dönüyor.
          await prismaLinkedInAuditStore.update(data.auditId, { status: data.retry ? "done" : "failed", stage: null }).catch(() => {})
        }
        if (error instanceof PermanentError) throw toUnrecoverable(error, "adapt")
        throw error
      }
      return
    }
```

- [ ] **Adım 6: Yeşili gör ve commit**

Çalıştır: `cd apps/worker && pnpm exec vitest run && pnpm exec tsc --noEmit -p . && cd ../..`
Beklenen: PASS. `job-contract.test.ts` iş adlarını listeliyorsa yeni adı oraya ekle.

```bash
git add apps/worker/src/adapt-queue.ts apps/worker/src/linkedin-audit-pipeline.ts apps/worker/src/linkedin-audit-pipeline.test.ts apps/worker/src/index.ts
git commit -m "Worker: linkedin-audit işi (okuma, teşhis, yazım, yeniden deneme) (DOG-157)"
```

### Görev 6: Web uçları ve ücret kapısı

**Dosyalar:**
- Değiştir: `apps/web/src/features/billing/access.ts` (`hasLivePass`), test `access.test.ts`
- Değiştir: `apps/web/src/server/rateLimit.ts` (`linkedinAudit`)
- Oluştur: `apps/web/src/features/linkedin/audit.ts` (istemci-güvenli tipler, istek şeması, `lockRewrites`)
- Test: `apps/web/src/features/linkedin/audit.test.ts`
- Oluştur: `apps/web/src/server/linkedinAudit.ts` (kayıt aç, son kayıtlar, saklama)
- Oluştur: `apps/web/src/app/api/linkedin/audits/route.ts`
- Test: `apps/web/src/server/linkedinAudit.test.ts`

**Arayüzler:**
- Tüketir: `LinkedInProfileDataSchema` (`@uyarla/core/linkedin/profileData`); `LinkedInAuditReport`, `compareAudits` (`@uyarla/core/linkedin/audit`); `LinkedInRewrites`, `hasFailedRewrites` (`@uyarla/core/linkedin/rewrite`); `LINKEDIN_AUDIT_JOB`, `ADAPT_JOB_OPTIONS` (`@uyarla/worker/adapt-queue`).
- Üretir:
  - Sabitler ve şema: `MAX_AUDIT_POSTINGS`, `MAX_AUDIT_BODY_BYTES`, `MAX_RETRIES`, `STUCK_MS`, `KEEP_AUDITS`, `auditRequestSchema`.
  - Tipler: `AuditRequest`, `PublicRewrites`, `AuditLocks`, `AuditView`, `AuditResponse`.
  - Fonksiyonlar: `lockRewrites(rewrites, unlocked)`, `isStuck(createdAt, now)`, `hasLivePass(passes, now)`.
  - Uçlar: `GET`, `POST` ve `PATCH /api/linkedin/audits`.

- [ ] **Adım 1: Kırmızı test (saf parçalar)**

```ts
// apps/web/src/features/linkedin/audit.test.ts
import { describe, expect, it } from "vitest"
import type { LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"
import { auditRequestSchema, isStuck, lockRewrites } from "@/features/linkedin/audit"

const ok = { status: "ok" as const, issues: [] }
const rewrites: LinkedInRewrites = {
  headline: { status: "done", options: [{ text: "Uzman | Google Ads", verification: ok }] },
  about: { status: "done", suggestion: { text: "GİZLİ-HAKKINDA-METNİ", verification: ok } },
  experience: [
    { index: 0, status: "done", suggestion: { text: "GİZLİ-DENEYİM-METNİ", verification: ok } },
    { index: 1, status: "template", text: "• [şablon]" },
  ],
}

describe("lockRewrites", () => {
  it("strips about and experience rewrites without a pass, everywhere in the JSON", () => {
    const { rewrites: shown, locked } = lockRewrites(rewrites, false)
    const json = JSON.stringify(shown)
    expect(json).not.toContain("GİZLİ-HAKKINDA-METNİ")
    expect(json).not.toContain("GİZLİ-DENEYİM-METNİ")
    expect(shown.headline).toEqual(rewrites.headline)
    expect(shown.experience[1]).toEqual(rewrites.experience[1])
    expect(locked).toEqual({ about: true, experience: 1 })
  })

  it("passes everything through with a pass", () => {
    expect(lockRewrites(rewrites, true)).toEqual({ rewrites, locked: null })
  })
})

describe("auditRequestSchema", () => {
  const profile = { name: null, headline: "Başlık", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }

  it("accepts the two sources", () => {
    expect(auditRequestSchema.safeParse({ source: "extension", profile, targetRole: null, analysisIds: [] }).success).toBe(true)
    expect(auditRequestSchema.safeParse({ source: "pdf", resumeId: "r1", targetRole: "Uzman", analysisIds: ["a1"] }).success).toBe(true)
  })

  it("rejects more than three postings and a broken profile", () => {
    expect(auditRequestSchema.safeParse({ source: "pdf", resumeId: "r1", targetRole: null, analysisIds: ["a", "b", "c", "d"] }).success).toBe(false)
    expect(auditRequestSchema.safeParse({ source: "extension", profile: { headline: 5 }, targetRole: null, analysisIds: [] }).success).toBe(false)
  })
})

describe("isStuck", () => {
  it("treats a running audit older than ten minutes as stuck", () => {
    const now = new Date("2026-10-22T12:00:00Z")
    expect(isStuck(new Date("2026-10-22T11:49:00Z"), now)).toBe(true)
    expect(isStuck(new Date("2026-10-22T11:55:00Z"), now)).toBe(false)
  })
})
```

`access.test.ts`'e ekle:

```ts
describe("hasLivePass", () => {
  const now = new Date("2026-10-22T12:00:00Z")
  it("only a pass active right now counts", () => {
    expect(hasLivePass([{ status: "active", startsAt: new Date("2026-10-20"), endsAt: new Date("2026-10-27") }], now)).toBe(true)
    expect(hasLivePass([{ status: "active", startsAt: new Date("2026-10-25"), endsAt: new Date("2026-11-01") }], now)).toBe(false)
    expect(hasLivePass([{ status: "refunded", startsAt: new Date("2026-10-20"), endsAt: new Date("2026-10-27") }], now)).toBe(false)
  })
})
```

`access.test.ts`'in içe aktarmasına `hasLivePass`'ı ekle.

- [ ] **Adım 2: Kırmızıyı gör**

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin/audit.test.ts src/features/billing/access.test.ts`
Beklenen: FAIL (modül ve fonksiyon yok).

- [ ] **Adım 3: Uygula (saf parçalar)**

`access.ts`'de `isLive` fonksiyonunun altına ekle:

```ts
/** Şu an geçerli bir paket var mı (LinkedIn yazımlarının kilidi; spec §4.4). */
export function hasLivePass(passes: PassLike[], now: Date): boolean {
  return passes.some((p) => isLive(p, now))
}
```

`rateLimit.ts` içinde `RATE_LIMITS`'e ekle:

```ts
  // LinkedIn profil denetimi: günde 5 tarama (yapay zekâ maliyetinin üst sınırı).
  linkedinAudit: { limit: 5, windowSeconds: 86400 },
```

```ts
// apps/web/src/features/linkedin/audit.ts
import { z } from "zod"
import { LinkedInProfileDataSchema, type LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import type { AuditSectionId, AuditSectionStatus, LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import type { LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"

/**
 * LinkedIn profil denetiminin istemciyle sunucu arasındaki sözleşmesi
 * (spec §6). İstemci-güvenli: core'un yalnızca saf alt yolları.
 */
export const MAX_AUDIT_POSTINGS = 3
export const MAX_AUDIT_BODY_BYTES = 64 * 1024
export const MAX_RETRIES = 3
export const STUCK_MS = 10 * 60_000
export const KEEP_AUDITS = 5

const common = {
  targetRole: z.string().trim().max(120).nullable(),
  analysisIds: z.array(z.string().min(1)).max(MAX_AUDIT_POSTINGS),
}
export const auditRequestSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("extension"), profile: LinkedInProfileDataSchema, ...common }),
  z.object({ source: z.literal("pdf"), resumeId: z.string().min(1), ...common }),
])
export type AuditRequest = z.input<typeof auditRequestSchema>

export function isStuck(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= STUCK_MS
}

/** Kilitli parçalar yanıttan çıkmış yazımlar (spec §4.4). */
export type PublicRewrites = {
  headline: LinkedInRewrites["headline"]
  about: LinkedInRewrites["about"] | { status: "locked" }
  experience: Array<LinkedInRewrites["experience"][number] | { index: number; status: "locked" }>
}
export type AuditLocks = { about: boolean; experience: number } | null

/** Paketi yoksa hakkında ve deneyim yazımları sunucudan hiç çıkmıyor. */
export function lockRewrites(rewrites: LinkedInRewrites, unlocked: boolean): { rewrites: PublicRewrites; locked: AuditLocks } {
  if (unlocked) return { rewrites, locked: null }
  let experience = 0
  return {
    rewrites: {
      headline: rewrites.headline,
      about: rewrites.about.status === "done" ? { status: "locked" } : rewrites.about,
      experience: rewrites.experience.map((e) => {
        if (e.status !== "done") return e
        experience++
        return { index: e.index, status: "locked" as const }
      }),
    },
    locked: { about: rewrites.about.status === "done", experience },
  }
}

export interface AuditView {
  id: string
  status: "running" | "done" | "failed"
  stage: string | null
  source: "extension" | "pdf"
  createdAt: string
  profile: LinkedInProfileData | null
  targetRole: string | null
  analysisIds: string[]
  report: LinkedInAuditReport | null
  rewrites: PublicRewrites | null
  locked: AuditLocks
  /** Düşen yazım varsa ve deneme hakkı kaldıysa true. */
  canRetry: boolean
}

export interface AuditResponse {
  audit: AuditView | null
  previous: { createdAt: string; summary: LinkedInAuditReport["summary"]; sections: Array<{ id: AuditSectionId; status: AuditSectionStatus }> } | null
  unlocked: boolean
}
```

- [ ] **Adım 4: Sunucu parçası (kırmızı test)**

```ts
// apps/web/src/server/linkedinAudit.test.ts
import { describe, expect, it, vi } from "vitest"
import { AuditBusyError, createAudit } from "@/server/linkedinAudit"

function fakeDb(existing: Array<{ id: string; status: string; createdAt: Date }>) {
  const created: unknown[] = []
  const deleted: unknown[] = []
  const db = {
    linkedInAudit: {
      // Gerçek sorgu gibi: yalnızca son 10 dakikadaki "running".
      findFirst: vi.fn(async ({ where }: { where: { createdAt: { gt: Date } } }) => existing.find((a) => a.status === "running" && a.createdAt > where.createdAt.gt) ?? null),
      findMany: vi.fn(async () => existing.map((a) => ({ id: a.id }))),
      create: vi.fn(async ({ data }: { data: unknown }) => {
        created.push(data)
        return { id: "yeni" }
      }),
      deleteMany: vi.fn(async (args: unknown) => {
        deleted.push(args)
        return { count: 0 }
      }),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  }
  return { db, created, deleted }
}

const input = { source: "pdf" as const, resumeId: "r1", profile: null, targetRole: null, analysisIds: [] }
const now = new Date("2026-10-22T12:00:00Z")

describe("createAudit", () => {
  it("refuses a second audit while one is running (double click, two tabs)", async () => {
    const { db } = fakeDb([{ id: "suren", status: "running", createdAt: new Date("2026-10-22T11:58:00Z") }])
    await expect(createAudit(db as never, "u1", input, now)).rejects.toBeInstanceOf(AuditBusyError)
  })

  it("lets a new audit start when the running one is stuck", async () => {
    const { db, created } = fakeDb([{ id: "takili", status: "running", createdAt: new Date("2026-10-22T11:30:00Z") }])
    await expect(createAudit(db as never, "u1", input, now)).resolves.toEqual({ id: "yeni" })
    expect(created).toHaveLength(1)
  })

  it("keeps only the newest five audits", async () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, status: "done", createdAt: new Date(2026, 9, 1 + i) }))
    const { db, deleted } = fakeDb(existing)
    await createAudit(db as never, "u1", input, now)
    expect(db.linkedInAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5 }))
    expect(deleted).toHaveLength(1)
  })
})
```

- [ ] **Adım 5: Sunucu parçasını uygula**

```ts
// apps/web/src/server/linkedinAudit.ts
import type { Prisma, prisma } from "@uyarla/db"
import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import { KEEP_AUDITS, STUCK_MS } from "@/features/linkedin/audit"

type Db = typeof prisma

export class AuditBusyError extends Error {
  constructor(readonly auditId: string) {
    super("Taraman hâlâ sürüyor.")
    this.name = "AuditBusyError"
  }
}

/**
 * Yeni denetim kaydı (spec §4.1). Süren bir tarama varsa yenisi açılmıyor
 * (çift tıklama, iki sekme); 10 dakikadan eskisi takılmış sayılıyor. Kayıt
 * açılınca en yeni 5'in dışındakiler siliniyor.
 */
export async function createAudit(
  db: Db,
  userId: string,
  input: { source: "extension" | "pdf"; resumeId: string | null; profile: LinkedInProfileData | null; targetRole: string | null; analysisIds: string[] },
  now = new Date(),
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const running = await tx.linkedInAudit.findFirst({
      where: { userId, status: "running", createdAt: { gt: new Date(now.getTime() - STUCK_MS) } },
      select: { id: true },
    })
    if (running) throw new AuditBusyError(running.id)
    const created = await tx.linkedInAudit.create({
      data: {
        userId,
        source: input.source,
        resumeId: input.resumeId,
        profile: (input.profile ?? undefined) as Prisma.InputJsonValue | undefined,
        targetRole: input.targetRole,
        analysisIds: input.analysisIds,
        status: "running",
      },
      select: { id: true },
    })
    const old = await tx.linkedInAudit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: KEEP_AUDITS, select: { id: true } })
    if (old.length > 0) await tx.linkedInAudit.deleteMany({ where: { id: { in: old.map((a) => a.id) } } })
    return created
  })
}
```

Test sahtesinde `findMany` her çağrıda bütün listeyi döndürüyor; `skip: 5` çağrıda doğrulanıyor, silme bir kez çağrılıyor. Bu yeterli.

- [ ] **Adım 6: Uç**

```ts
// apps/web/src/app/api/linkedin/audits/route.ts
import { prisma } from "@uyarla/db"
import type { LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import { hasFailedRewrites, type LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"
import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import { ADAPT_JOB_OPTIONS, LINKEDIN_AUDIT_JOB } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { z } from "zod"
import { hasLivePass } from "@/features/billing/access"
import { MAX_AUDIT_BODY_BYTES, MAX_RETRIES, auditRequestSchema, lockRewrites, type AuditResponse } from "@/features/linkedin/audit"
import { firstIssue } from "@/lib/validation"
import { adaptQueue } from "@/server/adaptQueue"
import { isAdmin } from "@/server/admin"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { AuditBusyError, createAudit } from "@/server/linkedinAudit"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

const retrySchema = z.object({ id: z.string().min(1), action: z.literal("retry") })

function failure(error: unknown, where: string) {
  const reply = authErrorResponse(error)
  if (reply) return reply
  console.error(`[api/linkedin/audits] ${where}`, error)
  return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
}

/** En son denetim, önceki taramanın özeti ve kilit bilgisi (spec §6). */
export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
    const now = new Date()
    const [rows, passes] = await Promise.all([
      prisma.linkedInAudit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 2 }),
      prisma.accessPass.findMany({ where: { userId: user.id }, select: { status: true, startsAt: true, endsAt: true } }),
    ])
    const unlocked = isAdmin(user) || hasLivePass(passes, now)
    const [latest, before] = rows
    const prevReport = (before?.report ?? null) as LinkedInAuditReport | null
    const body: AuditResponse = {
      unlocked,
      previous:
        before && prevReport ? { createdAt: before.createdAt.toISOString(), summary: prevReport.summary, sections: prevReport.sections.map((s) => ({ id: s.id, status: s.status })) } : null,
      audit: latest
        ? (() => {
            const rewrites = (latest.rewrites ?? null) as LinkedInRewrites | null
            const gated = rewrites ? lockRewrites(rewrites, unlocked) : null
            return {
              id: latest.id,
              status: latest.status,
              stage: latest.stage,
              source: latest.source,
              createdAt: latest.createdAt.toISOString(),
              profile: (latest.profile ?? null) as LinkedInProfileData | null,
              targetRole: latest.targetRole,
              analysisIds: latest.analysisIds,
              report: (latest.report ?? null) as LinkedInAuditReport | null,
              rewrites: gated?.rewrites ?? null,
              locked: gated?.locked ?? null,
              canRetry: latest.status === "done" && !!rewrites && hasFailedRewrites(rewrites) && latest.retries < MAX_RETRIES,
            }
          })()
        : null,
    }
    // Önce/sonra farkı istemcide (sectionDelta, Görev 8); burada yalnızca veri.
    return NextResponse.json(body)
  } catch (error) {
    return failure(error, "GET")
  }
}

/** Yeni tarama (spec §4.1). */
export async function POST(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const raw = await request.text()
    if (Buffer.byteLength(raw, "utf8") > MAX_AUDIT_BODY_BYTES) {
      return NextResponse.json({ error: "Profil verisi çok büyük. PDF ile dener misin?", code: "too_large" }, { status: 400 })
    }
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "Profil okunamadı. PDF ile dener misin?", code: "invalid" }, { status: 400 })
    }
    const parsed = auditRequestSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message, code: "invalid" }, { status: 400 })
    const input = parsed.data

    if (input.source === "pdf") {
      const owned = await prisma.resume.count({ where: { id: input.resumeId, userId: user.id } })
      if (!owned) return NextResponse.json({ error: "CV bulunamadı." }, { status: 404 })
    }
    if (input.analysisIds.length > 0) {
      const owned = await prisma.analysis.count({ where: { id: { in: input.analysisIds }, userId: user.id, status: "done" } })
      if (owned !== input.analysisIds.length) return NextResponse.json({ error: "Seçilen ilanlardan biri bulunamadı." }, { status: 404 })
    }

    await enforceRateLimit(redisStore, `linkedin-audit:${user.id}`, RATE_LIMITS.registered)
    await enforceRateLimit(redisStore, `linkedin-audit-gun:${user.id}`, RATE_LIMITS.linkedinAudit)

    const audit = await createAudit(prisma, user.id, {
      source: input.source,
      resumeId: input.source === "pdf" ? input.resumeId : null,
      profile: input.source === "extension" ? input.profile : null,
      targetRole: input.targetRole,
      analysisIds: input.analysisIds,
    })
    await adaptQueue.add(LINKEDIN_AUDIT_JOB, { auditId: audit.id }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ auditId: audit.id }, { status: 202 })
  } catch (error) {
    if (error instanceof AuditBusyError) return NextResponse.json({ error: error.message, auditId: error.auditId }, { status: 409 })
    return failure(error, "POST")
  }
}

/** Düşen yazımları yeniden dene (spec §6); günlük hakdan düşmüyor, tarama başına 3 kez. */
export async function PATCH(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = retrySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    const audit = await prisma.linkedInAudit.findFirst({ where: { id: parsed.data.id, userId: user.id } })
    if (!audit) return NextResponse.json({ error: "Tarama bulunamadı." }, { status: 404 })
    const rewrites = (audit.rewrites ?? null) as LinkedInRewrites | null
    if (audit.status !== "done" || !rewrites || !hasFailedRewrites(rewrites) || audit.retries >= MAX_RETRIES) {
      return NextResponse.json({ error: "Yeniden denenecek bir şey yok." }, { status: 400 })
    }
    await prisma.linkedInAudit.update({ where: { id: audit.id }, data: { status: "running", stage: "writing", retries: { increment: 1 } } })
    await adaptQueue.add(LINKEDIN_AUDIT_JOB, { auditId: audit.id, retry: true }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ retried: true }, { status: 202 })
  } catch (error) {
    return failure(error, "PATCH")
  }
}
```

`isAdmin(user)` oturum kullanıcısını alıyor (`server/admin.ts`). `previous` tam rapor taşımıyor, yalnızca özet ile bölüm kimliği ve durumu; fark istemcide Görev 8'deki `sectionDelta` ile hesaplanıyor. Core'daki `compareAudits` worker ya da ileride sunucu tarafı için duruyor.

- [ ] **Adım 7: Yeşili gör ve PR 2**

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin src/features/billing src/server/linkedinAudit.test.ts && pnpm exec tsc --noEmit -p . && cd ../..`
Beklenen: PASS.

Yerelde elle dene (web ve worker açık):
1. Kayıtlı oturumda tarayıcı konsolundan `fetch("/api/linkedin/audits",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source:"extension",profile:{name:"Deniz Aksoy",headline:"Pazarlama",about:null,experience:[{title:"Uzman",company:"Acme",dateRange:"2022 - Present",location:null,description:"• Meta kampanyalarını yönettim."}],education:[],certifications:[],skills:["Google Ads"],languages:[],truncated:{}},targetRole:null,analysisIds:[]})})` çağır. Beklenen: 202.
2. `GET /api/linkedin/audits` ile `stage`'in `reading → checking → writing`, sonra `status: "done"` olduğunu gör. Paketsiz kullanıcıda `rewrites.about.status === "locked"`.
3. Aynı POST'u süren tarama varken tekrarla. Beklenen: 409.

```bash
git add apps/web/src/features/billing/access.ts apps/web/src/features/billing/access.test.ts apps/web/src/server/rateLimit.ts apps/web/src/features/linkedin/audit.ts apps/web/src/features/linkedin/audit.test.ts apps/web/src/server/linkedinAudit.ts apps/web/src/server/linkedinAudit.test.ts apps/web/src/app/api/linkedin/audits/route.ts
git commit -m "LinkedIn denetimi uçları: tarama, sonuç, yeniden deneme; ücret kapısı (DOG-157)"
git push -u origin linkedin-denetim-2-is
gh pr create --base test --title "LinkedIn denetimi 2/5: worker işi, yazım, uçlar ve ücret kapısı (DOG-157)" --body "<özet + doğrulama>"
gh pr merge --squash --delete-branch
```

---

## PR 3: Arayüz

Dal: `git checkout test && git pull && git checkout -b linkedin-denetim-3-arayuz`

### Görev 7: İstek kancaları, başlangıç ekranı ve sayfa

**Dosyalar:**
- Oluştur: `apps/web/src/features/linkedin/api.ts`
- Oluştur: `apps/web/src/features/linkedin/components/AuditStart.tsx`
- Oluştur: `apps/web/src/features/linkedin/components/LinkedInAuditView.tsx`
- Değiştir: `apps/web/src/app/(app)/linkedin/page.tsx`
- Test: `apps/web/src/features/linkedin/components/AuditStart.render.test.tsx`

**Arayüzler:**
- Tüketir: `AuditRequest`, `AuditResponse` (Görev 6); `useLibrary`, `useUploadResume` (`@/features/resumes/api`); `useApplicationCards` (`@/features/applications/api`); `saveProfile` (`@/features/onboarding/api`); `MAX_AUDIT_POSTINGS`.
- Üretir:
  - Kancalar ve fonksiyonlar: `auditQueryKey`, `getAudit()`, `useAudit()`, `startAudit(body)`, `retryAudit(id)`.
  - Bileşenler:
    - `AuditStart` (`props: { targetRole: string | null; extension: { installed: boolean } | null; busy: boolean; error: string | null; onStart(body: { resumeId: string; targetRole: string | null; analysisIds: string[] }): void; onTargetRoleSave(role: string): Promise<void> }`)
    - `LinkedInAuditView` (`props: { initialTargetRole: string | null }`; eklenti aktarımı Görev 12'de içine ekleniyor).

- [ ] **Adım 1: Kancalar**

```ts
// apps/web/src/features/linkedin/api.ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { AuditRequest, AuditResponse } from "@/features/linkedin/audit"

export const auditQueryKey = ["linkedin-audit"] as const

export async function getAudit(): Promise<AuditResponse> {
  return (await api.get<AuditResponse>("/linkedin/audits")).data
}

/** Tarama sürerken 2 saniyede bir yokluyor; bitince duruyor. */
export function useAudit() {
  return useQuery({
    queryKey: auditQueryKey,
    queryFn: getAudit,
    refetchInterval: (q) => (q.state.data?.audit?.status === "running" ? 2000 : false),
  })
}

export async function startAudit(body: AuditRequest): Promise<{ auditId: string }> {
  return (await api.post<{ auditId: string }>("/linkedin/audits", body)).data
}

export async function retryAudit(id: string): Promise<void> {
  await api.patch("/linkedin/audits", { id, action: "retry" })
}
```

- [ ] **Adım 2: Kırmızı çizim testi**

```tsx
// apps/web/src/features/linkedin/components/AuditStart.render.test.tsx
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { AuditStart } from "@/features/linkedin/components/AuditStart"

const render = (el: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>)
const base = { busy: false, error: null, onStart: () => {}, onTargetRoleSave: async () => {} }

describe("AuditStart", () => {
  it("shows the target role and the PDF option; the extension card only when known", () => {
    const html = render(<AuditStart {...base} targetRole="Dijital Pazarlama Uzmanı" extension={null} />)
    expect(html).toContain("Dijital Pazarlama Uzmanı")
    expect(html).toContain("PDF yükle")
    expect(html).not.toContain("Eklentiyle tek tıkla")
  })

  it("recommends the extension and says how to install it when it is missing", () => {
    const html = render(<AuditStart {...base} targetRole={null} extension={{ installed: false }} />)
    expect(html).toContain("Eklentiyle tek tıkla")
    expect(html).toContain("Önerilen")
    expect(html).toContain("Eklentiyi kur")
    expect(html).toContain("Hedef rolünü yaz")
  })

  it("opens the user's own profile when the extension is installed", () => {
    const html = render(<AuditStart {...base} targetRole={null} extension={{ installed: true }} />)
    expect(html).toContain('href="https://www.linkedin.com/in/me/"')
  })
})
```

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin/components/AuditStart.render.test.tsx`
Beklenen: FAIL (bileşen yok).

- [ ] **Adım 3: `AuditStart`**

```tsx
// apps/web/src/features/linkedin/components/AuditStart.tsx
"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronDown, CircleHelp, ExternalLink, FilePlus2, FileText, LoaderCircle, Pencil, Puzzle, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApplicationCards } from "@/features/applications/api"
import { MAX_AUDIT_POSTINGS } from "@/features/linkedin/audit"
import { useLibrary } from "@/features/resumes/api"
import { cn } from "@/lib/cn"

/** Kullanıcının kendi profili; LinkedIn `/in/me/`'yi sahibinin profiline yönlendiriyor. */
const OWN_PROFILE_URL = "https://www.linkedin.com/in/me/"
/** Chrome Web Mağazası sayfası; yayımlanana kadar kurulum yardımı. */
const EXTENSION_HELP = "/get-started"

const roleSchema = z.object({ role: z.string().trim().min(2, "Hedef rolünü yaz.").max(120, "En fazla 120 karakter.") })

export function AuditStart({
  targetRole,
  extension,
  busy,
  error,
  onStart,
  onTargetRoleSave,
}: {
  targetRole: string | null
  /** null: eklenti durumu bilinmiyor ya da eklenti yolu henüz yok; kart çizilmiyor. */
  extension: { installed: boolean } | null
  busy: boolean
  error: string | null
  onStart: (body: { resumeId: string; targetRole: string | null; analysisIds: string[] }) => void
  onTargetRoleSave: (role: string) => Promise<void>
}) {
  const library = useLibrary(true)
  const cards = useApplicationCards()
  const resumes = library.data ?? []
  const [resumeId, setResumeId] = useState<string | null>(null)
  const chosen = resumeId ?? resumes.find((r) => /linkedin/i.test(`${r.label ?? ""} ${r.fileName ?? ""}`))?.id ?? resumes[0]?.id ?? null
  const [picked, setPicked] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const form = useForm<z.input<typeof roleSchema>>({ resolver: zodResolver(roleSchema), values: { role: targetRole ?? "" } })
  const analyses = (cards.data ?? []).slice(0, 20)

  const saveRole = form.handleSubmit(async ({ role }) => {
    await onTargetRoleSave(role.trim())
    setEditing(false)
  })

  return (
    <div className="space-y-6">
      <Card className="gap-3 py-5 shadow-xs">
        <CardContent className="space-y-4 px-5">
          {editing || !targetRole ? (
            <form onSubmit={saveRole} className="flex flex-wrap items-end gap-2" noValidate>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="hedefRol">Hedef rolün</Label>
                <Input id="hedefRol" placeholder="Örneğin: Dijital Pazarlama Uzmanı" {...form.register("role")} />
              </div>
              <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
                Kaydet
              </Button>
              {!targetRole && <p className="m-0 w-full text-xs text-muted-foreground">Hedef rolünü yaz; başlığına ona göre de bakalım.</p>}
              {form.formState.errors.role && (
                <p role="alert" className="m-0 w-full text-sm text-brand-amber">
                  {form.formState.errors.role.message}
                </p>
              )}
            </form>
          ) : (
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Hedef rolün:</span>
              <span className="font-medium">{targetRole}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> değiştir
              </Button>
            </p>
          )}

          {analyses.length > 0 && (
            <details className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary">
                İlanlarıma göre de bak ({picked.length}/{MAX_AUDIT_POSTINGS})
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
                {analyses.map((c) => {
                  const checked = picked.includes(c.analysisId)
                  const disabled = !checked && picked.length >= MAX_AUDIT_POSTINGS
                  return (
                    <li key={c.analysisId}>
                      <Label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal transition-colors",
                          checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => setPicked((p) => (checked ? p.filter((x) => x !== c.analysisId) : [...p, c.analysisId]))}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.position}</span>
                          {c.company && <span className="block truncate text-xs text-muted-foreground">{c.company}</span>}
                        </span>
                      </Label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", extension && "sm:grid-cols-2")}>
        {extension && (
          <Card className="gap-3 border-primary/40 py-5 shadow-xs">
            <CardHeader className="px-5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Puzzle className="size-4 text-primary" aria-hidden /> Eklentiyle tek tıkla
                </CardTitle>
                <Badge>Önerilen</Badge>
              </div>
              <CardDescription>Bütün bölümler tek tıkla gelir. Yalnızca kendi profilini okur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5">
              <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>LinkedIn'de kendi profilini aç.</li>
                <li>Tarayıcının sağ üstündeki uyarla simgesine tıkla.</li>
              </ol>
              {extension.installed ? (
                <Button asChild>
                  <a href={OWN_PROFILE_URL} target="_blank" rel="noreferrer">
                    Profilimi aç <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={EXTENSION_HELP}>Eklentiyi kur</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="gap-3 py-5 shadow-xs">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" aria-hidden /> PDF yükle
            </CardTitle>
            <CardDescription>LinkedIn'den indirdiğin profil PDF'i. Telefonda da çalışır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5">
            <details className="group text-sm">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-medium text-primary">
                <CircleHelp className="size-4" aria-hidden /> LinkedIn'den PDF nasıl indirilir?
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ol className="mt-2 mb-0 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>LinkedIn'de kendi profil sayfanı aç.</li>
                <li>
                  Profil başlığının altındaki <span className="font-medium text-foreground">Daha fazla</span> düğmesine bas.
                </li>
                <li>
                  <span className="font-medium text-foreground">PDF olarak kaydet</span>&apos;i seç ve dosyayı CV&apos;lerim&apos;e yükle.
                </li>
              </ol>
            </details>
            {resumes.length > 0 ? (
              <Select value={chosen ?? ""} onValueChange={setResumeId}>
                <SelectTrigger aria-label="LinkedIn PDF'in" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label || r.fileName || "CV"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              !library.isPending && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/cvs?ekle=1">
                    <FilePlus2 aria-hidden /> CV'lerim'e yükle
                  </Link>
                </Button>
              )
            )}
            <Button
              type="button"
              disabled={!chosen || busy}
              onClick={() => chosen && onStart({ resumeId: chosen, targetRole, analysisIds: picked })}
            >
              {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              Profilimi denetle
            </Button>
          </CardContent>
        </Card>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

Not: `EXTENSION_HELP` eklenti mağazada yayımlanınca mağaza adresiyle değişecek; o güne kadar `/get-started`. Görev 11'de eklenti 0.3.0 yayımlanınca adresi güncelle.

- [ ] **Adım 4: Sayfa ve yönetici bileşen**

```tsx
// apps/web/src/features/linkedin/components/LinkedInAuditView.tsx
"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { auditQueryKey, retryAudit, startAudit, useAudit } from "@/features/linkedin/api"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import { AuditStart } from "@/features/linkedin/components/AuditStart"
import { LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"
import { saveProfile } from "@/features/onboarding/api"
import { apiErrorMessage } from "@/lib/api"

/**
 * LinkedIn profil denetimi sayfası (spec §5.1): başlangıç, bekleme, sonuç.
 * Hedef rol profilden; sayfada değişince profil de güncelleniyor.
 */
export function LinkedInAuditView({ initialTargetRole }: { initialTargetRole: string | null }) {
  const queryClient = useQueryClient()
  const audit = useAudit()
  const [targetRole, setTargetRole] = useState(initialTargetRole)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restart, setRestart] = useState(false)

  async function start(body: { resumeId: string; targetRole: string | null; analysisIds: string[] }) {
    setBusy(true)
    setError(null)
    try {
      await startAudit({ source: "pdf", ...body })
      setRestart(false)
      await queryClient.invalidateQueries({ queryKey: auditQueryKey })
    } catch (e) {
      setError(await apiErrorMessage(e, "Taramayı başlatamadık. Birazdan tekrar dener misin?"))
    } finally {
      setBusy(false)
    }
  }

  async function saveRole(role: string) {
    await saveProfile({ targetRole: role })
    setTargetRole(role)
  }

  async function retry(id: string) {
    try {
      await retryAudit(id)
      await queryClient.invalidateQueries({ queryKey: auditQueryKey })
    } catch (e) {
      setError(await apiErrorMessage(e, "Yeniden deneyemedik."))
    }
  }

  if (audit.isPending) return <Skeleton className="h-64 rounded-xl" />
  const data = audit.data
  const current = data?.audit ?? null
  const startPanel = <AuditStart targetRole={targetRole} extension={null} busy={busy} error={error} onStart={start} onTargetRoleSave={saveRole} />

  if (!current || restart) return startPanel
  if (current.status === "running") return <LinkedInAuditWaiting audit={current} />
  if (current.status === "failed" || !current.report) {
    return (
      <div className="space-y-4">
        <p className="m-0 text-sm text-destructive">Profilini denetleyemedik. Tekrar dener misin?</p>
        {startPanel}
      </div>
    )
  }
  return <AuditResult audit={current} previous={data?.previous ?? null} unlocked={data?.unlocked ?? false} onRescan={() => setRestart(true)} onRetry={() => void retry(current.id)} />
}
```

`page.tsx`'i şöyle değiştir: hedef rolü sunucuda oku, yeni açıklamayla `LinkedInAuditView`'i çiz. Genişlik `default` olsun, çünkü sonuç ekranı iki sütunlu.

```tsx
import { redirect } from "next/navigation"
import { prisma } from "@uyarla/db"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { LinkedInAuditView } from "@/features/linkedin/components/LinkedInAuditView"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

export const metadata = { title: "LinkedIn profilin · uyarla" }

/** LinkedIn profil denetimi (spec 2026-10-22). Kayıtlı kullanıcıya açık. */
export default async function LinkedInPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/linkedin"))
  const profile = await getProfile(prisma, session.user.id)
  return (
    <AppPage
      title="LinkedIn profilin"
      description="Profilini bölüm bölüm denetle: başlık, hakkında, deneyim, eğitim ve beceriler. Önerileri kopyalayıp LinkedIn'de sen uygularsın; profiline dokunmuyoruz."
    >
      <LinkedInAuditView initialTargetRole={profile?.targetRole ?? null} />
    </AppPage>
  )
}
```

Bu görevde `AuditResult` ve `LinkedInAuditWaiting` henüz yok. Tip kontrolünün geçmesi için Görev 8 ve Görev 9 aynı PR'da tamamlanıyor; çizim testi yalnızca `AuditStart`'ı çiziyor.

- [ ] **Adım 5: Yeşili gör**

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin/components/AuditStart.render.test.tsx`
Beklenen: PASS. Commit'i Görev 9'un sonunda at.

### Görev 8: Sonuç ekranı

**Dosyalar:**
- Oluştur: `apps/web/src/features/linkedin/sections.ts` (saf: etiketler, durum metni, fark)
- Test: `apps/web/src/features/linkedin/sections.test.ts`
- Oluştur: `apps/web/src/features/linkedin/components/AuditResult.tsx` (profil kartı, menü, bölüm kartları)
- Oluştur: `apps/web/src/features/linkedin/components/RewriteBlock.tsx` (şu anki ve öneri, fark vurgusu, kopyala, kilit)
- Test: `apps/web/src/features/linkedin/components/AuditResult.render.test.tsx`

**Arayüzler:**
- Tüketir: `AuditView`, `AuditResponse` (Görev 6); `diffWords` (`@/features/adaptation/diff`); `plansPath` (`@/features/billing/paywall`).
- Üretir:
  - Sabitler: `SECTION_LABELS: Record<AuditSectionId, string>`, `STATUS_LABELS`.
  - Fonksiyonlar: `sectionDelta(previous, report): { passedDelta: number; improved: AuditSectionId[] } | null`, `initials(name: string | null): string`.
  - Bileşenler: `AuditResult`, `RewriteBlock`.

- [ ] **Adım 1: Kırmızı test (saf)**

```ts
// apps/web/src/features/linkedin/sections.test.ts
import { describe, expect, it } from "vitest"
import { SECTION_LABELS, STATUS_LABELS, initials, sectionDelta } from "@/features/linkedin/sections"

describe("sections", () => {
  it("labels every section and status in Turkish", () => {
    expect(SECTION_LABELS.headline).toBe("Başlık")
    expect(SECTION_LABELS.postings).toBe("İlanlarına göre")
    expect(STATUS_LABELS.improve).toBe("Geliştirilebilir")
  })

  it("compares with the previous scan by section status", () => {
    const previous = { createdAt: "", summary: { passed: 5, total: 10 }, sections: [{ id: "headline" as const, status: "missing" as const }] }
    const report = { summary: { passed: 8, total: 10 }, sections: [{ id: "headline" as const, status: "strong" as const, checks: [] }] }
    expect(sectionDelta(previous, report as never)).toEqual({ passedDelta: 3, improved: ["headline"] })
    expect(sectionDelta(null, report as never)).toBeNull()
  })

  it("makes avatar initials", () => {
    expect(initials("Deniz Aksoy")).toBe("DA")
    expect(initials("ilkay")).toBe("İ")
    expect(initials(null)).toBe("?")
  })
})
```

- [ ] **Adım 2: Uygula (saf)**

```ts
// apps/web/src/features/linkedin/sections.ts
import type { AuditSectionId, AuditSectionStatus, LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import type { AuditResponse } from "@/features/linkedin/audit"

export const SECTION_LABELS: Record<AuditSectionId, string> = {
  headline: "Başlık",
  about: "Hakkında",
  experience: "Deneyim",
  education: "Eğitim",
  certifications: "Sertifikalar",
  skills: "Beceriler",
  postings: "İlanlarına göre",
}

export const STATUS_LABELS: Record<AuditSectionStatus, string> = {
  strong: "Güçlü",
  improve: "Geliştirilebilir",
  missing: "Eksik",
  info: "Bilgi",
}

const RANK: Record<AuditSectionStatus, number> = { missing: 0, improve: 1, strong: 2, info: 2 }

/** Önceki taramaya göre: geçen kontrol farkı ve durumu iyileşen bölümler. */
export function sectionDelta(
  previous: AuditResponse["previous"],
  report: Pick<LinkedInAuditReport, "summary" | "sections">,
): { passedDelta: number; improved: AuditSectionId[] } | null {
  if (!previous) return null
  const before = new Map(previous.sections.map((s) => [s.id, s.status]))
  return {
    passedDelta: report.summary.passed - previous.summary.passed,
    improved: report.sections.filter((s) => before.has(s.id) && RANK[s.status] > RANK[before.get(s.id)!]).map((s) => s.id),
  }
}

export function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr"))
    .join("")
}
```

- [ ] **Adım 3: Kırmızı çizim testi**

```tsx
// apps/web/src/features/linkedin/components/AuditResult.render.test.tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { auditProfile } from "@uyarla/core/linkedin/audit"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import type { AuditView } from "@/features/linkedin/audit"

const profile = {
  name: "Deniz Aksoy",
  headline: "Pazarlama",
  about: null,
  experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "• Meta kampanyalarını yönettim." }],
  education: [],
  certifications: [],
  skills: ["Google Ads"],
  languages: [],
  truncated: { experience: { shown: 5, total: 8 } },
}
const ok = { status: "ok" as const, issues: [] }
const audit = (over: Partial<AuditView> = {}): AuditView => ({
  id: "au1",
  status: "done",
  stage: null,
  source: "extension",
  createdAt: "2026-10-22T12:00:00.000Z",
  profile,
  targetRole: "Dijital Pazarlama Uzmanı",
  analysisIds: [],
  report: auditProfile(profile, { targetRole: "Dijital Pazarlama Uzmanı", goal: null, scored: [] }),
  rewrites: {
    headline: { status: "done", options: [{ text: "Uzman | Google Ads, Meta", verification: ok }] },
    about: { status: "locked" },
    experience: [{ index: 0, status: "locked" }],
  },
  locked: { about: true, experience: 1 },
  canRetry: false,
  ...over,
})
const render = (a: AuditView, unlocked = false) => renderToStaticMarkup(<AuditResult audit={a} previous={null} unlocked={unlocked} onRescan={() => {}} onRetry={() => {}} />)

describe("AuditResult", () => {
  it("shows the profile card, the honest summary and the truncation note", () => {
    const html = render(audit())
    expect(html).toContain("Deniz Aksoy")
    expect(html).toMatch(/\d+ kontrolden \d+&#x27;i geçti|\d+ kontrolden \d+'i geçti/)
    expect(html).toContain("Deneyimlerinden 5&#x27;i okundu")
    expect(html).not.toMatch(/%/)
  })

  it("free headline options are copyable; locked rewrites show only a skeleton and the plans link", () => {
    const html = render(audit())
    expect(html).toContain("Uzman | Google Ads, Meta")
    expect(html).toContain("Önerin hazır; paketle açılır")
    expect(html).toContain('href="/plans?donus=%2Flinkedin"')
  })

  it("shows unlocked rewrites with the before text", () => {
    const html = render(
      audit({
        rewrites: {
          headline: { status: "done", options: [] },
          about: { status: "done", suggestion: { text: "Meta kampanyalarını yönetiyorum.", verification: ok } },
          experience: [{ index: 0, status: "done", suggestion: { text: "• Meta kampanyalarını yönettim.", verification: { status: "flagged", issues: [{ kind: "number", detail: "Kontrol et" }] } } }],
        },
        locked: null,
      }),
      true,
    )
    expect(html).toContain("Meta kampanyalarını yönetiyorum.")
    expect(html).toContain("Kontrol et")
    expect(html).not.toContain("paketle açılır")
  })
})
```

`linkedin/sections.ts`'in ve testlerin geçtiğini gör: `pnpm exec vitest run src/features/linkedin/sections.test.ts`. Çizim testi FAIL (bileşen yok).

- [ ] **Adım 4: `RewriteBlock`**

```tsx
// apps/web/src/features/linkedin/components/RewriteBlock.tsx
"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Copy, ExternalLink, Lock, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { diffWords } from "@/features/adaptation/diff"
import { plansPath } from "@/features/billing/paywall"
import { cn } from "@/lib/cn"

const LINKEDIN_PROFILE = "https://www.linkedin.com/in/me/"

type Suggestion = { text: string; verification: { status: "ok" | "flagged"; issues: Array<{ kind: string; detail: string }> } }

/** Kopyala düğmesi: metni panoya yazar, "LinkedIn'de yapıştır" der. */
export function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          toast.success("Kopyalandı; LinkedIn'de yapıştır.")
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          toast.error("Kopyalayamadık; metni seçip kopyalayabilirsin.")
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Kopyalandı" : label}
    </Button>
  )
}

/** Kilitli yazım: gerçek metin sunucudan gelmiyor; bulanık iskelet ve paket bağlantısı. */
export function LockedRewrite() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed bg-muted/30 p-4">
      <div aria-hidden className="space-y-2 blur-[2px]">
        {[92, 78, 85, 60].map((w) => (
          <span key={w} className="block h-2 rounded-full bg-muted-foreground/20" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 bg-background/60 p-3 text-center">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Lock className="size-4 text-primary" aria-hidden /> Önerin hazır; paketle açılır.
        </span>
        <Button asChild size="sm">
          <Link href={plansPath("/linkedin")}>Paketleri gör</Link>
        </Button>
      </div>
    </div>
  )
}

/** "Şu anki" ve "Önerimiz": değişen kelimeler vurgulu, karakter sayacı, kopyala. */
export function RewriteBlock({ current, suggestion, maxChars }: { current: string | null; suggestion: Suggestion; maxChars?: number }) {
  const parts = current ? diffWords(current, suggestion.text) : null
  return (
    <div className="space-y-3">
      {current && (
        <div>
          <p className="m-0 text-xs font-semibold text-muted-foreground">Şu anki</p>
          <p className="m-0 mt-1 text-sm whitespace-pre-line text-muted-foreground">{current}</p>
        </div>
      )}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold text-primary">Önerimiz</p>
          <span className={cn("text-xs tabular-nums", maxChars && suggestion.text.length > maxChars ? "text-destructive" : "text-muted-foreground")}>
            {suggestion.text.length}
            {maxChars ? ` / ${maxChars}` : ""} karakter
          </span>
        </div>
        <p className="m-0 mt-1 text-sm whitespace-pre-line">
          {parts
            ? parts.map((p, i) =>
                p.kind === "removed" ? null : (
                  <span key={i} className={p.kind === "added" ? "rounded bg-primary/15 px-0.5" : undefined}>
                    {p.text}{" "}
                  </span>
                ),
              )
            : suggestion.text}
        </p>
        {suggestion.verification.status === "flagged" && (
          <p className="m-0 mt-2 flex items-start gap-1.5 text-xs text-brand-amber">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {suggestion.verification.issues.map((i) => i.detail).join(" ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={suggestion.text} />
          <Button asChild size="sm" variant="ghost">
            <a href={LINKEDIN_PROFILE} target="_blank" rel="noreferrer">
              LinkedIn'de aç <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
```

`diffWords` parçaları `{ text, kind: "same" | "added" | "removed" }` döndürüyor (`features/adaptation/diff.ts`). `toast` için `sonner`'ın `<Toaster />`'ı kök düzende (`app/layout.tsx`) zaten var.

- [ ] **Adım 5: `AuditResult`**

```tsx
// apps/web/src/features/linkedin/components/AuditResult.tsx
"use client"

import { CircleAlert, CircleCheck, Info, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuditCheck, AuditSectionId, AuditSectionStatus } from "@uyarla/core/linkedin/audit"
import { HEADLINE_MAX_CHARS } from "@uyarla/core/linkedin/reportRecord"
import type { AuditResponse, AuditView } from "@/features/linkedin/audit"
import { SECTION_LABELS, STATUS_LABELS, initials, sectionDelta } from "@/features/linkedin/sections"
import { CopyButton, LockedRewrite, RewriteBlock } from "@/features/linkedin/components/RewriteBlock"
import { cn } from "@/lib/cn"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

const STATUS_STYLE: Record<AuditSectionStatus, string> = {
  strong: "bg-brand-green/10 text-brand-green dark:text-[#4ade80]",
  improve: "bg-brand-amber/15 text-brand-amber",
  missing: "bg-destructive/10 text-destructive",
  info: "bg-muted text-muted-foreground",
}
const DOT: Record<AuditSectionStatus, string> = { strong: "bg-brand-green", improve: "bg-brand-amber", missing: "bg-destructive", info: "bg-muted-foreground/40" }

function CheckRow({ check }: { check: AuditCheck }) {
  const Icon = check.status === "ok" ? CircleCheck : check.status === "missing" ? CircleAlert : TriangleAlert
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", check.status === "ok" ? "text-brand-green" : check.status === "missing" ? "text-destructive" : "text-brand-amber")} aria-hidden />
      <span className={check.status === "ok" ? "text-muted-foreground" : undefined}>{check.text}</span>
    </li>
  )
}

function SectionCard({ id, status, checks, children }: { id: AuditSectionId; status: AuditSectionStatus; checks: AuditCheck[]; children?: React.ReactNode }) {
  return (
    <Card id={`bolum-${id}`} className="scroll-mt-20 gap-4 py-5 shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2 px-5">
        <CardTitle className="text-base">{SECTION_LABELS[id]}</CardTitle>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{STATUS_LABELS[status]}</span>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {checks.length > 0 && <ul className="m-0 list-none space-y-2 p-0">{checks.map((c, i) => <CheckRow key={`${c.id}-${c.role ?? i}`} check={c} />)}</ul>}
        {children}
      </CardContent>
    </Card>
  )
}

export function AuditResult({
  audit,
  previous,
  unlocked,
  onRescan,
  onRetry,
}: {
  audit: AuditView
  previous: AuditResponse["previous"]
  unlocked: boolean
  onRescan: () => void
  onRetry: () => void
}) {
  const report = audit.report!
  const profile = audit.profile!
  const rewrites = audit.rewrites
  const delta = sectionDelta(previous, report)
  const sectionOf = (id: AuditSectionId) => report.sections.find((s) => s.id === id)
  const truncatedExperience = profile.truncated.experience

  return (
    <div className="space-y-6">
      {/* Profil kartı: LinkedIn başlığına benzer; fotoğraf yok, baş harfler. */}
      <Card className="overflow-hidden py-0 shadow-xs">
        <div aria-hidden className="h-16 bg-gradient-to-r from-primary/70 via-primary/40 to-brand-coral/40" />
        <CardContent className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
          <div className="-mt-8 flex min-w-0 items-end gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-card bg-primary text-xl font-semibold text-primary-foreground">
              {initials(profile.name)}
            </span>
            <div className="min-w-0 pb-1">
              <p className="m-0 truncate text-lg font-semibold">{profile.name ?? "LinkedIn profilin"}</p>
              <p className="m-0 truncate text-sm text-muted-foreground">{profile.headline ?? "Başlık yok"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="m-0 text-2xl font-semibold tabular-nums">
              {report.summary.total} kontrolden {report.summary.passed}&apos;i geçti
            </p>
            {delta && delta.passedDelta !== 0 && (
              <p className="m-0 text-xs text-muted-foreground">
                Önceki taramaya göre {delta.passedDelta > 0 ? `+${delta.passedDelta}` : delta.passedDelta} kontrol
              </p>
            )}
          </div>
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {report.sections.map((s) => (
              <a key={s.id} href={`#bolum-${s.id}`} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLE[s.status])}>
                {SECTION_LABELS[s.id]}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Son tarama {DATE.format(new Date(audit.createdAt))}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRescan}>
              <RefreshCw aria-hidden /> Yeniden tara
            </Button>
          </div>
        </div>
      </Card>

      {truncatedExperience && (
        <p className="m-0 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Deneyimlerinden {truncatedExperience.shown}&apos;i okundu
          {truncatedExperience.total ? ` (toplam ${truncatedExperience.total})` : ""}; tamamı için PDF de yükleyebilirsin.
        </p>
      )}
      {report.skipped.includes("headline_target") && (
        <p className="m-0 text-sm text-muted-foreground">Hedef rolünü yazarsan başlığına ona göre de bakarız.</p>
      )}
      {audit.canRetry && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
          Bazı önerileri şu an yazamadık.
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw aria-hidden /> Tekrar dene
          </Button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Bölümler" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:flex-col">
            {report.sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#bolum-${s.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
                  <span aria-hidden className={cn("size-2 rounded-full", DOT[s.status])} />
                  {SECTION_LABELS[s.id]}
                  <span className="sr-only">: {STATUS_LABELS[s.status]}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {sectionOf("headline") && (
            <SectionCard {...sectionOf("headline")!}>
              {rewrites?.headline.status === "done" && rewrites.headline.options.length > 0 && (
                <div className="space-y-2">
                  <p className="m-0 text-xs font-semibold text-primary">Başlık önerilerimiz</p>
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                    {rewrites.headline.options.map((o) => (
                      <li key={o.text} className="flex flex-col justify-between gap-2 rounded-lg border p-3">
                        <p className="m-0 text-sm">{o.text}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {o.text.length} / {HEADLINE_MAX_CHARS}
                          </span>
                          <CopyButton text={o.text} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {sectionOf("about") && (
            <SectionCard {...sectionOf("about")!}>
              {rewrites?.about.status === "locked" && <LockedRewrite />}
              {rewrites?.about.status === "done" && <RewriteBlock current={profile.about} suggestion={rewrites.about.suggestion} />}
            </SectionCard>
          )}

          {sectionOf("experience") && (
            <SectionCard id="experience" status={sectionOf("experience")!.status} checks={sectionOf("experience")!.checks.filter((c) => c.role === undefined)}>
              <div className="space-y-2">
                {profile.experience.map((role, index) => {
                  const own = sectionOf("experience")!.checks.filter((c) => c.role === index)
                  const rewrite = rewrites?.experience.find((e) => e.index === index)
                  return (
                    <details key={`${role.title}-${index}`} className="group rounded-lg border" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{role.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[role.company, role.dateRange].filter(Boolean).join(" · ")}</span>
                        </span>
                        {own.some((c) => c.status !== "ok") && <Badge variant="secondary">Öneri var</Badge>}
                      </summary>
                      <div className="space-y-3 border-t p-3">
                        {own.length > 0 && <ul className="m-0 list-none space-y-2 p-0">{own.map((c, i) => <CheckRow key={`${c.id}-${i}`} check={c} />)}</ul>}
                        {rewrite?.status === "locked" && <LockedRewrite />}
                        {rewrite?.status === "done" && <RewriteBlock current={role.description} suggestion={rewrite.suggestion} />}
                        {rewrite?.status === "template" && (
                          <div className="rounded-lg border border-dashed p-3">
                            <p className="m-0 text-xs font-semibold text-muted-foreground">Doldurman için şablon</p>
                            <p className="m-0 mt-1 text-sm whitespace-pre-line">{rewrite.text}</p>
                            <div className="mt-2">
                              <CopyButton text={rewrite.text} />
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {sectionOf("education") && <SectionCard {...sectionOf("education")!} />}

          {sectionOf("certifications") && (
            <SectionCard {...sectionOf("certifications")!}>
              {profile.certifications.length > 0 ? (
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
                  {profile.certifications.map((c) => (
                    <li key={c.name}>{[c.name, c.issuer, c.date].filter(Boolean).join(" · ")}</li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Sertifikan yok. Hedefindeki ilanlar bir sertifika istiyorsa onu almayı düşünebilirsin.</p>
              )}
            </SectionCard>
          )}

          {sectionOf("skills") && (
            <SectionCard {...sectionOf("skills")!}>
              {report.skills.add.length > 0 && (
                <div>
                  <p className="m-0 text-xs font-semibold text-primary">Ekle (deneyiminde geçiyor)</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                    {report.skills.add.map((a) => (
                      <li key={a.term} title={a.evidence} className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium">
                        + {a.term}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.skills.pinFirst.length > 0 && (
                <div>
                  <p className="m-0 text-xs font-semibold text-muted-foreground">Öne al</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                    {report.skills.pinFirst.map((s) => (
                      <li key={s} className="rounded-full border px-2.5 py-1 text-xs">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {sectionOf("postings") && (
            <SectionCard {...sectionOf("postings")!}>
              {report.commonMissing.length > 0 ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {report.commonMissing.map((m) => (
                    <li key={m.term} className="rounded-full border border-dashed px-2.5 py-1 text-xs">
                      {m.term}
                      {m.must ? " · zorunlu" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Seçtiğin ilanların ortak bir eksiği yok.</p>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}
```

`SectionCard {...sectionOf("headline")!}` yayılımı `id`, `status`, `checks` alanlarını veriyor; `AuditSection` başka alan taşımıyor.

- [ ] **Adım 6: Yeşili gör**

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin`
Beklenen: PASS. Özet testindeki kesme işareti `&#x27;` olarak kodlanıyor; testteki iki seçenekli düzenli ifade bunu kapsıyor. Commit'i Görev 9'un sonunda at.

### Görev 9: Bekleme sahnesi, vitrin ve eski raporun kaldırılması

**Dosyalar:**
- Oluştur: `apps/web/src/features/linkedin/components/LinkedInAuditWaiting.tsx`
- Değiştir: `apps/web/src/components/ui-showcase/WaitingShowcase.tsx` (LinkedIn ekranı yeni bekleme sahnesine)
- Oluştur: `apps/web/src/app/ui/linkedin/page.tsx`, `apps/web/src/components/ui-showcase/LinkedInShowcase.tsx`
- Test: `apps/web/src/components/waiting/Waiting.render.test.tsx` (LinkedIn bölümü yeni bileşene)
- Sil: `apps/web/src/features/linkedin/components/LinkedInView.tsx`, `LinkedInView.render.test.tsx`, `LinkedInWaiting.tsx`
- Değiştir: `apps/web/src/app/api/resumes/[id]/route.ts` (`POST` linkedin-report kaldırılıyor)
- Sil: `apps/worker/src/linkedin-pipeline.ts`, `apps/worker/src/linkedin-pipeline.test.ts`; değiştir: `apps/worker/src/index.ts`, `apps/worker/src/adapt-queue.ts` (`LINKEDIN_REPORT_JOB`)
- Değiştir: `docs/kararlar.md` (K-105)

**Arayüzler:**
- Tüketir: `WaitingFrame`, `PaperSheet`, `useCycle`, `WaitingStep` (`@/components/waiting/WaitingFrame`); `SceneCard`, `Threads` (`@/components/waiting/Scene`); `AuditView`.
- Üretir: `AUDIT_STEPS`, `LinkedInAuditWaiting({ audit }: { audit: Pick<AuditView, "stage" | "createdAt" | "profile"> })`.

- [ ] **Adım 1: Kırmızı test**

`Waiting.render.test.tsx` içindeki `describe("LinkedInWaiting", …)` bloğunu sil, yerine ekle. Dosyanın başındaki `LinkedInWaiting` içe aktarmasını da kaldır.

```tsx
import { LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"

describe("LinkedInAuditWaiting", () => {
  const profile = {
    name: "Deniz Aksoy",
    headline: "Pazarlama",
    about: null,
    experience: [{ title: "Uzman", company: "Acme", dateRange: null, location: null, description: null }],
    education: [],
    certifications: [],
    skills: [],
    languages: [],
    truncated: {},
  }

  it("draws the real headline and roles while checking sections, h2 under the page title", () => {
    const html = renderToStaticMarkup(<LinkedInAuditWaiting audit={{ stage: "checking", createdAt: "2026-10-22T12:00:00.000Z", profile }} />)
    expect(html).toContain("Bölümleri kontrol ediyoruz")
    expect(html).toContain("Deniz Aksoy")
    expect(html).toContain("Uzman")
    expect(html).toMatch(/<h2[^>]*>Bölümleri kontrol ediyoruz<\/h2>/)
  })

  it("draws a skeleton while a PDF is still being read", () => {
    const html = renderToStaticMarkup(<LinkedInAuditWaiting audit={{ stage: "reading", createdAt: "2026-10-22T12:00:00.000Z", profile: null }} />)
    expect(html).toContain("Profilini okuyoruz")
  })
})
```

Çalıştır: `cd apps/web && pnpm exec vitest run src/components/waiting`
Beklenen: FAIL (modül yok).

- [ ] **Adım 2: Bekleme sahnesi**

```tsx
// apps/web/src/features/linkedin/components/LinkedInAuditWaiting.tsx
"use client"

import { BriefcaseBusiness, GraduationCap, IdCard, ListChecks, MessageSquareText, Type } from "lucide-react"
import { SceneCard, Threads } from "@/components/waiting/Scene"
import { PaperSheet, WaitingFrame, useCycle, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"
import type { AuditView } from "@/features/linkedin/audit"

/** Denetimin gerçek adımları; worker kayda yazıyor (spec §4.1). */
export const AUDIT_STEPS: WaitingStep[] = [
  { id: "reading", short: "Okuma", title: "Profilini okuyoruz", description: "Başlık, hakkında, deneyim, eğitim ve beceriler ayrıştırılıyor." },
  { id: "checking", short: "Kontrol", title: "Bölümleri kontrol ediyoruz", description: "Her bölüm, hedefine ve işe alımcının baktığı yerlere göre." },
  { id: "writing", short: "Yazım", title: "Önerilerini yazıyoruz", description: "Öneriler yalnızca profilindeki bilgilerle; her cümle kontrol ediliyor." },
]

const SECTIONS = [
  { id: "headline", label: "Başlık", icon: Type },
  { id: "about", label: "Hakkında", icon: MessageSquareText },
  { id: "experience", label: "Deneyim", icon: BriefcaseBusiness },
  { id: "education", label: "Eğitim", icon: GraduationCap },
  { id: "skills", label: "Beceriler", icon: ListChecks },
]

const FACTS = [
  "Profiline dokunmuyoruz; önerileri kopyalayıp LinkedIn'de sen uygularsın.",
  "Eklenti yalnızca senin tıkladığın, kendi profil sayfanı okur.",
  "Öneriler profilinde yazanlarla yazılır; dayanağı zayıf cümleyi işaretleyip sana sorarız.",
  "Önerileri uygulayıp yeniden taradığında farkı görürsün.",
]

export function LinkedInAuditWaiting({ audit }: { audit: Pick<AuditView, "stage" | "createdAt" | "profile"> }) {
  const stage = audit.stage ?? "reading"
  const checking = stage === "checking"
  const writing = stage === "writing"
  const cursor = useCycle(SECTIONS.length, checking, 900)
  const cardState = (i: number): SheetState => (writing ? "done" : checking ? (cursor === -1 || cursor === i ? "active" : "idle") : "idle")
  const p = audit.profile
  const lines = p ? [p.headline, ...p.experience.map((e) => [e.title, e.company].filter(Boolean).join(" · "))].filter((l): l is string => !!l) : null

  return (
    <WaitingFrame eyebrow="LinkedIn denetimi" steps={AUDIT_STEPS} activeId={stage} startedAt={Date.parse(audit.createdAt)} facts={FACTS} footnote="Genelde bir dakika kadar sürüyor." headingLevel={2}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:gap-2">
        <PaperSheet
          label={writing ? "Öneriler" : "LinkedIn profilin"}
          icon={IdCard}
          title={p?.name ?? null}
          lines={lines}
          state={checking ? "done" : "active"}
          mode={writing ? "write" : "read"}
          className="h-48 sm:h-auto sm:min-h-64"
        />
        <div className="hidden sm:block">
          <Threads active={checking} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="m-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Bölümler</p>
          {SECTIONS.map((s, i) => (
            <SceneCard key={s.id} icon={s.icon} title={s.label} state={cardState(i)} />
          ))}
        </div>
      </div>
    </WaitingFrame>
  )
}
```

- [ ] **Adım 3: Eski raporu kaldır**

1. `git rm apps/web/src/features/linkedin/components/LinkedInView.tsx apps/web/src/features/linkedin/components/LinkedInView.render.test.tsx apps/web/src/features/linkedin/components/LinkedInWaiting.tsx`
2. `WaitingShowcase.tsx`: `LinkedInWaiting`, `REPORT_STEPS` içe aktarmalarını `LinkedInAuditWaiting`, `AUDIT_STEPS` ile değiştir. `STEPS.linkedin = AUDIT_STEPS`. `screen === "linkedin"` dalı:

```tsx
      {screen === "linkedin" && (
        <LinkedInAuditWaiting
          audit={{
            stage,
            createdAt: new Date().toISOString(),
            profile: withInput
              ? { name: "Deniz Aksoy", headline: "Performance Marketing Specialist", about: null, experience: [{ title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: null, location: null, description: null }], education: [], certifications: [], skills: [], languages: [], truncated: {} }
              : null,
          }}
        />
      )}
```

3. `apps/web/src/app/api/resumes/[id]/route.ts`:
   - `POST` fonksiyonunu ve üstündeki yorumu sil.
   - Artık kullanılmayan içe aktarmaları kaldır: `linkedinReportRequestSchema`, `LinkedInReportRecord`, `ADAPT_JOB_OPTIONS`, `LINKEDIN_REPORT_JOB`, `adaptQueue`, `enforceRateLimit`. `tsc` hangilerinin boşta kaldığını söyler.
   - `GET` yanıtındaki `linkedinReport` alanını da kaldır. Başka bir tüketici kalmadığını `grep -rn "linkedinReport" apps/web/src` ile doğrula; çıktıda yalnızca `dataExport` kalabilir, orada alan yok.
4. `linkedinReportRequestSchema` tanımlandığı şema dosyasında başka kullanım yoksa sil (`grep -rn "linkedinReportRequestSchema" apps/web/src`).
5. Worker:
   - `git rm apps/worker/src/linkedin-pipeline.ts apps/worker/src/linkedin-pipeline.test.ts`.
   - `index.ts`'den `LINKEDIN_REPORT_JOB` dalını ve ilgili içe aktarmaları sil.
   - `adapt-queue.ts`'den `LINKEDIN_REPORT_JOB` ve `LinkedInReportJobData`'yı sil.
   - Kuyrukta kalmış eski bir iş varsa worker artık o adı tanımıyor ve iş düşüyor. Bu bilerek kabul ediliyor: kullanıcı yeni sayfadan tarar.

- [ ] **Adım 4: Vitrin**

```tsx
// apps/web/src/app/ui/linkedin/page.tsx
import { notFound } from "next/navigation"
import { LinkedInShowcase } from "@/components/ui-showcase/LinkedInShowcase"

export const metadata = { title: "LinkedIn denetimi · uyarla" }

/** LinkedIn denetiminin hâlleri: başlangıç, sonuç (kilitli ve açık). Yalnızca yerelde. */
export default function LinkedInShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <LinkedInShowcase />
}
```

```tsx
// apps/web/src/components/ui-showcase/LinkedInShowcase.tsx
"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { auditProfile } from "@uyarla/core/linkedin/audit"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AuditView } from "@/features/linkedin/audit"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import { AuditStart } from "@/features/linkedin/components/AuditStart"

/** Kurgusal profil (eval cv-d-pazarlama); gerçek kişi değil. */
const PROFILE = {
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık performans pazarlaması deneyimim var.",
  experience: [
    { title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: "Mar 2023 - Present", location: "İstanbul", description: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panoları hazırladım." },
    { title: "Digital Marketing Executive", company: "Parlak Dijital Ajans", dateRange: "Eyl 2021 - Şub 2023", location: null, description: null },
  ],
  education: [{ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: null }],
  certifications: [{ name: "Google Ads Search Certification", issuer: "Google", date: null }],
  skills: ["Google Ads", "Looker Studio"],
  languages: ["İngilizce"],
  truncated: { experience: { shown: 2, total: 4 } },
}
const ok = { status: "ok" as const, issues: [] }

export function LinkedInShowcase() {
  const [view, setView] = useState<"start" | "locked" | "open">("locked")
  const [client] = useState(() => new QueryClient())
  const report = auditProfile(PROFILE, { targetRole: "Dijital Pazarlama Uzmanı", goal: null, scored: [] })
  const audit = (open: boolean): AuditView => ({
    id: "vitrin",
    status: "done",
    stage: null,
    source: "extension",
    createdAt: new Date().toISOString(),
    profile: PROFILE,
    targetRole: "Dijital Pazarlama Uzmanı",
    analysisIds: [],
    report,
    rewrites: {
      headline: { status: "done", options: ["Performance Marketing Specialist | Google Ads, GA4, Looker Studio", "Performans Pazarlama | Meta ve Google reklamları", "E-ticaret büyümesi | Google Ads, GA4"].map((text) => ({ text, verification: ok })) },
      about: open ? { status: "done", suggestion: { text: "Moda Sepeti'nde Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönetiyorum; GA4 panolarıyla haftalık rapor hazırlıyorum.", verification: ok } } : { status: "locked" },
      experience: [open ? { index: 0, status: "done", suggestion: { text: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panolarıyla haftalık performans raporu hazırladım.", verification: ok } } : { index: 0, status: "locked" }, { index: 1, status: "template", text: "• [Ne yaptın] ile [ölçülebilir sonuç]" }],
    },
    locked: open ? null : { about: true, experience: 1 },
    canRetry: false,
  })

  return (
    <QueryClientProvider client={client}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as typeof view)}>
          <ToggleGroupItem value="start">Başlangıç</ToggleGroupItem>
          <ToggleGroupItem value="locked">Sonuç · kilitli</ToggleGroupItem>
          <ToggleGroupItem value="open">Sonuç · açık</ToggleGroupItem>
        </ToggleGroup>
        {view === "start" && <AuditStart targetRole="Dijital Pazarlama Uzmanı" extension={{ installed: false }} busy={false} error={null} onStart={() => {}} onTargetRoleSave={async () => {}} />}
        {view !== "start" && <AuditResult audit={audit(view === "open")} previous={null} unlocked={view === "open"} onRescan={() => {}} onRetry={() => {}} />}
      </main>
    </QueryClientProvider>
  )
}
```

Vitrin kendi `QueryClient`'ını kuruyor çünkü `AuditStart` kütüphane ve kart kancalarını çağırıyor. Yerelde anonim oturumda bu kancalar 401 alır; listeler boş kalır, sorun değil.

- [ ] **Adım 5: Karar kaydı**

`docs/kararlar.md` sonuna ekle:

```markdown

## K-105 · LinkedIn raporu yerine profil denetimi

**Bağlam:** DOG-69'daki rapor yalnızca seçilen ilanlara göre başlık ve hakkında
önerisi veriyordu. Kullanıcı 22 Ekim'de profili bölüm bölüm denetleyen bir
özellik istedi (spec 2026-10-22).

**Karar:**
- `/linkedin` artık profil denetimi. Bölüm durumları ve nedenli kontroller
  ücretsiz; başlık alternatifleri ve beceri önerileri ücretsiz; hakkında ve
  deneyim yazımları pakette. Kilitli metin sunucudan çıkmıyor.
- Profil eklentiyle (kendi profil sayfası) ya da PDF'le geliyor. Sunucu
  LinkedIn'e istek atmıyor (DOG-67). Fotoğraf yok.
- Eski rapor (`POST /api/resumes/[id]` linkedin-report, worker
  `linkedin-report`) kaldırıldı. `Resume.linkedinReport` sütunu yazılmıyor;
  ayrı bir göçte silinecek.
```

- [ ] **Adım 6: Doğrula ve PR 3**

Çalıştır: `pnpm --filter @uyarla/web exec tsc --noEmit -p . && pnpm --filter @uyarla/worker exec tsc --noEmit -p . && (cd apps/web && pnpm exec vitest run) && (cd apps/worker && pnpm exec vitest run)`
Beklenen: PASS.

Yerelde (web ve worker açık, kayıtlı oturum):
1. `/ui/linkedin`: başlangıç, kilitli ve açık sonuç; 1440 ve 390 px, açık ve koyu tema. Yatay kaydırma yok (`document.documentElement.scrollWidth === innerWidth`).
2. `/ui/waiting` → LinkedIn: okuma, kontrol, yazım aşamaları.
3. `/linkedin`: PDF yoluyla gerçek bir tarama. Kurgusal `packages/core/eval/sources/cv-dosyalari/cv-d-pazarlama.pdf`'i kütüphaneye yükle. Bekleme ekranını, sonucu ve kilidi gör.

Dev sunucusu dal değiştirdikten sonra yeni rota klasörlerinde 404 verebiliyor. Kod doğruysa sunucuyu yeniden başlat.

```bash
git add apps/web/src/features/linkedin/api.ts apps/web/src/features/linkedin/sections.ts apps/web/src/features/linkedin/sections.test.ts apps/web/src/features/linkedin/components/AuditStart.tsx apps/web/src/features/linkedin/components/AuditStart.render.test.tsx apps/web/src/features/linkedin/components/LinkedInAuditView.tsx apps/web/src/features/linkedin/components/AuditResult.tsx apps/web/src/features/linkedin/components/AuditResult.render.test.tsx apps/web/src/features/linkedin/components/RewriteBlock.tsx apps/web/src/features/linkedin/components/LinkedInAuditWaiting.tsx "apps/web/src/app/(app)/linkedin/page.tsx" apps/web/src/app/ui/linkedin/page.tsx apps/web/src/components/ui-showcase/LinkedInShowcase.tsx apps/web/src/components/ui-showcase/WaitingShowcase.tsx apps/web/src/components/waiting/Waiting.render.test.tsx "apps/web/src/app/api/resumes/[id]/route.ts" "apps/web/src/app/api/linkedin/audits/route.ts" apps/worker/src/index.ts apps/worker/src/adapt-queue.ts docs/kararlar.md
git status --short   # git rm ile silinenler zaten hazırlanmış olmalı
git commit -m "LinkedIn denetimi sayfası: başlangıç, bekleme, sonuç; eski rapor kaldırıldı (K-105)"
git push -u origin linkedin-denetim-3-arayuz
gh pr create --base test --title "LinkedIn denetimi 3/5: sayfa ve sonuç ekranı (K-105)" --body "<özet + ekran doğrulaması>"
gh pr merge --squash --delete-branch
```

Şema dosyasında `linkedinReportRequestSchema` silindiyse onun yolunu da `git add` listesine ekle.

---

## PR 4: Eklenti

Dal: `git checkout test && git pull && git checkout -b linkedin-denetim-4-eklenti`

### Görev 10: Sayfa anlık görüntüsünden profil (core, saf)

**Dosyalar:**
- Oluştur: `packages/core/src/linkedin/snapshot.ts`
- Test: `packages/core/src/linkedin/snapshot.test.ts`

**Arayüzler:**
- Tüketir: `LinkedInProfileData` (Görev 1).
- Üretir:
  - `interface ProfileSnapshot { url: string; own: boolean; name: string | null; headline: string | null; about: string | null; sections: Partial<Record<SnapshotSection, { items: string[][]; showAllText: string | null }>> }`
  - `type SnapshotSection = "experience" | "education" | "certifications" | "skills" | "languages"`
  - `profileFromSnapshot(s: ProfileSnapshot): LinkedInProfileData`

Eklentinin sayfa betiği (Görev 11) her öğenin görünen satırlarını sırayla topluyor. Aynı şirkette birden çok rolde şirket adını rolün ikinci satırı yapıyor. Bu çözücü yalnızca satırları yorumluyor.

- [ ] **Adım 1: Kırmızı test**

```ts
// packages/core/src/linkedin/snapshot.test.ts
import { describe, expect, it } from "vitest"
import { profileFromSnapshot, type ProfileSnapshot } from "./snapshot.js"

const snapshot = (over: Partial<ProfileSnapshot> = {}): ProfileSnapshot => ({
  url: "https://www.linkedin.com/in/deniz-aksoy/",
  own: true,
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık deneyimim var.",
  sections: {
    experience: {
      items: [
        ["Performance Marketing Specialist", "Moda Sepeti · Full-time", "Mar 2023 - Present · 2 yrs 8 mos", "İstanbul, Türkiye · Hybrid", "• Meta kampanyalarını yönettim.", "• GA4 panoları hazırladım.", "Skills: Google Ads · GA4"],
        ["Digital Marketing Executive", "Parlak Dijital Ajans", "Eyl 2021 - Şub 2023 · 1 yıl 6 ay"],
      ],
      showAllText: "Tüm 4 deneyimi göster",
    },
    education: { items: [["Marmara Üniversitesi", "Lisans, İşletme", "2017 - 2021", "Activities and societies: Pazarlama Kulübü"]], showAllText: null },
    certifications: { items: [["Google Ads Search Certification", "Google", "Issued Jan 2024", "Credential ID 123"]], showAllText: null },
    skills: { items: [["Google Ads"], ["Looker Studio"]], showAllText: "Show all 12 skills" },
    languages: { items: [["İngilizce", "Professional working proficiency"]], showAllText: null },
  },
  ...over,
})

describe("profileFromSnapshot", () => {
  it("reads a role: title, company without employment type, dates, location, description without skills line", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.experience[0]).toEqual({
      title: "Performance Marketing Specialist",
      company: "Moda Sepeti",
      dateRange: "Mar 2023 - Present · 2 yrs 8 mos",
      location: "İstanbul, Türkiye · Hybrid",
      description: "• Meta kampanyalarını yönettim.\n• GA4 panoları hazırladım.",
    })
    expect(p.experience[1]).toMatchObject({ company: "Parlak Dijital Ajans", location: null, description: null })
  })

  it("reads education, certifications, skills and languages", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.education[0]).toEqual({ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: "Activities and societies: Pazarlama Kulübü" })
    expect(p.certifications[0]).toEqual({ name: "Google Ads Search Certification", issuer: "Google", date: "Jan 2024" })
    expect(p.skills).toEqual(["Google Ads", "Looker Studio"])
    expect(p.languages).toEqual(["İngilizce"])
  })

  it("records truncated sections from the 'show all' links (Turkish and English)", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.truncated.experience).toEqual({ shown: 2, total: 4 })
    expect(p.truncated.skills).toEqual({ shown: 2, total: 12 })
    expect(p.truncated.education).toBeUndefined()
  })

  it("handles a role without company line and missing sections", () => {
    const p = profileFromSnapshot(snapshot({ sections: { experience: { items: [["Kurucu", "2020 - Present"]], showAllText: null } } }))
    expect(p.experience[0]).toEqual({ title: "Kurucu", company: null, dateRange: "2020 - Present", location: null, description: null })
    expect(p.education).toEqual([])
    expect(p.skills).toEqual([])
  })

  it("drops LinkedIn's 'see more' labels", () => {
    const p = profileFromSnapshot(snapshot({ sections: { experience: { items: [["Uzman", "Acme", "2022 - Present", "Kampanya yönettim…", "…daha fazla göster"]], showAllText: null } } }))
    expect(p.experience[0]!.description).toBe("Kampanya yönettim…")
  })
})
```

- [ ] **Adım 2: Kırmızıyı gör**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin/snapshot.test.ts`
Beklenen: FAIL, modül yok.

- [ ] **Adım 3: Uygula**

```ts
// packages/core/src/linkedin/snapshot.ts
import type { LinkedInProfileData } from "./profileData.js"

/**
 * Eklentinin kullanıcının kendi LinkedIn profil sayfasından topladığı görünen
 * satırlar (spec §5.2). Sayfa betiği yalnızca satırları topluyor; yorum burada,
 * saf ve testli. LinkedIn sayfa yapısını değiştirince düzeltme de burada.
 */
export type SnapshotSection = "experience" | "education" | "certifications" | "skills" | "languages"

export interface ProfileSnapshot {
  url: string
  /** Yalnızca sahibine görünen "Profil bölümü ekle" düğmesi var mı. */
  own: boolean
  name: string | null
  headline: string | null
  about: string | null
  sections: Partial<Record<SnapshotSection, { items: string[][]; showAllText: string | null }>>
}

const YEAR = /\b(19|20)\d{2}\b|\b(Present|Halen|Günümüz|Hâlâ|Devam ediyor)\b/i
const EMPLOYMENT = /\s+·\s+(Full-time|Part-time|Internship|Contract|Freelance|Self-employed|Seasonal|Apprenticeship|Tam zamanlı|Yarı zamanlı|Stajyer|Staj|Sözleşmeli|Serbest|Serbest çalışan|Mevsimlik|Çırak)\s*$/i
const WORK_MODE = /(Remote|Uzaktan|Hybrid|Hibrit|On-site|İş yerinde|Ofiste)\s*$/i
const SKILLS_LINE = /^(Skills|Yetenekler|Beceriler)\s*:/i
const SEE_MORE = /^[…\.]*\s*(daha fazla göster|daha fazla gör|see more|show more)$/i
const ISSUED = /^(Issued|Veriliş tarihi|Verilme tarihi|Alındı)\s*:?\s*/i
const CREDENTIAL = /^(Credential ID|Kimlik bilgisi kimliği|Sertifika kimliği)\b/i

const clean = (lines: string[]) => lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && !SEE_MORE.test(l))

function experienceItem(raw: string[]): LinkedInProfileData["experience"][number] | null {
  const lines = clean(raw)
  const title = lines.shift()
  if (!title) return null
  let company: string | null = null
  if (lines[0] && !YEAR.test(lines[0])) company = lines.shift()!.replace(EMPLOYMENT, "").trim() || null
  const dateRange = lines[0] && YEAR.test(lines[0]) ? lines.shift()! : null
  // Konum: kısa ve tarih değil; virgüllü yer adı ya da çalışma biçimiyle bitiyor.
  const location = lines[0] && lines[0].length <= 80 && !YEAR.test(lines[0]) && (lines[0].includes(",") || WORK_MODE.test(lines[0])) && !/[.!?]$/.test(lines[0]) ? lines.shift()! : null
  const description = lines.filter((l) => !SKILLS_LINE.test(l)).join("\n") || null
  return { title, company, dateRange, location, description }
}

function educationItem(raw: string[]): LinkedInProfileData["education"][number] | null {
  const lines = clean(raw)
  const school = lines.shift()
  if (!school) return null
  const degree = lines[0] && !YEAR.test(lines[0]) ? lines.shift()! : null
  const dateRange = lines[0] && YEAR.test(lines[0]) ? lines.shift()! : null
  return { school, degree, dateRange, description: lines.join("\n") || null }
}

function certificationItem(raw: string[]): LinkedInProfileData["certifications"][number] | null {
  const lines = clean(raw).filter((l) => !CREDENTIAL.test(l))
  const name = lines.shift()
  if (!name) return null
  const issuer = lines[0] && !ISSUED.test(lines[0]) ? lines.shift()! : null
  const dateLine = lines.find((l) => ISSUED.test(l))
  return { name, issuer, date: dateLine ? dateLine.replace(ISSUED, "").split("·")[0]!.trim() || null : null }
}

function truncation(section: { items: string[][]; showAllText: string | null } | undefined) {
  const total = section?.showAllText?.match(/\d+/)?.[0]
  return section && total ? { shown: section.items.length, total: Number(total) } : undefined
}

export function profileFromSnapshot(s: ProfileSnapshot): LinkedInProfileData {
  const items = (key: SnapshotSection) => s.sections[key]?.items ?? []
  const first = (key: SnapshotSection) => items(key).map((i) => clean(i)[0]).filter((x): x is string => !!x)
  const truncated: LinkedInProfileData["truncated"] = {}
  for (const key of ["experience", "education", "certifications", "skills"] as const) {
    const t = truncation(s.sections[key])
    if (t) truncated[key] = t
  }
  return {
    name: s.name?.trim() || null,
    headline: s.headline?.trim() || null,
    about: s.about?.trim() || null,
    experience: items("experience").map(experienceItem).filter((x): x is NonNullable<typeof x> => !!x),
    education: items("education").map(educationItem).filter((x): x is NonNullable<typeof x> => !!x),
    certifications: items("certifications").map(certificationItem).filter((x): x is NonNullable<typeof x> => !!x),
    skills: first("skills"),
    languages: first("languages"),
    truncated,
  }
}
```

`packages/core/src/index.ts`'e `export * from "./linkedin/snapshot.js"` ekle.

- [ ] **Adım 4: Yeşili gör ve commit**

Çalıştır: `cd packages/core && pnpm exec vitest run src/linkedin && pnpm exec tsc --noEmit`
Beklenen: PASS.

```bash
git add packages/core/src/linkedin/snapshot.ts packages/core/src/linkedin/snapshot.test.ts packages/core/src/index.ts
git commit -m "LinkedIn sayfa görüntüsünden profil çözücü (DOG-157)"
```

### Görev 11: Eklenti 0.3.0: kendi profilini okuma ve aktarma

**Dosyalar:**
- Oluştur: `apps/extension/src/profile.ts` (saf: adres kontrolü, aktarım adresi)
- Test: `apps/extension/src/profile.test.ts`
- Oluştur: `apps/extension/src/profileCollector.ts` (sayfa içinde çalışan betik; kendi kendine yeterli)
- Değiştir: `apps/extension/src/background.ts` (tıklama dalı, `uyarla-ping`)
- Değiştir: `apps/extension/manifest.json`, `apps/extension/package.json` (0.3.0)

**Arayüzler:**
- Tüketir: `profileFromSnapshot`, `ProfileSnapshot` (`@uyarla/core/linkedin/snapshot`); `LinkedInProfileDataSchema` (`@uyarla/core/linkedin/profileData`); `issueToken`, `redeemToken` (mevcut).
- Üretir:
  - `isProfileUrl(url: string): boolean`
  - `encodeProfile(profile: LinkedInProfileData): string` (base64url, UTF-8)
  - `profileHandoffUrl(base: string, encoded: string, token: string): string`
  - `collectProfileSnapshot(): ProfileSnapshot` (sayfa içi)
  - Mesaj: `{ type: "uyarla-ping" }` → `{ ok: true, version: string }`

- [ ] **Adım 1: Kırmızı test**

```ts
// apps/extension/src/profile.test.ts
import { describe, expect, it } from "vitest"
import { encodeProfile, isProfileUrl, profileHandoffUrl } from "./profile.js"

describe("isProfileUrl", () => {
  it("accepts a profile page, not its detail pages or other LinkedIn pages", () => {
    expect(isProfileUrl("https://www.linkedin.com/in/deniz-aksoy/")).toBe(true)
    expect(isProfileUrl("https://tr.linkedin.com/in/deniz-aksoy?originalSubdomain=tr")).toBe(true)
    expect(isProfileUrl("https://www.linkedin.com/in/deniz-aksoy/details/experience/")).toBe(false)
    expect(isProfileUrl("https://www.linkedin.com/jobs/view/123")).toBe(false)
    expect(isProfileUrl("https://example.com/in/deniz")).toBe(false)
    expect(isProfileUrl("bozuk")).toBe(false)
  })
})

describe("encodeProfile, profileHandoffUrl", () => {
  const profile = { name: "Deniz Aksoy", headline: "Uzman · İstanbul 😊", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }

  it("encodes UTF-8 JSON as URL-safe base64 that round-trips", () => {
    const encoded = encodeProfile(profile)
    expect(encoded).not.toMatch(/[+/=]/)
    const json = new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))
    expect(JSON.parse(json)).toEqual(profile)
  })

  it("puts profile and token in the fragment of /linkedin", () => {
    const url = profileHandoffUrl("https://uyarla.com.tr/", "abc", "jt")
    expect(url).toBe("https://uyarla.com.tr/linkedin#profil=abc&jeton=jt")
  })
})
```

Çalıştır: `cd apps/extension && pnpm exec vitest run src/profile.test.ts`
Beklenen: FAIL.

- [ ] **Adım 2: Saf parçalar**

```ts
// apps/extension/src/profile.ts
import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"

/** Kendi profil sayfası: linkedin.com/in/<ad>; alt sayfalar ("details") değil. */
export function isProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/in\/[^/]+\/?$/.test(u.pathname)
  } catch {
    return false
  }
}

/** UTF-8 JSON → URL'de güvenli base64 (Türkçe ve emoji bozulmasın). */
export function encodeProfile(profile: LinkedInProfileData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(profile))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Profil `#` kısmında: sunucuya ve istek günlüklerine gitmiyor (DOG-70 ile aynı). */
export function profileHandoffUrl(base: string, encoded: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/linkedin#profil=${encoded}&jeton=${encodeURIComponent(token)}`
}
```

- [ ] **Adım 3: Sayfa içi betik**

Bu fonksiyon `chrome.scripting.executeScript({ func })` ile sayfada çalışıyor. Chrome kaynağını kopyalıyor; dışarıdan değişken ya da içe aktarma kullanamaz.

```ts
// apps/extension/src/profileCollector.ts
import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"

/**
 * Kullanıcının açtığı LinkedIn profil sayfasında çalışır ve yalnızca görünen
 * satırları toplar (spec §5.2). Kendi kendine yeterli olmalı: Chrome bu
 * fonksiyonun kaynağını sayfaya kopyalıyor, kapanış ve içe aktarma taşınmıyor.
 *
 * LinkedIn görünen metni `span[aria-hidden="true"]` içinde, ekran okuyucu
 * kopyasını ayrı bir gizli span'da tutuyor; ikincisi atlanıyor. Bölümler
 * `id`'li bir işaretin bulunduğu `<section>`'lar: about, experience, education,
 * licenses_and_certifications, skills, languages.
 */
export function collectProfileSnapshot(): ProfileSnapshot {
  const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim()
  const visible = (root: Element) =>
    Array.from(root.querySelectorAll('span[aria-hidden="true"]'))
      .map((s) => clean(s.textContent))
      .filter(Boolean)
  const section = (id: string) => document.getElementById(id)?.closest("section") ?? null
  const own = Array.from(document.querySelectorAll("main button, main a")).some((el) => /^(Profil bölümü ekle|Add profile section)$/i.test(clean(el.textContent)))

  const items = (id: string) => {
    const root = section(id)
    if (!root) return undefined
    const list = root.querySelector("ul")
    const out: string[][] = []
    for (const li of Array.from(list?.children ?? [])) {
      const nested = li.querySelector("ul")
      const nestedItems = nested ? Array.from(nested.children).filter((c) => c.tagName === "LI" && visible(c).length > 0) : []
      if (nestedItems.length > 1) {
        // Aynı şirkette birden çok rol: şirket adı her rolün ikinci satırı.
        const company = visible(li)[0] ?? ""
        for (const role of nestedItems) {
          const lines = visible(role)
          out.push([lines[0] ?? "", company, ...lines.slice(1)])
        }
      } else {
        const lines = visible(li)
        if (lines.length > 0) out.push(lines)
      }
    }
    const showAll = Array.from(root.querySelectorAll('a[href*="/details/"]')).map((a) => clean(a.textContent)).find(Boolean) ?? null
    return { items: out, showAllText: showAll }
  }

  const about = section("about")
  return {
    url: location.href,
    own,
    name: clean(document.querySelector("main h1")?.textContent) || null,
    headline: clean(document.querySelector("main .text-body-medium")?.textContent) || null,
    // İlk görünen satır bölüm başlığı ("Hakkında" / "About").
    about: about ? visible(about).slice(1).join("\n") || null : null,
    sections: {
      experience: items("experience"),
      education: items("education"),
      certifications: items("licenses_and_certifications"),
      skills: items("skills"),
      languages: items("languages"),
    },
  }
}
```

- [ ] **Adım 4: Arka plan**

`background.ts` içinde üç değişiklik:

1. İçe aktarmalar:

```ts
import { LinkedInProfileDataSchema } from "@uyarla/core/linkedin/profileData"
import { profileFromSnapshot, type ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import { encodeProfile, isProfileUrl, profileHandoffUrl } from "./profile.js"
import { collectProfileSnapshot } from "./profileCollector.js"
```

2. Bildirim yardımcısı (`notFound`'un yanına):

```ts
function notify(message: string): void {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/128.png", title: "uyarla", message })
}

/** Kendi profil sayfası: görünen satırlar → profil → uyarla'nın /linkedin sayfası. */
async function sendProfile(tabId: number): Promise<void> {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: collectProfileSnapshot })
  const snapshot = result?.result as ProfileSnapshot | undefined
  if (!snapshot) return notify("Profilini okuyamadık; sayfayı yenileyip tekrar dene ya da PDF yükle.")
  if (!snapshot.own) return notify("Yalnızca kendi profilini gönderebilirsin.")
  const parsed = LinkedInProfileDataSchema.safeParse(profileFromSnapshot(snapshot))
  if (!parsed.success || (!parsed.data.headline && parsed.data.experience.length === 0)) {
    return notify("Profilini okuyamadık; sayfayı yenileyip tekrar dene ya da PDF yükle.")
  }
  const { store, token } = issueToken(await readTokens(), Date.now())
  await chrome.storage.session.set({ [TOKENS_KEY]: store })
  await chrome.tabs.create({ url: profileHandoffUrl(UYARLA_URL, encodeProfile(parsed.data), token) })
}
```

3. `chrome.action.onClicked` dinleyicisinin başında, `tab.id` kontrolünden sonra:

```ts
  if (tab.url && isProfileUrl(tab.url)) {
    try {
      await sendProfile(tab.id)
    } catch {
      notify("Profilini okuyamadık; sayfayı yenileyip tekrar dene ya da PDF yükle.")
    }
    return
  }
```

4. `onMessageExternal` dinleyicisinin başına ping ekle (jeton kontrolünden önce):

```ts
  if ((message as { type?: string } | null)?.type === "uyarla-ping") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
    return false
  }
```

`tab.url` yalnızca `activeTab` izni tıklamayla verildiğinde dolu geliyor; tıklama dinleyicisi bu izni zaten veriyor. Gelmezse betikteki `location.href` ile karar ver: `collectProfileSnapshot`'ı çalıştır, `isProfileUrl(snapshot.url)` değilse mevcut ilan yoluna düş.

- [ ] **Adım 5: Sürüm**

`manifest.json`:
- `"version": "0.3.0"`.
- `"description": "İlan sayfasını ya da kendi LinkedIn profilini tek tıkla uyarla'ya gönder."`
- `"action.default_title": "uyarla'ya gönder"`

`package.json`: `"version": "0.3.0"`.

- [ ] **Adım 6: Doğrula ve commit**

Çalıştır: `cd apps/extension && pnpm exec vitest run && pnpm exec tsc --noEmit && UYARLA_URL=http://localhost:3001 node scripts/build.mjs && cd ../..`
Beklenen: PASS ve `dist/` oluşur.

**Elle deneme (kullanıcıyla).** Ben LinkedIn'e giriş yapamıyorum; bu adımı kullanıcı yapıyor:
1. Chrome'da `chrome://extensions` → Geliştirici modu → "Paketlenmemiş öğe yükle" → `apps/extension/dist`. Eski sürüm varsa önce kaldır.
2. Kendi profilinde simgeye tıkla. Beklenen: `localhost:3001/linkedin` açılır ve tarama başlar.
3. Başkasının profilinde tıkla. Beklenen: "Yalnızca kendi profilini gönderebilirsin."
4. Okunan bölümleri kontrol et. Deneyim, eğitim ve sertifikalar doğru mu? Eksik ya da kayık satır varsa kullanıcıdan o bölümün ekran görüntüsünü iste. Düzeltmeyi `snapshot.ts`'de yap ve aynı satırlarla test ekle.

```bash
git add apps/extension/src/profile.ts apps/extension/src/profile.test.ts apps/extension/src/profileCollector.ts apps/extension/src/background.ts apps/extension/manifest.json apps/extension/package.json
git commit -m "Eklenti 0.3.0: kendi LinkedIn profilini uyarla'ya gönder (DOG-157)"
```

### Görev 12: Web: eklentiden gelen profil ve eklenti yoklaması

**Dosyalar:**
- Oluştur: `apps/web/src/features/linkedin/handoff.ts`
- Test: `apps/web/src/features/linkedin/handoff.test.ts`
- Değiştir: `apps/web/src/features/linkedin/components/LinkedInAuditView.tsx`

**Arayüzler:**
- Tüketir: `LinkedInProfileDataSchema`; `verifyHandoff`, `browserSendMessage`, `extensionIdsFromEnv`, `type SendMessage` (`@/features/analysis/extensionHandoff`); `startAudit`.
- Üretir: `readProfileHandoff(hash: string): { profile: LinkedInProfileData; token: string } | { error: "invalid" } | null`, `detectExtension(ids: string[], send: SendMessage | undefined, timeoutMs?: number): Promise<boolean>`.

- [ ] **Adım 1: Kırmızı test**

```ts
// apps/web/src/features/linkedin/handoff.test.ts
import { describe, expect, it } from "vitest"
import { detectExtension, readProfileHandoff } from "@/features/linkedin/handoff"

const profile = { name: "Deniz Aksoy", headline: "Uzman · İstanbul", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }
const encode = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

describe("readProfileHandoff", () => {
  it("decodes the extension's profile and token", () => {
    expect(readProfileHandoff(`#profil=${encode(profile)}&jeton=jt`)).toEqual({ profile, token: "jt" })
  })

  it("returns null without a profile and an error for broken data", () => {
    expect(readProfileHandoff("")).toBeNull()
    expect(readProfileHandoff("#ornek-ilanlar")).toBeNull()
    expect(readProfileHandoff("#profil=@@@&jeton=jt")).toEqual({ error: "invalid" })
    expect(readProfileHandoff(`#profil=${encode({ headline: 5 })}&jeton=jt`)).toEqual({ error: "invalid" })
  })
})

describe("detectExtension", () => {
  it("is true when any extension answers the ping", async () => {
    const send = (_id: string, _m: unknown, cb: (r: unknown) => void) => cb({ ok: true, version: "0.3.0" })
    expect(await detectExtension(["a"], send)).toBe(true)
  })

  it("is false without a channel, without ids or on silence", async () => {
    expect(await detectExtension(["a"], undefined)).toBe(false)
    expect(await detectExtension([], () => {})).toBe(false)
    expect(await detectExtension(["a"], () => {}, 20)).toBe(false)
  })
})
```

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin/handoff.test.ts`
Beklenen: FAIL.

- [ ] **Adım 2: Uygula**

```ts
// apps/web/src/features/linkedin/handoff.ts
import { LinkedInProfileDataSchema, type LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import type { SendMessage } from "@/features/analysis/extensionHandoff"

/**
 * Eklentinin `/linkedin#profil=…&jeton=…` aktarımı (spec §5.2). Profil yoksa
 * null; bozuksa hata (sayfa "PDF ile dene" diyor).
 */
export function readProfileHandoff(hash: string): { profile: LinkedInProfileData; token: string } | { error: "invalid" } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const encoded = params.get("profil")
  if (!encoded) return null
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
    const parsed = LinkedInProfileDataSchema.safeParse(JSON.parse(json))
    const token = params.get("jeton")
    return parsed.success && token ? { profile: parsed.data, token } : { error: "invalid" }
  } catch {
    return { error: "invalid" }
  }
}

/** Eklenti kurulu mu: yapılandırılmış kimliklerden biri ping'e cevap verirse. */
export async function detectExtension(ids: string[], send: SendMessage | undefined, timeoutMs = 1200): Promise<boolean> {
  if (!send || ids.length === 0) return false
  const asks = ids.map(
    (id) =>
      new Promise<boolean>((resolve) => {
        send(id, { type: "uyarla-ping" }, (response) => resolve((response as { ok?: unknown } | undefined)?.ok === true))
      }),
  )
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
  return Promise.race([Promise.all(asks).then((all) => all.some(Boolean)), timeout])
}
```

`LinkedInAuditView`'e ekle:

```tsx
import { useEffect, useRef } from "react"
import { browserSendMessage, extensionIdsFromEnv, verifyHandoff } from "@/features/analysis/extensionHandoff"
import { detectExtension, readProfileHandoff } from "@/features/linkedin/handoff"

const EXTENSION_IDS = extensionIdsFromEnv(process.env.NEXT_PUBLIC_EXTENSION_IDS)
```

Bileşenin içine, `useState` satırlarının altına:

```tsx
  // Eklenti kurulu mu (başlangıç kartı için); bilinene kadar kart çizilmiyor.
  const [extension, setExtension] = useState<{ installed: boolean } | null>(null)
  useEffect(() => {
    void detectExtension(EXTENSION_IDS, browserSendMessage()).then((installed) => setExtension({ installed }))
  }, [])

  // Eklentiden gelen profil: # siliniyor, jeton eklentiye doğrulatılıyor, tarama başlıyor.
  const handoffDone = useRef(false)
  useEffect(() => {
    if (handoffDone.current) return
    const incoming = readProfileHandoff(window.location.hash)
    if (!incoming) return
    handoffDone.current = true
    window.history.replaceState(null, "", window.location.pathname)
    if ("error" in incoming) {
      setError("Eklentiden gelen profil okunamadı. Sayfayı yenileyip eklentiye yeniden tıkla ya da PDF yükle.")
      return
    }
    void (async () => {
      const valid = await verifyHandoff(incoming.token, EXTENSION_IDS, browserSendMessage())
      if (!valid) {
        setError("Eklentiden gelen profili doğrulayamadık. LinkedIn'de eklentiye yeniden tıkla.")
        return
      }
      setBusy(true)
      try {
        await startAudit({ source: "extension", profile: incoming.profile, targetRole, analysisIds: [] })
        setRestart(false)
        await queryClient.invalidateQueries({ queryKey: auditQueryKey })
      } catch (e) {
        setError(await apiErrorMessage(e, "Taramayı başlatamadık. Birazdan tekrar dener misin?"))
      } finally {
        setBusy(false)
      }
    })()
    // İlk açılışta bir kez; targetRole o anki değer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

`startPanel` içinde `extension={null}` yerine `extension={extension}` ver. `AuditStart`'taki `EXTENSION_HELP` adresi eklenti mağazada yayımlandıysa mağaza adresine çevrilir; yayımlanmadıysa `/get-started` kalır, bu not PR açıklamasına girer.

- [ ] **Adım 3: Doğrula ve PR 4**

Çalıştır: `cd apps/web && pnpm exec vitest run src/features/linkedin && pnpm exec tsc --noEmit -p . && cd ../..`
Beklenen: PASS.

Yerelde: Görev 11'in elle denemesini kullanıcıyla yap. `/linkedin`'de eklenti kartı "Profilimi aç" göstermeli. Eklenti kaldırılınca kart "Eklentiyi kur" demeli.

```bash
git add apps/web/src/features/linkedin/handoff.ts apps/web/src/features/linkedin/handoff.test.ts apps/web/src/features/linkedin/components/LinkedInAuditView.tsx
git commit -m "LinkedIn denetimi: eklentiden gelen profil ve eklenti yoklaması (DOG-157)"
git push -u origin linkedin-denetim-4-eklenti
gh pr create --base test --title "LinkedIn denetimi 4/5: eklenti 0.3.0 ve aktarım (DOG-157)" --body "<özet + kullanıcının gerçek profilde denemesi>"
gh pr merge --squash --delete-branch
```

---

## PR 5: KVKK

Dal: `git checkout test && git pull && git checkout -b linkedin-denetim-5-kvkk`

### Görev 13: Gizlilik metni

**Dosyalar:**
- Değiştir: `apps/web/src/app/(marketing)/privacy/page.tsx`
- Değiştir: `apps/web/src/features/legal/company.ts` (`lastUpdated`)

- [ ] **Adım 1: Metin**

`privacy/page.tsx`'de "OpenAI (ABD), yapay zekâ modeli" maddesini şöyle güncelle:

```tsx
          <li>
            <strong>OpenAI (ABD), yapay zekâ modeli:</strong> CV'nin ve ilanın metni analiz, skor,
            uyarlama ve ön yazı için; LinkedIn profil bilgilerin (eklentiyle senin isteğinle kendi
            profil sayfandan ya da yüklediğin PDF'ten) profil denetimi için OpenAI API'sine
            gönderilir. OpenAI, API üzerinden gelen veriyi model eğitiminde kullanmaz. Kötüye
            kullanımı denetlemek için en fazla 30 gün saklayabilir, sonra siler.
          </li>
```

Saklama bölümünde CV ve analizlerin anlatıldığı paragrafı bul (`grep -n "sakla" "apps/web/src/app/(marketing)/privacy/page.tsx"`). Oraya şu cümleyi ekle: "LinkedIn profil denetimlerinin son beşi saklanır; hesabını silince silinir."

`company.ts`'de `lastUpdated` değerini PR'ın açıldığı günün tarihiyle güncelle (ör. `"5 Kasım 2026"`).

- [ ] **Adım 2: Doğrula ve PR 5**

Çalıştır: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit -p . && cd ../..`
Beklenen: PASS. Yerelde `/privacy`'de iki cümleyi ve tarihi gör.

```bash
git add "apps/web/src/app/(marketing)/privacy/page.tsx" apps/web/src/features/legal/company.ts
git commit -m "KVKK: LinkedIn profil denetimi (DOG-157)"
git push -u origin linkedin-denetim-5-kvkk
gh pr create --base test --title "LinkedIn denetimi 5/5: KVKK metni (DOG-157)" --body "<özet>"
gh pr merge --squash --delete-branch
```

---

## Görev 14: Canlıya alma

Bu görev yalnızca kullanıcı onay verince ve aşağıdaki iki ön koşul sağlanınca yapılıyor.

- [ ] **Adım 1: Ön koşulları sor**
  - **Worker:** Railway çalışıyor mu? Worker, main'deki hâliyle dağıtılabiliyor mu? Yeni `linkedin-audit` işi worker'da. Worker dağıtılmadan canlıda tarama hep "sürüyor"da kalır.
  - **Eklenti:** 0.3.0 Chrome Web Mağazası'na yüklenecek mi? Kullanıcı yapıyor. Yüklenmezse PDF yolu yine tam çalışır.
- [ ] **Adım 2: Üretim göçü**
  - Üretim `DATABASE_URL`'i kullanıcının ortamından komuta **satır içinde** veriliyor: `DATABASE_URL=… pnpm --filter @uyarla/db exec prisma migrate deploy`.
  - Adres yazdırılmıyor, dosyaya yazılmıyor, komut çıktısı paylaşılmıyor.
  - Beklenen: `linkedin_denetimi` göçü uygulandı.
- [ ] **Adım 3: Test → main**
  - `gh pr create --base main --head test` ile PR aç. Gövdeye beş PR'ın özetini, worker ve göç notunu yaz.
  - Vercel SUCCESS olmadan birleştirme. Birleştirme `gh pr merge <n> --merge` (merge commit).
- [ ] **Adım 4: Worker dağıtımı**
  - Railway'de main'i dağıt.
  - Worker günlüğünde "analyze ve adapt kuyrukları dinleniyor" satırını gör.
- [ ] **Adım 5: Canlı doğrulama**
  - `curl -s -o /dev/null -w "%{http_code}" https://uyarla.com.tr/linkedin`: anonimde 307 (girişe).
  - `curl -s -o /dev/null -w "%{http_code}" https://uyarla.com.tr/api/linkedin/audits`: 401.
  - `/ui/linkedin`: 404.
  - Kullanıcı kendi hesabıyla PDF yolundan bir tarama yapar. Bekleme, sonuç ve kilit durumu doğru görünmeli.
- [ ] **Adım 6: Kayıtlar**
  - Linear kaydına canlı doğrulamayı yaz ve "Done" yap.
  - `Resume.linkedinReport` sütununun silinmesi için ayrı bir küçük kayıt aç (spec §2).
