import { describe, expect, it } from "vitest"
import {
  createAutoSubmitGate,
  extensionIdsFromEnv,
  readExtensionHandoff,
  shouldAutoSubmit,
  verifyHandoff,
  type SendMessage,
} from "@/features/analysis/extensionHandoff"

const TEXT = "Muhasebe Uzmanı — Mimeda\n\nGenel muhasebe süreçleri, Logo ERP, 3 yıl deneyim, MS Excel orta seviye."
const hash = (text: string, source?: string) =>
  `#ilan=${encodeURIComponent(text)}${source ? `&kaynak=${encodeURIComponent(source)}` : ""}`

describe("readExtensionHandoff", () => {
  it("reads the posting text and its source page", () => {
    expect(readExtensionHandoff(hash(TEXT, "https://www.kariyer.net/is-ilani/x-1"), "")).toEqual({
      jobText: TEXT,
      sourceUrl: "https://www.kariyer.net/is-ilani/x-1",
      token: null,
    })
  })

  it("round-trips special characters", () => {
    // Review Focus 1: + % & # ve Türkçe harf bozulmamalı.
    const tricky = `${TEXT} C++ & %50 prim #1 İşçi ğüşöç`
    expect(readExtensionHandoff(hash(tricky), "")!.jobText).toBe(tricky)
  })

  it("ignores a missing, short or malformed handoff", () => {
    expect(readExtensionHandoff("", "")).toBeNull()
    expect(readExtensionHandoff("#baska=1", "")).toBeNull()
    expect(readExtensionHandoff(hash("kısa"), "")).toBeNull()
    expect(readExtensionHandoff("#ilan=%E0%A4%A", "")).toBeNull()
  })

  it("ignores the handoff on a saved-result address", () => {
    // Review Focus 4: ?analiz= sonucu gösteriyor; form doldurulmaz.
    expect(readExtensionHandoff(hash(TEXT), "?analiz=abc")).toBeNull()
  })

  it("drops a source that is not an http(s) address", () => {
    expect(readExtensionHandoff(hash(TEXT, "javascript:alert(1)"), "")!.sourceUrl).toBeNull()
  })
})

describe("shouldAutoSubmit", () => {
  it("submits for a registered user with a preselected resume when the extension vouched for it", () => {
    expect(shouldAutoSubmit({ registered: true, resumeId: "r1", jobText: TEXT, verified: true })).toBe(true)
  })

  it("waits when the extension did not vouch for the link (DOG-71)", () => {
    // Başka bir sitenin #ilan= bağlantısı: form dolar ama analiz başlamaz.
    expect(shouldAutoSubmit({ registered: true, resumeId: "r1", jobText: TEXT, verified: false })).toBe(false)
  })

  it("waits for an anonymous user or a missing resume", () => {
    // Review Focus 3.
    expect(shouldAutoSubmit({ registered: false, resumeId: "r1", jobText: TEXT, verified: true })).toBe(false)
    expect(shouldAutoSubmit({ registered: true, resumeId: undefined, jobText: TEXT, verified: true })).toBe(false)
  })
})

describe("createAutoSubmitGate", () => {
  it("opens once", () => {
    // Review Focus 2: Strict Mode efekti iki kez çalıştırsa da tek gönderim.
    const gate = createAutoSubmitGate()
    expect(gate()).toBe(true)
    expect(gate()).toBe(false)
  })
})

describe("readExtensionHandoff · jeton (DOG-71)", () => {
  it("reads the token the extension added", () => {
    expect(readExtensionHandoff(`${hash(TEXT)}&jeton=abc-123`, "")!.token).toBe("abc-123")
  })
})

describe("verifyHandoff (DOG-71)", () => {
  const answering =
    (answers: Record<string, unknown>): SendMessage =>
    (id, _message, callback) =>
      setTimeout(() => callback(answers[id]), 0)

  it("is verified when one of the configured extensions vouches for the token", async () => {
    const send = answering({ magaza: undefined, gelistirme: { valid: true } })
    expect(await verifyHandoff("t1", ["magaza", "gelistirme"], send)).toBe(true)
  })

  it("is not verified when the extension rejects the token", async () => {
    expect(await verifyHandoff("t1", ["gelistirme"], answering({ gelistirme: { valid: false } }))).toBe(false)
  })

  it("is not verified without a token, an extension id or the extension itself", async () => {
    expect(await verifyHandoff(null, ["gelistirme"], answering({ gelistirme: { valid: true } }))).toBe(false)
    expect(await verifyHandoff("t1", [], answering({}))).toBe(false)
    expect(await verifyHandoff("t1", ["gelistirme"], undefined)).toBe(false)
  })

  it("gives up after the timeout when nobody answers", async () => {
    const silent: SendMessage = () => {}
    expect(await verifyHandoff("t1", ["gelistirme"], silent, 20)).toBe(false)
  })
})

describe("extensionIdsFromEnv", () => {
  it("splits and trims a comma separated list", () => {
    expect(extensionIdsFromEnv(" abc , def ,, ")).toEqual(["abc", "def"])
    expect(extensionIdsFromEnv(undefined)).toEqual([])
  })
})
