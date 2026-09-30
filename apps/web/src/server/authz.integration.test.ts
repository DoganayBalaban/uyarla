import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { loadAdaptation } from "@/server/adaptationDecision"
import { AuthError, ensureOwner } from "@/server/authz"

const toClean: string[] = []

afterEach(async () => {
  await prisma.adaptation.deleteMany({
    where: { analysis: { userId: { in: toClean } } },
  })
  await prisma.analysis.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.user.deleteMany({ where: { id: { in: toClean } } })
  toClean.length = 0
})

async function makeUser(userName: string) {
  const u = await prisma.user.create({
    data: { name: userName, email: `${userName}-${Date.now()}-${Math.random()}@test.local` },
  })
  toClean.push(u.id)
  return u
}

describe("ownership chain · real database", () => {
  it("another user's adaptation returns 404", async () => {
    // Sahiplik Adaptation → Analysis → userId zincirinden gidiyor; hatanın
    // saklanabileceği yer tam burası. Birim testleri ensureOwner'ı doğruluyor
    // ama zincirin doğru kurulduğunu yalnızca gerçek veri gösterir.
    const owner = await makeUser("sahibi")
    const other = await makeUser("digeri")

    const posting = await prisma.jobPosting.create({
      data: { userId: owner.id, rawText: "ilan", requirements: [], language: "tr" },
    })
    const analysis = await prisma.analysis.create({
      data: {
        userId: owner.id,
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

    const payload = await loadAdaptation(adaptation.id)
    expect(payload).not.toBeNull()
    expect(payload!.ownerId).toBe(owner.id)

    // Sahibi erişebiliyor.
    expect(() =>
      ensureOwner(payload!.ownerId, { user: { id: owner.id, isAnonymous: false } }),
    ).not.toThrow()

    // Başkası 404 alıyor — 403 değil (spec §8).
    try {
      ensureOwner(payload!.ownerId, { user: { id: other.id, isAnonymous: false } })
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(404)
    }
  })
})
