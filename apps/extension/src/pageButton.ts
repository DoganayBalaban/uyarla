import { brandSvg } from "./brand.js"

/**
 * İlan ve profil sayfasındaki uyarla düğmesi (DOG-169). Yerleşim A: sitenin
 * kendi başvuru düğmesinin hemen yanında. Başvuru düğmesi bulunamazsa
 * (site tasarımı değişti) sağ altta yüzen rozet; düğme hiçbir sitede
 * kaybolmasın.
 *
 * Düğme kapalı Shadow DOM'da: sitenin CSS'i düğmeyi, düğmenin CSS'i siteyi
 * bozmuyor. Tıklama yalnızca kullanıcıdan (isTrusted) kabul ediliyor; sitenin
 * betiği düğmeye bastırıp sekme açtıramaz.
 */
export const BUTTON_TAG = "uyarla-dugme"

/** Başvuru düğmesinin metni; tamamı bu olmalı ("Başvuru süreci hakkında…" değil). */
const APPLY =
  /^(kolay başvuru|easy apply|hemen başvur|başvur|ilana başvur|başvuru yap|şirket sitesinde başvur|apply|apply now|apply for this job|apply for this position|apply on company (website|site)|i'm interested)$/i
/** Kendi LinkedIn profilinin başlık kartındaki "Bölüm ekle" bağlantısı. */
const PROFILE = /^(bölüm ekle|profil bölümü ekle|add profile section|add section)$/i

const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim()

/**
 * Tarayıcıda gerçekten görünüyor mu. LinkedIn'in ilan sayfasında CSS ile
 * gizlenmiş bir "Apply" kopyası var; düğme onun yanına girip görünmüyordu.
 * `checkVisibility` olmayan ortamda (jsdom) yalnızca öznitelikler.
 */
function shows(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility
  return typeof check === "function" ? check.call(el) : true
}

function isHidden(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true") return true
  }
  return !shows(el)
}

function findByText(doc: Document, pattern: RegExp): Element | null {
  for (const el of Array.from(doc.querySelectorAll('button, a, [role="button"]'))) {
    if (el.closest(BUTTON_TAG) || isHidden(el)) continue
    if (pattern.test(clean(el.textContent))) return el
  }
  return null
}

export function findApplyAnchor(doc: Document): Element | null {
  return findByText(doc, APPLY)
}

/**
 * Düğmenin görünür kabı: başvuru düğmesini tek görünür çocuk olarak taşıyan
 * en dıştaki ata (DOG-169). LinkedIn'de "Başvur" bağlantısı önce kesen bir
 * hap kabın, sonra görünmeyen bir ipucu metni de taşıyan bir grid'in içinde.
 * Düğme bunların içine girince "Başvur"la aynı hücreye düşüp altında
 * kalıyordu. Tırmanma "Başvur" ile "Kaydet"in bulunduğu satırda duruyor.
 */
function outerControl(el: Element): Element {
  const visibleChildren = (parent: Element) =>
    Array.from(parent.children).filter((c) => c.tagName.toLowerCase() !== BUTTON_TAG && shows(c) && !isHidden(c))
  let current = el
  for (let parent = current.parentElement; parent && parent !== current.ownerDocument.body; parent = current.parentElement) {
    const kids = visibleChildren(parent)
    if (kids.length !== 1 || kids[0] !== current) break
    current = parent
  }
  return current
}

/** Düğme başvuru düğmesinin üstüne düşmüş mü (kesilen kap, üst üste binen katman). */
function overlaps(host: Element, target: Element): boolean {
  const h = host.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  if (!h.width || !t.width) return false
  const w = Math.min(h.right, t.right) - Math.max(h.left, t.left)
  const y = Math.min(h.bottom, t.bottom) - Math.max(h.top, t.top)
  return w > 0 && y > 0 && w * y > 0.5 * h.width * h.height
}

export function findProfileAnchor(doc: Document): Element | null {
  return findByText(doc, PROFILE)
}

const STYLE = `
:host { all: initial; display: inline-flex; vertical-align: middle; margin: 0 8px; }
:host([data-yer="kose"]) { position: fixed; right: 24px; bottom: 24px; margin: 0; z-index: 2147483646; }
button {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff; background: #4f46e5; border: 0; border-radius: 999px; padding: 8px 16px;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, .18); white-space: nowrap;
}
:host([data-yer="kose"]) button { box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
button:hover { background: #4338ca; }
button:focus-visible { outline: 3px solid #a5b4fc; outline-offset: 2px; }
.logo { display: block; height: 12px; width: auto; flex: none; color: #fff; }
`

const buttons = new WeakMap<Element, { button: HTMLButtonElement; onClick: () => void }>()

/**
 * Düğmeyi koyar ya da var olanı günceller; sayfada hep tek düğme. `anchor`
 * varsa hemen arkasına, yoksa köşeye.
 */
export function placeButton(doc: Document, options: { label: string; onClick: () => void; anchor: Element | null }): Element {
  let host = doc.querySelector(BUTTON_TAG)
  if (!host) {
    host = doc.createElement(BUTTON_TAG)
    const shadow = host.attachShadow({ mode: "closed" })
    const style = doc.createElement("style")
    style.textContent = STYLE
    const button = doc.createElement("button")
    button.type = "button"
    const mark = brandSvg(doc, "icon")
    mark.classList.add("logo")
    button.append(mark, doc.createElement("span"))
    shadow.append(style, button)
    const entry = { button, onClick: options.onClick }
    buttons.set(host, entry)
    button.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.isTrusted) entry.onClick()
    })
  }
  const entry = buttons.get(host)!
  entry.onClick = options.onClick
  ;(entry.button.lastChild as HTMLElement).textContent = options.label
  entry.button.setAttribute("aria-label", `uyarla: ${options.label}`)

  // Başvuru düğmesi görünmüyorsa yanı da anlamsız.
  const target = options.anchor && shows(options.anchor) ? outerControl(options.anchor) : null
  if (target) {
    host.removeAttribute("data-yer")
    if (target.nextElementSibling !== host) target.insertAdjacentElement("afterend", host)
  }
  // Çapa yoksa, yanında görünmüyorsa (gizli kap) ya da başvuru düğmesinin üstüne düştüyse köşede.
  if (!target || !shows(host) || overlaps(host, target)) {
    host.setAttribute("data-yer", "kose")
    if (host.parentElement !== doc.body) doc.body.append(host)
  }
  return host
}

export function removeButton(doc: Document): void {
  doc.querySelector(BUTTON_TAG)?.remove()
}

/** Yalnızca testte: düğmeye kullanıcı (trusted) ya da sayfa betiği basmış gibi. */
export function clickForTest(host: Element, trusted: boolean): void {
  const entry = buttons.get(host)
  if (!entry) return
  if (trusted) entry.onClick()
  else entry.button.dispatchEvent(new (host.ownerDocument.defaultView!.MouseEvent)("click", { bubbles: true }))
}
