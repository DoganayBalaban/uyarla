import { describe, expect, it } from "vitest"
import { isAllowedPath } from "@/server/jobPostingFromUrl"

describe("isAllowedPath", () => {
  it.each([
    "https://www.kariyer.net/is-ilani/acme-frontend-gelistirici-123",
    "https://tr.linkedin.com/jobs/view/4012345678",
    "http://boards.greenhouse.io/acme/jobs/1",
    "https://acme.wd3.myworkdayjobs.com/tr-TR/External/job/1",
  ])("accepts %s (upgraded to https)", (address) => {
    const url = isAllowedPath(address)
    expect(url).not.toBeNull()
    expect(url!.protocol).toBe("https:")
  })

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "https://kariyer.net.kotu.site/ilan",
    "https://kotukariyer.net/ilan",
    "https://user:pass@www.kariyer.net/ilan",
    "https://www.kariyer.net:8080/ilan",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "düz metin",
  ])("rejects %s", (address) => {
    expect(isAllowedPath(address)).toBeNull()
  })
})
