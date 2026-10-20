import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditText } from "@/features/adaptation/components/EditText"

describe("EditText (DOG-92)", () => {
  it("offers editing and says when the new version is the user's own", () => {
    const save = async () => null
    expect(renderToStaticMarkup(<EditText text="Metin" busy={false} onSave={save} />)).toContain("Düzenle")
    expect(renderToStaticMarkup(<EditText text="Metin" busy={false} onSave={save} />)).not.toContain("senin düzenlemen")
    expect(renderToStaticMarkup(<EditText text="Metin" edited busy={false} onSave={save} />)).toContain("Yeni hâli senin düzenlemen.")
  })
})
