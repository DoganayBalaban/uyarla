import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { sectionHeading, segmentResume, stripLeadingHeading } from "./segment.js"

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

describe("segmentResume · Europass and LinkedIn headings (DOG-60)", () => {
  it("recognizes the Europass education and skills headings", () => {
    const b = segmentResume(
      "İŞ DENEYİMİ\nAtlas Lojistik\nEĞİTİM VE ÖĞRETİM\nLisans, İktisat\nKİŞİSEL BECERİLER\nMS Excel, Logo Tiger",
    )
    expect(b.educationBlock).toContain("İktisat")
    expect(b.skillsBlock).toContain("Logo Tiger")
    expect(b.experienceBlock).not.toContain("İktisat")
  })

  it("keeps a personal information heading out of the header block", () => {
    // Europass: ad "KİŞİSEL BİLGİLER" başlığının altında; başlık ad sanılıyordu.
    const b = segmentResume("KİŞİSEL BİLGİLER\nEce Yıldırım\nKadıköy, İstanbul\nİŞ DENEYİMİ\nAtlas Lojistik")
    expect(b.headerBlock.split("\n")[0]).toBe("Ece Yıldırım")
  })

  it("splits a heading that shares a table row with its content", () => {
    // Europass DOCX'te etiket ve içerik aynı tablo satırında: "KİŞİSEL BİLGİLER | Ece Yıldırım".
    const b = segmentResume("KİŞİSEL BİLGİLER | Ece Yıldırım\nKadıköy\nEĞİTİM VE ÖĞRETİM | 2016 – 2020\nLisans, İktisat")
    expect(b.headerBlock.split("\n")[0]).toBe("Ece Yıldırım")
    expect(b.educationBlock).toContain("2016 – 2020")
    expect(b.educationBlock).toContain("İktisat")
  })

  it("recognizes the LinkedIn Contact and Top Skills sections", () => {
    const b = segmentResume(
      "Contact\ndeniz@ornek.com\nTop Skills\nGoogle Ads\nLooker Studio\nSummary\nPerformans pazarlamacısıyım.",
    )
    expect(b.skillsBlock).toContain("Google Ads")
    expect(b.headerBlock).toContain("deniz@ornek.com")
    expect(b.headerBlock).not.toContain("Contact")
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

describe("segmentResume · projects and other sections (DOG-105)", () => {
  const cv = [
    "Ada Yılmaz",
    "ada@ornek.com",
    "EXPERIENCE",
    "Acme — Intern  |  2024",
    "• Built dashboards.",
    "SELECTED PROJECTS",
    "Yeni Nesil Asistan — Enterprise document assistant with RAG.",
    "AI Workflow Platform — Workflow automation with React and FastAPI.",
    "EDUCATION",
    "Bir Üniversite — B.Sc. Software Engineering",
    "ADDITIONAL",
    "Driving licence: B",
    "",
    "Honors",
    "Dean's list 2023",
  ].join("\n")

  it("puts projects in their own block instead of experience", () => {
    const s = segmentResume(cv)
    expect(s.projectsBlock).toContain("Yeni Nesil Asistan")
    expect(s.projectsBlock).toContain("AI Workflow Platform")
    expect(s.experienceBlock).not.toContain("Yeni Nesil Asistan")
  })

  it("keeps sections it does not structure, with their own heading and lines", () => {
    expect(segmentResume(cv).otherSections).toEqual([
      { heading: "ADDITIONAL", lines: ["Driving licence: B"] },
      { heading: "Honors", lines: ["Dean's list 2023"] },
    ])
  })

  it("recognises Turkish project headings", () => {
    expect(segmentResume("Ada\nPROJELER\nBitirme projesi — Mobil uygulama").projectsBlock).toContain("Bitirme projesi")
  })

  it("gives the project extractor nothing when the resume has no headings at all", () => {
    expect(segmentResume("Ada Yılmaz\nada@ornek.com\nBir şeyler yaptım.").projectsBlock).toBe("")
  })
})

describe("segmentResume · no line is lost (DOG-105)", () => {
  // Değişmez: bölümleme hiçbir satırı atmamalı. Her boş olmayan satır ya bir
  // bloğa ya da otherSections'a düşer. Eskiden "Additional", "Honors" gibi
  // bölümler sessizce atılıyordu ve indirilen CV'de kayboluyordu.
  const dir = join(import.meta.dirname, "../../eval/sources/cv")
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
    it(`keeps every line of ${file}`, () => {
      const text = readFileSync(join(dir, file), "utf8")
      const s = segmentResume(text)
      const kept = [
        s.headerBlock,
        s.summaryBlock,
        s.experienceBlock,
        s.projectsBlock,
        s.educationBlock,
        s.skillsBlock,
        ...s.otherSections.flatMap((o) => [o.heading, ...o.lines]),
      ].join("\n")
      const lost = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        // İletişim başlıklarının kendisi bilerek bloğa girmiyor (DOG-60);
        // tablo satırında ("KİŞİSEL BİLGİLER | Ece") kalan kısım aranıyor.
        .map((l) => {
          const [first, ...rest] = l.split(" | ")
          return sectionHeading(first!) === "header" ? rest.join(" | ").trim() : first!.trim()
        })
        .filter((l) => l && sectionHeading(l) !== "header")
        .filter((l) => !kept.includes(l))
      expect(lost).toEqual([])
    })
  }
})

describe("segmentResume · section order (DOG-106)", () => {
  it("records structured sections in the order they first appear", () => {
    const s = segmentResume("Ad Soyad\nEĞİTİM\nİTÜ\nDENEYİM\nAcme\nBECERİLER\nReact\nPROJELER\nAsistan")
    expect(s.sectionOrder).toEqual(["education", "experience", "skills", "projects"])
  })

  it("places skills by the skills heading, not by languages or certificates", () => {
    // cv-c: DİLLER eğitimden önce, BECERİLER sonra; ikisi de beceri bloğuna gidiyor.
    const s = segmentResume("Ad\nDENEYİM\nAcme\nDİLLER\nİngilizce\nEĞİTİM\nİTÜ\nBECERİLER\nPython")
    expect(s.sectionOrder).toEqual(["experience", "education", "skills"])
  })

  it("uses the languages position when there is no skills heading", () => {
    const s = segmentResume("Ad\nDENEYİM\nAcme\nSERTİFİKALAR\nAWS\nEĞİTİM\nİTÜ")
    expect(s.sectionOrder).toEqual(["experience", "skills", "education"])
  })

  it("does not record an order when no heading is found", () => {
    expect(segmentResume("Ad\nbir satır").sectionOrder).toBeUndefined()
  })
})

describe("segmentResume · two-column leftovers (DOG-107)", () => {
  // cv-c: iki sütun iç içe geçiyor; özet başlığının altı boş, paragraf deneyim başlığının altında.
  const twoColumn = [
    "I. Z.",
    "HAKKIMDA",
    "PROFESYONEL DENEYİM",
    "Yönetim Bilişim Sistemleri mezunu ve yazılım geliştiricisiyim. Python, web",
    "teknolojileri ve yapay zeka alanlarında projeler geliştiriyorum.",
    "+90 555 111 22 33\tad@ornek.com",
    "YAPAY ZEKA EĞİTMENİ",
    "Bir Eğitim Vakfı",
    "• Uygulamalı eğitimler verdim.",
    "github.com/ad\tlinkedin.com/in/ad",
    "EĞİTİM",
    "Bir Üniversite",
  ].join("\n")

  it("gives the paragraph under the next heading to an empty summary", () => {
    const s = segmentResume(twoColumn)
    expect(stripLeadingHeading(s.summaryBlock)).toBe(
      "Yönetim Bilişim Sistemleri mezunu ve yazılım geliştiricisiyim. Python, web\nteknolojileri ve yapay zeka alanlarında projeler geliştiriyorum.",
    )
    expect(s.experienceBlock).not.toContain("mezunu")
    expect(s.experienceBlock).toContain("YAPAY ZEKA EĞİTMENİ")
    expect(s.experienceBlock).toContain("• Uygulamalı eğitimler verdim.")
  })

  it("moves contact-only lines to the header wherever they appear", () => {
    const s = segmentResume(twoColumn)
    expect(s.headerBlock).toContain("ad@ornek.com")
    expect(s.headerBlock).toContain("linkedin.com/in/ad")
    expect(s.experienceBlock).not.toContain("linkedin")
  })

  it("does not take an experience entry as the summary", () => {
    // Yıl taşıyan satır bir iş kaydının başlığı: özet değil.
    const s = segmentResume(
      "Ad\nÖZET\nDENEYİM\nAcme Teknoloji şirketinde yazılım geliştirici olarak çalıştım 2020 - 2023\n• Servis yazdım",
    )
    expect(stripLeadingHeading(s.summaryBlock)).toBe("")
    expect(s.experienceBlock).toContain("Acme Teknoloji")
  })

  it("does not search when the summary has its own content", () => {
    const s = segmentResume(
      "Ad\nÖZET\nKısa özet.\nDENEYİM\nUzun bir açıklama satırı ki sekiz kelimeden fazla kelime taşıyor burada\n• Servis yazdım",
    )
    expect(stripLeadingHeading(s.summaryBlock)).toBe("Kısa özet.")
    expect(s.experienceBlock).toContain("Uzun bir açıklama")
  })

  it("leaves a referee's e-mail and a project's repository link where they are", () => {
    const s = segmentResume("Ad\nPROJELER\nAsistan\ngithub.com/ad/asistan\nREFERENCES\nali@ornek.com")
    expect(s.projectsBlock).toContain("github.com/ad/asistan")
    expect(s.headerBlock).not.toContain("ali@ornek.com")
    expect(s.otherSections).toEqual([{ heading: "REFERENCES", lines: ["ali@ornek.com"] }])
  })
})
