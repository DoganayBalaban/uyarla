import { describe, expect, it } from "vitest"
import { acikSaglayicilar, saglayiciAyarlari } from "./saglayicilar"

describe("sosyal giriş sağlayıcıları", () => {
  it("kimlik bilgisi yoksa hiçbiri açılmıyor", () => {
    expect(acikSaglayicilar({})).toEqual([])
  })

  it("yalnızca iki değişkeni de dolu olanı açıyor", () => {
    const env = {
      GOOGLE_CLIENT_ID: "g-id",
      GOOGLE_CLIENT_SECRET: "g-secret",
      GITHUB_CLIENT_ID: "gh-id", // secret eksik
      LINKEDIN_CLIENT_SECRET: "", // id eksik, secret boş
    }
    expect(acikSaglayicilar(env)).toEqual(["google"])
    expect(saglayiciAyarlari(env)).toEqual({
      google: { clientId: "g-id", clientSecret: "g-secret" },
    })
  })
})
