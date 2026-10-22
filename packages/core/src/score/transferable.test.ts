import { describe, expect, it, vi } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { findTransferable, readTransferable, toItems } from "./transferable.js"

const profile: ResumeProfile = {
  fullName: "Aday",
  headline: null,
  summary: null,
  experience: [
    {
      company: "Anadolu İş Makinaları",
      title: "Saha Satış Mühendisi",
      startDate: "2021",
      endDate: "halen",
      bullets: [
        { text: "Müşterilerle fiyat ve teslim koşullarını pazarlık ederek yıllık sözleşmeler imzaladım.", sourceRef: "Müşterilerle fiyat ve teslim koşullarını pazarlık ederek yıllık sözleşmeler imzaladım." },
        { text: "Aylık satış raporlarını hazırladım.", sourceRef: "Aylık satış raporlarını hazırladım." },
      ],
    },
  ],
  education: [],
  skills: ["CRM"],
  languages: [],
  certifications: [],
}
const posting = { position: "Satın Alma Uzmanı", company: null, seniority: null, language: "tr", requirements: [] } as unknown as JobPostingData
const input = {
  profile,
  posting,
  missingMust: [
    { index: 2, text: "Tedarikçilerle pazarlık deneyimi" },
    { index: 5, text: "SAP MM bilgisi" },
  ],
}

describe("transferable experience (DOG-100)", () => {
  it("keeps a verbatim CV bullet with its reason and drops the rest", () => {
    const items = toItems(
      [
        { sira: 1, alinti: "müşterilerle fiyat ve teslim koşullarını pazarlık ederek yıllık sözleşmeler imzaladım", gerekce: "Müşteriyle yaptığın pazarlık, tedarikçiyle pazarlıkta da aynı beceri." },
        { sira: 2, alinti: "SAP sistemlerinde çalıştım", gerekce: "SAP deneyimin var." },
      ],
      input,
      "kaynak",
    )
    expect(items[0]).toMatchObject({
      requirementIndex: 2,
      quote: "Müşterilerle fiyat ve teslim koşullarını pazarlık ederek yıllık sözleşmeler imzaladım.",
      verification: { status: "ok" },
    })
    // CV'de birebir olmayan alıntı uydurma sayılıyor; öneri düşüyor.
    expect(items[1]).toEqual({ requirementIndex: 5, requirement: "SAP MM bilgisi", quote: null, reason: null, verification: null })
  })

  it("flags a number in the reason that the CV doesn't have", () => {
    const [item] = toItems(
      [{ sira: 1, alinti: "Aylık satış raporlarını hazırladım.", gerekce: "3 yıl boyunca rapor hazırladın." }],
      input,
      "Aylık satış raporlarını hazırladım.",
    )
    expect(item?.verification?.status).toBe("flagged")
  })

  it("skips the model when nothing is missing", async () => {
    const llm = { extract: vi.fn() }
    expect(await findTransferable(llm as never, { ...input, missingMust: [] })).toEqual({ data: [], tokens: 0 })
    expect(llm.extract).not.toHaveBeenCalled()
  })

  it("reads a stored record tolerantly", () => {
    expect(readTransferable({ status: "running", createdAt: "x", attempts: 1 })).toEqual({ status: "running", createdAt: "x", attempts: 1 })
    expect(readTransferable({ status: "done", createdAt: "x", attempts: 1, items: [] })).toMatchObject({ status: "done", items: [] })
    expect(readTransferable({ status: "done", createdAt: "x" })).toBeNull()
    expect(readTransferable(null)).toBeNull()
  })
})
