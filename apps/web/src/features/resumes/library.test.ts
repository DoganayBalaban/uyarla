import { describe, expect, it } from "vitest"
import type { LibraryResume } from "@/features/resumes/schema"
import { initialResumeId, isLibraryFull, preselectResumeId, resumeTitle } from "@/features/resumes/library"

function resume(id: string, extra: Partial<LibraryResume> = {}): LibraryResume {
  return { id, label: null, fileName: `${id}.pdf`, createdAt: "2026-10-06T00:00:00.000Z", isDefault: false, ...extra }
}

describe("resumeTitle", () => {
  it("prefers the label, then the file name, then a generic title", () => {
    expect(resumeTitle({ label: "Frontend CV", fileName: "a.pdf" })).toBe("Frontend CV")
    expect(resumeTitle({ label: null, fileName: "a.pdf" })).toBe("a.pdf")
    expect(resumeTitle({ label: null, fileName: null })).toBe("Kayıtlı CV")
  })
})

describe("initialResumeId", () => {
  it("picks the default, else the first, else none", () => {
    expect(initialResumeId([resume("a"), resume("b", { isDefault: true })])).toBe("b")
    expect(initialResumeId([resume("a"), resume("b")])).toBe("a")
    expect(initialResumeId([])).toBeNull()
  })
})

describe("isLibraryFull", () => {
  it("is full at five", () => {
    expect(isLibraryFull(["a", "b", "c", "d"].map((id) => resume(id)))).toBe(false)
    expect(isLibraryFull(["a", "b", "c", "d", "e"].map((id) => resume(id)))).toBe(true)
  })
})

describe("preselectResumeId", () => {
  const list = [resume("a"), resume("b", { isDefault: true })]

  it("preselects the default when nothing is chosen", () => {
    expect(preselectResumeId({ resumes: list, current: undefined, hasFile: false, picked: false })).toBe("b")
  })

  it("leaves a chosen file alone, even when the library arrives later", () => {
    expect(preselectResumeId({ resumes: list, current: undefined, hasFile: true, picked: false })).toBeUndefined()
  })

  it("respects the user's own choice", () => {
    expect(preselectResumeId({ resumes: list, current: "a", hasFile: false, picked: true })).toBeUndefined()
    expect(preselectResumeId({ resumes: list, current: undefined, hasFile: false, picked: true })).toBeUndefined()
  })

  it("drops a selection that is no longer in the library", () => {
    expect(preselectResumeId({ resumes: list, current: "gone", hasFile: false, picked: true })).toBe("b")
    expect(preselectResumeId({ resumes: [], current: "gone", hasFile: false, picked: true })).toBeNull()
  })

  it("changes nothing when the current selection is valid", () => {
    expect(preselectResumeId({ resumes: list, current: "b", hasFile: false, picked: false })).toBeUndefined()
  })
})

