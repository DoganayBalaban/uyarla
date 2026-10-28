import { describe, expect, it, vi } from "vitest"
import { createPolarProvider, type PolarDeps } from "@/server/billing/polar"
import { WebhookSignatureError } from "@/server/billing/provider"

class FakeVerificationError extends Error {}
class FakeUnknownTypeError extends Error {}

const deps = (overrides: Partial<PolarDeps> = {}): PolarDeps => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/checkout/abc" }),
  createCustomerSession: vi.fn().mockResolvedValue({ customer_portal_url: "https://sandbox.polar.sh/portal/x" }),
  revokeSubscription: vi.fn().mockResolvedValue({}),
  validateEvent: vi.fn(),
  isVerificationError: (e) => e instanceof FakeVerificationError,
  isUnknownTypeError: (e) => e instanceof FakeUnknownTypeError,
  ...overrides,
})
const products = { month: "prod_m", quarter: "prod_q" }
const provider = (d: PolarDeps, config: Partial<Parameters<typeof createPolarProvider>[0]> = {}) =>
  createPolarProvider({ webhookSecret: "whsec_x", products, ...config }, d)

const subscription = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "trialing",
  product_id: "prod_q",
  current_period_end: "2026-11-04T10:00:00Z",
  cancel_at_period_end: false,
  trial_end: "2026-11-04T10:00:00Z",
  ended_at: null,
  created_at: "2026-10-28T10:00:00Z",
  modified_at: "2026-10-28T10:00:05Z",
  metadata: { plan: "quarter", user_id: "user_1" },
  customer_id: "cus_1",
  customer: { external_id: "user_1" },
  ...over,
})
const event = (type: string, data: unknown) => deps({ validateEvent: vi.fn().mockResolvedValue({ type, data }) })

describe("polar provider", () => {
  it("opens a Turkish checkout carrying the user and the plan", async () => {
    const d = deps()
    const result = await provider(d).createCheckout({
      userId: "user_1",
      email: "a@b.c",
      productId: "prod_m",
      plan: "month",
      successUrl: "https://uyarla.com.tr/plans/thanks",
      allowTrial: false,
    })
    expect(result.url).toBe("https://sandbox.polar.sh/checkout/abc")
    expect(d.createCheckout).toHaveBeenCalledWith({
      products: ["prod_m"],
      external_customer_id: "user_1",
      customer_email: "a@b.c",
      success_url: "https://uyarla.com.tr/plans/thanks",
      metadata: { plan: "month", user_id: "user_1" },
      locale: "tr",
      // Deneme hakkını Polar değil biz söylüyoruz (son inceleme): ekrandaki etiketle aynı.
      allow_trial: false,
    })
  })

  it("reads a subscription event: user, plan from the product, dates (DOG-158)", async () => {
    expect(await provider(event("subscription.created", subscription())).parseWebhook("{}", {})).toEqual({
      type: "subscription",
      subscriptionId: "sub_1",
      userId: "user_1",
      plan: "quarter",
      status: "trialing",
      currentPeriodEnd: new Date("2026-11-04T10:00:00Z"),
      cancelAtPeriodEnd: false,
      trialEnd: new Date("2026-11-04T10:00:00Z"),
      endedAt: null,
      modifiedAt: new Date("2026-10-28T10:00:05Z"),
      customerId: "cus_1",
    })
  })

  it("reads every status-changing subscription event, a revoke included", async () => {
    for (const type of ["subscription.updated", "subscription.active", "subscription.canceled", "subscription.uncanceled", "subscription.past_due"]) {
      expect(await provider(event(type, subscription())).parseWebhook("{}", {})).toMatchObject({ subscriptionId: "sub_1" })
    }
    const revoked = subscription({ status: "canceled", ended_at: "2026-10-29T10:00:00Z" })
    expect(await provider(event("subscription.revoked", revoked)).parseWebhook("{}", {})).toMatchObject({ status: "canceled", endedAt: new Date("2026-10-29T10:00:00Z") })
  })

  it("falls back to created_at and the customer's external id", async () => {
    const e = await provider(event("subscription.updated", subscription({ product_id: "prod_m", metadata: {}, modified_at: null }))).parseWebhook("{}", {})
    expect(e).toMatchObject({ userId: "user_1", plan: "month", modifiedAt: new Date("2026-10-28T10:00:00Z") })
  })

  it("takes the user from metadata before the customer record", async () => {
    const e = await provider(event("subscription.updated", subscription({ customer: { external_id: "someone_else" } }))).parseWebhook("{}", {})
    expect(e).toMatchObject({ userId: "user_1" })
  })

  it("keeps an unknown product's status as plan 'unknown' and reports a subscription without our user (son inceleme)", async () => {
    // Fiyat değişince eski üründeki abonenin iptali/iadesi düşmesin; erişim kuralı plana bakmıyor.
    expect(await provider(event("subscription.updated", subscription({ product_id: "prod_x" }))).parseWebhook("{}", {})).toMatchObject({ type: "subscription", plan: "unknown", status: "trialing" })
    const noUser = subscription({ metadata: {}, customer: { external_id: null } })
    expect(await provider(event("subscription.updated", noUser)).parseWebhook("{}", {})).toEqual({ type: "unmatched", subscriptionId: "sub_1", reason: "user" })
    expect(await provider(event("order.paid", { id: "ord_1" })).parseWebhook("{}", {})).toBeNull()
    expect(await provider(event("checkout.created", {})).parseWebhook("{}", {})).toBeNull()
  })

  it("ignores event types the SDK does not know instead of failing", async () => {
    const d = deps({ validateEvent: vi.fn().mockRejectedValue(new FakeUnknownTypeError("member.created")) })
    expect(await provider(d).parseWebhook("{}", {})).toBeNull()
  })

  it("reports a bad signature as WebhookSignatureError", async () => {
    const d = deps({ validateEvent: vi.fn().mockRejectedValue(new FakeVerificationError("bad")) })
    await expect(provider(d).parseWebhook("{}", {})).rejects.toBeInstanceOf(WebhookSignatureError)
  })

  it("opens the customer portal for the user and revokes a subscription", async () => {
    const d = deps()
    const p = provider(d)
    expect(await p.createPortalSession({ userId: "user_1", customerId: null, returnUrl: "https://uyarla.com.tr/account" })).toEqual({ url: "https://sandbox.polar.sh/portal/x" })
    expect(d.createCustomerSession).toHaveBeenCalledWith({ external_customer_id: "user_1", return_url: "https://uyarla.com.tr/account" })
    // Polar müşteri kaydı başka kimlik taşıyabilir (aynı e-postayla eski hesap): biliniyorsa müşteri kimliğiyle.
    await p.createPortalSession({ userId: "user_1", customerId: "cus_1", returnUrl: "https://uyarla.com.tr/account" })
    expect(d.createCustomerSession).toHaveBeenLastCalledWith({ customer_id: "cus_1", return_url: "https://uyarla.com.tr/account" })
    await p.revokeSubscription("sub_1")
    expect(d.revokeSubscription).toHaveBeenCalledWith("sub_1")
  })
})

describe("polarProviderFromEnv", () => {
  it("throws a distinct error when Polar is not configured (DOG-80)", async () => {
    const { BillingNotConfiguredError, polarProviderFromEnv } = await import("@/server/billing/polar")
    expect(() => polarProviderFromEnv({})).toThrow(BillingNotConfiguredError)
    expect(() => polarProviderFromEnv({ POLAR_ACCESS_TOKEN: "x" })).toThrow(BillingNotConfiguredError)
  })
})
