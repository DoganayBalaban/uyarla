import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { segmentResume, stripLeadingHeading } from "./segment.js"

const resume = (name: string) =>
  readFileSync(join(import.meta.dirname, "../../eval/sources/cv", `${name}.txt`), "utf8")

describe("segmentResume · real resumes", () => {
  it("cv-a: TECHNICAL SKILLS goes to the skills block, ADDITIONAL does not", () => {
    // LLM bölümlemesi bunu tam ters yapmıştı: TECHNICAL SKILLS deneyime,
    // ADDITIONAL beceriye gidiyordu ve MCP, tool calling, Docker kayboluyordu.
    const b = segmentResume(resume("cv-a-ai-engineer"))

    expect(b.skillsBlock).toContain("TECHNICAL SKILLS")
    expect(b.skillsBlock).toContain("MCP")
    expect(b.skillsBlock).toContain("Docker")
    expect(b.skillsBlock).not.toContain("ADDITIONAL")
    expect(b.experienceBlock).not.toContain("TECHNICAL SKILLS")
  })

  it("cv-a: experience and education blocks are correct", () => {
    const b = segmentResume(resume("cv-a-ai-engineer"))
    expect(b.experienceBlock).toContain("EXPERIENCE")
    expect(b.experienceBlock).toContain("AI Engineer")
    expect(b.educationBlock).toContain("EDUCATION")
    expect(b.educationBlock).toContain("B.Sc. Software Engineering")
  })

  it("cv-b: two separate skill sections merge into one block", () => {
    // Core Skills + Technical Skills. LLM bunlardan birini atıyordu (K-19).
    const b = segmentResume(resume("cv-b-test-engineer"))

    expect(b.skillsBlock).toContain("Core Skills")
    expect(b.skillsBlock).toContain("Technical Skills")
    expect(b.skillsBlock).toContain("Manual Testing")
    expect(b.skillsBlock).toContain("Selenium")
  })

  it("cv-c: certifications and languages land in the skills block for a resume without a skills section", () => {
    const b = segmentResume(resume("cv-c-yeni-mezun"))

    expect(b.skillsBlock).toContain("DİLLER")
    expect(b.skillsBlock).toContain("SERTİFİKALAR")
    expect(b.experienceBlock).toContain("PROFESYONEL DENEYİM")
  })

  it("no block is empty in any of the three resumes", () => {
    for (const name of ["cv-a-ai-engineer", "cv-b-test-engineer", "cv-c-yeni-mezun"]) {
      const b = segmentResume(resume(name))
      expect(b.experienceBlock.length, `${name} deneyim`).toBeGreaterThan(50)
      expect(b.educationBlock.length, `${name} eğitim`).toBeGreaterThan(10)
    }
  })
})

describe("segmentResume · edge cases", () => {
  it("gives the raw text to every block when no heading is found", () => {
    const text = "Elif Yılmaz\nReact ile panel geliştirdim\nPython biliyorum"
    const b = segmentResume(text)

    expect(b.experienceBlock).toBe(text)
    expect(b.skillsBlock).toBe(text)
    expect(b.educationBlock).toBe(text)
  })

  it("the heading line itself is included in the block", () => {
    // K-10: başlıkların atılması kurum/unvan satırlarını da düşürüyordu.
    const b = segmentResume("DENEYİM\nAcme · Geliştirici · 2022\n- React yazdım")
    expect(b.experienceBlock).toContain("DENEYİM")
    expect(b.experienceBlock).toContain("Acme")
  })

  it("recognizes Turkish and English headings together", () => {
    const b = segmentResume("EXPERIENCE\nAcme\nBECERİLER\nPython, React\nEDUCATION\nİTÜ")
    expect(b.experienceBlock).toContain("Acme")
    expect(b.skillsBlock).toContain("Python")
    expect(b.educationBlock).toContain("İTÜ")
  })

  it("does not mistake a long line for a heading", () => {
    const long = "Deneyimlerimi ve eğitim geçmişimi aşağıda ayrıntılı olarak bulabilirsiniz efendim"
    const b = segmentResume(`${long}\nDENEYİM\nAcme`)
    expect(b.experienceBlock).toContain("Acme")
    expect(b.experienceBlock).not.toContain(long)
  })

  it("content of an ignored section goes into no block", () => {
    const b = segmentResume("BECERİLER\nPython\nREFERANSLAR\nAhmet Yılmaz - 0555")
    expect(b.skillsBlock).toContain("Python")
    expect(b.skillsBlock).not.toContain("Ahmet")
    expect(b.experienceBlock).not.toContain("Ahmet")
  })
})

describe("stripLeadingHeading", () => {
  it("drops the leading section heading", () => {
    expect(stripLeadingHeading("PROFILE\n\nAI Engineer ve geliştirici")).toBe(
      "AI Engineer ve geliştirici",
    )
  })

  it("leaves text untouched when there is no heading", () => {
    expect(stripLeadingHeading("AI Engineer ve geliştirici")).toBe("AI Engineer ve geliştirici")
  })

  it("drops only the first heading", () => {
    // İçerikte geçen bir kelime başlığa benziyorsa metin ortasından
    // satır silmiyoruz.
    expect(stripLeadingHeading("ÖZET\nDeneyim sahibiyim\nEĞİTİM")).toBe(
      "Deneyim sahibiyim\nEĞİTİM",
    )
  })

  it("returns empty for an empty block", () => {
    expect(stripLeadingHeading("")).toBe("")
    expect(stripLeadingHeading("  \n\n ")).toBe("")
  })

  it("recognizes the Professional Summary heading", () => {
    // Ölçümle bulundu: değerlendirme CV'lerinden birinde bu başlık
    // tanınmıyordu ve özet bölümü tümüyle başlık bloğunda kalıyordu.
    expect(stripLeadingHeading("Professional Summary\nTest mühendisiyim")).toBe(
      "Test mühendisiyim",
    )
  })
})
