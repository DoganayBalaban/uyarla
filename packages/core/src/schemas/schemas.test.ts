import { describe, it, expect } from "vitest"
import { ResumeProfileSchema, resumeProfileJsonSchema, experienceListJsonSchema } from "./resume.js"
import { JobPostingSchema, jobPostingJsonSchema } from "./job.js"

/** LM Studio'nun strict kısıtı: her alan required, ek alan yok, $schema yok. */
function assertStrictCompatible(schema: Record<string, unknown>) {
  const props = Object.keys(schema.properties as Record<string, unknown>)
  expect((schema.required as string[]).sort()).toEqual(props.sort())
  expect(schema.additionalProperties).toBe(false)
  expect(schema).not.toHaveProperty("$schema")
}

describe("resume profile schema", () => {
  const valid = {
    fullName: "Elif Yılmaz",
    headline: "Frontend Geliştirici",
    summary: "3 yıl React deneyimi",
    experience: [
      {
        company: "Acme",
        title: "Frontend Geliştirici",
        startDate: "2022-01",
        endDate: "halen",
        bullets: [
          { text: "React ile arayüz geliştirdi", sourceRef: "React ile arayüz geliştirdi" },
        ],
      },
    ],
    education: [
      { school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", startDate: "2017", endDate: "2021" },
    ],
    skills: ["React", "TypeScript"],
    languages: ["Türkçe", "İngilizce"],
    certifications: [],
  }

  it("accepts a valid profile", () => {
    expect(ResumeProfileSchema.parse(valid)).toEqual(valid)
  })

  it("accepts null when information is missing", () => {
    const missing = { ...valid, fullName: null, headline: null, summary: null }
    expect(ResumeProfileSchema.parse(missing).fullName).toBeNull()
  })

  it("sourceRef is required on an experience bullet", () => {
    expect(() =>
      ResumeProfileSchema.parse({
        ...valid,
        experience: [{ ...valid.experience[0], bullets: [{ text: "bir şey yaptı" }] }],
      }),
    ).toThrow()
  })

  it("JSON Schema is strict-compatible", () => {
    assertStrictCompatible(resumeProfileJsonSchema)
    assertStrictCompatible(experienceListJsonSchema)
  })

  it("extra fields are forbidden in nested objects too", () => {
    // JSON Schema ağacında gezinmek için asgari yapı tanımı; `any` yerine.
    interface DocxNode {
      additionalProperties?: boolean
      properties?: Record<string, DocxNode>
      items?: DocxNode
    }
    const stem = experienceListJsonSchema as unknown as DocxNode
    const experienceEntry = stem.properties?.experience?.items
    expect(experienceEntry?.additionalProperties).toBe(false)
    expect(experienceEntry?.properties?.bullets?.items?.additionalProperties).toBe(false)
  })
})

describe("posting schema", () => {
  const valid = {
    position: "Frontend Geliştirici",
    company: "Acme",
    seniority: "mid" as const,
    language: "tr" as const,
    requirements: [
      { text: "3 yıl React deneyimi", type: "experience" as const, importance: "must" as const, concepts: [{ term: "react", synonyms: ["react"] }] },
      { text: "Takım çalışmasına yatkın", type: "soft" as const, importance: "nice" as const, concepts: [{ term: "takım çalışması", synonyms: ["takım çalışması"] }] },
    ],
  }

  it("parses requirements with type and importance", () => {
    expect(JobPostingSchema.parse(valid)).toEqual(valid)
  })

  it("company and seniority may be null when unknown", () => {
    expect(JobPostingSchema.parse({ ...valid, company: null, seniority: null }).company).toBeNull()
  })

  it("rejects an undefined importance value", () => {
    expect(() =>
      JobPostingSchema.parse({
        ...valid,
        requirements: [{ text: "a", type: "skill", importance: "belki", concepts: [] }],
      }),
    ).toThrow()
  })

  it("JSON Schema is strict-compatible", () => {
    assertStrictCompatible(jobPostingJsonSchema)
  })
})
