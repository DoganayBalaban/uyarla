import { describe, expect, it } from "vitest"
import { encodeProfile, isProfileUrl, profileHandoffUrl } from "./profile.js"

describe("isProfileUrl", () => {
  it("accepts a profile page, not its detail pages or other LinkedIn pages", () => {
    expect(isProfileUrl("https://www.linkedin.com/in/deniz-aksoy/")).toBe(true)
    expect(isProfileUrl("https://tr.linkedin.com/in/deniz-aksoy?originalSubdomain=tr")).toBe(true)
    expect(isProfileUrl("https://www.linkedin.com/in/deniz-aksoy/details/experience/")).toBe(false)
    expect(isProfileUrl("https://www.linkedin.com/jobs/view/123")).toBe(false)
    expect(isProfileUrl("https://example.com/in/deniz")).toBe(false)
    expect(isProfileUrl("bozuk")).toBe(false)
  })
})

describe("encodeProfile, profileHandoffUrl", () => {
  const profile = { name: "Deniz Aksoy", headline: "Uzman · İstanbul 😊", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }

  it("encodes UTF-8 JSON as URL-safe base64 that round-trips", () => {
    const encoded = encodeProfile(profile)
    expect(encoded).not.toMatch(/[+/=]/)
    const json = new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))
    expect(JSON.parse(json)).toEqual(profile)
  })

  it("puts profile and token in the fragment of /linkedin", () => {
    const url = profileHandoffUrl("https://uyarla.com.tr/", "abc", "jt")
    expect(url).toBe("https://uyarla.com.tr/linkedin#profil=abc&jeton=jt")
  })
})
