import { describe, expect, it } from "vitest"
import { TRANSIENT_ERROR_MESSAGE as TRANSIENT_ERROR_MESSAGE, analysisErrorMessage as analysisErrorMessage } from "@/server/analysisErrorMessage"

describe("analysisErrorMessage", () => {
  it("shows the message of a permanent error that failed on the first attempt", () => {
    const messageText = "Bu PDF taranmış bir görüntü, içinde seçilebilir metin yok."
    expect(analysisErrorMessage({ failedReason: messageText, attemptsMade: 1, opts: { attempts: 3 } })).toBe(messageText)
  })

  it("hides the technical text of a transient error that exhausted retries", () => {
    expect(
      analysisErrorMessage({
        failedReason: "LLM çağrısı başarısız: Connection error.",
        attemptsMade: 3,
        opts: { attempts: 3 },
      }),
    ).toBe(TRANSIENT_ERROR_MESSAGE)
  })

  it("falls back to the generic message without a reason", () => {
    expect(analysisErrorMessage({ failedReason: null, attemptsMade: 1, opts: { attempts: 3 } })).toBe(
      TRANSIENT_ERROR_MESSAGE,
    )
  })
})
