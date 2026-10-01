import { AxiosError, AxiosHeaders } from "axios"
import { describe, expect, it } from "vitest"
import { apiErrorMessage, apiStatus } from "@/lib/api"

function responseError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError("istek başarısız", "ERR_BAD_RESPONSE", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  })
}

describe("apiErrorMessage", () => {
  it("returns the message the API sent", async () => {
    expect(await apiErrorMessage(responseError(400, { error: "İlanı alamadık." }), "yedek")).toBe("İlanı alamadık.")
  })

  it("reads the message from a blob body", async () => {
    // Dosya indirme isteği blob bekliyor; hata gövdesi de blob olarak geliyor.
    const body = new Blob([JSON.stringify({ error: "Taslak hazır değil." })], { type: "application/json" })
    expect(await apiErrorMessage(responseError(409, body), "yedek")).toBe("Taslak hazır değil.")
  })

  it("falls back when the body has no message", async () => {
    expect(await apiErrorMessage(responseError(500, "<html>"), "yedek")).toBe("yedek")
    expect(await apiErrorMessage(new Error("ağ yok"), "yedek")).toBe("yedek")
  })
})

describe("apiStatus", () => {
  it("returns the response status of a failed request", () => {
    expect(apiStatus(responseError(404, {}))).toBe(404)
  })

  it("is null when no response arrived", () => {
    expect(apiStatus(new AxiosError("ağ yok", "ERR_NETWORK"))).toBeNull()
    expect(apiStatus(new Error("başka"))).toBeNull()
  })
})
