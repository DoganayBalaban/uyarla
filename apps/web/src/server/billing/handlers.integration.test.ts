import { afterEach, describe, expect, it, vi } from "vitest"
import * as Sentry from "@sentry/nextjs"

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { handleCheckout, handlePortal, handleStatus, handleWebhook } from "@/server/billing/handlers"
import { WebhookSignatureError, type BillingEvent, type BillingProvider } from "@/server/billing/provider"

const toClean: string[] = []
const NOW = new Date("2026-11-10T12:00:00Z")
afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})
async function makeUser() {
  const u = await prisma.user.create({ data: { name: "Uç", email: `uc-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}
const PLANS = [{ key: "month" as const, days: 30, productId: "prod_m", priceTry: 299 }]
const provider = (event: BillingEvent | null | Error) => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/c/1" }),
  createPortalSession: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/portal/1" }),
  revokeSubscription: vi.fn().mockResolvedValue(undefined),
  parseWebhook: event instanceof Error ? vi.fn().mockRejectedValue(event) : vi.fn().mockResolvedValue(event),
}) satisfies BillingProvider
const subEvent = (userId: string, over: Partial<BillingEvent> = {}): BillingEvent => ({
  type: "subscription",
  subscriptionId: `sub_${userId}`,
  userId,
  plan: "month",
  status: "trialing",
  currentPeriodEnd: new Date("2026-11-17T12:00:00Z"),
  cancelAtPeriodEnd: false,
  trialEnd: new Date("2026-11-17T12:00:00Z"),
  endedAt: null,
  modifiedAt: NOW,
  ...over,
})
const activeSub = (userId: string) =>
  prisma.subscription.create({
    data: { userId, providerSubscriptionId: `sub_aktif_${userId}`, plan: "month", status: "active", currentPeriodEnd: new Date(NOW.getTime() + 20 * 864e5), providerUpdatedAt: NOW },
  })

describe("handleCheckout", () => {
  it("returns the provider's checkout address with a thanks page that returns to the user's place", async () => {
    const u = await makeUser()
    const p = provider(null)
    const res = await handleCheckout({
      db: prisma,
      provider: p,
      plans: PLANS,
      userId: u.id,
      body: { plan: "month", returnTo: "/analyze?uyarla=a1" },
      baseUrl: "https://uyarla.com.tr",
      now: NOW,
    })
    expect(res).toEqual({ status: 200, json: { url: "https://sandbox.polar.sh/c/1" } })
    expect(p.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_m",
        plan: "month",
        // `odeme`: teşekkür sayfası bundan sonra açılan aboneliği bekliyor (DOG-80).
        successUrl: `https://uyarla.com.tr/plans/thanks?donus=%2Fanalyze%3Fuyarla%3Da1&odeme=${NOW.getTime()}`,
      }),
    )
  })

  it("rejects a plan that is not offered", async () => {
    const u = await makeUser()
    const res = await handleCheckout({ db: prisma, provider: provider(null), plans: PLANS, userId: u.id, body: { plan: "week" }, baseUrl: "x" })
    expect(res.status).toBe(400)
  })

  it("an active subscriber gets the portal, not a second subscription (DOG-158)", async () => {
    const u = await makeUser()
    await activeSub(u.id)
    const p = provider(null)
    const res = await handleCheckout({ db: prisma, provider: p, plans: PLANS, userId: u.id, body: { plan: "month" }, baseUrl: "https://uyarla.com.tr", now: NOW })
    expect(res).toEqual({ status: 200, json: { url: "https://sandbox.polar.sh/portal/1" } })
    expect(p.createCheckout).not.toHaveBeenCalled()
    expect(p.createPortalSession).toHaveBeenCalledWith({ userId: u.id, returnUrl: "https://uyarla.com.tr/account" })
  })
})

describe("handlePortal (DOG-158)", () => {
  it("opens the portal for someone with a subscription, 404 otherwise", async () => {
    const u = await makeUser()
    expect((await handlePortal({ db: prisma, provider: provider(null), userId: u.id, baseUrl: "https://uyarla.com.tr" })).status).toBe(404)
    await activeSub(u.id)
    expect(await handlePortal({ db: prisma, provider: provider(null), userId: u.id, baseUrl: "https://uyarla.com.tr" })).toEqual({
      status: 200,
      json: { url: "https://sandbox.polar.sh/portal/1" },
    })
  })
})

describe("handleWebhook (DOG-158)", () => {
  it("answers 403 to a bad signature and writes nothing", async () => {
    const res = await handleWebhook({ db: prisma, provider: provider(new WebhookSignatureError()), rawBody: "{}", headers: {}, now: NOW })
    expect(res.status).toBe(403)
  })

  it("saves the subscription once and answers 200 to a repeated delivery", async () => {
    const u = await makeUser()
    const p = provider(subEvent(u.id))
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(1)
  })

  it("a subscription event for a deleted user is revoked at Polar and logged", async () => {
    const log = vi.fn()
    const p = provider(subEvent("silinmis-kullanici", { subscriptionId: "sub_kayip" }))
    const res = await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW, log })
    expect(res.status).toBe(200)
    expect(p.revokeSubscription).toHaveBeenCalledWith("sub_kayip")
    expect(log).toHaveBeenCalled()
  })

  it("alerts Sentry by default when an event could not be applied", async () => {
    const p = provider(subEvent("silinmis-2", { subscriptionId: "sub_kayip_2" }))
    await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining("abonelik"), expect.objectContaining({ level: "warning" }))
  })
})

describe("handleStatus (DOG-158)", () => {
  it("free quota for a new user, subscription details for a subscriber", async () => {
    const u = await makeUser()
    const plans = [{ key: "month" as const, days: 30, productId: "prod_m", priceTry: 299 }]
    expect(await handleStatus({ db: prisma, userId: u.id, now: NOW, plans })).toMatchObject({
      access: false,
      unlimited: false,
      trialEligible: true,
      subscription: null,
      quota: { analyses: { used: 0, limit: 5 }, adaptations: { used: 0, limit: 1 }, resetsAt: "2026-11-30T21:00:00.000Z" },
      usedLast24h: 0,
      dailyCap: 30,
    })
    await prisma.subscription.create({
      data: { userId: u.id, providerSubscriptionId: `sub_${u.id}`, plan: "month", status: "trialing", trialEnd: new Date("2026-11-15T00:00:00Z"), providerUpdatedAt: NOW },
    })
    expect(await handleStatus({ db: prisma, userId: u.id, now: NOW, plans })).toMatchObject({
      access: true,
      trialEligible: false,
      quota: null,
      subscription: { plan: "month", status: "trialing", trialEnd: "2026-11-15T00:00:00.000Z", priceTry: 299 },
    })
  })
})
