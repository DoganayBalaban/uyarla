import { describe, it, expect } from "vitest"
import { ResumeProfileSchema, resumeProfileJsonSchema, experienceListJsonSchema } from "./resume.js"
import { JobPostingSchema, jobPostingJsonSchema } from "./job.js"

/** LM Studio'nun strict kısıtı: her alan required, ek alan yok, $schema yok. */
function assertStrictUyumlu(schema: Record<string, unknown>) {
  const props = Object.keys(schema.properties as Record<string, unknown>)
  expect((schema.required as string[]).sort()).toEqual(props.sort())
  expect(schema.additionalProperties).toBe(false)
  expect(schema).not.toHaveProperty("$schema")
}

describe("CV profili şeması", () => {
  const gecerli = {
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
    education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", endDate: "2021" }],
    skills: ["React", "TypeScript"],
    languages: ["Türkçe", "İngilizce"],
    certifications: [],
  }

  it("geçerli bir profili kabul eder", () => {
    expect(ResumeProfileSchema.parse(gecerli)).toEqual(gecerli)
  })

  it("bilgi yoksa null kabul eder", () => {
    const eksik = { ...gecerli, fullName: null, headline: null, summary: null }
    expect(ResumeProfileSchema.parse(eksik).fullName).toBeNull()
  })

  it("deneyim maddesinde sourceRef zorunludur", () => {
    expect(() =>
      ResumeProfileSchema.parse({
        ...gecerli,
        experience: [{ ...gecerli.experience[0], bullets: [{ text: "bir şey yaptı" }] }],
      }),
    ).toThrow()
  })

  it("JSON Schema strict uyumlu", () => {
    assertStrictUyumlu(resumeProfileJsonSchema)
    assertStrictUyumlu(experienceListJsonSchema)
  })

  it("iç içe nesnelerde de ek alan yasak", () => {
    // JSON Schema ağacında gezinmek için asgari yapı tanımı; `any` yerine.
    interface Dugum {
      additionalProperties?: boolean
      properties?: Record<string, Dugum>
      items?: Dugum
    }
    const kok = experienceListJsonSchema as unknown as Dugum
    const deneyim = kok.properties?.experience?.items
    expect(deneyim?.additionalProperties).toBe(false)
    expect(deneyim?.properties?.bullets?.items?.additionalProperties).toBe(false)
  })
})

describe("İlan şeması", () => {
  const gecerli = {
    position: "Frontend Geliştirici",
    company: "Acme",
    seniority: "mid" as const,
    language: "tr" as const,
    requirements: [
      { text: "3 yıl React deneyimi", type: "experience" as const, importance: "must" as const, concepts: [{ term: "react", synonyms: ["react"] }] },
      { text: "Takım çalışmasına yatkın", type: "soft" as const, importance: "nice" as const, concepts: [{ term: "takım çalışması", synonyms: ["takım çalışması"] }] },
    ],
  }

  it("gereksinimleri tür ve önem bilgisiyle ayrıştırır", () => {
    expect(JobPostingSchema.parse(gecerli)).toEqual(gecerli)
  })

  it("şirket ve kıdem bilinmiyorsa null olabilir", () => {
    expect(JobPostingSchema.parse({ ...gecerli, company: null, seniority: null }).company).toBeNull()
  })

  it("tanımsız önem değerini reddeder", () => {
    expect(() =>
      JobPostingSchema.parse({
        ...gecerli,
        requirements: [{ text: "a", type: "skill", importance: "belki", concepts: [] }],
      }),
    ).toThrow()
  })

  it("JSON Schema strict uyumlu", () => {
    assertStrictUyumlu(jobPostingJsonSchema)
  })
})
