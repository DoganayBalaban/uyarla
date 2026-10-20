import { describe, expect, it } from "vitest"
import { classifyPostingSource, postingSourceWarning } from "@/features/analysis/postingSource"

const kind = (url: string) => classifyPostingSource(url)?.kind

describe("posting source (DOG-125)", () => {
  it("trusts known portals, ATSs and institutions, subdomains included", () => {
    expect(kind("https://www.kariyer.net/is-ilani/x-1")).toBe("portal")
    expect(kind("https://tr.linkedin.com/jobs/view/1")).toBe("portal")
    expect(kind("https://job-boards.eu.greenhouse.io/acme/jobs/1")).toBe("ats")
    expect(kind("https://jobs.lever.co/acme/1")).toBe("ats")
    expect(kind("https://acme.wd3.myworkdayjobs.com/x")).toBe("ats")
    expect(kind("https://isealimkariyerkapisi.cbiko.gov.tr/ilan/1")).toBe("institution")
  })

  it("flags look-alikes of known names", () => {
    expect(classifyPostingSource("https://greenhouse.io.evil.com/jobs/1")).toEqual({ kind: "lookalike", host: "greenhouse.io.evil.com", imitates: "Greenhouse" })
    expect(classifyPostingSource("https://evil-greenhouse.io/jobs/1")?.imitates).toBe("Greenhouse")
    expect(classifyPostingSource("https://kariyer-net.com/ilan/1")?.imitates).toBe("Kariyer.net")
    expect(classifyPostingSource("https://kariyer.net.tr/ilan/1")?.imitates).toBe("Kariyer.net")
    expect(classifyPostingSource("https://linkedin-jobs.com/view/1")?.imitates).toBe("LinkedIn")
    // Adresteki kullanıcı kısmı düşüyor; asıl alan adı evil.com.
    expect(classifyPostingSource("https://greenhouse.io@evil.com/jobs/1")).toEqual({ kind: "unverified", host: "evil.com" })
  })

  it("does not cry wolf on company sites that merely contain a short name", () => {
    expect(kind("https://careers.clevercompany.com/jobs/1")).toBe("unverified")
    expect(kind("https://kariyer.acme.com.tr/ilan/1")).toBe("unverified")
    expect(kind("https://elemanbul.com/1")).toBe("unverified")
  })

  it("warns softly for unverified, strongly for look-alikes, not at all otherwise", () => {
    expect(postingSourceWarning(classifyPostingSource("https://careers.acme.com/1"))).toMatchObject({ tone: "soft" })
    expect(postingSourceWarning(classifyPostingSource("https://evil-greenhouse.io/1"))).toMatchObject({ tone: "strong" })
    expect(postingSourceWarning(classifyPostingSource("https://jobs.lever.co/acme/1"))).toBeNull()
    expect(postingSourceWarning(classifyPostingSource(null))).toBeNull()
    expect(classifyPostingSource("javascript:alert(1)")).toBeNull()
  })
})
