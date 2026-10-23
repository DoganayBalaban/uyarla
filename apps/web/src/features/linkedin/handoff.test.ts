import { describe, expect, it } from "vitest"
import { detectExtension, readProfileHandoff, rememberPostings, takePostings } from "@/features/linkedin/handoff"

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

describe("rememberPostings, takePostings (son inceleme)", () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }
  const now = new Date("2026-10-23T12:00:00Z")
  const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

  it("carries the postings picked before opening LinkedIn to the extension's handoff, once", () => {
    const s = memory()
    rememberPostings(s, ["a1", "a2"], now)
    expect(takePostings(s, later(5))).toEqual(["a1", "a2"])
    expect(takePostings(s, later(6))).toEqual([])
  })

  it("forgets an old choice, an emptied choice and broken data; works without storage", () => {
    const s = memory()
    rememberPostings(s, ["a1"], now)
    expect(takePostings(s, later(61))).toEqual([])
    rememberPostings(s, ["a1"], now)
    rememberPostings(s, [], now)
    expect(takePostings(s, later(1))).toEqual([])
    for (const v of s.m.keys()) s.m.set(v, "bozuk")
    s.m.set("uyarla:linkedin-ilanlar", "{bozuk")
    expect(takePostings(s, later(1))).toEqual([])
    expect(() => rememberPostings(null, ["a1"], now)).not.toThrow()
    expect(takePostings(null, now)).toEqual([])
  })
})
