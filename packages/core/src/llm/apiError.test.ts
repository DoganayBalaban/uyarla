import { describe, it, expect } from "vitest"
import { classifyApiError } from "./apiError.js"
import { PermanentError, TransientError } from "../errors.js"

const apiError = (status: number, code?: string) =>
  Object.assign(new Error(`${status} hata`), { status, code })

describe("classifyApiError", () => {
  it("treats a network error without a status as transient", () => {
    const error = classifyApiError(new Error("ECONNREFUSED"), "LLM çağrısı", "llm")
    expect(error).toBeInstanceOf(TransientError)
    expect(error).toMatchObject({ code: "llm_unreachable" })
  })

  it("treats a wrong key as permanent", () => {
    const error = classifyApiError(apiError(401), "LLM çağrısı", "llm")
    expect(error).toBeInstanceOf(PermanentError)
    expect(error).toMatchObject({ code: "llm_rejected" })
  })

  it("treats a rejected request (bad schema, unknown model) as permanent", () => {
    expect(classifyApiError(apiError(400), "x", "llm")).toBeInstanceOf(PermanentError)
    expect(classifyApiError(apiError(404), "x", "llm")).toBeInstanceOf(PermanentError)
  })

  it("treats a rate limit as transient", () => {
    const error = classifyApiError(apiError(429, "rate_limit_exceeded"), "x", "embedding")
    expect(error).toBeInstanceOf(TransientError)
    expect(error).toMatchObject({ code: "embedding_rate_limited" })
  })

  it("treats an exhausted quota as permanent even though it is a 429", () => {
    const error = classifyApiError(apiError(429, "insufficient_quota"), "x", "llm")
    expect(error).toBeInstanceOf(PermanentError)
    expect(error).toMatchObject({ code: "llm_quota_exceeded" })
  })

  it("treats a server error and a timeout as transient", () => {
    expect(classifyApiError(apiError(503), "x", "llm")).toBeInstanceOf(TransientError)
    expect(classifyApiError(apiError(408), "x", "llm")).toBeInstanceOf(TransientError)
  })

  it("gives a permanent error a message fit for the user", () => {
    // Kalıcı hatanın metni analiz ekranında olduğu gibi gösteriliyor
    // (analysisErrorMessage); "401 Incorrect API key" kullanıcıya çıkmamalı.
    const cause = apiError(401)
    const error = classifyApiError(cause, "LLM çağrısı", "llm")
    expect(error.message).not.toMatch(/401|LLM|API/)
    expect(error.message).toMatch(/tekrar/)
    expect(error.cause).toBe(cause)
  })

  it("keeps the technical detail of a transient error in its message", () => {
    // Geçici hatanın metni kullanıcıya gösterilmiyor, günlüğe yazılıyor.
    expect(classifyApiError(apiError(503), "LLM çağrısı", "llm").message).toMatch(/LLM çağrısı başarısız: 503/)
  })
})
