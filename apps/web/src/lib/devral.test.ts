import { describe, it, expect, vi } from "vitest"
import { devralmaIslemleri } from "./devral"

/** Hangi tabloya hangi where/data ile gidildiğini yakalayan sahte Prisma. */
function sahtePrisma() {
  const cagrilar: Array<{ tablo: string; where: unknown; data: unknown }> = []
  const yap = (tablo: string) => ({
    updateMany: vi.fn((args: { where: unknown; data: unknown }) => {
      cagrilar.push({ tablo, ...args })
      return { count: 0 }
    }),
  })
  return {
    cagrilar,
    client: { resume: yap("resume"), analysis: yap("analysis"), jobPosting: yap("jobPosting") },
  }
}

describe("devralmaIslemleri", () => {
  it("üç tabloyu da anonim kullanıcıdan yeni kullanıcıya taşır", () => {
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "anon1", "yeni1")
    expect(cagrilar.map((c) => c.tablo).sort()).toEqual(["analysis", "jobPosting", "resume"])
  })

  it("yalnızca anonim kullanıcının satırlarını hedefler", () => {
    // Bu dosyanın en kritik iddiası: where koşulu düşerse BÜTÜN
    // kullanıcıların verisi tek hesaba taşınır.
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "anon1", "yeni1")
    for (const c of cagrilar) {
      expect(c.where).toEqual({ userId: "anon1" })
      expect(c.data).toEqual({ userId: "yeni1" })
    }
  })

  it("aynı kimlikte hiçbir işlem üretmez", () => {
    // Kendine taşımak anlamsız ve bir hata işareti.
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "ayni", "ayni")
    expect(cagrilar).toHaveLength(0)
  })

  it("boş kimlikte hata fırlatır", () => {
    const { client } = sahtePrisma()
    expect(() => devralmaIslemleri(client as never, "", "yeni1")).toThrow(/kimlik/i)
    expect(() => devralmaIslemleri(client as never, "anon1", "")).toThrow(/kimlik/i)
  })
})
