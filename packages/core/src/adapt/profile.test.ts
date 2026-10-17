import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { applyAdaptation, bulletId, projectBulletId } from "./profile.js"

const resumeProfile: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Test yazdım", sourceRef: "Test yazdım" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", startDate: null, endDate: "2021" }],
  skills: ["Excel", "React"],
  languages: ["İngilizce"],
  certifications: ["AWS"],
}

const draftData: AdaptationDraft = {
  summary: {
    original: "Frontend geliştirici",
    rewritten: "React odaklı frontend geliştirici",
    verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: bulletId(0, 0),
      experienceIndex: 0,
      original: "React ile panel yaptım",
      sourceRef: "React ile panel yaptım",
      rewritten: "React ile müşteri panelini geliştirdim",
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
    {
      id: bulletId(0, 1),
      experienceIndex: 0,
      original: "Test yazdım",
      sourceRef: "Test yazdım",
      rewritten: "Birim test altyapısını kurdum",
      verification: { status: "flagged", issues: [{ kind: "semantic_drift", detail: "…" }] },
      decision: "rejected",
    },
  ],
  skillOrder: ["React", "Excel"],
}

describe("bulletId", () => {
  it("produces a stable id from experience and bullet order", () => {
    expect(bulletId(0, 0)).toBe("0-0")
    expect(bulletId(2, 5)).toBe("2-5")
  })
})

describe("applyAdaptation", () => {
  it("replaces an accepted bullet with its rewrite", () => {
    const outcome = applyAdaptation(resumeProfile, draftData)
    expect(outcome.experience[0]!.bullets[0]!.text).toBe("React ile müşteri panelini geliştirdim")
  })

  it("keeps the original for a rejected bullet", () => {
    const outcome = applyAdaptation(resumeProfile, draftData)
    expect(outcome.experience[0]!.bullets[1]!.text).toBe("Test yazdım")
  })

  it("keeps the original for an undecided bullet", () => {
    // pending, henüz onaylanmamış demek; kabul edilmiş gibi davranmak
    // kullanıcının görmediği metni CV'sine koyardı.
    const pending: AdaptationDraft = {
      ...draftData,
      bullets: [{ ...draftData.bullets[0]!, decision: "pending" }],
    }
    expect(applyAdaptation(resumeProfile, pending).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })

  it("always keeps sourceRef", () => {
    // Doğrulamanın kaynağı bu; yeniden yazımla değişmemeli.
    const outcome = applyAdaptation(resumeProfile, draftData)
    expect(outcome.experience[0]!.bullets[0]!.sourceRef).toBe("React ile panel yaptım")
  })

  it("uses an accepted summary", () => {
    expect(applyAdaptation(resumeProfile, draftData).summary).toBe("React odaklı frontend geliştirici")
  })

  it("keeps the original for a rejected summary", () => {
    const red: AdaptationDraft = {
      ...draftData,
      summary: { ...draftData.summary, decision: "rejected" },
    }
    expect(applyAdaptation(resumeProfile, red).summary).toBe("Frontend geliştirici")
  })

  it("leaves summary null for a resume without one", () => {
    // Hat özetsiz CV için boş bir yeniden yazımı "accepted" olarak yazıyor;
    // bu, null özeti "" yapmamalı.
    const withoutSummary: AdaptationDraft = {
      ...draftData,
      summary: { ...draftData.summary, original: null, rewritten: "" },
    }
    expect(applyAdaptation({ ...resumeProfile, summary: null }, withoutSummary).summary).toBeNull()
  })

  it("orders skills as in the draft", () => {
    expect(applyAdaptation(resumeProfile, draftData).skills).toEqual(["React", "Excel"])
  })

  it("does not drop a skill missing from skillOrder", () => {
    // Küme değişmezliği (K-27) burada da korunmalı: eksik bir sıralama
    // sessizce beceri silemez.
    const missing: AdaptationDraft = { ...draftData, skillOrder: ["React"] }
    expect(applyAdaptation(resumeProfile, missing).skills.sort()).toEqual(["Excel", "React"])
  })

  it("does not change education, languages or certifications", () => {
    // Bunlar olgudur; ilana göre değişecek ifade payı yok (spec §6.4).
    const outcome = applyAdaptation(resumeProfile, draftData)
    expect(outcome.education).toEqual(resumeProfile.education)
    expect(outcome.languages).toEqual(resumeProfile.languages)
    expect(outcome.certifications).toEqual(resumeProfile.certifications)
  })

  it("does not mutate the input profile", () => {
    applyAdaptation(resumeProfile, draftData)
    expect(resumeProfile.experience[0]!.bullets[0]!.text).toBe("React ile panel yaptım")
  })

  it("leaves a bullet with no draft counterpart unchanged", () => {
    const empty: AdaptationDraft = { ...draftData, bullets: [] }
    expect(applyAdaptation(resumeProfile, empty).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })
})

describe("applyAdaptation · contributions (DOG-94)", () => {
  const contribution = (over: Partial<NonNullable<AdaptationDraft["contributions"]>[number]> = {}) => ({
    id: "c1",
    requirementIndex: 0,
    experienceIndex: 0,
    answer: "staj projesinde docker compose ile 3 servisi ayağa kaldırdım",
    status: "done" as const,
    text: "Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.",
    verification: { status: "ok" as const, issues: [] },
    decision: "accepted" as const,
    ...over,
  })

  it("appends an accepted contribution to its job, with the user's answer as sourceRef", () => {
    const outcome = applyAdaptation(resumeProfile, { ...draftData, contributions: [contribution()] })
    const bullets = outcome.experience[0]!.bullets
    expect(bullets.at(-1)).toEqual({
      text: "Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.",
      sourceRef: "staj projesinde docker compose ile 3 servisi ayağa kaldırdım",
    })
    expect(bullets).toHaveLength(resumeProfile.experience[0]!.bullets.length + 1)
  })

  it("leaves out rejected, pending, running and empty contributions", () => {
    const skipped = [
      contribution({ id: "a", decision: "rejected" }),
      contribution({ id: "b", decision: "pending" }),
      contribution({ id: "c", status: "running", text: undefined }),
      contribution({ id: "d", text: "" }),
    ]
    const outcome = applyAdaptation(resumeProfile, { ...draftData, contributions: skipped })
    expect(outcome.experience[0]!.bullets).toHaveLength(resumeProfile.experience[0]!.bullets.length)
  })
})

describe("applyAdaptation · project bullets (DOG-105)", () => {
  const withProject: ResumeProfile = {
    ...resumeProfile,
    projects: [
      {
        name: "Asistan",
        role: null,
        startDate: null,
        endDate: null,
        bullets: [
          { text: "Belge asistanı yaptım", sourceRef: "Belge asistanı yaptım" },
          { text: "Arayüz yazdım", sourceRef: "Arayüz yazdım" },
        ],
      },
    ],
  }
  const projectBullet = (j: number, decision: "accepted" | "rejected") => ({
    id: projectBulletId(0, j),
    projectIndex: 0,
    original: withProject.projects![0]!.bullets[j]!.text,
    sourceRef: withProject.projects![0]!.bullets[j]!.sourceRef,
    rewritten: j === 0 ? "RAG ile belge asistanı yaptım" : "React ile arayüz yazdım",
    verification: { status: "ok" as const, issues: [] },
    decision,
  })

  it("uses an accepted project rewrite, keeps a rejected one and never touches sourceRef", () => {
    const draft: AdaptationDraft = { ...draftData, bullets: [...draftData.bullets, projectBullet(0, "accepted"), projectBullet(1, "rejected")] }
    const bullets = applyAdaptation(withProject, draft).projects![0]!.bullets
    expect(bullets.map((b) => b.text)).toEqual(["RAG ile belge asistanı yaptım", "Arayüz yazdım"])
    expect(bullets[0]!.sourceRef).toBe("Belge asistanı yaptım")
  })

  it("gives project bullets ids that cannot collide with experience bullets", () => {
    expect(projectBulletId(0, 0)).toBe("p0-0")
    expect(projectBulletId(0, 0)).not.toBe(bulletId(0, 0))
  })

  it("adds no projects field to a profile that had none", () => {
    expect(applyAdaptation(resumeProfile, draftData)).not.toHaveProperty("projects")
  })
})
