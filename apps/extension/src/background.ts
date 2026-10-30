import { LinkedInProfileDataSchema } from "@uyarla/core/linkedin/profileData"
import { profileFromSnapshot, type ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import { issueToken, redeemToken, type TokenStore } from "./handoffToken.js"
import { pickSelection, uyarlaUrl } from "./posting.js"
import { readMessage } from "./messages.js"
import { encodeProfile, profileHandoffUrl } from "./profile.js"

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
  // Sayfanın "eklenti kurulu mu" yoklaması (DOG-157).
  if ((message as { type?: string } | null)?.type === "uyarla-ping") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
    return false
  }
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

const PROFILE_UNREADABLE = "Profilini okuyamadık; sayfayı yenileyip tekrar dene ya da PDF yükle."

function notify(message: string): void {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/128.png", title: "uyarla", message })
}

/**
 * Kendi profil sayfası (DOG-157): görünen satırlar → profil → uyarla'nın
 * /linkedin sayfası. Başkasının profili okunmuyor ve gönderilmiyor. Satırlar
 * sayfa düğmesinden ya da simge menüsünden geliyor (DOG-169).
 */
async function sendProfile(snapshot: ProfileSnapshot | undefined): Promise<void> {
  if (!snapshot) return notify(PROFILE_UNREADABLE)
  if (!snapshot.own) return notify("Yalnızca kendi profilini gönderebilirsin.")
  let parsed: ReturnType<typeof LinkedInProfileDataSchema.safeParse>
  try {
    parsed = LinkedInProfileDataSchema.safeParse(profileFromSnapshot(snapshot))
  } catch {
    return notify(PROFILE_UNREADABLE)
  }
  if (!parsed.success || (!parsed.data.headline && parsed.data.experience.length === 0)) return notify(PROFILE_UNREADABLE)
  const { store, token } = issueToken(await readTokens(), Date.now())
  await chrome.storage.session.set({ [TOKENS_KEY]: store })
  await chrome.tabs.create({ url: profileHandoffUrl(UYARLA_URL, encodeProfile(parsed.data), token) })
}

/**
 * Sayfa düğmesi ve simge menüsü (DOG-169). Simge artık menü açıyor; menü
 * ve düğme ilanı ya da profili okuyup buraya gönderiyor, jeton burada.
 * Yalnızca eklentinin kendi betiklerinden gelen mesajlar kabul ediliyor.
 */
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const read = readMessage(message, sender, { id: chrome.runtime.id, popupUrl: chrome.runtime.getURL("popup.html") })
  if (!read) return false
  void (async () => {
    try {
      if (read.type === "uyarla-ilan") await openUyarla(read.text, read.url)
      else await sendProfile(read.snapshot)
      sendResponse({ ok: true })
    } catch {
      if (read.type === "uyarla-profil") notify(PROFILE_UNREADABLE)
      sendResponse({ ok: false })
    }
  })()
  return true
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
