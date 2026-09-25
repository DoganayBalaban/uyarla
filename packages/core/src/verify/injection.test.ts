import { describe, it, expect } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { checkPostingTermInjection } from "./injection.js"

const ilan = (terimler: string[]): JobPostingData => ({
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: terimler.map((t) => ({
    text: t,
    type: "skill",
    importance: "must",
    concepts: [{ term: t, synonyms: [t] }],
  })),
})

describe("checkPostingTermInjection", () => {
  it("kaynakta olan terim uyarı üretmez", () => {
    expect(
      checkPostingTermInjection(
        "React kullanarak müşteri panelini geliştirdim",
        "React ile müşteri panelini geliştirdim",
        ilan(["React", "Kubernetes"]),
      ),
    ).toEqual([])
  })

  it("kaynakta olmayan ilan terimi eklenirse uyarı üretir", () => {
    const uyarilar = checkPostingTermInjection(
      "React ve Kubernetes ile müşteri panelini geliştirdim",
      "React ile müşteri panelini geliştirdim",
      ilan(["React", "Kubernetes"]),
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("posting_term_injected")
    expect(uyarilar[0]!.detail).toContain("Kubernetes")
  })

  it("ilanda geçmeyen yeni kelime uyarı üretmez", () => {
    // Yalnızca ilan kavramları kontrol edilir; sıradan kelime değişikliği
    // yeniden ifadenin kendisidir.
    expect(
      checkPostingTermInjection(
        "React kullanarak kurumsal müşteri panelini hayata geçirdim",
        "React ile müşteri panelini geliştirdim",
        ilan(["React"]),
      ),
    ).toEqual([])
  })

  it("eş anlamlı biçimle eklenen terimi de yakalar", () => {
    const uyarilar = checkPostingTermInjection(
      "React ve k8s ile panel geliştirdim",
      "React ile panel geliştirdim",
      {
        ...ilan([]),
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
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.detail).toContain("kubernetes")
  })

  it("çapraz dilli eşleşmede kaynakta varsa uyarı üretmez", () => {
    // Türkçe normalleştirme ve çapraz dilli sözlük devrede (K-21, K-25).
    expect(
      checkPostingTermInjection(
        "Software Engineering alanında çalıştım",
        "Yazılım Mühendisliği alanında çalıştım",
        ilan(["Yazılım Mühendisliği"]),
      ),
    ).toEqual([])
  })

  it("birden çok terim eklenirse her biri için uyarı üretir", () => {
    const uyarilar = checkPostingTermInjection(
      "React, Kubernetes ve Docker ile geliştirdim",
      "React ile geliştirdim",
      ilan(["React", "Kubernetes", "Docker"]),
    )
    expect(uyarilar).toHaveLength(2)
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkPostingTermInjection(
      "Kubernetes ile geliştirdim",
      "React ile geliştirdim",
      ilan(["Kubernetes"]),
    )[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/error|injected|invalid/i)
  })
})
