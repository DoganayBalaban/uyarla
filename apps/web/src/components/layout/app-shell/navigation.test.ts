import { describe, expect, it } from "vitest"
import { breadcrumbs, isActive } from "@/components/layout/app-shell/navigation"

describe("app shell navigation (DOG-144)", () => {
  it("marks the item and its sub pages active", () => {
    expect(isActive("/applications", "/applications")).toBe(true)
    expect(isActive("/applications/abc", "/applications")).toBe(true)
    expect(isActive("/applicationsx", "/applications")).toBe(false)
    // Mülakat hazırlığı Mülakatlar'a ait.
    expect(isActive("/applications/abc/mulakat", "/interviews")).toBe(true)
    expect(isActive("/applications/abc/mulakat", "/applications")).toBe(false)
  })

  it("builds the breadcrumb for top and detail pages", () => {
    expect(breadcrumbs("/dashboard")).toEqual([{ label: "Genel bakış" }])
    expect(breadcrumbs("/applications/abc")).toEqual([{ label: "Başvurular", href: "/applications" }, { label: "Başvuru" }])
    expect(breadcrumbs("/applications/abc/mulakat")).toEqual([{ label: "Mülakatlar", href: "/interviews" }, { label: "Hazırlık" }])
    expect(breadcrumbs("/adapt/xyz")).toEqual([{ label: "Uyarlama" }])
    expect(breadcrumbs("/bilinmeyen")).toEqual([])
    expect(breadcrumbs("/analyze")).toEqual([{ label: "Yeni analiz" }])
    expect(breadcrumbs("/analyze", new URLSearchParams("analiz=a1"))).toEqual([{ label: "Analiz sonucu" }])
  })
})
