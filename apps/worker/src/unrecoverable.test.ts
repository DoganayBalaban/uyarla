import { describe, expect, it, vi } from "vitest"
import { UnrecoverableError } from "bullmq"
import { PermanentError } from "@uyarla/core"
import { toUnrecoverable } from "./unrecoverable.js"

describe("toUnrecoverable", () => {
  it("keeps the user-facing message", () => {
    const error = toUnrecoverable(new PermanentError("Bu PDF taranmış.", "scanned_pdf"), "analyze")
    expect(error).toBeInstanceOf(UnrecoverableError)
    expect(error.message).toBe("Bu PDF taranmış.")
  })

  it("logs the technical cause that the user does not see", () => {
    // Servis hatasında (yanlış anahtar, kota) ekrandaki metin genel; neden
    // yalnızca günlükte kalıyor, yoksa hiçbir yerde görünmez.
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const cause = new Error("401 Incorrect API key provided")
    toUnrecoverable(new PermanentError("Sorun bizde.", "llm_rejected", { cause }), "analyze")
    expect(log).toHaveBeenCalledWith(expect.stringContaining("401 Incorrect API key provided"))
    log.mockRestore()
  })
})
