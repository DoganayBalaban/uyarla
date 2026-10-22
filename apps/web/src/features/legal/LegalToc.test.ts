import { describe, expect, it } from "vitest"
import { slugify } from "@/features/legal/LegalToc"

describe("legal page anchors (DOG-156)", () => {
  it("turns Turkish headings into plain anchors", () => {
    expect(slugify("1. Veri sorumlusu")).toBe("1-veri-sorumlusu")
    expect(slugify("Kişisel verilerin işlenme amaçları")).toBe("kisisel-verilerin-islenme-amaclari")
    expect(slugify("Çerezler ve Üçüncü Taraflar")).toBe("cerezler-ve-ucuncu-taraflar")
  })
})
