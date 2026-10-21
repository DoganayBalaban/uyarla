import { describe, expect, it } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { addUserBullet, jobBullets, moveBullet, removeBullet, restoreBullet } from "./bullets.js"
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
