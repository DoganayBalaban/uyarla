import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import type { ExtensionMessage } from "./messages.js"
import { SHORTCUTS, popupView, type PopupState } from "./popupView.js"
import { readPosting } from "./posting.js"
import { isProfileUrl } from "./profile.js"
import { collectProfileSnapshot } from "./profileCollector.js"
import { SETTING_KEY } from "./settings.js"

/** Build sırasında esbuild `define` ile veriliyor (scripts/build.mjs). */
declare const UYARLA_URL: string

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/**
 * Simge menüsü (DOG-169). Menü açılınca Chrome o sekme için activeTab izni
 * veriyor; sekme yalnızca o anda okunuyor. Gönderim arka planda.
 */
async function readTab(): Promise<{ state: PopupState; message: ExtensionMessage | null }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const none = { state: { scriptable: false, posting: null, profile: null }, message: null }
  if (tab?.id === undefined) return none
  try {
    if (tab.url && isProfileUrl(tab.url)) {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectProfileSnapshot })
      const snapshot = result?.result as ProfileSnapshot | undefined
      return {
        state: { scriptable: true, posting: null, profile: { own: !!snapshot?.own } },
        message: snapshot?.own ? { type: "uyarla-profil", snapshot } : null,
      }
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    })
    const page = result?.result as { html: string; url: string } | undefined
    // Menüde kullanıcı kendisi istiyor: sayfa metni de yeter (sayfa düğmesi daha seçici).
    const posting = page ? readPosting(page) : null
    return {
      state: { scriptable: true, posting: posting ? { position: posting.position, company: posting.company } : null, profile: null },
      message: posting && page ? { type: "uyarla-ilan", text: posting.text, url: page.url } : null,
    }
  } catch {
    // chrome://, Web Mağazası gibi betik çalıştırılamayan sayfalar.
    return none
  }
}

function renderLinks(): void {
  const base = UYARLA_URL.replace(/\/+$/, "")
  for (const link of SHORTCUTS) {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = link.label
    button.addEventListener("click", () => {
      void chrome.tabs.create({ url: `${base}${link.path}` }).then(() => window.close())
    })
    $("links").append(button)
  }
}

async function renderSetting(): Promise<void> {
  const input = $<HTMLInputElement>("pageButton")
  const stored = await chrome.storage.local.get(SETTING_KEY)
  input.checked = stored[SETTING_KEY] !== false
  input.addEventListener("change", () => void chrome.storage.local.set({ [SETTING_KEY]: input.checked }))
}

async function renderState(): Promise<void> {
  const { state, message } = await readTab()
  const view = popupView(state)
  $("loading").hidden = true
  $("state").hidden = false
  $("title").textContent = view.title
  const detail = $("detail")
  detail.hidden = !view.detail
  detail.textContent = view.detail ?? ""
  const hint = $("hint")
  hint.hidden = !view.hint
  hint.textContent = view.hint ?? ""
  const action = $<HTMLButtonElement>("action")
  if (view.action && view.actionLabel && message) {
    action.hidden = false
    action.textContent = view.actionLabel
    action.addEventListener("click", () => {
      action.disabled = true
      void chrome.runtime.sendMessage(message).finally(() => window.close())
    })
  }
}

renderLinks()
void renderSetting()
void renderState()
