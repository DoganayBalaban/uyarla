import { describe, expect, it } from "vitest"
import { JOB_SITES, JOB_SITES_TITLE } from "@/features/landing/jobSites"

describe("job sites strip (DOG-83)", () => {
  it("lists the sites whose postings uyarla reads", () => {
    expect(JOB_SITES.map((s) => s.name)).toEqual(["LinkedIn", "Kariyer.net", "Indeed", "Yenibiris", "Secretcv", "Eleman.net"])
  })

  it("frames the strip as where postings come from, never as partners or hires", () => {
    // Marka rehberi §11 ve Polar itirazı: işe giriş ya da ortaklık ima edilmez.
    const copy = JOB_SITES_TITLE.toLocaleLowerCase("tr")
    for (const banned of ["işe gir", "ortak", "partner", "güven", "kullanıyor"]) expect(copy).not.toContain(banned)
  })
})
