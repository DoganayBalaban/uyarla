import { describe, expect, it } from "vitest"
import { addTerm, searchSuggestions } from "@/features/jobs/suggestions"

const profile = {
  experience: [
    { title: "Muhasebe Uzmanı", company: "A", bullets: [] },
    { title: "muhasebe uzmanı", company: "B", bullets: [] },
    { title: "Finans Asistanı", company: "C", bullets: [] },
  ],
  skills: ["SAP", "Excel", "sap", "Muhasebe Uzmanı", "Logo", "Raporlama", "Bütçe", "Vergi"],
} as never

describe("job search suggestions (DOG-150)", () => {
  it("puts the target role first and drops repeats in any case", () => {
    expect(searchSuggestions(profile, "Mali İşler Uzmanı")).toEqual({
      roles: ["Mali İşler Uzmanı", "Muhasebe Uzmanı", "Finans Asistanı"],
      skills: ["SAP", "Excel", "Logo", "Raporlama", "Bütçe"],
    })
    expect(searchSuggestions(profile, null).roles).toEqual(["Muhasebe Uzmanı", "Finans Asistanı"])
  })

  it("adds a term once", () => {
    expect(addTerm("", "SAP")).toBe("SAP")
    expect(addTerm("Muhasebe Uzmanı", "SAP")).toBe("Muhasebe Uzmanı SAP")
    expect(addTerm("Muhasebe Uzmanı SAP", "sap")).toBe("Muhasebe Uzmanı SAP")
  })
})
