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
    { school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", endDate: "2021" },
  ],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce"],
  certifications: [],
}

describe("collectEvidence", () => {
  it("her deneyim maddesini ayrı kanıt yapar", () => {
    const bullets = collectEvidence(PROFILE).filter((e) => e.kind === "bullet")
    expect(bullets).toHaveLength(2)
    expect(bullets[0]!.text).toContain("React ile panel")
  })

  it("her iş için unvanı ayrı bir kanıt olarak ekler", () => {
    const roller = collectEvidence(PROFILE).filter((e) => e.kind === "role")
    expect(roller).toHaveLength(1)
    expect(roller[0]!.text).toBe("Frontend Geliştirici · Acme")
  })

  it("madde kanıtında eşleşme metni bağlam ön eki taşımaz", () => {
    // Unvan ön eki her maddenin başında tekrarlanıyor. Kelime eşleşmesi buna
    // baksaydı, unvana denk gelen bir anahtar kelime tüm maddelerle eşleşir
    // ve kanıt olarak rastgele biri gösterilirdi.
    const bullet = collectEvidence(PROFILE).find((e) => e.kind === "bullet")!
    expect(bullet.text).toContain("Frontend Geliştirici")
    expect(bullet.matchText).toBe("React ile panel geliştirdi")
    expect(bullet.matchText).not.toContain("Frontend Geliştirici")
  })

  it("bağlamsız kanıtlarda text ve matchText aynıdır", () => {
    const digerleri = collectEvidence(PROFILE).filter((e) => e.kind !== "bullet")
    for (const e of digerleri) expect(e.matchText).toBe(e.text)
  })

  it("deneyim maddesine unvan ve kurum bağlamını ekler", () => {
    // "panel geliştirdi" tek başına hangi rolde yapıldığını anlatmaz;
    // anlamsal eşleşme bağlamsız maddede zayıflar.
    const first = collectEvidence(PROFILE).find((e) => e.kind === "bullet")!
    expect(first.text).toContain("Frontend Geliştirici")
    expect(first.text).toContain("Acme")
  })

  it("her beceriyi ayrı kanıt yapar", () => {
    const skills = collectEvidence(PROFILE).filter((e) => e.kind === "skill")
    expect(skills.map((e) => e.text)).toEqual(["React", "TypeScript"])
  })

  it("eğitimi kanıt olarak ekler", () => {
    const edu = collectEvidence(PROFILE).filter((e) => e.kind === "education")
    expect(edu).toHaveLength(1)
    expect(edu[0]!.text).toContain("İTÜ")
    expect(edu[0]!.text).toContain("Bilgisayar")
  })

  it("sourceRef'i deneyim maddelerinde korur, diğerlerinde null bırakır", () => {
    const all = collectEvidence(PROFILE)
    expect(all.find((e) => e.kind === "bullet")!.sourceRef).toBe("React ile panel geliştirdi")
    expect(all.find((e) => e.kind === "skill")!.sourceRef).toBeNull()
  })

  it("boş profilde boş dizi döner", () => {
    const bos: ResumeProfile = {
      ...PROFILE,
      experience: [],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    }
    expect(collectEvidence(bos)).toEqual([])
  })

  it("deneyimi olmayan ama becerisi olan profilde beceri kanıtları kalır", () => {
    const yeniMezun: ResumeProfile = { ...PROFILE, experience: [] }
    const kanitlar = collectEvidence(yeniMezun)
    expect(kanitlar.filter((e) => e.kind === "skill")).toHaveLength(2)
    expect(kanitlar.filter((e) => e.kind === "bullet")).toHaveLength(0)
  })
})
