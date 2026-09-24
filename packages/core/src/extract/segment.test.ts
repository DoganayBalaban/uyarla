import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { segmentResume } from "./segment.js"

const cv = (ad: string) =>
  readFileSync(join(import.meta.dirname, "../../eval/sources/cv", `${ad}.txt`), "utf8")

describe("segmentResume · gerçek CV'ler", () => {
  it("cv-a: TECHNICAL SKILLS beceri bloğuna gider, ADDITIONAL gitmez", () => {
    // LLM bölümlemesi bunu tam ters yapmıştı: TECHNICAL SKILLS deneyime,
    // ADDITIONAL beceriye gidiyordu ve MCP, tool calling, Docker kayboluyordu.
    const b = segmentResume(cv("cv-a-ai-engineer"))

    expect(b.skillsBlock).toContain("TECHNICAL SKILLS")
    expect(b.skillsBlock).toContain("MCP")
    expect(b.skillsBlock).toContain("Docker")
    expect(b.skillsBlock).not.toContain("ADDITIONAL")
    expect(b.experienceBlock).not.toContain("TECHNICAL SKILLS")
  })

  it("cv-a: deneyim ve eğitim blokları doğru", () => {
    const b = segmentResume(cv("cv-a-ai-engineer"))
    expect(b.experienceBlock).toContain("EXPERIENCE")
    expect(b.experienceBlock).toContain("AI Engineer")
    expect(b.educationBlock).toContain("EDUCATION")
    expect(b.educationBlock).toContain("B.Sc. Software Engineering")
  })

  it("cv-b: iki ayrı beceri bölümü tek blokta birleşir", () => {
    // Core Skills + Technical Skills. LLM bunlardan birini atıyordu (K-19).
    const b = segmentResume(cv("cv-b-test-engineer"))

    expect(b.skillsBlock).toContain("Core Skills")
    expect(b.skillsBlock).toContain("Technical Skills")
    expect(b.skillsBlock).toContain("Manual Testing")
    expect(b.skillsBlock).toContain("Selenium")
  })

  it("cv-c: beceri bölümü olmayan CV'de sertifika ve diller beceri bloğunda", () => {
    const b = segmentResume(cv("cv-c-yeni-mezun"))

    expect(b.skillsBlock).toContain("DİLLER")
    expect(b.skillsBlock).toContain("SERTİFİKALAR")
    expect(b.experienceBlock).toContain("PROFESYONEL DENEYİM")
  })

  it("üç CV'de de hiçbir blok boş kalmıyor", () => {
    for (const ad of ["cv-a-ai-engineer", "cv-b-test-engineer", "cv-c-yeni-mezun"]) {
      const b = segmentResume(cv(ad))
      expect(b.experienceBlock.length, `${ad} deneyim`).toBeGreaterThan(50)
      expect(b.educationBlock.length, `${ad} eğitim`).toBeGreaterThan(10)
    }
  })
})

describe("segmentResume · kenar durumlar", () => {
  it("başlık bulunamazsa ham metni her bloğa verir", () => {
    const metin = "Elif Yılmaz\nReact ile panel geliştirdim\nPython biliyorum"
    const b = segmentResume(metin)

    expect(b.experienceBlock).toBe(metin)
    expect(b.skillsBlock).toBe(metin)
    expect(b.educationBlock).toBe(metin)
  })

  it("başlık satırının kendisi bloğa dahil edilir", () => {
    // K-10: başlıkların atılması kurum/unvan satırlarını da düşürüyordu.
    const b = segmentResume("DENEYİM\nAcme · Geliştirici · 2022\n- React yazdım")
    expect(b.experienceBlock).toContain("DENEYİM")
    expect(b.experienceBlock).toContain("Acme")
  })

  it("Türkçe ve İngilizce başlıkları birlikte tanır", () => {
    const b = segmentResume("EXPERIENCE\nAcme\nBECERİLER\nPython, React\nEDUCATION\nİTÜ")
    expect(b.experienceBlock).toContain("Acme")
    expect(b.skillsBlock).toContain("Python")
    expect(b.educationBlock).toContain("İTÜ")
  })

  it("uzun bir satırı başlık sanmaz", () => {
    const uzun = "Deneyimlerimi ve eğitim geçmişimi aşağıda ayrıntılı olarak bulabilirsiniz efendim"
    const b = segmentResume(`${uzun}\nDENEYİM\nAcme`)
    expect(b.experienceBlock).toContain("Acme")
    expect(b.experienceBlock).not.toContain(uzun)
  })

  it("yoksayılan bölümün içeriği hiçbir bloğa girmez", () => {
    const b = segmentResume("BECERİLER\nPython\nREFERANSLAR\nAhmet Yılmaz - 0555")
    expect(b.skillsBlock).toContain("Python")
    expect(b.skillsBlock).not.toContain("Ahmet")
    expect(b.experienceBlock).not.toContain("Ahmet")
  })
})
