import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { applyAdaptation, bulletId } from "./profile.js"

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
