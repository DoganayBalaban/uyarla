import { describe, expect, it } from "vitest"
import { parseRecent, pushRecent } from "@/components/layout/app-shell/recent"

describe("command menu recents (DOG-154)", () => {
  it("puts the newest first, once, and keeps at most five", () => {
    const list = ["a", "b", "c", "d", "e"].map((x) => ({ href: `/${x}`, label: x }))
    expect(pushRecent(list, { href: "/c", label: "c" }).map((r) => r.href)).toEqual(["/c", "/a", "/b", "/d", "/e"])
    expect(pushRecent(list, { href: "/f", label: "f" }).map((r) => r.href)).toEqual(["/f", "/a", "/b", "/c", "/d"])
  })

  it("ignores broken or foreign entries", () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent("{")).toEqual([])
    expect(parseRecent(JSON.stringify([{ href: "https://evil.example", label: "x" }, { href: "/cvs", label: "CV'lerim" }]))).toEqual([
      { href: "/cvs", label: "CV'lerim" },
    ])
  })
})
