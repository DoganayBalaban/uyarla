import { describe, expect, it } from "vitest"
import { stripQuery } from "@/components/providers/WebAnalytics"

describe("stripQuery (DOG-111)", () => {
  it("sends only the path, never query strings or fragments", () => {
    const event = { type: "pageview" as const, url: "https://uyarla.com.tr/analyze?uyarla=cmabc123&donus=%2Fplans#sonuc" }
    expect(stripQuery(event).url).toBe("https://uyarla.com.tr/analyze")
  })
})
