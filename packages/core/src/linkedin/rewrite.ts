import { z } from "zod"
import { resumeFacts, verifyCoverLetter } from "../cover/letter.js"
import type { LlmProvider } from "../llm/types.js"
import { resumeLanguage } from "../normalize/language.js"
import { containsKeyword, normalizeTokens } from "../normalize/turkish.js"
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
   - Becerileri YALNIZCA "BECERİLER" satırından seç.
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

const CONNECTORS = new Set(["ve", "ile", "and", "of", "for", "&"])

/**
 * Başlığın her parçası (unvan, alan, beceri) izin verilen bir unvan ya da
 * profilde (hedef dahil) geçen bir ifade olmalı. verifyCoverLetter sayıya ve
 * ilan terimine bakıyor; ilan yoksa başlıkta uydurulan beceriyi görmüyordu
 * (son inceleme). Parça birebir geçmiyorsa kelimelerinin hepsi profilde olmalı.
 * Yorumlama ("ROAS artışı" ← "ROAS'ı 4,1'den 5,3'e çıkardım") da işaretleniyor;
 * uyarı "doğruysa kullan" diyor, kararı kullanıcı veriyor.
 */
export function headlineIssues(headline: string, titles: readonly string[], source: string): Array<{ kind: string; detail: string }> {
  const known = normalizeTokens(source)
  // Türkçe ek farkı ("yönet" / "yönett"): kısa olan en az 5 harfse önek yetiyor; "java" "javascript"i karşılamıyor.
  const seen = (t: string) => known.some((k) => k === t || (Math.min(k.length, t.length) >= 5 && (k.startsWith(t) || t.startsWith(k))))
  const fold = (t: string) => t.toLocaleLowerCase("tr").trim()
  const supported = (part: string) =>
    titles.some((t) => fold(t).includes(fold(part)) || fold(part).includes(fold(t))) ||
    containsKeyword(source, part) ||
    normalizeTokens(part)
      .filter((t) => !CONNECTORS.has(t) && !/^\d+$/.test(t))
      .every(seen)
  return headline
    .split(/[|,·•]/)
    .map((p) => p.trim())
    .filter((p) => p && !supported(p))
    .map((p) => ({ kind: "headline_unsupported", detail: `“${p}” profilinde geçmiyor; doğruysa kullan, değilse çıkar.` }))
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
  const titles = headlineTitles(resume, input.targetRole)
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
        `UNVANLAR: ${titles.join(" · ") || "—"}`,
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
    if (options.length > 0) {
      headline = {
        status: "done",
        options: verify(options).map((o) => {
          const issues = [...o.verification.issues, ...headlineIssues(o.text, titles, source)]
          return { text: o.text, verification: { status: issues.length ? "flagged" : "ok", issues } }
        }),
      }
    }
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
