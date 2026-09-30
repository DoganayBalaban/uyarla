import { describe, it, expect } from "vitest"
import { PACKAGE_NAME } from "./index.js"

describe("core package", () => {
  it("is set up and exports work", () => {
    expect(PACKAGE_NAME).toBe("@uyarla/core")
  })
})
