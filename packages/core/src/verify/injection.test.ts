import { describe, it, expect } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { checkPostingTermInjection } from "./injection.js"

const posting = (termList: string[]): JobPostingData => ({
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: termList.map((t) => ({
    text: t,
    type: "skill",
    importance: "must",
    concepts: [{ term: t, synonyms: [t] }],
  })),
})

describe("checkPostingTermInjection", () => {
  it("a term present in the source produces no warning", () => {
    expect(
      checkPostingTermInjection(
        "React kullanarak müşteri panelini geliştirdim",
        "React ile müşteri panelini geliştirdim",
        posting(["React", "Kubernetes"]),
      ),
    ).toEqual([])
  })

  it("warns when a posting term absent from the source is added", () => {
    const warnings = checkPostingTermInjection(
      "React ve Kubernetes ile müşteri panelini geliştirdim",
      "React ile müşteri panelini geliştirdim",
      posting(["React", "Kubernetes"]),
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.kind).toBe("posting_term_injected")
    expect(warnings[0]!.detail).toContain("Kubernetes")
  })

  it("a new word absent from the posting produces no warning", () => {
    // Yalnızca ilan kavramları kontrol edilir; sıradan kelime değişikliği
    // yeniden ifadenin kendisidir.
    expect(
      checkPostingTermInjection(
        "React kullanarak kurumsal müşteri panelini hayata geçirdim",
        "React ile müşteri panelini geliştirdim",
        posting(["React"]),
      ),
    ).toEqual([])
  })

  it("also catches a term added in synonym form", () => {
    const warnings = checkPostingTermInjection(
      "React ve k8s ile panel geliştirdim",
      "React ile panel geliştirdim",
      {
        ...posting([]),
        requirements: [
          {
            text: "Kubernetes deneyimi",
            type: "skill",
            importance: "must",
            concepts: [{ term: "kubernetes", synonyms: ["kubernetes", "k8s"] }],
          },
        ],
      },
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.detail).toContain("kubernetes")
  })

  it("produces no warning for a cross-language match present in the source", () => {
    // Türkçe normalleştirme ve çapraz dilli sözlük devrede (K-21, K-25).
    expect(
      checkPostingTermInjection(
        "Software Engineering alanında çalıştım",
        "Yazılım Mühendisliği alanında çalıştım",
        posting(["Yazılım Mühendisliği"]),
      ),
    ).toEqual([])
  })

  it("warns for each term when several are added", () => {
    const warnings = checkPostingTermInjection(
      "React, Kubernetes ve Docker ile geliştirdim",
      "React ile geliştirdim",
      posting(["React", "Kubernetes", "Docker"]),
    )
    expect(warnings).toHaveLength(2)
  })

  it("the reason is user-facing Turkish", () => {
    const warning = checkPostingTermInjection(
      "Kubernetes ile geliştirdim",
      "React ile geliştirdim",
      posting(["Kubernetes"]),
    )[0]!
    expect(warning.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(warning.detail).not.toMatch(/error|injected|invalid/i)
  })
})
