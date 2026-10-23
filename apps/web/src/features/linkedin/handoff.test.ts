import { describe, expect, it } from "vitest"
import { detectExtension, readProfileHandoff } from "@/features/linkedin/handoff"

const profile = { name: "Deniz Aksoy", headline: "Uzman · İstanbul", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }
const encode = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

describe("readProfileHandoff", () => {
  it("decodes the extension's profile and token", () => {
    expect(readProfileHandoff(`#profil=${encode(profile)}&jeton=jt`)).toEqual({ profile, token: "jt" })
  })

  it("returns null without a profile and an error for broken data", () => {
    expect(readProfileHandoff("")).toBeNull()
    expect(readProfileHandoff("#ornek-ilanlar")).toBeNull()
    expect(readProfileHandoff("#profil=@@@&jeton=jt")).toEqual({ error: "invalid" })
    expect(readProfileHandoff(`#profil=${encode({ headline: 5 })}&jeton=jt`)).toEqual({ error: "invalid" })
  })
})

describe("detectExtension", () => {
  it("is true when any extension answers the ping", async () => {
    const send = (_id: string, _m: unknown, cb: (r: unknown) => void) => cb({ ok: true, version: "0.3.0" })
    expect(await detectExtension(["a"], send)).toBe(true)
  })

  it("does not wait for an id that never answers once another one says yes", async () => {
    const send = (id: string, _m: unknown, cb: (r: unknown) => void) => (id === "magaza" ? cb({ ok: true }) : undefined)
    expect(await detectExtension(["gelistirme", "magaza"], send, 5000)).toBe(true)
  })

  it("is false without a channel, without ids or on silence", async () => {
    expect(await detectExtension(["a"], undefined)).toBe(false)
    expect(await detectExtension([], () => {})).toBe(false)
    expect(await detectExtension(["a"], () => {}, 20)).toBe(false)
  })
})
