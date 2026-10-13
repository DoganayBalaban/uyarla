import { describe, expect, it } from "vitest"
import { searchCareerjet, searchJooble } from "./sources.js"

function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fn = async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status })
  }
  return { fn: fn as typeof fetch, calls }
}

describe("searchJooble", () => {
  it("posts the query to the keyed endpoint and normalizes the jobs", async () => {
    const { fn, calls } = fakeFetch({
      totalCount: 42,
      jobs: [
        {
          id: 7,
          title: "Muhasebe Uzmanı",
          company: "Mimeda",
          location: "İstanbul",
          snippet: "Genel muhasebe, <b>Logo</b> ERP…",
          link: "https://tr.jooble.org/desc/7",
          source: "kariyer.net",
          updated: "2026-10-10T00:00:00",
        },
      ],
    })

    const r = await searchJooble(
      { apiKey: "anahtar", baseUrl: "https://jooble.org/api/", fetch: fn },
      { keywords: "muhasebe uzmanı", location: "İstanbul" },
    )

    expect(calls[0]!.url).toBe("https://jooble.org/api/anahtar")
    expect(calls[0]!.init!.method).toBe("POST")
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ keywords: "muhasebe uzmanı", location: "İstanbul" })
    expect(r.total).toBe(42)
    expect(r.jobs[0]).toEqual({
      source: "jooble",
      origin: "kariyer.net",
      title: "Muhasebe Uzmanı",
      company: "Mimeda",
      location: "İstanbul",
      // Kaynaklar özette HTML etiketi bırakıyor; düz metne iniyor.
      snippet: "Genel muhasebe, Logo ERP…",
      url: "https://tr.jooble.org/desc/7",
      postedAt: "2026-10-10T00:00:00",
    })
  })

  it("explains a rejected key instead of returning nothing", async () => {
    const { fn } = fakeFetch({}, 403)
    await expect(
      searchJooble({ apiKey: "yanlis", baseUrl: "https://jooble.org/api/", fetch: fn }, { keywords: "x", location: "" }),
    ).rejects.toThrow(/Jooble.*403/)
  })
})

describe("searchCareerjet", () => {
  it("sends basic auth, locale and the visitor, and normalizes the jobs", async () => {
    const { fn, calls } = fakeFetch({
      type: "JOBS",
      hits: 120,
      jobs: [
        {
          title: "Satış Danışmanı",
          company: "Borusan Cat",
          locations: "İstanbul",
          description: "Saha satışı, teklif hazırlama",
          url: "https://jobviewtrack.com/x",
          site: "www.kariyer.net",
          date: "Fri, 10 Oct 2026 00:00:00 GMT",
          salary: "",
        },
      ],
    })

    const r = await searchCareerjet(
      { apiKey: "anahtar", locale: "tr_TR", fetch: fn },
      { keywords: "satış danışmanı", location: "İstanbul" },
      { ip: "1.2.3.4", userAgent: "Mozilla/5.0" },
    )

    const url = new URL(calls[0]!.url)
    expect(url.origin + url.pathname).toBe("https://search.api.careerjet.net/v4/query")
    expect(url.searchParams.get("locale_code")).toBe("tr_TR")
    expect(url.searchParams.get("user_ip")).toBe("1.2.3.4")
    expect(url.searchParams.get("user_agent")).toBe("Mozilla/5.0")
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("anahtar:").toString("base64")}`,
    )
    expect(r.total).toBe(120)
    expect(r.jobs[0]).toMatchObject({
      source: "careerjet",
      origin: "www.kariyer.net",
      title: "Satış Danışmanı",
      company: "Borusan Cat",
      location: "İstanbul",
      snippet: "Saha satışı, teklif hazırlama",
      url: "https://jobviewtrack.com/x",
    })
  })

  it("returns no jobs for a location-disambiguation answer", async () => {
    // Belirsiz konumda Careerjet ilan yerine konum listesi döndürüyor.
    const { fn } = fakeFetch({ type: "LOCATIONS", locations: ["İstanbul", "İstanbul Anadolu"] })
    const r = await searchCareerjet(
      { apiKey: "k", locale: "tr_TR", fetch: fn },
      { keywords: "x", location: "ist" },
      { ip: "1.2.3.4", userAgent: "ua" },
    )
    expect(r).toEqual({ total: 0, jobs: [] })
  })
})
