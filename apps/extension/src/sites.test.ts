import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { BUTTON_SITES, buttonSiteMatches, isButtonSite } from "./sites.js"

describe("button sites (DOG-169)", () => {
  it("covers LinkedIn, Kariyer.net and the other job sites, subdomains included", () => {
    for (const host of ["www.linkedin.com", "tr.linkedin.com", "www.kariyer.net", "www.yenibiris.com", "www.secretcv.com", "www.eleman.net", "tr.indeed.com", "boards.greenhouse.io", "jobs.lever.co", "acme.wd3.myworkdayjobs.com"]) {
      expect(isButtonSite(host), host).toBe(true)
    }
  })

  it("leaves other sites alone", () => {
    for (const host of ["www.google.com", "notlinkedin.com", "kariyer.net.example.com", "www.indeed.com"]) expect(isButtonSite(host), host).toBe(false)
  })

  it("keeps the manifest's content script sites the same as the list", () => {
    // Kurulumda Chrome'un gösterdiği izin bu listeden; README ve mağaza gerekçesi de.
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")) as { content_scripts: Array<{ matches: string[] }> }
    expect(manifest.content_scripts[0]!.matches).toEqual(buttonSiteMatches())
    expect(BUTTON_SITES.length).toBeGreaterThan(0)
  })
})
