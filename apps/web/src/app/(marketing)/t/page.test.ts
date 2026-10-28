import { describe, expect, it } from "vitest"
import { metadata } from "@/app/(marketing)/t/page"

describe("/t (DOG-162)", () => {
  it("is the landing page for TikTok visitors, kept out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.alternates).toEqual({ canonical: "/" })
  })
})
