import { describe, it, expect } from "vitest"
import { flattenSkillLines } from "./skills.js"

describe("flattenSkillLines", () => {
  it("kategori satırında öğeleri alır, kategoriyi almaz", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "Programming Languages", items: ["Java", "SQL"] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["Java", "SQL"])
  })

  it("açıklama satırında etiketi alır, açıklamayı almaz", () => {
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

  it("öğesiz satırda etiketi beceri sayar", () => {
    expect(
      flattenSkillLines({
        lines: [{ label: "React", items: [] }],
        languages: [], certifications: [],
      }),
    ).toEqual(["React"])
  })

  it("bölüm başlıklarını beceri saymaz", () => {
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

  it("aynı beceriyi iki kez listelemez", () => {
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

  it("gerçek bir CV'nin iki bölümlü beceri listesini eksiksiz çıkarır", () => {
    // K-19: bu CV biçiminde model, iki bölümden yalnızca birini döndürüyordu.
    const sonuc = flattenSkillLines({
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

    expect(sonuc).toEqual([
      "Test Case Design & Execution", "Manual Testing",
      "Java", "SQL Queries", "JIRA", "Postman",
    ])
  })

  it("uzun ama noktasız bir öğeyi açıklama sayar", () => {
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

  it("boş girdide boş dizi döner", () => {
    expect(flattenSkillLines({ lines: [], languages: [], certifications: [] })).toEqual([])
  })
})
