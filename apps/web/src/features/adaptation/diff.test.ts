import { describe, it, expect } from "vitest"
import { diffWords } from "@/features/adaptation/diff"

describe("diffWords", () => {
  it("everything is same for identical text", () => {
    expect(diffWords("React ile panel", "React ile panel")).toEqual([
      { text: "React ile panel", kind: "same" },
    ])
  })

  it("marks an inserted word as added", () => {
    const p = diffWords("React ile panel", "React ile müşteri panel")
    expect(p.filter((x) => x.kind === "added").map((x) => x.text)).toEqual(["müşteri"])
  })

  it("marks a removed word as removed", () => {
    const p = diffWords("React ile eski panel", "React ile panel")
    expect(p.filter((x) => x.kind === "removed").map((x) => x.text)).toEqual(["eski"])
  })

  it("returns a changed word as both removed and added", () => {
    const p = diffWords("panel yaptım", "panel geliştirdim")
    expect(p.filter((x) => x.kind === "removed").map((x) => x.text)).toEqual(["yaptım"])
    expect(p.filter((x) => x.kind === "added").map((x) => x.text)).toEqual(["geliştirdim"])
  })

  it("merges adjacent words of the same kind", () => {
    // Her kelime ayrı bir span olursa vurgu parçalı görünür.
    const p = diffWords("a", "a bir iki üç")
    expect(p.filter((x) => x.kind === "added")).toHaveLength(1)
  })

  it("punctuation stays attached to the word", () => {
    expect(diffWords("Panel yaptım.", "Panel yaptım.").every((x) => x.kind === "same")).toBe(true)
  })

  it("everything is added for an empty original", () => {
    expect(diffWords("", "yeni metin").every((x) => x.kind === "added")).toBe(true)
  })

  it("everything is removed for an empty rewrite", () => {
    expect(diffWords("eski metin", "").every((x) => x.kind === "removed")).toBe(true)
  })

  it("keeps word order", () => {
    const p = diffWords("a b c", "a x c")
    expect(p[p.length - 1]!.text).toBe("c")
    expect(p[0]!.text).toBe("a")
  })

  it("covers every word of both texts", () => {
    // Fark gösterimi bilgi kaybetmemeli: kullanıcı neyin değiştiğini
    // görebilmek için iki metnin de tamamını görmeli.
    const old = "React ile eski panel yaptım"
    const fresh = "React kullanarak müşteri panelini geliştirdim"
    const p = diffWords(old, fresh)
    const all = p.map((x) => x.text).join(" ")
    for (const k of [...old.split(" "), ...fresh.split(" ")]) {
      expect(all).toContain(k)
    }
  })
})
