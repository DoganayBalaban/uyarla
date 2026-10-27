import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import {
  PaymentRequiredError,
  applyBillingEvent,
  loadUsage,
  requireEntitlement,
  withEntitlement,
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

/** Bu ay açılmış bir ilan; analiz durumu verilirse analiz de. */
async function posting(userId: string, createdAt: Date, analysisStatus?: "done" | "failed") {
  const p = await prisma.jobPosting.create({ data: { userId, rawText: "ilan", requirements: [], language: "tr", createdAt } })
  if (analysisStatus) await prisma.analysis.create({ data: { userId, jobPostingId: p.id, modelId: "m", status: analysisStatus, createdAt } })
  return p
}

describe("loadUsage (DOG-158)", () => {
  it("counts this month's postings, not failed ones, not last month's", async () => {
    const u = await makeUser()
    await posting(u.id, new Date("2026-11-02T10:00:00Z"), "done")
    await posting(u.id, new Date("2026-11-03T10:00:00Z")) // analiz henüz yok: sayılıyor
    await posting(u.id, new Date("2026-11-04T10:00:00Z"), "failed")
    await posting(u.id, new Date("2026-10-31T20:30:00Z"), "done") // İstanbul'da 31 Ekim 23:30
    const { usage } = await loadUsage(prisma, u.id, NOW)
    expect(usage.analysesThisMonth).toBe(2)
  })

  it("counts this month's and the last 24 hours' non-failed adaptations", async () => {
    const u = await makeUser()
    await makeAdaptation(u.id, new Date("2026-10-20T10:00:00Z"))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 2 * day))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 3600e3))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 60e3), "failed")
    expect((await loadUsage(prisma, u.id, NOW)).usage).toMatchObject({ adaptationsThisMonth: 2, adaptationsLast24h: 1 })
  })
})

describe("requireEntitlement (DOG-158)", () => {
  it("refuses the sixth free analysis and opens it for a subscriber", async () => {
    const u = await makeUser()
    for (let i = 0; i < 5; i++) await posting(u.id, new Date(`2026-11-0${i + 1}T10:00:00Z`), "done")
    await expect(requireEntitlement(prisma, { userId: u.id, feature: "analysis", now: NOW })).rejects.toMatchObject({ code: "analysis_quota" })
    await prisma.subscription.create({
      data: { userId: u.id, providerSubscriptionId: `sub_${u.id}`, plan: "month", status: "trialing", trialEnd: new Date("2026-11-15T00:00:00Z"), providerUpdatedAt: NOW },
    })
    await expect(requireEntitlement(prisma, { userId: u.id, feature: "analysis", now: NOW })).resolves.toBeUndefined()
  })

  it("lets the month's free adaptation through and stops the second", async () => {
    const u = await makeUser()
    await expect(requireEntitlement(prisma, { userId: u.id, feature: "adaptation", now: NOW })).resolves.toBeUndefined()
    await makeAdaptation(u.id, NOW)
    await expect(requireEntitlement(prisma, { userId: u.id, feature: "adaptation", now: NOW })).rejects.toMatchObject({ code: "adaptation_quota" })
    await expect(requireEntitlement(prisma, { userId: u.id, feature: "practice", now: NOW })).rejects.toBeInstanceOf(PaymentRequiredError)
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
  it("opens only one free adaptation for two simultaneous requests (DOG-158: bu ayki tek hak)", async () => {
    const u = await makeUser()
    const [a, b] = await Promise.all([makeAnalysis(u.id), makeAnalysis(u.id)])
    const open = (analysisId: string) =>
      withEntitlement(prisma, { userId: u.id, feature: "adaptation", now: NOW }, (tx) =>
        tx.adaptation.create({ data: { analysisId, draft: {}, modelId: "m", status: "running", createdAt: NOW } }),
      )
    const results = await Promise.allSettled([open(a.id), open(b.id)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: "adaptation_quota" })
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
