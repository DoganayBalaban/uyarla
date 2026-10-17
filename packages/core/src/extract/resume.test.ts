import { describe, it, expect } from "vitest"
import { extractResumeProfile, resumeParserKey } from "./resume.js"
import type { ExtractOptions, LlmProvider } from "../llm/types.js"

/** Şema adına göre önceden belirlenmiş yanıt döndüren sahte sağlayıcı. */
function fakeLlm(
  responses: Record<string, unknown>,
): LlmProvider & { calls: ExtractOptions[] } {
  const calls: ExtractOptions[] = []
  return {
    calls,
    async extract<T>(opts: ExtractOptions) {
      calls.push(opts)
      const data = responses[opts.schemaName]
      if (data === undefined) throw new Error(`beklenmeyen şema: ${opts.schemaName}`)
      return { data: data as T, tokens: 10 }
    },
  }
}

const RESPONSES: Record<string, unknown> = {
  resume_segments: {
    headerBlock: "Elif Yılmaz\nFrontend Geliştirici",
    summaryBlock: "3 yıl React deneyimi",
    experienceBlock: "Acme · Frontend Geliştirici · 2022-01 – halen\n- React ile arayüz geliştirdi",
    educationBlock: "İTÜ, Bilgisayar Mühendisliği, 2021",
    skillsBlock: "React, TypeScript",
  },
  resume_experience: {
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
  },
  resume_education: {
    education: [
      { school: "İTÜ", degree: null, field: "Bilgisayar Mühendisliği", startDate: null, endDate: "2021" },
    ],
  },
  resume_skills: {
    lines: [{ label: "Beceriler", items: ["React", "TypeScript"] }],
    languages: [],
    certifications: [],
  },
}

describe("extractResumeProfile · with LLM segmentation", () => {
  it("flattens skill lines into the profile", async () => {
    // Model satırları kopyalıyor, "hangisi beceri" kararı kodda veriliyor (K-19).
    const llm = fakeLlm({
      ...RESPONSES,
      resume_skills: {
        lines: [
          { label: "Technical Skills", items: [] },
          { label: "Diller", items: ["Java", "SQL"] },
          { label: "Manual Testing", items: ["Performing regression testing."] },
        ],
        languages: ["İngilizce"],
        certifications: [],
      },
    })
    const { data } = await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })

    expect(data.skills).toEqual(["Java", "SQL", "Manual Testing"])
    expect(data.languages).toEqual(["İngilizce"])
  })

  it("merges segmentation and block extractions into one profile", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data } = await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })

    expect(data.experience).toHaveLength(1)
    expect(data.experience[0]!.company).toBe("Acme")
    expect(data.education[0]!.school).toBe("İTÜ")
    expect(data.skills).toEqual(["React", "TypeScript"])
    expect(data.summary).toBe("3 yıl React deneyimi")
  })

  it("makes four separate calls: segmentation + three blocks", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })

    expect(llm.calls.map((c) => c.schemaName)).toEqual([
      "resume_segments",
      "resume_experience",
      "resume_education",
      "resume_skills",
    ])
  })

  it("sends block calls only the relevant block, not the raw resume", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })

    const experienceEntry = llm.calls.find((c) => c.schemaName === "resume_experience")!
    expect(experienceEntry.input).toBe((RESPONSES.resume_segments as { experienceBlock: string }).experienceBlock)
    expect(experienceEntry.input).not.toContain("ham cv metni")
  })

  it("sums token counts", async () => {
    const llm = fakeLlm(RESPONSES)
    const { tokens } = await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })
    expect(tokens).toBe(40)
  })

  it("does not call the LLM for an empty block", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_segments: {
        ...(RESPONSES.resume_segments as object),
        educationBlock: "   ",
      },
    })
    const { data } = await extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })

    expect(llm.calls.map((c) => c.schemaName)).not.toContain("resume_education")
    expect(data.education).toEqual([])
  })

  it("returns an empty profile with a single call when there are no blocks", async () => {
    const llm = fakeLlm({
      resume_segments: {
        headerBlock: "", summaryBlock: "", experienceBlock: "", educationBlock: "", skillsBlock: "",
      },
    })
    const { data, tokens } = await extractResumeProfile(llm, "bos cv", { segmenter: "llm" })

    expect(llm.calls).toHaveLength(1)
    expect(data.experience).toEqual([])
    expect(data.summary).toBeNull()
    expect(tokens).toBe(10)
  })

  it("rejects output that does not match the schema", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_experience: { experience: [{ company: "Acme" }] },
    })
    await expect(extractResumeProfile(llm, "ham cv metni", { segmenter: "llm" })).rejects.toThrow()
  })
})

describe("extractResumeProfile · with code segmentation (default)", () => {
  const CV = `PROFILE
3 yıldır React ile arayüz geliştiriyorum.

EXPERIENCE
Acme · Frontend Geliştirici · 2022 – halen
- React ile panel geliştirdim

EDUCATION
Bir Üniversite, Bilgisayar Mühendisliği, 2021

TECHNICAL SKILLS
Frontend: React, TypeScript

ADDITIONAL
References available on request`

  it("makes no LLM call for segmentation", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, CV)

    expect(llm.calls.map((c) => c.schemaName)).not.toContain("resume_segments")
    expect(llm.calls).toHaveLength(3)
  })

  it("sends each block call only its own section", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, CV)

    const skill = llm.calls.find((c) => c.schemaName === "resume_skills")!
    expect(skill.input).toContain("TECHNICAL SKILLS")
    expect(skill.input).toContain("React, TypeScript")
    // ADDITIONAL yoksayılan bir bölüm; beceri bloğuna girmemeli.
    expect(skill.input).not.toContain("References available")
    // Deneyim bloğu da beceri bloğuna sızmamalı.
    expect(skill.input).not.toContain("Acme")
  })

  it("runs the block calls concurrently", async () => {
    // Üç blok birbirinden bağımsız; sıralı çağrı CV okumasını ~3 kat uzatıyordu (DOG-28).
    let inFlight = 0
    let peak = 0
    const llm: LlmProvider = {
      async extract<T>(opts: ExtractOptions) {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return { data: RESPONSES[opts.schemaName] as T, tokens: 10 }
      },
    }

    const { tokens } = await extractResumeProfile(llm, CV)

    expect(peak).toBe(3)
    expect(tokens).toBe(30)
  })

  it("takes the summary from code segmentation", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data } = await extractResumeProfile(llm, CV)
    expect(data.summary).toContain("React ile arayüz geliştiriyorum")
  })
})

describe("resumeParserKey", () => {
  it("is stable for the same model", () => {
    expect(resumeParserKey("gpt-4.1-mini")).toBe(resumeParserKey("gpt-4.1-mini"))
  })

  it("changes with the model", () => {
    // Başka modelin ayrıştırdığı profil yeniden kullanılmamalı (DOG-59).
    expect(resumeParserKey("gpt-4.1-mini")).not.toBe(resumeParserKey("gpt-4.1"))
  })
})

describe("extractResumeProfile · projects and other sections (DOG-105)", () => {
  const cv = [
    "Ada Yılmaz",
    "ada@ornek.com",
    "EXPERIENCE",
    "Acme — Intern | 2024",
    "• Built dashboards.",
    "PROJECTS",
    "Yeni Nesil Asistan — Enterprise document assistant with RAG.",
    "EDUCATION",
    "Bir Üniversite — B.Sc. Software Engineering",
    "SKILLS",
    "Python, React",
    "HONORS",
    "Dean's list 2023",
  ].join("\n")
  const project = {
    name: "Yeni Nesil Asistan",
    role: null,
    startDate: null,
    endDate: null,
    bullets: [{ text: "Enterprise document assistant with RAG.", sourceRef: "Enterprise document assistant with RAG." }],
  }

  it("extracts projects from their own block and keeps other sections as they are", async () => {
    const llm = fakeLlm({ ...RESPONSES, resume_projects: { projects: [project] } })
    const { data } = await extractResumeProfile(llm, cv)
    expect(data.projects).toEqual([project])
    expect(data.otherSections).toEqual([{ heading: "HONORS", lines: ["Dean's list 2023"] }])
    const projectCall = llm.calls.find((c) => c.schemaName === "resume_projects")!
    expect(projectCall.input).toContain("Yeni Nesil Asistan")
    expect(llm.calls.find((c) => c.schemaName === "resume_experience")!.input).not.toContain("Yeni Nesil Asistan")
  })

  it("makes no projects call for a resume without a projects section", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data } = await extractResumeProfile(llm, cv.replace(/PROJECTS\n.*\n/, ""))
    expect(llm.calls.some((c) => c.schemaName === "resume_projects")).toBe(false)
    expect(data.projects).toEqual([])
  })
})
