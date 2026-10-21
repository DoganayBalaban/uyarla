import { describe, expect, it } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import {
  addUserBullet,
  addUserSection,
  hideSection,
  jobBullets,
  moveBullet,
  moveSection,
  relocateBullet,
  removeBullet,
  removeUserSection,
  renameSection,
  restoreBullet,
  restoreSection,
} from "./bullets.js"
import { toDocumentModel } from "../document/model.js"
import { applyAdaptation } from "./profile.js"

const profile: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Sayfa açılışını %30 hızlandırdım", sourceRef: "Sayfa açılışını %30 hızlandırdım" },
      ],
    },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}

const posting = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: "mid",
  language: "tr",
  requirements: [{ text: "Kubernetes deneyimi", type: "skill", importance: "must", concepts: [{ term: "Kubernetes", synonyms: [] }] }],
} as unknown as JobPostingData

const draft: AdaptationDraft = {
  summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "rejected" },
  bullets: [],
  skillOrder: [],
}

const texts = (d: AdaptationDraft) => applyAdaptation(profile, d).experience[0]!.bullets.map((b) => b.text)

describe("bullet editor (DOG-92)", () => {
  it("adds the user's bullet at the end of the job and checks it like an edit", () => {
    const out = addUserBullet(draft, 0, "  React panelinde  erişilebilirliği iyileştirdim ", { profile, posting })
    expect(out.userBullets).toEqual([
      { id: "u1", experienceIndex: 0, text: "React panelinde erişilebilirliği iyileştirdim", verification: { status: "ok", issues: [] } },
    ])
    expect(texts(out).at(-1)).toBe("React panelinde erişilebilirliği iyileştirdim")
    // CV'de olmayan ilan terimi uyarı alıyor ama ekleniyor.
    const flagged = addUserBullet(out, 0, "Kubernetes kümesi kurdum", { profile, posting })
    expect(flagged.userBullets?.[1]).toMatchObject({ id: "u2", verification: { status: "flagged" } })
    expect(() => addUserBullet(draft, 3, "metin", { profile, posting })).toThrow()
    expect(() => addUserBullet(draft, 0, "  ", { profile, posting })).toThrow()
  })

  it("removes a CV bullet reversibly and deletes the user's own bullet", () => {
    const removed = removeBullet(draft, "0-0")
    expect(texts(removed)).toEqual(["Sayfa açılışını %30 hızlandırdım"])
    expect(jobBullets(profile, removed, 0)[0]).toMatchObject({ id: "0-0", removed: true })
    expect(texts(restoreBullet(removed, "0-0"))).toHaveLength(2)

    const added = addUserBullet(draft, 0, "Yeni madde", { profile, posting })
    expect(removeBullet(added, "u1").userBullets).toEqual([])
  })

  it("keeps removals when the one-page strategy resets its own omissions", () => {
    const d = { ...removeBullet(draft, "0-1"), omitted: ["0-0"] }
    expect(texts(d)).toEqual([])
    expect(texts({ ...d, omitted: [] })).toEqual(["React ile panel yaptım"])
  })

  it("moves bullets within the job, new ones stay at the end", () => {
    const added = addUserBullet(draft, 0, "Yeni madde", { profile, posting })
    const moved = moveBullet(added, profile, 0, "u1", "up")
    expect(texts(moved)).toEqual(["React ile panel yaptım", "Yeni madde", "Sayfa açılışını %30 hızlandırdım"])
    // Sınırda değişmiyor.
    expect(moveBullet(moved, profile, 0, "0-0", "up")).toBe(moved)
    // Sıradan sonra eklenen madde sonda.
    const again = addUserBullet(moved, 0, "Bir madde daha", { profile, posting })
    expect(texts(again).at(-1)).toBe("Bir madde daha")
    expect(() => moveBullet(draft, profile, 0, "9-9", "down")).toThrow()
  })
})

describe("projects and sections (DOG-92, sixth step)", () => {
  const withProject: ResumeProfile = {
    ...profile,
    projects: [{ name: "Panel", role: null, startDate: null, endDate: null, bullets: [{ text: "Grafik bileşeni", sourceRef: "Grafik bileşeni" }] }],
  } as ResumeProfile
  const projectTexts = (d: AdaptationDraft) => applyAdaptation(withProject, d).projects![0]!.bullets.map((b) => b.text)

  it("adds, moves and removes project bullets like job bullets", () => {
    const added = addUserBullet(draft, { kind: "project", index: 0 }, "Testlerini yazdım", { profile: withProject, posting })
    expect(added.userBullets?.[0]).toMatchObject({ id: "u1", projectIndex: 0 })
    expect(added.userBullets?.[0]).not.toHaveProperty("experienceIndex")
    // Proje maddesi işe karışmıyor.
    expect(applyAdaptation(withProject, added).experience[0]!.bullets).toHaveLength(2)
    expect(projectTexts(added)).toEqual(["Grafik bileşeni", "Testlerini yazdım"])
    const moved = moveBullet(added, withProject, { kind: "project", index: 0 }, "u1", "up")
    expect(moved.bulletOrder).toEqual({ p0: ["u1", "p0-0"] })
    expect(projectTexts(moved)).toEqual(["Testlerini yazdım", "Grafik bileşeni"])
    expect(projectTexts(removeBullet(moved, "p0-0"))).toEqual(["Testlerini yazdım"])
    expect(() => addUserBullet(draft, { kind: "project", index: 4 }, "x", { profile: withProject, posting })).toThrow()
  })

  it("moves a section within the current order", () => {
    const current = ["experience", "projects", "education", "skills"] as const
    const out = moveSection(draft, current, "education", "up")
    expect(out.sectionOrder).toEqual(["experience", "education", "projects", "skills"])
    expect(applyAdaptation(profile, out).sectionOrder).toEqual(out.sectionOrder)
    expect(moveSection(draft, current, "experience", "up")).toBe(draft)
    // Projesi olmayan CV'de eğitim, görünmeyen "projeler"in üstünden atlıyor.
    const noProjects = new Set(["experience", "education", "skills"] as const)
    expect(moveSection(draft, current, "education", "up", noProjects).sectionOrder).toEqual(["education", "projects", "experience", "skills"])
  })

  it("adds the user's section after the CV's own and deletes it", () => {
    const out = addUserSection(draft, " Gönüllü çalışmalar ", "Kod kampında mentorluk\n\n  Açık kaynak katkı ", { profile, posting })
    expect(out.userSections).toEqual([
      { id: "s1", heading: "Gönüllü çalışmalar", lines: ["Kod kampında mentorluk", "Açık kaynak katkı"], verification: { status: "ok", issues: [] } },
    ])
    expect(applyAdaptation(profile, out).otherSections).toEqual([{ heading: "Gönüllü çalışmalar", lines: ["Kod kampında mentorluk", "Açık kaynak katkı"] }])
    expect(addUserSection(draft, "Sertifika", "Kubernetes sertifikası", { profile, posting }).userSections?.[0]?.verification.status).toBe("flagged")
    expect(removeUserSection(out, "s1").userSections).toEqual([])
    expect(() => addUserSection(draft, "", "x", { profile, posting })).toThrow()
    expect(() => addUserSection(draft, "Başlık", "  \n ", { profile, posting })).toThrow()
  })
})

describe("relocating bullets and editing the CV's own sections (DOG-92, last step)", () => {
  const twoJobs: ResumeProfile = {
    ...profile,
    experience: [
      ...profile.experience,
      { company: "Beta", title: "Stajyer", startDate: "2021", endDate: "2022", bullets: [{ text: "Test yazdım", sourceRef: "Test yazdım" }] },
    ],
    otherSections: [{ heading: "Hobiler", lines: ["Satranç"] }],
  }
  const jobs = (d: AdaptationDraft) => applyAdaptation(twoJobs, d).experience.map((j) => j.bullets.map((b) => b.text))

  it("moves a bullet to another job, at the end, and back home", () => {
    const moved = relocateBullet(draft, twoJobs, "0-0", { kind: "experience", index: 1 })
    expect(jobs(moved)).toEqual([["Sayfa açılışını %30 hızlandırdım"], ["Test yazdım", "React ile panel yaptım"]])
    // Yeni yerinde de taşınabiliyor.
    expect(jobs(moveBullet(moved, twoJobs, 1, "0-0", "up"))[1]).toEqual(["React ile panel yaptım", "Test yazdım"])
    // Kendi yerine dönen madde taşınmış sayılmıyor.
    const back = relocateBullet(moved, twoJobs, "0-0", { kind: "experience", index: 0 })
    expect(back.bulletPlacement).toEqual({})
    expect(jobs(back)[0]).toEqual(["React ile panel yaptım", "Sayfa açılışını %30 hızlandırdım"])
    expect(() => relocateBullet(draft, twoJobs, "9-9", { kind: "experience", index: 1 })).toThrow()
    expect(() => relocateBullet(draft, twoJobs, "0-0", { kind: "project", index: 0 })).toThrow()
  })

  it("hides a section from the document and the score, reversibly", () => {
    const hidden = hideSection(hideSection(draft, "skills"), "o0")
    const out = applyAdaptation(twoJobs, hidden)
    expect(out.skills).toEqual([])
    expect(out.otherSections).toEqual([])
    const back = applyAdaptation(twoJobs, restoreSection(hidden, "o0"))
    expect(back.otherSections).toEqual([{ heading: "Hobiler", lines: ["Satranç"] }])
    // Becerilerin ardındaki diller ve sertifikalar da gizlenebiliyor.
    const certs = applyAdaptation({ ...twoJobs, certifications: ["Google Ads"] }, hideSection(draft, "certifications"))
    expect(certs.certifications).toEqual([])
    expect(() => hideSection(draft, "summary")).toThrow()
  })

  it("renames sections; the document uses the new heading, empty goes back to default", () => {
    const renamed = renameSection(renameSection(draft, "experience", "İş deneyimi"), "o0", "İlgi alanları")
    const model = toDocumentModel(applyAdaptation(twoJobs, renamed))
    expect(model.sections.map((x) => x.title)).toContain("İŞ DENEYİMİ")
    expect(model.sections.map((x) => x.title)).toContain("İLGİ ALANLARI")
    const langs = toDocumentModel(applyAdaptation({ ...twoJobs, languages: ["İngilizce"] }, renameSection(draft, "languages", "Yabancı diller")))
    expect(langs.sections.map((x) => x.title)).toContain("YABANCI DİLLER")
    expect(renameSection(renamed, "experience", "  ").sectionEdits?.titles).toEqual({ o0: "İlgi alanları" })
    expect(() => renameSection(draft, "experience", "x".repeat(61))).toThrow()
  })
})
