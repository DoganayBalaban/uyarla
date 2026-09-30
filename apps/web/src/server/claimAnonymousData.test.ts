import { describe, it, expect, vi } from "vitest"
import { claimOperations } from "@/server/claimAnonymousData"

/** Hangi tabloya hangi where/data ile gidildiğini yakalayan sahte Prisma. */
function fakePrisma() {
  const callList: Array<{ tablo: string; where: unknown; data: unknown }> = []
  const make = (tablo: string) => ({
    updateMany: vi.fn((args: { where: unknown; data: unknown }) => {
      callList.push({ tablo, ...args })
      return { count: 0 }
    }),
  })
  return {
    callList,
    client: { resume: make("resume"), analysis: make("analysis"), jobPosting: make("jobPosting") },
  }
}

describe("claimOperations", () => {
  it("moves all three tables from the anonymous user to the new user", () => {
    const { callList, client } = fakePrisma()
    claimOperations(client as never, "anon1", "yeni1")
    expect(callList.map((c) => c.tablo).sort()).toEqual(["analysis", "jobPosting", "resume"])
  })

  it("targets only the anonymous user's rows", () => {
    // Bu dosyanın en kritik iddiası: where koşulu düşerse BÜTÜN
    // kullanıcıların verisi tek hesaba taşınır.
    const { callList, client } = fakePrisma()
    claimOperations(client as never, "anon1", "yeni1")
    for (const c of callList) {
      expect(c.where).toEqual({ userId: "anon1" })
      expect(c.data).toEqual({ userId: "yeni1" })
    }
  })

  it("produces no operation for the same id", () => {
    // Kendine taşımak anlamsız ve bir hata işareti.
    const { callList, client } = fakePrisma()
    claimOperations(client as never, "ayni", "ayni")
    expect(callList).toHaveLength(0)
  })

  it("throws for an empty id", () => {
    const { client } = fakePrisma()
    expect(() => claimOperations(client as never, "", "yeni1")).toThrow(/kimlik/i)
    expect(() => claimOperations(client as never, "anon1", "")).toThrow(/kimlik/i)
  })
})
