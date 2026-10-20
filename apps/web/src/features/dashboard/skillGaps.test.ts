import { describe, expect, it } from "vitest"
import { skillGaps } from "@/features/dashboard/skillGaps"

const req = (importance: string, missing: string[], type = "skill") => ({ requirement: { importance, type }, missingConcepts: missing })
const result = (...requirements: ReturnType<typeof req>[]) => ({ requirements })

describe("skillGaps (DOG-119)", () => {
  it("ranks concepts missing in several postings, weighting required ones", () => {
    const { gaps, analyses } = skillGaps([
      result(req("must", ["Docker"]), req("nice", ["Kubernetes"])),
      result(req("nice", ["docker"]), req("nice", ["Kubernetes"])),
      result(req("must", ["Docker", "SQL"]), req("must", ["Docker"])),
      result(req("must", ["SQL"])),
    ])
    expect(analyses).toBe(4)
    expect(gaps).toEqual([
      { term: "Docker", postings: 3, must: 2 },
      { term: "SQL", postings: 2, must: 2 },
      { term: "Kubernetes", postings: 2, must: 0 },
    ])
  })

  it("leaves out excluded requirements, the user's excluded list, soft traits and conditions", () => {
    const { gaps } = skillGaps(
      [
        { requirements: [req("must", ["Docker"]), req("must", ["Ehliyet"], "condition")], excluded: [0] },
        result(req("must", ["Docker"]), req("must", ["İletişim"], "soft"), req("must", ["Jira"])),
        result(req("must", ["Docker"]), req("must", ["Ehliyet"], "condition"), req("must", ["Jira"])),
      ],
      ["jira"],
    )
    expect(gaps).toEqual([{ term: "Docker", postings: 2, must: 2 }])
  })

  it("stays empty with too few analyses or one-off concepts", () => {
    expect(skillGaps([result(req("must", ["Docker"])), result(req("must", ["Docker"]))]).gaps).toEqual([])
    expect(skillGaps([result(req("must", ["A"])), result(req("must", ["B"])), result(req("must", ["C"]))]).gaps).toEqual([])
  })
})
