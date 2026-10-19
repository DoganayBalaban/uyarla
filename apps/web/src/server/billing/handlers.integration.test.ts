import { afterEach, describe, expect, it, vi } from "vitest"
import * as Sentry from "@sentry/nextjs"

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { handleCheckout, handleStatus, handleWebhook } from "@/server/billing/handlers"
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
const PLANS = [{ key: "month" as const, days: 30, productId: "prod_m", priceTry: 349 }]
const provider = (event: BillingEvent | null | Error): BillingProvider => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/c/1" }),
  parseWebhook: event instanceof Error ? vi.fn().mockRejectedValue(event) : vi.fn().mockResolvedValue(event),
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
        // `odeme`: teşekkür sayfası bundan sonra açılan dönemi bekliyor (DOG-80).
        successUrl: `https://uyarla.com.tr/plans/tesekkurler?donus=%2Fanalyze%3Fuyarla%3Da1&odeme=${NOW.getTime()}`,
      }),
    )
  })

  it("rejects a plan that is not offered", async () => {
    const u = await makeUser()
    const res = await handleCheckout({ db: prisma, provider: provider(null), plans: PLANS, userId: u.id, body: { plan: "week" }, baseUrl: "x" })
    expect(res.status).toBe(400)
  })
})

describe("handleWebhook", () => {
  it("answers 403 to a bad signature and writes nothing", async () => {
    const res = await handleWebhook({ db: prisma, provider: provider(new WebhookSignatureError()), rawBody: "{}", headers: {}, now: NOW })
    expect(res.status).toBe(403)
  })

  it("grants once and answers 200 to a repeated delivery", async () => {
    // Review Focus 1.
    const u = await makeUser()
    const p = provider({ type: "paid", orderId: `w-${u.id}`, userId: u.id, plan: "month" })
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect(await prisma.accessPass.count({ where: { userId: u.id } })).toBe(1)
  })

  it("answers 200 but logs when the order cannot be applied", async () => {
    // Review Focus 3: Polar sonsuza dek denemesin, biz de fark edelim.
    const log = vi.fn()
    const p = provider({ type: "paid", orderId: "kayip", userId: "silinmis", plan: "month" })
    const res = await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW, log })
    expect(res.status).toBe(200)
    expect(log).toHaveBeenCalled()
  })

  it("alerts Sentry by default when a paid order could not be applied", async () => {
    // Spec §4: silinmiş hesap gibi durumlarda para alındı ama dönem açılmadı;
    // elle iade için birinin haberi olmalı. console.warn kimseye ulaşmıyordu.
    const p = provider({ type: "paid", orderId: "kayip-2", userId: "silinmis", plan: "month" })
    await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining("uygulanamayan"), expect.objectContaining({ level: "warning" }))
  })
})

describe("handleStatus", () => {
  it("reports the pass end and whether the free adaptation was used", async () => {
    const u = await makeUser()
    expect(await handleStatus({ db: prisma, userId: u.id, now: NOW })).toEqual({
      passEndsAt: null,
      lastPassAt: null,
      freeUsed: false,
      freeLeft: 1,
      // Yöneticilere sınırsız hak (#121); test o PR'da güncellenmemişti.
      unlimited: false,
      usedLast24h: 0,
      dailyCap: 30,
    })
    await prisma.accessPass.create({
      data: { userId: u.id, plan: "week", providerOrderId: `s-${u.id}`, startsAt: NOW, endsAt: new Date(NOW.getTime() + 7 * 864e5) },
    })
    const status = await handleStatus({ db: prisma, userId: u.id, now: NOW })
    expect(status.passEndsAt).toBe(new Date(NOW.getTime() + 7 * 864e5).toISOString())
    // Teşekkür sayfası yeni ödemeyi bununla tanıyor (DOG-80).
    expect(status.lastPassAt).not.toBeNull()
  })
})
