import type { ExtractResult, LlmProvider } from "../llm/types.js"
import {
  EducationListSchema,
  ExperienceListSchema,
  ResumeProfileSchema,
  ResumeSegmentsSchema,
  SkillLinesSchema,
  educationListJsonSchema,
  experienceListJsonSchema,
  resumeSegmentsJsonSchema,
  skillLinesJsonSchema,
} from "../schemas/resume.js"
import type { ResumeProfile, SkillLines } from "../schemas/resume.js"
import { parseHeader } from "./header.js"
import { segmentResume, stripLeadingHeading } from "./segment.js"
import { flattenSkillLines } from "./skills.js"
import {
  EDUCATION_PROMPT,
  EXPERIENCE_PROMPT,
  SEGMENT_PROMPT,
  SKILLS_PROMPT,
} from "./prompts.js"

const BOS_BECERI = { skills: [], languages: [], certifications: [] }

/**
 * Satır transkripsiyonunu profilin beklediği düz beceri listesine çevirir.
 * "Hangisi beceri" kararı kodda veriliyor, modelde değil (K-19).
 */
function duzlestir(lines: SkillLines) {
  return {
    skills: flattenSkillLines(lines),
    languages: lines.languages,
    certifications: lines.certifications,
  }
}

/**
 * İki aşamalı çıkarım (spec §6.3): önce kaba bölümleme, sonra blok başına
 * kısa ve odaklı çağrı. Küçük modellerde uzun tek çağrının kalitesi hızla
 * düşüyor.
 *
 * Çağrılar sıralı (K-09). Paralelleştirme Görev 13'te değerlendirme
 * setinin süre verisiyle yeniden ele alınacak.
 */
export interface ExtractResumeOptions {
  /**
   * Bölümlemenin nasıl yapılacağı.
   *
   * "code" varsayılan: başlıkları düzenli ifadeyle tanır, deterministiktir,
   * bir LLM çağrısı tasarruf ettirir. "llm" karşılaştırma için duruyor —
   * ikisi aynı değerlendirme setinde ölçülebilsin diye.
   */
  segmenter?: "code" | "llm"
}

export async function extractResumeProfile(
  llm: LlmProvider,
  rawText: string,
  options: ExtractResumeOptions = {},
): Promise<ExtractResult<ResumeProfile>> {
  let tokens = 0

  let blocks
  if (options.segmenter === "llm") {
    const segments = await llm.extract({
      prompt: SEGMENT_PROMPT,
      schemaName: "resume_segments",
      schema: resumeSegmentsJsonSchema,
      input: rawText,
    })
    tokens += segments.tokens
    blocks = ResumeSegmentsSchema.parse(segments.data)
  } else {
    blocks = segmentResume(rawText)
  }

  // Boş bloklar için çağrı yapılmaz: hem süre hem gereksiz uydurma riski.
  const experience = blocks.experienceBlock.trim()
    ? await llm.extract({
        prompt: EXPERIENCE_PROMPT,
        schemaName: "resume_experience",
        schema: experienceListJsonSchema,
        input: blocks.experienceBlock,
      })
    : null
  if (experience) tokens += experience.tokens

  const education = blocks.educationBlock.trim()
    ? await llm.extract({
        prompt: EDUCATION_PROMPT,
        schemaName: "resume_education",
        schema: educationListJsonSchema,
        input: blocks.educationBlock,
      })
    : null
  if (education) tokens += education.tokens

  const skills = blocks.skillsBlock.trim()
    ? await llm.extract({
        prompt: SKILLS_PROMPT,
        schemaName: "resume_skills",
        schema: skillLinesJsonSchema,
        input: blocks.skillsBlock,
      })
    : null
  if (skills) tokens += skills.tokens

  // Ad ve başlık kodda çıkarılıyor, LLM'e sorulmuyor: deterministik bir iş
  // ve kırıldığında testler kırmızıya dönüyor (bkz. parseHeader).
  const header = parseHeader(blocks.headerBlock)

  const profile = ResumeProfileSchema.parse({
    fullName: header.fullName,
    headline: header.headline,
    summary: stripLeadingHeading(blocks.summaryBlock) || null,
    experience: experience ? ExperienceListSchema.parse(experience.data).experience : [],
    education: education ? EducationListSchema.parse(education.data).education : [],
    ...(skills ? duzlestir(SkillLinesSchema.parse(skills.data)) : BOS_BECERI),
  })

  return { data: profile, tokens }
}
