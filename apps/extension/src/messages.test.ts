import { describe, expect, it } from "vitest"
import { readMessage } from "./messages.js"

const self = { id: "eklenti", popupUrl: "chrome-extension://eklenti/popup.html" }
const fromTab = { id: "eklenti", tab: { id: 7 } }
const posting = "Senior Digital Marketing Specialist — Esteworld\n\nPerformans pazarlama operasyonumuzu birlikte büyütecek bir uzman arıyoruz."

describe("readMessage (DOG-169)", () => {
  it("accepts a posting sent by the page button or the popup", () => {
    expect(readMessage({ type: "uyarla-ilan", text: posting, url: "https://www.linkedin.com/jobs/view/1" }, fromTab, self)).toEqual({ type: "uyarla-ilan", text: posting, url: "https://www.linkedin.com/jobs/view/1" })
    expect(readMessage({ type: "uyarla-ilan", text: posting, url: "https://x" }, { id: "eklenti", url: self.popupUrl }, self)?.type).toBe("uyarla-ilan")
  })

  it("accepts a profile snapshot with its own shape checked later", () => {
    expect(readMessage({ type: "uyarla-profil", snapshot: { own: true, name: "Deniz", sections: {} } }, fromTab, self)?.type).toBe("uyarla-profil")
  })

  it("rejects messages from anyone but the extension's own scripts", () => {
    expect(readMessage({ type: "uyarla-ilan", text: posting, url: "https://x" }, { id: "baska", tab: { id: 1 } }, self)).toBeNull()
    // Ne sekmeden ne menüden: başka bir eklenti sayfası.
    expect(readMessage({ type: "uyarla-ilan", text: posting, url: "https://x" }, { id: "eklenti", url: "chrome-extension://eklenti/other.html" }, self)).toBeNull()
  })

  it("rejects a posting too short to analyze and anything malformed", () => {
    expect(readMessage({ type: "uyarla-ilan", text: "kısa", url: "https://x" }, fromTab, self)).toBeNull()
    expect(readMessage({ type: "uyarla-ilan", text: 42, url: "https://x" }, fromTab, self)).toBeNull()
    expect(readMessage({ type: "uyarla-profil", snapshot: "x" }, fromTab, self)).toBeNull()
    expect(readMessage(null, fromTab, self)).toBeNull()
  })
})
