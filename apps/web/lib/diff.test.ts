import { describe, it, expect } from "vitest"
import { diffWords } from "./diff"

describe("diffWords", () => {
  it("aynı metinde her şey same olur", () => {
    expect(diffWords("React ile panel", "React ile panel")).toEqual([
      { text: "React ile panel", kind: "same" },
    ])
  })

  it("eklenen kelimeyi added işaretler", () => {
    const p = diffWords("React ile panel", "React ile müşteri panel")
    expect(p.filter((x) => x.kind === "added").map((x) => x.text)).toEqual(["müşteri"])
  })

  it("çıkarılan kelimeyi removed işaretler", () => {
    const p = diffWords("React ile eski panel", "React ile panel")
    expect(p.filter((x) => x.kind === "removed").map((x) => x.text)).toEqual(["eski"])
  })

  it("değiştirilen kelimeyi hem removed hem added verir", () => {
    const p = diffWords("panel yaptım", "panel geliştirdim")
    expect(p.filter((x) => x.kind === "removed").map((x) => x.text)).toEqual(["yaptım"])
    expect(p.filter((x) => x.kind === "added").map((x) => x.text)).toEqual(["geliştirdim"])
  })

  it("bitişik aynı türden kelimeleri birleştirir", () => {
    // Her kelime ayrı bir span olursa vurgu parçalı görünür.
    const p = diffWords("a", "a bir iki üç")
    expect(p.filter((x) => x.kind === "added")).toHaveLength(1)
  })

  it("noktalama kelimeye yapışık kalır", () => {
    expect(diffWords("Panel yaptım.", "Panel yaptım.").every((x) => x.kind === "same")).toBe(true)
  })

  it("boş orijinalde her şey added olur", () => {
    expect(diffWords("", "yeni metin").every((x) => x.kind === "added")).toBe(true)
  })

  it("boş yeniden yazımda her şey removed olur", () => {
    expect(diffWords("eski metin", "").every((x) => x.kind === "removed")).toBe(true)
  })

  it("kelime sırasını korur", () => {
    const p = diffWords("a b c", "a x c")
    expect(p[p.length - 1]!.text).toBe("c")
    expect(p[0]!.text).toBe("a")
  })

  it("her iki metnin tüm kelimelerini kapsar", () => {
    // Fark gösterimi bilgi kaybetmemeli: kullanıcı neyin değiştiğini
    // görebilmek için iki metnin de tamamını görmeli.
    const eski = "React ile eski panel yaptım"
    const yeni = "React kullanarak müşteri panelini geliştirdim"
    const p = diffWords(eski, yeni)
    const tumu = p.map((x) => x.text).join(" ")
    for (const k of [...eski.split(" "), ...yeni.split(" ")]) {
      expect(tumu).toContain(k)
    }
  })
})
