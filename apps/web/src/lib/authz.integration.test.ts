import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { loadAdaptation } from "./adaptation"
import { AuthError, ensureOwner } from "./authz"

const temizlenecek: string[] = []

afterEach(async () => {
  await prisma.adaptation.deleteMany({
    where: { analysis: { userId: { in: temizlenecek } } },
  })
  await prisma.analysis.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.user.deleteMany({ where: { id: { in: temizlenecek } } })
  temizlenecek.length = 0
})

async function kullaniciYap(ad: string) {
  const u = await prisma.user.create({
    data: { name: ad, email: `${ad}-${Date.now()}-${Math.random()}@test.local` },
  })
  temizlenecek.push(u.id)
  return u
}

describe("sahiplik zinciri · gerçek veritabanı", () => {
  it("başkasının uyarlaması 404 veriyor", async () => {
    // Sahiplik Adaptation → Analysis → userId zincirinden gidiyor; hatanın
    // saklanabileceği yer tam burası. Birim testleri ensureOwner'ı doğruluyor
    // ama zincirin doğru kurulduğunu yalnızca gerçek veri gösterir.
    const sahibi = await kullaniciYap("sahibi")
    const digeri = await kullaniciYap("digeri")

    const posting = await prisma.jobPosting.create({
      data: { userId: sahibi.id, rawText: "ilan", requirements: [], language: "tr" },
    })
    const analysis = await prisma.analysis.create({
      data: {
        userId: sahibi.id,
        jobPostingId: posting.id,
        modelId: "test",
        status: "done",
        score: 42,
      },
    })
    // Taslak geçerli olmak zorunda: loadAdaptation onu Zod ile doğruluyor.
    // Boş nesne geçmiyor ve bunu bu test yakaladı.
    const adaptation = await prisma.adaptation.create({
      data: {
        analysisId: analysis.id,
        modelId: "test",
        status: "draft",
        draft: {
          summary: {
            original: null,
            rewritten: "",
            verification: { status: "ok", issues: [] },
            decision: "accepted",
          },
          bullets: [],
          skillOrder: [],
        },
      },
    })

    const yuk = await loadAdaptation(adaptation.id)
    expect(yuk).not.toBeNull()
    expect(yuk!.ownerId).toBe(sahibi.id)

    // Sahibi erişebiliyor.
    expect(() =>
      ensureOwner(yuk!.ownerId, { user: { id: sahibi.id, isAnonymous: false } }),
    ).not.toThrow()

    // Başkası 404 alıyor — 403 değil (spec §8).
    try {
      ensureOwner(yuk!.ownerId, { user: { id: digeri.id, isAnonymous: false } })
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(404)
    }
  })
})
