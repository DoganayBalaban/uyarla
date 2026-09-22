import { describe, it, expect } from "vitest"
import { PACKAGE_NAME } from "./index.js"

describe("core paketi", () => {
  it("kurulum tamam ve dışa aktarım çalışıyor", () => {
    expect(PACKAGE_NAME).toBe("@uyarla/core")
  })
})
