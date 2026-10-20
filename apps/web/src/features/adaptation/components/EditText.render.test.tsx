import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditText, needsPreview, scoreDelta } from "@/features/adaptation/components/EditText"

describe("EditText (DOG-92)", () => {
  it("offers editing and says when the new version is the user's own", () => {
    const save = async () => null
    expect(renderToStaticMarkup(<EditText text="Metin" busy={false} onSave={save} />)).toContain("Düzenle")
    expect(renderToStaticMarkup(<EditText text="Metin" busy={false} onSave={save} />)).not.toContain("senin düzenlemen")
    expect(renderToStaticMarkup(<EditText text="Metin" edited busy={false} onSave={save} />)).toContain("Yeni hâli senin düzenlemen.")
  })
})

describe("live score helpers (DOG-92)", () => {
  it("previews only a changed, non-empty text", () => {
    expect(needsPreview("React ve TypeScript", "React")).toBe(true)
    expect(needsPreview(" React ", "React")).toBe(false)
    expect(needsPreview("   ", "React")).toBe(false)
    expect(needsPreview(null, "React")).toBe(false)
  })

  it("shows the change against the current score", () => {
    expect(scoreDelta(48, 45)).toBe(3)
    expect(scoreDelta(44.6, 45.2)).toBe(0)
    expect(scoreDelta(null, 45)).toBeNull()
  })
})
