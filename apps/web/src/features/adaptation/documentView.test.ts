import { describe, expect, it } from "vitest"
import { documentSections } from "@/features/adaptation/documentView"

const job = (bullets: string[]) => ({ company: "Moda Sepeti", title: "Uzman", startDate: "2023", endDate: "Halen", bullets })

const document = {
  before: { headline: "Uzman", summary: "Eski özet", experience: [job(["a", "b"])], skills: ["Excel"] },
  after: { headline: "Uzman", summary: "Yeni özet", experience: [job(["A", "b"])], skills: ["GA4", "Excel"] },
}

describe("documentSections", () => {
  it("pairs each bullet with its original and marks what changed", () => {
    const s = documentSections(document, { bullets: [] })
    expect(s.experience[0]!.bullets).toMatchObject([
      { before: "a", after: "A", changed: true, pending: false },
      { before: "b", after: "b", changed: false, pending: false },
    ])
    expect(s.experience[0]!.dates).toBe("2023 – Halen")
    expect(s.summary).toMatchObject({ before: "Eski özet", after: "Yeni özet", changed: true })
  })

  it("marks bullets omitted for one page by their id, keeping positions paired (DOG-93)", () => {
    const s = documentSections(document, { bullets: [], omitted: ["0-0"] })
    expect(s.experience[0]!.bullets.map((b) => [b.id, b.omitted])).toEqual([
      ["0-0", true],
      ["0-1", false],
    ])
    expect(s.experience[0]!.bullets[0]).toMatchObject({ before: "a", after: "A" })
  })

  it("marks bullets still waiting for a decision by their positional id", () => {
    const bullet = { id: "0-1", original: "b", rewritten: "B", verification: { status: "flagged" as const, issues: [] }, decision: "pending" as const }
    expect(documentSections(document, { bullets: [bullet] }).experience[0]!.bullets[1]!.pending).toBe(true)
  })

  it("flags skills that were added from the resume's own bullets", () => {
    expect(documentSections(document, { bullets: [] }).skills).toEqual([
      { name: "GA4", added: true },
      { name: "Excel", added: false },
    ])
  })

  it("has no summary line when the resume had none and none was written", () => {
    const empty = { ...document, before: { ...document.before, summary: null }, after: { ...document.after, summary: null } }
    expect(documentSections(empty, { bullets: [] }).summary).toBeNull()
  })
})

describe("documentSections · contributions", () => {
  it("shows a bullet that exists only in the after state as fully added", () => {
    const withAdded = { ...document, after: { ...document.after, experience: [job(["A", "b", "Yeni madde"])] } }
    expect(documentSections(withAdded, { bullets: [] }).experience[0]!.bullets[2]).toMatchObject({
      before: "",
      after: "Yeni madde",
      changed: true,
      pending: false,
    })
  })
})

describe("documentSections · projects (DOG-105)", () => {
  const project = (bullets: string[]) => ({ name: "Asistan", role: null, dates: "2026", bullets })
  const withProjects = {
    before: { ...document.before, projects: [project(["belge asistanı"])], otherSections: [] },
    after: { ...document.after, projects: [project(["RAG ile belge asistanı"])], otherSections: [] },
  }

  it("pairs project bullets with their originals and marks pending ones by project id", () => {
    const pendingBullet = { id: "p0-0", original: "belge asistanı", rewritten: "RAG ile belge asistanı", verification: { status: "ok" as const, issues: [] }, decision: "pending" as const }
    expect(documentSections(withProjects, { bullets: [pendingBullet] }).projects[0]!.bullets[0]).toMatchObject({
      before: "belge asistanı",
      after: "RAG ile belge asistanı",
      changed: true,
      pending: true,
    })
  })

  it("has no projects for older responses", () => {
    expect(documentSections(document, { bullets: [] }).projects).toEqual([])
  })
})
