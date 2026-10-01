import { AxiosError, AxiosHeaders } from "axios"
import { describe, expect, it } from "vitest"
import { shouldRetry } from "@/lib/queryClient"

const config = { headers: new AxiosHeaders() }
const notFound = new AxiosError("yok", "ERR_BAD_REQUEST", config, null, {
  status: 404,
  statusText: "",
  headers: {},
  config,
  data: {},
})

describe("shouldRetry", () => {
  it("retries a request that got no response, twice", () => {
    const offline = new AxiosError("ağ yok", "ERR_NETWORK")
    expect(shouldRetry(0, offline)).toBe(true)
    expect(shouldRetry(1, offline)).toBe(true)
    expect(shouldRetry(2, offline)).toBe(false)
  })

  it("does not retry an answer from the API", () => {
    // 404/401 kalıcı: tekrar sormak yalnızca hatayı geciktirir.
    expect(shouldRetry(0, notFound)).toBe(false)
  })
})
