import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import {
  PaymentRequiredError,
  applyBillingEvent,
  assertCanAdapt,
  loadAccess,
  withAdaptationAccess,
} from "@/server/billing/entitlement"

const toClean: string[] = []
const NOW = new Date("2026-11-10T12:00:00Z")
const day = 864e5

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser() {
  const u = await prisma.user.create({ data: { name: "Ödeme", email: `odeme-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}

/** Kullanıcıya bir analiz ve uyarlama; `createdAt` ve durum verilebilir. */
async function makeAdaptation(userId: string, createdAt: Date, status: "running" | "draft" | "failed" = "draft") {
  const analysis = await makeAnalysis(userId)
  await prisma.adaptation.create({ data: { analysisId: analysis.id, draft: {}, modelId: "m", status, createdAt } })
}

async function makeAnalysis(userId: string) {
  const resume = await prisma.resume.create({ data: { userId, filePath: "x", rawText: "metin" } })
  const version = await prisma.resumeVersion.create({ data: { resumeId: resume.id, profile: {}, source: "parsed", versionNo: 1 } })
  const posting = await prisma.jobPosting.create({ data: { userId, rawText: "ilan", requirements: [], language: "tr" } })
  return prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "m", status: "done" },
  })
}

describe("loadAccess", () => {
  it("counts non-failed adaptations and those in the last 24 hours", async () => {
    const u = await makeUser()
    await makeAdaptation(u.id, new Date(NOW.getTime() - 2 * day))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 3600e3))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 60e3), "failed")
    expect(await loadAccess(prisma, u.id, NOW)).toMatchObject({ adaptationsUsed: 2, adaptationsLast24h: 1, passes: [] })
  })
})

describe("assertCanAdapt", () => {
  it("lets the first adaptation through and stops the second without a pass", async () => {
    const u = await makeUser()
    await expect(assertCanAdapt(prisma, u.id, NOW)).resolves.toBeUndefined()
    await makeAdaptation(u.id, NOW)
    await expect(assertCanAdapt(prisma, u.id, NOW)).rejects.toMatchObject({ code: "payment_required" })
    await expect(assertCanAdapt(prisma, u.id, NOW)).rejects.toBeInstanceOf(PaymentRequiredError)
  })
})

describe("applyBillingEvent", () => {
  it("grants a pass once even if the same order arrives twice", async () => {
    // Review Focus 1.
    const u = await makeUser()
    const event = { type: "paid", orderId: `ord-${u.id}`, userId: u.id, plan: "month" } as const
    expect(await applyBillingEvent(prisma, event, NOW)).toBe("granted")
    expect(await applyBillingEvent(prisma, event, NOW)).toBe("duplicate")
    const passes = await prisma.accessPass.findMany({ where: { userId: u.id } })
    expect(passes).toHaveLength(1)
    expect(passes[0]!.endsAt).toEqual(new Date(NOW.getTime() + 30 * day))
    await expect(assertCanAdapt(prisma, u.id, NOW)).resolves.toBeUndefined()
  })

  it("stacks a second pass and a refund closes only its own order", async () => {
    // Review Focus 2.
    const u = await makeUser()
    await applyBillingEvent(prisma, { type: "paid", orderId: `a-${u.id}`, userId: u.id, plan: "week" }, NOW)
    await applyBillingEvent(prisma, { type: "paid", orderId: `b-${u.id}`, userId: u.id, plan: "week" }, NOW)
    const second = await prisma.accessPass.findUniqueOrThrow({ where: { providerOrderId: `b-${u.id}` } })
    expect(second.startsAt).toEqual(new Date(NOW.getTime() + 7 * day))
    expect(await applyBillingEvent(prisma, { type: "refunded", orderId: `a-${u.id}` }, NOW)).toBe("revoked")
    const statuses = (await prisma.accessPass.findMany({ where: { userId: u.id }, orderBy: { startsAt: "asc" } })).map((p) => p.status)
    expect(statuses).toEqual(["refunded", "active"])
    // Gözden geçirme: sonraki dönem iade edilenin bitişini beklememeli; hemen kullanılabilir olmalı.
    await expect(assertCanAdapt(prisma, u.id, NOW)).resolves.toBeUndefined()
    const shifted = await prisma.accessPass.findUniqueOrThrow({ where: { providerOrderId: `b-${u.id}` } })
    expect(shifted.startsAt).toEqual(NOW)
    expect(shifted.endsAt).toEqual(new Date(NOW.getTime() + 7 * day))
  })

  it("ignores an unknown plan or a deleted user", async () => {
    // Review Focus 3.
    const u = await makeUser()
    expect(await applyBillingEvent(prisma, { type: "paid", orderId: `x-${u.id}`, userId: u.id, plan: "year" }, NOW)).toBe("ignored")
    expect(await applyBillingEvent(prisma, { type: "paid", orderId: `y-${u.id}`, userId: "silinmis-kullanici", plan: "month" }, NOW)).toBe(
      "ignored",
    )
    expect(await applyBillingEvent(prisma, { type: "refunded", orderId: "hic-olmayan" }, NOW)).toBe("ignored")
  })
})

describe("eşzamanlı istekler (DOG-77)", () => {
  it("opens only one free adaptation for two simultaneous requests", async () => {
    const u = await makeUser()
    const [a, b] = await Promise.all([makeAnalysis(u.id), makeAnalysis(u.id)])
    const open = (analysisId: string) =>
      withAdaptationAccess(prisma, { userId: u.id, now: NOW }, (tx) =>
        tx.adaptation.create({ data: { analysisId, draft: {}, modelId: "m", status: "running", createdAt: NOW } }),
      )
    const results = await Promise.allSettled([open(a.id), open(b.id)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: "payment_required" })
    expect(await prisma.adaptation.count({ where: { analysis: { userId: u.id } } })).toBe(1)
  })

  it("stacks two simultaneous orders instead of opening overlapping passes", async () => {
    const u = await makeUser()
    const pay = (orderId: string) => applyBillingEvent(prisma, { type: "paid", orderId, userId: u.id, plan: "week" }, NOW)
    expect(await Promise.all([pay(`p-${u.id}`), pay(`q-${u.id}`)])).toEqual(["granted", "granted"])
    const passes = await prisma.accessPass.findMany({ where: { userId: u.id }, orderBy: { startsAt: "asc" } })
    expect(passes.map((p) => p.startsAt)).toEqual([NOW, new Date(NOW.getTime() + 7 * day)])
  })

  it("still reports the same order arriving twice at once as a duplicate", async () => {
    const u = await makeUser()
    const event = { type: "paid", orderId: `r-${u.id}`, userId: u.id, plan: "month" } as const
    const outcomes = await Promise.all([applyBillingEvent(prisma, event, NOW), applyBillingEvent(prisma, event, NOW)])
    expect(outcomes.sort()).toEqual(["duplicate", "granted"])
    expect(await prisma.accessPass.count({ where: { userId: u.id } })).toBe(1)
  })
})
