import { describe, expect, it } from "vitest"
import { resumeStepCopy } from "@/features/onboarding/resumeStep"

describe("resumeStepCopy", () => {
  it("asks for the CV when the library is empty", () => {
    expect(resumeStepCopy(null).title).toBe("CV'ni bir kez yükle")
  })

  it("says the analyzed CV is already saved instead of asking again (DOG-166)", () => {
    // Kullanıcı testi: kayıttan sonra kurulum, az önce analiz edilen CV'yi yeniden istiyordu.
    const copy = resumeStepCopy({ label: null, fileName: "Deniz-Aksoy-CV.pdf" })
    expect(copy.title).toBe("CV'n kayıtlı")
    expect(copy.description).toContain("Deniz-Aksoy-CV.pdf")
    expect(copy.skipLabel).toBe("Atla")
  })
})
