import { describe, expect, it } from "vitest"
import { enabledProviders as enabledProviders, providerSettings as providerSettings } from "@/features/auth/providers"

describe("social login providers", () => {
  it("none is enabled without credentials", () => {
    expect(enabledProviders({})).toEqual([])
  })

  it("enables only providers with both variables set", () => {
    const env = {
      GOOGLE_CLIENT_ID: "g-id",
      GOOGLE_CLIENT_SECRET: "g-secret",
      GITHUB_CLIENT_ID: "gh-id", // secret eksik
      LINKEDIN_CLIENT_SECRET: "", // id eksik, secret boş
    }
    expect(enabledProviders(env)).toEqual(["google"])
    expect(providerSettings(env)).toEqual({
      google: { clientId: "g-id", clientSecret: "g-secret" },
    })
  })
})
