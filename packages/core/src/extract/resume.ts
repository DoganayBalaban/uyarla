import { createHash } from "node:crypto"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import {
  EducationListSchema,
  ExperienceListSchema,
  ProjectListSchema,
  ResumeProfileSchema,
  ResumeSegmentsSchema,
  SkillLinesSchema,
  educationListJsonSchema,
  experienceListJsonSchema,
  projectListJsonSchema,
  resumeSegmentsJsonSchema,
  skillLinesJsonSchema,
} from "../schemas/resume.js"
import type { ResumeProfile, SkillLines } from "../schemas/resume.js"
import { parseHeader } from "./header.js"
import { segmentResume, stripLeadingHeading } from "./segment.js"
import { flattenSkillLines, skillGroups } from "./skills.js"
import {
  EDUCATION_PROMPT,
  EXPERIENCE_PROMPT,
  PROJECTS_PROMPT,
  SEGMENT_PROMPT,
  SKILLS_PROMPT,
} from "./prompts.js"

const EMPTY_SKILLS = { skills: [], languages: [], certifications: [] }

/**
 * Satır transkripsiyonunu profilin beklediği düz beceri listesine çevirir.
 * "Hangisi beceri" kararı kodda veriliyor, modelde değil (K-19).
 */
function flatten(lines: SkillLines) {
  const groups = skillGroups(lines)
  return {
    skills: flattenSkillLines(lines),
    // Belgenin düzeni için CV'nin kendi kategorileri (DOG-106).
    ...(groups ? { skillGroups: groups } : {}),
    languages: lines.languages,
    certifications: lines.certifications,
  }
}

/**
 * İki aşamalı çıkarım (spec §6.3): önce kaba bölümleme, sonra blok başına
 * kısa ve odaklı çağrı. Küçük modellerde uzun tek çağrının kalitesi hızla
 * düşüyor.
 *
 * Blok çağrıları paralel (DOG-28). K-09'da yerel model aynı anda tek istek
 * işleyebildiği için sıralıydı; barındırılan modelde üç blok birbirini
 * beklemiyor ve CV okuması ~4,7 sn'den en uzun bloğun süresine iniyor.
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
    // LLM bölümleyicisi yalnızca karşılaştırma için; projeleri ayırmıyor.
    blocks = {
      ...ResumeSegmentsSchema.parse(segments.data),
      projectsBlock: "",
      otherSections: [],
      sectionOrder: undefined,
    }
  } else {
    blocks = segmentResume(rawText)
  }

  // Boş bloklar için çağrı yapılmaz: hem süre hem gereksiz uydurma riski.
  const [experience, projects, education, skills] = await Promise.all([
    blocks.experienceBlock.trim()
      ? llm.extract({
          prompt: EXPERIENCE_PROMPT,
          schemaName: "resume_experience",
          schema: experienceListJsonSchema,
          input: blocks.experienceBlock,
        })
      : null,
    blocks.projectsBlock.trim()
      ? llm.extract({
          prompt: PROJECTS_PROMPT,
          schemaName: "resume_projects",
          schema: projectListJsonSchema,
          input: blocks.projectsBlock,
        })
      : null,
    blocks.educationBlock.trim()
      ? llm.extract({
          prompt: EDUCATION_PROMPT,
          schemaName: "resume_education",
          schema: educationListJsonSchema,
          input: blocks.educationBlock,
        })
      : null,
    blocks.skillsBlock.trim()
      ? llm.extract({
          prompt: SKILLS_PROMPT,
          schemaName: "resume_skills",
          schema: skillLinesJsonSchema,
          input: blocks.skillsBlock,
        })
      : null,
  ])
  for (const call of [experience, projects, education, skills]) if (call) tokens += call.tokens

  // Ad ve başlık kodda çıkarılıyor, LLM'e sorulmuyor: deterministik bir iş
  // ve kırıldığında testler kırmızıya dönüyor (bkz. parseHeader).
  const header = parseHeader(blocks.headerBlock)

  const profile = ResumeProfileSchema.parse({
    fullName: header.fullName,
    headline: header.headline,
    // PDF satır sonları cümle ortasında kalıyor; özet düz yazıdır (K-38).
    summary: stripLeadingHeading(blocks.summaryBlock).replace(/\s*\n\s*/g, " ").trim() || null,
    experience: experience ? ExperienceListSchema.parse(experience.data).experience : [],
    education: education ? EducationListSchema.parse(education.data).education : [],
    ...(skills ? flatten(SkillLinesSchema.parse(skills.data)) : EMPTY_SKILLS),
    projects: projects ? ProjectListSchema.parse(projects.data).projects : [],
    // Yorumlanmadan, olduğu gibi (DOG-105).
    otherSections: blocks.otherSections,
    // CV'deki bölüm sırası; belge buna yakın kalıyor (DOG-106).
    ...(blocks.sectionOrder ? { sectionOrder: blocks.sectionOrder } : {}),
  })

  return { data: profile, tokens }
}

/**
 * Ayrıştırma kodunda ya da prompt'larda yorum değiştiren bir düzeltme
 * yapıldığında artırılır: eski profiller yeniden kullanılmaz, CV bir kez daha
 * okunur (DOG-59). Prompt ve şema değişiklikleri anahtara kendiliğinden giriyor.
 */
// 2: Europass, LinkedIn ve tablolu şablon bölümlemesi (DOG-60, K-49).
// 3: Projeler ve diğer bölümler artık kaybolmuyor (DOG-105).
// 4: Beceri kategorileri ve bölüm sırası saklanıyor (DOG-106).
// 5: İki sütunlu şablonda özet ve iletişim satırı kaybolmuyor (DOG-107).
const RESUME_PARSER_REVISION = 5

/**
 * Kayıtlı bir CV'nin ayrıştırılmış profili, aynı anahtarla üretildiyse yeniden
 * kullanılıyor. Model, prompt ya da şema değişince anahtar da değişiyor.
 */
export function resumeParserKey(modelId: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        RESUME_PARSER_REVISION,
        modelId,
        EXPERIENCE_PROMPT,
        PROJECTS_PROMPT,
        EDUCATION_PROMPT,
        SKILLS_PROMPT,
        experienceListJsonSchema,
        projectListJsonSchema,
        educationListJsonSchema,
        skillLinesJsonSchema,
      ]),
    )
    .digest("hex")
    .slice(0, 16)
}
