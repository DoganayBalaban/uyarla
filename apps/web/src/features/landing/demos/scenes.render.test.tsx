import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loopMs } from "@/features/landing/demos/demoScript"
import { JOB_PHASES } from "@/features/landing/demos/scenes"
import { JobSearchDemo, JobSearchFilm } from "@/features/landing/demos/JobSearchDemo"

/** Her sahne son karesinde (hareket azaltma) anlamlı metni gösteriyor. */
describe("scenes (DOG-160)", () => {
  it("job search ends with the four sites and the query", () => {
    const html = renderToStaticMarkup(<JobSearchFilm ms={loopMs(JOB_PHASES) - 1} />)
    for (const label of ["Kariyer.net", "LinkedIn", "Jooble", "Careerjet"]) expect(html).toContain(label)
    expect(html).toContain("frontend geliştirici react")
    expect(renderToStaticMarkup(<JobSearchDemo />)).toContain('role="figure"')
  })
})
