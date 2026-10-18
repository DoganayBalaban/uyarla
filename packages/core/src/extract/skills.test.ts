import { describe, it, expect } from "vitest"
import { flattenSkillLines, skillGroups } from "./skills.js"

describe("flattenSkillLines", () => {
  it("takes items from a category line, not the category", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "Programming Languages", items: ["Java", "SQL"] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["Java", "SQL"])
  })

  it("takes the label from a description line, not the description", () => {
    expect(
      flattenSkillLines({
        lines: [
          {
            label: "Manual Testing",
            items: ["Performing functional, regression, and integration testing."],
          },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Manual Testing"])
  })

  it("treats the label of an itemless line as a skill", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "React", items: [] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["React"])
  })

  it("does not treat section headings as skills", () => {
    expect(
      flattenSkillLines({
        lines: [
          { label: "Core Skills", items: [] },
          { label: "Technical Skills", items: [] },
          { label: "BECERİLER", items: [] },
          { label: "Araçlar", items: [] },
          { label: "React", items: [] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["React"])
  })

  it("does not treat Europass/LinkedIn headings or a table header row as skills", () => {
    // DOG-60: başlık satırı ve tablonun "Alan | Düzey" başlığı beceri listesine giriyordu.
    expect(
      flattenSkillLines({
        lines: [
          { label: "Top Skills", items: [] },
          { label: "KİŞİSEL BECERİLER", items: [] },
          { label: "Alan | Düzey", items: [] },
          { label: "Salesforce CRM", items: [] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Salesforce CRM"])
  })

  it("does not treat a lone proficiency level as a skill", () => {
    // Tablolu şablonun düzey sütunu: "Salesforce CRM | Orta" (DOG-60).
    expect(
      flattenSkillLines({
        lines: [{ label: "Yetkinlikler", items: ["Salesforce CRM", "Orta", "İleri", "Advanced", "B2 (iyi)"] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["Salesforce CRM"])
  })

  it("does not list the same skill twice", () => {
    expect(
      flattenSkillLines({
        lines: [
          { label: "Diller", items: ["Python", "Java"] },
          { label: "Backend", items: ["Python", "FastAPI"] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Python", "Java", "FastAPI"])
  })

  it("fully extracts the two-part skill list of a real resume", () => {
    // K-19: bu CV biçiminde model, iki bölümden yalnızca birini döndürüyordu.
    const outcome = flattenSkillLines({
      lines: [
        { label: "Core Skills", items: [] },
        {
          label: "Test Case Design & Execution",
          items: ["Creating and executing structured test scenarios."],
        },
        { label: "Manual Testing", items: ["Performing functional testing."] },
        { label: "Technical Skills", items: [] },
        { label: "Programming & Query Languages", items: ["Java", "SQL Queries"] },
        { label: "QA & Collaboration Tools", items: ["JIRA", "Postman"] },
      ],
      languages: [], certifications: [],
    })

    expect(outcome).toEqual([
      "Test Case Design & Execution", "Manual Testing",
      "Java", "SQL Queries", "JIRA", "Postman",
    ])
  })

  it("treats a long item without a period as a description", () => {
    // Sınır davranışı: 40 karakterin üstü terim değil cümle kabul edilir.
    expect(
      flattenSkillLines({
        lines: [
          {
            label: "Agile Collaboration",
            items: ["Working within Agile teams while coordinating with developers"],
          },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Agile Collaboration"])
  })

  it("returns an empty array for empty input", () => {
    expect(flattenSkillLines({ lines: [], languages: [], certifications: [] })).toEqual([])
  })
})

describe("flattenSkillLines · noise from real resumes", () => {
  it("also filters a section heading that arrives as an item", () => {
    // Gerçek vaka: "TECHNICAL SKILLS" label değil item olarak gelmişti ve
    // beceri listesine sızmıştı.
    expect(
      flattenSkillLines({
        lines: [{ label: "", items: ["TECHNICAL SKILLS", "LLMs", "RAG"] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["LLMs", "RAG"])
  })

  it("does not treat language and certification headings as skills", () => {
    // Beceri bölümü olmayan CV'lerde bölümleme bunları skillsBlock'a koyuyor.
    expect(
      flattenSkillLines({
        lines: [
          { label: "DİLLER", items: [] },
          { label: "SERTİFİKALAR / BELGELER", items: [] },
          { label: "EĞİTİM", items: [] },
          { label: "Python", items: [] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Python"])
  })

  it("removes language and certification values from the skill list", () => {
    // Bir katılım belgesinin "Bilgisayar Mühendisliği mezunu" gereksinimiyle
    // eşleşmesi uydurma eşleşmedir (K-20).
    expect(
      flattenSkillLines({
        lines: [
          { label: "B1 seviye İngilizce", items: [] },
          { label: "Modern Yazılım Mühendisliği Katılım Belgesi", items: [] },
          { label: "Python", items: [] },
        ],
        languages: ["B1 seviye İngilizce"],
        certifications: ["Modern Yazılım Mühendisliği Katılım Belgesi"],
      }),
    ).toEqual(["Python"])
  })
})

describe("flattenSkillLines · technology names with dots", () => {
  it("does not drop Next.js, Vue.js and ASP.NET as sentences", () => {
    // K-38: uçtan uca testte bu iki beceri indirilen CV'den kaybolmuştu.
    expect(
      flattenSkillLines({
        lines: [
          { label: "", items: ["React", "Next.js", "Vue.js", "Node.js", "ASP.NET Core"] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["React", "Next.js", "Vue.js", "Node.js", "ASP.NET Core"])
  })

  it("still treats a short item ending in a period as a sentence", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "Takım çalışması", items: ["Uyumlu çalışırım."] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["Takım çalışması"])
  })
})

describe("flattenSkillLines · sentence leakage", () => {
  it("does not treat a sentence label as a skill", () => {
    // Bölümlemenin karıştığı CV'lerde deneyim maddeleri beceri bloğuna
    // sızıyor ve etiket olarak geliyor.
    expect(
      flattenSkillLines({
        lines: [
          { label: "Robotik kodlama, tasarım ve üretim eğitimleri verdim.", items: [] },
          { label: "Öğrencilere proje geliştirme süreçlerinde mentorluk yaptım.", items: [] },
          { label: "Python", items: [] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Python"])
  })

  it("also treats a long label without a period as a sentence", () => {
    expect(
      flattenSkillLines({
        lines: [
          { label: "Eğitim içerikleri ve uygulamalı atölyeler hazırladım", items: [] },
          { label: "Git & GitHub", items: [] },
        ],
        languages: [], certifications: [],
      }),
    ).toEqual(["Git & GitHub"])
  })
})

describe("skillGroups (DOG-106)", () => {
  it("keeps the resume's own categories in order", () => {
    expect(
      skillGroups({
        lines: [
          { label: "TECHNICAL SKILLS", items: [] },
          { label: "AI / LLM", items: ["RAG", "MCP"] },
          { label: "Backend", items: ["Python", "FastAPI"] },
        ],
        languages: [],
        certifications: [],
      }),
    ).toEqual([
      { name: "AI / LLM", items: ["RAG", "MCP"] },
      { name: "Backend", items: ["Python", "FastAPI"] },
    ])
  })

  it("puts label-as-skill lines into one unnamed group", () => {
    // cv-b: "Manual Testing: Performing…" satırlarında etiket becerinin kendisi.
    expect(
      skillGroups({
        lines: [
          { label: "Manual Testing", items: [] },
          { label: "API Validation", items: [] },
          { label: "Programming & Query Languages", items: ["Java", "SQL Queries"] },
        ],
        languages: [],
        certifications: [],
      }),
    ).toEqual([
      { name: null, items: ["Manual Testing", "API Validation"] },
      { name: "Programming & Query Languages", items: ["Java", "SQL Queries"] },
    ])
  })

  it("a label that only names its own items is not a category", () => {
    // cv-c: "Git & GitHub" → ["Git", "GitHub"]; belgede "Git & GitHub: Git, GitHub" çıkıyordu.
    expect(
      skillGroups({
        lines: [
          { label: "Git & GitHub", items: ["Git", "GitHub"] },
          { label: "Tasarım Araçları", items: ["Canva", "Photoshop"] },
        ],
        languages: [],
        certifications: [],
      }),
    ).toEqual([
      { name: null, items: ["Git", "GitHub"] },
      { name: "Tasarım Araçları", items: ["Canva", "Photoshop"] },
    ])
  })

  it("is undefined when the resume has no categories; the document falls back to one line", () => {
    expect(
      skillGroups({ lines: [{ label: "", items: ["Excel", "SAP"] }], languages: [], certifications: [] }),
    ).toBeUndefined()
  })

  it("a section heading is not a group name", () => {
    expect(
      skillGroups({
        lines: [
          { label: "Technical Skills", items: ["Java"] },
          { label: "Araçlar ve Yöntemler", items: ["Jira"] },
        ],
        languages: [],
        certifications: [],
      }),
    ).toEqual([
      { name: null, items: ["Java"] },
      { name: "Araçlar ve Yöntemler", items: ["Jira"] },
    ])
  })

  it("flattened groups equal the flat list: languages, certifications and duplicates stay out", () => {
    const data = {
      lines: [
        { label: "Project Tools", items: ["Jira", "Excel"] },
        { label: "Office", items: ["Excel", "İngilizce (C1)"] },
        { label: "Languages", items: ["İngilizce (C1)"] },
      ],
      languages: ["İngilizce (C1)"],
      certifications: [],
    }
    const groups = skillGroups(data)!
    expect(groups).toEqual([{ name: "Project Tools", items: ["Jira", "Excel"] }])
    expect(groups.flatMap((g) => g.items)).toEqual(flattenSkillLines(data))
  })
})

describe("flattenSkillLines · language leaking into skills", () => {
  it("drops a language written with its level in a different order", () => {
    // cv-c: beceri satırında "B1 seviye İngilizce", diller alanında "İngilizce B1".
    expect(
      flattenSkillLines({
        lines: [{ label: "", items: ["B1 seviye İngilizce", "Python", "İngilizce", "Excel"] }],
        languages: ["İngilizce B1"],
        certifications: [],
      }),
    ).toEqual(["Python", "Excel"])
  })

  it("keeps a skill that only contains a language word", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "", items: ["İngilizce teknik yazışma", "Python"] }],
        languages: ["İngilizce (C1)"],
        certifications: [],
      }),
    ).toEqual(["İngilizce teknik yazışma", "Python"])
  })
})
