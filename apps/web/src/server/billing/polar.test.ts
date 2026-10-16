import { describe, expect, it, vi } from "vitest"
import { createPolarProvider, type PolarDeps } from "@/server/billing/polar"
import { WebhookSignatureError } from "@/server/billing/provider"

class FakeVerificationError extends Error {}
class FakeUnknownTypeError extends Error {}

const deps = (overrides: Partial<PolarDeps> = {}): PolarDeps => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/checkout/abc" }),
  validateEvent: vi.fn(),
  isVerificationError: (e) => e instanceof FakeVerificationError,
  isUnknownTypeError: (e) => e instanceof FakeUnknownTypeError,
  ...overrides,
})

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "ord_1",
  status: "paid",
  metadata: { plan: "month", user_id: "user_1" },
  customer: { external_id: "user_1", email: "a@b.c" },
  ...overrides,
})

describe("polar provider", () => {
  it("opens a Turkish checkout carrying the user and the plan", async () => {
    const d = deps()
    const result = await createPolarProvider({ webhookSecret: "whsec_x" }, d).createCheckout({
      userId: "user_1",
      email: "a@b.c",
      productId: "prod_m",
      plan: "month",
      successUrl: "https://uyarla.com.tr/plans/tesekkurler",
    })
    expect(result.url).toBe("https://sandbox.polar.sh/checkout/abc")
    expect(d.createCheckout).toHaveBeenCalledWith({
      products: ["prod_m"],
      external_customer_id: "user_1",
      customer_email: "a@b.c",
      success_url: "https://uyarla.com.tr/plans/tesekkurler",
      metadata: { plan: "month", user_id: "user_1" },
      locale: "tr",
    })
  })

  it("turns order.paid into a paid event", async () => {
    const d = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "order.paid", data: order() }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toEqual({
      type: "paid",
      orderId: "ord_1",
      userId: "user_1",
      plan: "month",
    })
  })

  it("turns a full order.refunded into a refund", async () => {
    const d = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "order.refunded", data: order({ status: "refunded" }) }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toEqual({ type: "refunded", orderId: "ord_1" })
  })

  it("keeps the pass on a partial refund", async () => {
    const d = deps({
      validateEvent: vi.fn().mockResolvedValue({ type: "order.refunded", data: order({ status: "partially_refunded" }) }),
    })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toBeNull()
  })

  it("ignores event types the SDK does not know instead of failing", async () => {
    const d = deps({ validateEvent: vi.fn().mockRejectedValue(new FakeUnknownTypeError("member.created")) })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toBeNull()
  })

  it("takes the user from metadata before the customer record", async () => {
    const d = deps({
      validateEvent: vi.fn().mockResolvedValue({
        type: "order.paid",
        data: order({ customer: { external_id: "someone_else" } }),
      }),
    })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toMatchObject({ userId: "user_1" })
  })

  it("ignores events we do not use and orders without our user", async () => {
    const other = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "checkout.created", data: {} }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, other).parseWebhook("{}", {})).toBeNull()
    const noUser = deps({
      validateEvent: vi.fn().mockResolvedValue({
        type: "order.paid",
        data: order({ metadata: { plan: "month" }, customer: { external_id: null } }),
      }),
    })
    expect(await createPolarProvider({ webhookSecret: "s" }, noUser).parseWebhook("{}", {})).toBeNull()
  })

  it("reports a bad signature as WebhookSignatureError", async () => {
    const d = deps({ validateEvent: vi.fn().mockRejectedValue(new FakeVerificationError("bad")) })
    await expect(createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).rejects.toBeInstanceOf(WebhookSignatureError)
  })
})
