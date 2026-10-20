import { z } from "zod"
import { postingSummary, resumeFacts, verifyCoverLetter } from "../cover/letter.js"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { resumeLanguage } from "../normalize/language.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import type { ScoredPosting } from "./report.js"
import { HEADLINE_MAX_CHARS, type LinkedInSuggestion } from "./reportRecord.js"

/**
 * LinkedIn başlık ve "Hakkında" önerisi (DOG-69, ikinci adım). Ön yazının
 * kuralı: yalnızca profildeki olgular; doğrulama aynı (sayı ve ilan terimi).
 *
 * Unvan: profilde geçen bir unvan. Hedef rol ancak profilde zaten geçiyorsa
 * başlığa giriyor; geçmiyorsa "o unvandayım" demek olurdu.
 * Beceriler: seçilen ilanlarda istenen ve profilde kanıtı olan kavramlar
 * (skorun eşleşen kavramları), en çok ilanda geçenler önce.
 */
export const LINKEDIN_SUGGEST_PROMPT = `Sana bir adayın LinkedIn profilinden çıkarılmış bilgiler, kullanabileceği
unvanlar ve hedeflediği ilanlarda istenen, profilinde KANITI OLAN beceriler
verilecek. LinkedIn için iki metin yaz.

1. "baslik": LinkedIn başlığı. Biçim: "Unvan | beceri, beceri, beceri".
   - Unvan olarak YALNIZCA "UNVANLAR" satırındakilerden birini kullan.
   - Becerileri YALNIZCA "BECERİLER" satırından seç, en fazla üç.
   - En fazla ${HEADLINE_MAX_CHARS} karakter. Sıfat, slogan, emoji yok.
2. "hakkinda": LinkedIn "Hakkında" bölümü. 60–200 kelime, 3–5 cümle.
   - Kim olduğunu, ne üzerinde çalıştığını ve BECERİLER satırındakileri
     deneyimiyle bağlayarak anlat.
   - YALNIZCA profilde yazan deneyim, sayı ve sonuçları kullan. Yeni bir
     deneyim, beceri, sayı ya da başarı EKLEME. Süreyi tarihlerden HESAPLAMA.
   - "HEDEF" satırı varsa son cümlede ne aradığını yaz ("… rolleri
     arıyorum"); yoksa yazma.
   - Klişe ("tutkulu", "sonuç odaklı", "dinamik", "passionate") yok.

Her iki metin de "DİL" satırındaki dilde olsun. Türkçe ise birinci tekil şahıs.`

const SuggestSchema = z.object({ baslik: z.string(), hakkinda: z.string() })
const suggestJsonSchema = toJsonSchema(SuggestSchema)

/** Seçilen ilanlarda istenen ve profilde kanıtı olan kavramlar. */
export function linkedinStrengths(scored: readonly ScoredPosting[], profile: ResumeProfile, limit = 6): string[] {
  // Anlamsal eşleşme kavramın kelimesini profilde göstermiyor; başlığa yalnızca
  // profilde gerçekten yazanlar girsin ("İngilizce bilen" CV'de yazmıyordu).
  const text = resumeFacts(profile)
  const byTerm = new Map<string, { term: string; postings: Set<string>; must: boolean }>()
  for (const s of scored) {
    const excluded = new Set(s.excluded ?? [])
    s.result.requirements.forEach((r, i) => {
      // Yalnızca beceriler: eğitim, deneyim, dil ve şartlar başlıkta beceri gibi
      // durmuyordu ("İngilizce bilen", "Üniversite mezunu").
      if (excluded.has(i) || r.requirement.type !== "skill") return
      // "GA4 / Google Tag Manager / Looker Studio" gibi kavramlar parçalarına.
      const terms = (r.matchedConcepts ?? []).flatMap((t) => t.split("/")).map((t) => t.trim()).filter((t) => t && t.split(/\s+/).length <= 3)
      for (const term of terms.filter((t) => containsKeyword(text, t))) {
        const key = term.toLocaleLowerCase("tr")
        const e = byTerm.get(key) ?? { term, postings: new Set<string>(), must: false }
        e.postings.add(s.analysisId)
        e.must ||= r.requirement.importance === "must"
        byTerm.set(key, e)
      }
    })
  }
  return [...byTerm.values()]
    .sort((a, b) => b.postings.size - a.postings.size || Number(b.must) - Number(a.must))
    .slice(0, limit)
    .map((e) => e.term)
}

/** Başlıkta kullanılabilecek unvanlar: profildekiler; hedef rol ancak profilde geçiyorsa. */
export function headlineTitles(profile: ResumeProfile, targetRole?: string | null): string[] {
  const titles = [...new Set(profile.experience.map((e) => e.title.trim()).filter(Boolean))].slice(0, 3)
  const text = [profile.headline, profile.summary, ...titles].filter(Boolean).join(" ")
  const target = targetRole?.trim()
  return target && containsKeyword(text, target) ? [target, ...titles.filter((t) => t !== target)] : titles
}

/** Doğrulamanın ilan terimi kontrolü için seçilen ilanların gereksinimleri tek ilanda. */
function mergedPosting(postings: readonly JobPostingData[]): JobPostingData {
  const first = postings[0]!
  return { ...first, requirements: postings.flatMap((p) => p.requirements) }
}

export async function suggestLinkedInText(
  llm: LlmProvider,
  input: { profile: ResumeProfile; scored: readonly ScoredPosting[]; postings: readonly JobPostingData[]; targetRole?: string | null },
): Promise<ExtractResult<{ headline: LinkedInSuggestion; about: LinkedInSuggestion }>> {
  const source = resumeFacts(input.profile)
  const titles = headlineTitles(input.profile, input.targetRole)
  const strengths = linkedinStrengths(input.scored, input.profile)
  const language = resumeLanguage(input.profile) === "en" ? "İngilizce" : "Türkçe"
  const { data, tokens } = await llm.extract({
    prompt: LINKEDIN_SUGGEST_PROMPT,
    schemaName: "linkedin_suggest",
    schema: suggestJsonSchema,
    input: [
      `PROFİL\n${source}`,
      `UNVANLAR: ${titles.join(" · ") || "—"}`,
      `BECERİLER: ${strengths.join(", ") || "—"}`,
      input.targetRole?.trim() ? `HEDEF: ${input.targetRole.trim()}` : null,
      `HEDEFLENEN İLANLAR\n${input.postings.map((p) => postingSummary(p).split("\n")[0]).join("\n")}`,
      `DİL: ${language}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  })
  const parsed = SuggestSchema.parse(data)
  let headline = parsed.baslik.trim().replace(/\s+/g, " ")
  // Sınır kodda: fazlası son ayraçtan kesiliyor.
  if (headline.length > HEADLINE_MAX_CHARS) {
    const cut = headline.slice(0, HEADLINE_MAX_CHARS)
    headline = cut.slice(0, Math.max(cut.lastIndexOf(","), cut.lastIndexOf("|"))).trim().replace(/[|,]$/, "").trim() || cut.trim()
  }
  // Hedef verilmediyse "… arıyorum" cümlesi kullanıcının beyanı değil; model
  // ilan unvanından uyduruyordu.
  const about = input.targetRole?.trim()
    ? parsed.hakkinda.trim()
    : (parsed.hakkinda.match(/[^.!?]+[.!?]+/g) ?? [parsed.hakkinda]).filter((x) => !/arıyorum|arayışındayım|seeking|looking for/i.test(x)).join("").trim() || parsed.hakkinda.trim()
  // Hedef rol kullanıcının kendi beyanı; kaynağa giriyor.
  const checkSource = input.targetRole?.trim() ? `${source}\nHedef: ${input.targetRole.trim()}` : source
  const [h, a] = verifyCoverLetter([headline, about], checkSource, mergedPosting(input.postings))
  return { data: { headline: { text: headline, verification: h!.verification }, about: { text: about, verification: a!.verification } }, tokens }
}
