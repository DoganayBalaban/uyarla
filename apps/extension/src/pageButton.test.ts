import { JSDOM } from "jsdom"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { BUTTON_TAG, clickForTest, findApplyAnchor, findProfileAnchor, placeButton, removeButton } from "./pageButton.js"

const doc = (body: string) => new JSDOM(`<!doctype html><html><body>${body}</body></html>`).window.document

describe("findApplyAnchor (DOG-169)", () => {
  it("finds the site's own apply button by its text", () => {
    const linkedin = doc(`<div class="top"><button aria-label="Esteworld şirketinde Senior Digital Marketing Specialist için Kolay Başvuru"><span>Kolay Başvuru</span></button><button>Kaydet</button></div>`)
    expect(findApplyAnchor(linkedin)?.textContent).toContain("Kolay Başvuru")
    expect(findApplyAnchor(doc(`<a href="/basvur">Hemen Başvur</a>`))?.textContent).toBe("Hemen Başvur")
    expect(findApplyAnchor(doc(`<button> Apply for this job </button>`))).not.toBeNull()
    expect(findApplyAnchor(doc(`<a role="button">Başvur</a>`))).not.toBeNull()
  })

  it("does not take a sentence that only mentions applying", () => {
    expect(findApplyAnchor(doc(`<a>Başvuru süreci hakkında bilgi al</a><button>Kaydet</button>`))).toBeNull()
  })

  it("skips hidden buttons", () => {
    expect(findApplyAnchor(doc(`<button hidden>Başvur</button><button aria-hidden="true">Apply</button>`))).toBeNull()
  })
})

describe("visibility in a real browser (DOG-169)", () => {
  // Gerçek LinkedIn ilan sayfasında ilk "Apply" CSS ile gizli bir kopyaydı; düğme onun
  // yanına girip görünmüyordu. jsdom'da düzen yok: checkVisibility sınıfa bakan bir taklit.
  const withLayout = (body: string) => {
    const d = doc(body)
    const proto = d.defaultView!.Element.prototype as unknown as { checkVisibility: (this: Element) => boolean }
    proto.checkVisibility = function () {
      return !this.closest(".gizli")
    }
    return d
  }

  it("takes the visible apply button, not a hidden copy", () => {
    const d = withLayout(`<div class="gizli"><button id="kopya">Apply</button></div><div><button id="asil">Apply</button></div>`)
    expect(findApplyAnchor(d)?.id).toBe("asil")
  })

  it("moves to the corner when the spot next to the apply button does not show", () => {
    const d = withLayout(`<div class="gizli"><button id="tek">Apply</button></div>`)
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: d.getElementById("tek") })
    expect(host.getAttribute("data-yer")).toBe("kose")
    expect(host.parentElement).toBe(d.body)
  })
})

describe("placement inside LinkedIn's apply pill (DOG-169)", () => {
  // Gerçek LinkedIn: "Başvur" yazısı görünür kabın içindeki bir bağlantı. Düğme bağlantının
  // yanına, yani kabın içine giriyor ve kap kestiği için "Başvur"un altında kalıyordu.
  it("sits after the apply button's outermost wrapper, beside the save button", () => {
    const d = doc(`<div class="row"><div class="pill"><a href="/apply"><span>Başvur</span><svg></svg></a></div><button id="kaydet">Kaydedildi</button></div>`)
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: findApplyAnchor(d) })
    expect(host.parentElement?.className).toBe("row")
    expect(host.previousElementSibling?.className).toBe("pill")
    expect(host.nextElementSibling?.id).toBe("kaydet")
  })

  it("moves to the corner when it would land on top of the apply button", () => {
    const d = doc(`<div class="row"><button id="basvur">Başvur</button><span>Kaydet</span></div>`)
    const view = d.defaultView!
    const rect = (x: number, w: number) => ({ x, y: 0, left: x, top: 0, width: w, height: 36, right: x + w, bottom: 36, toJSON: () => ({}) })
    const proto = view.Element.prototype as unknown as { getBoundingClientRect: (this: Element) => ReturnType<typeof rect> }
    // Düğme, başvurunun tam üstüne düşüyor (kesilen kap).
    proto.getBoundingClientRect = function () {
      return this.id === "basvur" ? rect(0, 200) : this.tagName.toLowerCase() === "uyarla-dugme" && this.parentElement?.className === "row" ? rect(20, 160) : rect(0, 0)
    }
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: findApplyAnchor(d) })
    expect(host.getAttribute("data-yer")).toBe("kose")
  })
})

describe("findProfileAnchor (DOG-169)", () => {
  it("finds the add-section link on the user's own LinkedIn profile", () => {
    const html = readFileSync(resolve(process.cwd(), "src/fixtures/linkedin-own-profile.html"), "utf8")
    const anchor = findProfileAnchor(new JSDOM(html).window.document)
    expect(anchor?.textContent?.trim()).toBe("Bölüm ekle")
  })
})

describe("placeButton (DOG-169)", () => {
  it("puts the button right after the apply button, once", () => {
    const d = doc(`<div><button id="apply">Kolay Başvuru</button><button>Kaydet</button></div>`)
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: findApplyAnchor(d) })
    expect(host.previousElementSibling?.id).toBe("apply")
    placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: findApplyAnchor(d) })
    expect(d.querySelectorAll(BUTTON_TAG)).toHaveLength(1)
  })

  it("floats in the corner when the page has no apply button to sit next to", () => {
    // Site tasarımı değişince düğme kaybolmasın.
    const d = doc(`<main><h1>İlan</h1></main>`)
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => {}, anchor: null })
    expect(host.parentElement).toBe(d.body)
    expect(host.getAttribute("data-yer")).toBe("kose")
  })

  it("calls back on click and can be removed", () => {
    const d = doc(`<button>Başvur</button>`)
    let clicks = 0
    const host = placeButton(d, { label: "CV'mi bu ilana uyarla", onClick: () => clicks++, anchor: findApplyAnchor(d) })
    clickForTest(host, true)
    expect(clicks).toBe(1)
    // Sitenin kendi betiğinden gelen tıklama (isTrusted false) bir şey göndermiyor.
    clickForTest(host, false)
    expect(clicks).toBe(1)
    removeButton(d)
    expect(d.querySelector(BUTTON_TAG)).toBeNull()
  })
})
