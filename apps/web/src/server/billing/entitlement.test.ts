import { describe, expect, it } from "vitest"
import { PaymentRequiredError } from "@/server/billing/entitlement"

describe("PaymentRequiredError", () => {
  it("explains the rolling daily window without promising tomorrow", () => {
    // Sınır kayan 24 saat; "yarın" gece yarısı açılacakmış gibi okunuyordu (DOG-80).
    const message = new PaymentRequiredError("daily_cap").message
    expect(message).toContain("24 saat")
    expect(message.toLocaleLowerCase("tr")).not.toContain("yarın")
  })

  it("tells a free user what ran out (DOG-158)", () => {
    expect(new PaymentRequiredError("adaptation_quota").message).toContain("ücretsiz uyarlamanı")
    expect(new PaymentRequiredError("analysis_quota").message).toContain("5 ücretsiz analizini")
  })
})
