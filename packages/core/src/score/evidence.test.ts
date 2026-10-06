import { describe, it, expect } from "vitest"
import { collectEvidence } from "./evidence.js"
import type { ResumeProfile } from "../schemas/resume.js"

const PROFILE: ResumeProfile = {
  fullName: "Elif",
  headline: null,
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Frontend Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel geliştirdi", sourceRef: "React ile panel geliştirdi" },
        { text: "Yükleme süresini düşürdü", sourceRef: "Yükleme süresini düşürdü" },
      ],
    },
  ],
  education: [
    { school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", startDate: null, endDate: "2021" },
  ],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce"],
  certifications: [],
}

describe("collectEvidence", () => {
  it("makes each experience bullet separate evidence", () => {
    const bullets = collectEvidence(PROFILE).filter((e) => e.kind === "bullet")
    expect(bullets).toHaveLength(2)
    expect(bullets[0]!.text).toContain("React ile panel")
  })

  it("adds the title of each job as separate evidence", () => {
    const roles = collectEvidence(PROFILE).filter((e) => e.kind === "role")
    expect(roles).toHaveLength(1)
    expect(roles[0]!.text).toBe("Frontend Geliştirici · Acme")
  })

  it("the match text of bullet evidence has no context prefix", () => {
    // Unvan ön eki her maddenin başında tekrarlanıyor. Kelime eşleşmesi buna
    // baksaydı, unvana denk gelen bir anahtar kelime tüm maddelerle eşleşir
    // ve kanıt olarak rastgele biri gösterilirdi.
    const bullet = collectEvidence(PROFILE).find((e) => e.kind === "bullet")!
    expect(bullet.text).toContain("Frontend Geliştirici")
    expect(bullet.matchText).toBe("React ile panel geliştirdi")
    expect(bullet.matchText).not.toContain("Frontend Geliştirici")
  })

  it("text and matchText are equal for context-free evidence", () => {
    const others = collectEvidence(PROFILE).filter((e) => e.kind !== "bullet")
    for (const e of others) expect(e.matchText).toBe(e.text)
  })

  it("adds title and company context to an experience bullet", () => {
    // "panel geliştirdi" tek başına hangi rolde yapıldığını anlatmaz;
    // anlamsal eşleşme bağlamsız maddede zayıflar.
    const first = collectEvidence(PROFILE).find((e) => e.kind === "bullet")!
    expect(first.text).toContain("Frontend Geliştirici")
    expect(first.text).toContain("Acme")
  })

  it("makes each skill separate evidence", () => {
    const skills = collectEvidence(PROFILE).filter((e) => e.kind === "skill")
    expect(skills.map((e) => e.text)).toEqual(["React", "TypeScript"])
  })

  it("adds education as evidence", () => {
    const edu = collectEvidence(PROFILE).filter((e) => e.kind === "education")
    expect(edu).toHaveLength(1)
    expect(edu[0]!.text).toContain("İTÜ")
    expect(edu[0]!.text).toContain("Bilgisayar")
  })

  it("keeps sourceRef on experience bullets and leaves it null elsewhere", () => {
    const all = collectEvidence(PROFILE)
    expect(all.find((e) => e.kind === "bullet")!.sourceRef).toBe("React ile panel geliştirdi")
    expect(all.find((e) => e.kind === "skill")!.sourceRef).toBeNull()
  })

  it("returns an empty array for an empty profile", () => {
    const empty: ResumeProfile = {
      ...PROFILE,
      experience: [],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    }
    expect(collectEvidence(empty)).toEqual([])
  })

  it("adds languages as evidence", () => {
    const langs = collectEvidence(PROFILE).filter((e) => e.kind === "language")
    expect(langs.map((e) => e.text)).toEqual(["İngilizce"])
  })

  it("adds the summary sentence by sentence at the end of the list", () => {
    const evidenceList = collectEvidence({
      ...PROFILE,
      summary: "Performans pazarlamasında 3 yıllık deneyim. Veriye dayalı\nkampanya yönetimi yapıyorum.",
    })
    const summaryText = evidenceList.filter((e) => e.kind === "summary")
    expect(summaryText.map((e) => e.text)).toEqual([
      "Performans pazarlamasında 3 yıllık deneyim.",
      "Veriye dayalı kampanya yönetimi yapıyorum.",
    ])
    expect(evidenceList.slice(-2)).toEqual(summaryText)
  })

  it("keeps skill evidence for a profile with skills but no experience", () => {
    const newGraduate: ResumeProfile = { ...PROFILE, experience: [] }
    const evidenceList = collectEvidence(newGraduate)
    expect(evidenceList.filter((e) => e.kind === "skill")).toHaveLength(2)
    expect(evidenceList.filter((e) => e.kind === "bullet")).toHaveLength(0)
  })
})

describe("collectEvidence · blank fields", () => {
  // Gerçek vaka: ayrıştırıcı cv-b'nin dillerine "" koydu; OpenAI gömme API'si
  // boş girdiyi 400 ile reddetti ve analiz "sorun bizde" hatasıyla düştü.
  it("never produces empty evidence text", () => {
    const evidence = collectEvidence({
      ...PROFILE,
      skills: ["React", "", "  "],
      languages: ["", "İngilizce"],
      education: [{ school: "", degree: null, field: null, startDate: null, endDate: null }],
    } as ResumeProfile)
    expect(evidence.every((e) => e.text.trim().length > 0)).toBe(true)
    expect(evidence.map((e) => e.text)).toContain("İngilizce")
  })
})

