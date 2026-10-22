import { issueToken, redeemToken, type TokenStore } from "./handoffToken.js"
import { pickPosting, pickSelection, uyarlaUrl } from "./posting.js"

/** Build sırasında esbuild `define` ile veriliyor (scripts/build.mjs). */
declare const UYARLA_URL: string

const MENU_ID = "uyarla-secili-metin"
const NOT_FOUND =
  "Bu sayfada ilan bulamadık. İlan metnini seçip sağ tıkla \"Seçili metni uyarla ile ölç\" de."

chrome.runtime.onInstalled.addListener(() => {
  // Güncellemede ve yeniden yüklemede önceki sürümün menüsü duruyor; aynı
  // kimlikle yeniden oluşturmak "duplicate id" hatası veriyordu.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Seçili metni uyarla ile ölç", contexts: ["selection"] })
  })
})

/** Jetonlar `chrome.storage.session`'da: tarayıcı kapanınca siliniyor, diske yazılmıyor. */
const TOKENS_KEY = "uyarlaJetonlari"

async function readTokens(): Promise<TokenStore> {
  return ((await chrome.storage.session.get(TOKENS_KEY))[TOKENS_KEY] as TokenStore | undefined) ?? {}
}

async function openUyarla(text: string, sourceUrl: string | null): Promise<void> {
  // Sayfa kendiliğinden göndermeden önce bu jetonu soruyor (DOG-71).
  const { store, token } = issueToken(await readTokens(), Date.now())
  await chrome.storage.session.set({ [TOKENS_KEY]: store })
  await chrome.tabs.create({ url: uyarlaUrl(UYARLA_URL, text, sourceUrl, token) })
}

/**
 * uyarla sayfasının jeton sorusu. Yalnızca manifest'teki
 * `externally_connectable` adresleri (uyarla.com.tr, localhost) mesaj
 * gönderebiliyor. Jeton bir kez doğrulanıp siliniyor: yenileme ya da
 * kopyalanan adres analiz başlatmıyor.
 */
chrome.runtime.onMessageExternal.addListener((message: unknown, _sender, sendResponse) => {
  const token = (message as { type?: string; token?: unknown } | null)?.type === "uyarla-jeton"
    ? (message as { token?: unknown }).token
    : undefined
  if (typeof token !== "string") {
    sendResponse({ valid: false })
    return false
  }
  void (async () => {
    const { store, valid } = redeemToken(await readTokens(), token, Date.now())
    await chrome.storage.session.set({ [TOKENS_KEY]: store })
    sendResponse({ valid })
  })()
  // Cevap eşzamansız gönderiliyor; kanal açık kalmalı.
  return true
})

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
  let pageText: string | undefined
  if (tab?.id !== undefined) {
    // Menü tıklaması activeTab izni veriyor: seçim sayfadan satır sonlarıyla okunuyor.
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: info.frameId !== undefined ? [info.frameId] : undefined },
        func: () => window.getSelection()?.toString() ?? "",
      })
      pageText = typeof result?.result === "string" ? result.result : undefined
    } catch {
      pageText = undefined
    }
  }
  const text = pickSelection(info.selectionText, pageText)
  if (!text) return notFound(tab?.id)
  await openUyarla(text, tab?.url ?? null)
})
