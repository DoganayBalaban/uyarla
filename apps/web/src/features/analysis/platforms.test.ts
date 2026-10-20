import { describe, expect, it } from "vitest"
import { PLATFORMS, detectPlatform, sanitizeSourceUrl } from "@/features/analysis/platforms"

describe("platforms (DOG-95)", () => {
  it("detects the platform from the posting's host, subdomains included", () => {
    expect(detectPlatform("https://www.kariyer.net/is-ilani/acme-frontend-gelistirici-123")).toBe("kariyernet")
    expect(detectPlatform("https://tr.linkedin.com/jobs/view/123")).toBe("linkedin")
    expect(detectPlatform("https://job-boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse")
    expect(detectPlatform("https://jobs.eu.lever.co/acme/abc")).toBe("lever")
    expect(detectPlatform("https://acme.wd3.myworkdayjobs.com/en-US/careers/job/x")).toBe("workday")
    expect(detectPlatform("https://career2.successfactors.eu/career?company=acme")).toBe("successfactors")
    expect(detectPlatform("https://isealimkariyerkapisi.cbiko.gov.tr/ilan/1")).toBe("kariyerkapisi")
  })

  it("does not match look-alike hosts or non-web addresses", () => {
    expect(detectPlatform("https://notkariyer.net/x")).toBeNull()
    expect(detectPlatform("https://kariyer.net.evil.com/x")).toBeNull()
    expect(detectPlatform("ftp://kariyer.net/x")).toBeNull()
    expect(detectPlatform("kariyer.net")).toBeNull()
    expect(detectPlatform(null)).toBeNull()
  })

  it("stores the address without query, fragment or credentials", () => {
    expect(sanitizeSourceUrl(" https://u:p@boards.greenhouse.io/acme/jobs/1?gh_src=abc#apply ")).toBe("https://boards.greenhouse.io/acme/jobs/1")
    expect(sanitizeSourceUrl("javascript:alert(1)")).toBeNull()
    expect(sanitizeSourceUrl("")).toBeNull()
    expect(sanitizeSourceUrl(null)).toBeNull()
    expect(sanitizeSourceUrl(`https://a.com/${"x".repeat(600)}`)).toBeNull()
  })

  it("every tip names an https source", () => {
    for (const p of Object.values(PLATFORMS)) {
      expect(p.tips.length).toBeGreaterThan(0)
      for (const t of p.tips) expect(t.source.url).toMatch(/^https:\/\//)
    }
  })
})
