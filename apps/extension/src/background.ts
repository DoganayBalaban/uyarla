import { pickPosting, pickSelection, uyarlaUrl } from "./posting.js"

/** Build sırasında esbuild `define` ile veriliyor (scripts/build.mjs). */
declare const UYARLA_URL: string

const MENU_ID = "uyarla-secili-metin"
const NOT_FOUND =
  "Bu sayfada ilan bulamadık. İlan metnini seçip sağ tıkla \"Seçili metni uyarla ile ölç\" de."

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "Seçili metni uyarla ile ölç", contexts: ["selection"] })
})

async function openUyarla(text: string, sourceUrl: string | null): Promise<void> {
  await chrome.tabs.create({ url: uyarlaUrl(UYARLA_URL, text, sourceUrl) })
}

async function notFound(tabId: number | undefined): Promise<void> {
  if (tabId !== undefined) {
    await chrome.action.setBadgeText({ tabId, text: "!" })
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#d97706" })
  }
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: "uyarla",
    message: NOT_FOUND,
  })
}

/** Simge: açık sekmenin HTML'i (activeTab ile, yalnızca bu tıklamada). */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return notFound(undefined)
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    })
    const page = result?.result as { html: string; url: string } | undefined
    const text = page ? pickPosting(page) : null
    if (!page || !text) return notFound(tab.id)
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" })
    await openUyarla(text, page.url)
  } catch {
    // chrome://, Web Mağazası gibi betik çalıştırılamayan sayfalar.
    await notFound(tab.id)
  }
})

/** Sağ tık: seçili metin, her sitede. */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return
  const text = pickSelection(info.selectionText)
  if (!text) return notFound(tab?.id)
  await openUyarla(text, tab?.url ?? null)
})
