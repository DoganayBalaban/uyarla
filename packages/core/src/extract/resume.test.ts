import { describe, it, expect } from "vitest"
import { extractResumeProfile } from "./resume.js"
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
      { school: "İTÜ", degree: null, field: "Bilgisayar Mühendisliği", endDate: "2021" },
    ],
  },
  resume_skills: {
    lines: [{ label: "Beceriler", items: ["React", "TypeScript"] }],
    languages: [],
    certifications: [],
  },
}

describe("extractResumeProfile", () => {
  it("beceri satırlarını düzleştirip profile koyar", async () => {
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
    const { data } = await extractResumeProfile(llm, "ham cv metni")

    expect(data.skills).toEqual(["Java", "SQL", "Manual Testing"])
    expect(data.languages).toEqual(["İngilizce"])
  })

  it("bölümleme ve blok çıkarımlarını tek profilde birleştirir", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data } = await extractResumeProfile(llm, "ham cv metni")

    expect(data.experience).toHaveLength(1)
    expect(data.experience[0]!.company).toBe("Acme")
    expect(data.education[0]!.school).toBe("İTÜ")
    expect(data.skills).toEqual(["React", "TypeScript"])
    expect(data.summary).toBe("3 yıl React deneyimi")
  })

  it("dört ayrı çağrı yapar: bölümleme + üç blok", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, "ham cv metni")

    expect(llm.calls.map((c) => c.schemaName)).toEqual([
      "resume_segments",
      "resume_experience",
      "resume_education",
      "resume_skills",
    ])
  })

  it("blok çağrılarına ham CV'yi değil, yalnızca ilgili bloğu gönderir", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, "ham cv metni")

    const deneyim = llm.calls.find((c) => c.schemaName === "resume_experience")!
    expect(deneyim.input).toBe((RESPONSES.resume_segments as { experienceBlock: string }).experienceBlock)
    expect(deneyim.input).not.toContain("ham cv metni")
  })

  it("token sayılarını toplar", async () => {
    const llm = fakeLlm(RESPONSES)
    const { tokens } = await extractResumeProfile(llm, "ham cv metni")
    expect(tokens).toBe(40)
  })

  it("boş blok için LLM'i çağırmaz", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_segments: {
        ...(RESPONSES.resume_segments as object),
        educationBlock: "   ",
      },
    })
    const { data } = await extractResumeProfile(llm, "ham cv metni")

    expect(llm.calls.map((c) => c.schemaName)).not.toContain("resume_education")
    expect(data.education).toEqual([])
  })

  it("hiç blok yoksa tek çağrıyla boş profil döner", async () => {
    const llm = fakeLlm({
      resume_segments: {
        summaryBlock: "", experienceBlock: "", educationBlock: "", skillsBlock: "",
      },
    })
    const { data, tokens } = await extractResumeProfile(llm, "bos cv")

    expect(llm.calls).toHaveLength(1)
    expect(data.experience).toEqual([])
    expect(data.summary).toBeNull()
    expect(tokens).toBe(10)
  })

  it("şemaya uymayan çıktıyı reddeder", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_experience: { experience: [{ company: "Acme" }] },
    })
    await expect(extractResumeProfile(llm, "ham cv metni")).rejects.toThrow()
  })
})
