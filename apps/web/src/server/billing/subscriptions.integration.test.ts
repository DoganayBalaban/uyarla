import { prisma } from "@uyarla/db"
import { afterEach, describe, expect, it, vi } from "vitest"
import { deletionOperations } from "@/server/deleteAccount"
import { applySubscriptionEvent, revokeOpenSubscriptions } from "@/server/billing/subscriptions"
import type { BillingProvider, SubscriptionEvent } from "@/server/billing/provider"

const toClean: string[] = []
afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})
async function makeUser(tag: string) {
  const u = await prisma.user.create({ data: { name: tag, email: `${tag}-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}
const event = (userId: string, over: Partial<SubscriptionEvent> = {}): SubscriptionEvent => ({
  type: "subscription",
  subscriptionId: `sub_${userId}`,
  userId,
  plan: "quarter",
  status: "trialing",
  currentPeriodEnd: new Date("2026-11-04T10:00:00Z"),
  cancelAtPeriodEnd: false,
  trialEnd: new Date("2026-11-04T10:00:00Z"),
  endedAt: null,
  modifiedAt: new Date("2026-10-28T10:00:00Z"),
  customerId: null,
  ...over,
})

describe("applySubscriptionEvent (DOG-158)", () => {
  it("creates then updates the same subscription; a repeated event changes nothing", async () => {
    const u = await makeUser("abone")
    expect(await applySubscriptionEvent(prisma, event(u.id))).toBe("saved")
    expect(await applySubscriptionEvent(prisma, event(u.id))).toBe("saved")
    expect(await applySubscriptionEvent(prisma, event(u.id, { status: "active", trialEnd: null, modifiedAt: new Date("2026-11-04T10:00:01Z") }))).toBe("saved")
    const rows = await prisma.subscription.findMany({ where: { userId: u.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: "active", plan: "quarter", trialEnd: null })
  })

  it("does not let an older event overwrite a newer one (out-of-order delivery)", async () => {
    const u = await makeUser("sirasiz")
    await applySubscriptionEvent(prisma, event(u.id, { status: "canceled", endedAt: new Date("2026-11-01T00:00:00Z"), modifiedAt: new Date("2026-11-01T00:00:00Z") }))
    expect(await applySubscriptionEvent(prisma, event(u.id, { status: "active", modifiedAt: new Date("2026-10-30T00:00:00Z") }))).toBe("stale")
    expect((await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } })).status).toBe("canceled")
  })

  it("keeps the stored Polar customer when a later event lacks it", async () => {
    const u = await makeUser("musteri")
    await applySubscriptionEvent(prisma, event(u.id, { customerId: "cus_1" }))
    await applySubscriptionEvent(prisma, event(u.id, { status: "active", modifiedAt: new Date("2026-10-29T10:00:00Z") }))
    expect(await prisma.subscription.findFirstOrThrow({ where: { userId: u.id }, select: { status: true, providerCustomerId: true } })).toEqual({ status: "active", providerCustomerId: "cus_1" })
  })

  it("ignores an event for a deleted user", async () => {
    expect(await applySubscriptionEvent(prisma, event("yok-boyle-biri"))).toBe("ignored")
  })
})

describe("revokeOpenSubscriptions (DOG-158)", () => {
  it("revokes the open ones at Polar and reports the ones Polar refused", async () => {
    const u = await makeUser("silinen")
    await applySubscriptionEvent(prisma, event(u.id, { subscriptionId: `sub_acik_${u.id}`, currentPeriodEnd: new Date(Date.now() + 864e6) }))
    await applySubscriptionEvent(prisma, event(u.id, { subscriptionId: `sub_bitmis_${u.id}`, status: "canceled", endedAt: new Date("2026-10-01T00:00:00Z") }))
    const revoke = vi.fn().mockRejectedValueOnce(new Error("polar kapalı"))
    const log = vi.fn()
    const provider = { revokeSubscription: revoke } as unknown as BillingProvider
    // Hesap silme bu listeye bakıp duruyor: iptal edilemeyen abonelik silinmiş hesaptan ücret çekmeye devam ederdi.
    expect(await revokeOpenSubscriptions(prisma, provider, u.id, log)).toEqual({ revoked: 0, failed: [`sub_acik_${u.id}`] })
    expect(revoke).toHaveBeenCalledWith(`sub_acik_${u.id}`)
    expect(revoke).not.toHaveBeenCalledWith(`sub_bitmis_${u.id}`)
    expect(log).toHaveBeenCalled()
    revoke.mockResolvedValueOnce(undefined)
    expect(await revokeOpenSubscriptions(prisma, provider, u.id, log)).toEqual({ revoked: 1, failed: [] })
  })
})
