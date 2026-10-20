import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PlatformTips } from "@/features/analysis/components/PlatformTips"

describe("PlatformTips (DOG-95)", () => {
  it("shows the platform's tips with their sources, nothing for an unknown platform", () => {
    const html = renderToStaticMarkup(<PlatformTips platform="linkedin" />)
    expect(html).toContain("Bu ilan LinkedIn üzerinden")
    expect(html).toContain("Kaynak: LinkedIn Yardım")
    expect(html).toContain('href="https://www.linkedin.com/help/linkedin/answer/a510363"')
    expect(renderToStaticMarkup(<PlatformTips platform={null} />)).toBe("")
  })
})
