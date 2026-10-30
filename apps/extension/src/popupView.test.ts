import { describe, expect, it } from "vitest"
import { SHORTCUTS, popupView } from "./popupView.js"

describe("popupView (DOG-169)", () => {
  it("offers to measure a posting it found, naming it", () => {
    const v = popupView({ scriptable: true, posting: { position: "Senior Digital Marketing Specialist", company: "Esteworld" }, profile: null })
    expect(v).toMatchObject({ action: "posting", actionLabel: "CV'mi bu ilana uyarla", detail: "Senior Digital Marketing Specialist · Esteworld" })
  })

  it("offers the audit on the user's own profile and explains someone else's", () => {
    expect(popupView({ scriptable: true, posting: null, profile: { own: true } })).toMatchObject({ action: "profile", actionLabel: "Profilimi denetle" })
    const other = popupView({ scriptable: true, posting: null, profile: { own: false } })
    expect(other.action).toBeNull()
    expect(other.hint).toContain("kendi profilini")
  })

  it("tells how to send a posting it could not find, and where it cannot work", () => {
    const none = popupView({ scriptable: true, posting: null, profile: null })
    expect(none.action).toBeNull()
    expect(none.hint).toContain("sağ tıkla")
    const blocked = popupView({ scriptable: false, posting: null, profile: null })
    expect(blocked.hint).toContain("bu sayfada")
    // Üstte zaten "uyarla" yazıyor; başlık durumu söylesin.
    expect(blocked.title).toBe("Bu sayfada çalışamıyoruz")
  })

  it("links to the pages people come back to", () => {
    expect(SHORTCUTS.map((s) => s.path)).toEqual(["/analyze", "/applications", "/cvs", "/linkedin"])
  })
})
