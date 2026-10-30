import { collectProfileSnapshot } from "./profileCollector.js"
import type { ExtensionMessage } from "./messages.js"
import { findApplyAnchor, findProfileAnchor, placeButton, removeButton } from "./pageButton.js"
import { readPosting } from "./posting.js"
import { isProfileUrl } from "./profile.js"
import { SETTING_KEY } from "./settings.js"

/**
 * İş sitelerinde çalışan sayfa betiği (DOG-169): açık ilan ya da kendi
 * LinkedIn profili varsa uyarla düğmesini koyar. Sayfayı yalnızca düğmeyi
 * koyup koymamaya karar vermek için okur; kullanıcı basmadan hiçbir şey
 * gönderilmiyor. Gönderim arka planda (jeton orada).
 */

/** Sayfa değişince yeniden bakmadan önce bekleme; LinkedIn sürekli değişiyor. */
const SETTLE_MS = 800
/** Bir adreste ilan aranırken en fazla bu kadar deneme (sayfa geç yükleniyor). */
const MAX_TRIES = 12

let enabled = true
let lastUrl = ""
let tries = 0
let timer: ReturnType<typeof setTimeout> | undefined

function send(message: ExtensionMessage): void {
  void chrome.runtime.sendMessage(message).catch(() => {
    // Eklenti güncellenip bağlam koptuysa sayfa yenilenene kadar sessiz.
  })
}

function evaluate(): void {
  timer = undefined
  if (!enabled) return removeButton(document)
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    tries = 0
    removeButton(document)
  }
  if (tries >= MAX_TRIES) return
  tries++

  if (isProfileUrl(url)) {
    const snapshot = collectProfileSnapshot()
    if (!snapshot.own) return removeButton(document)
    placeButton(document, {
      label: "Profilimi uyarla ile denetle",
      anchor: findProfileAnchor(document),
      onClick: () => send({ type: "uyarla-profil", snapshot: collectProfileSnapshot() }),
    })
    tries = MAX_TRIES
    return
  }

  const posting = readPosting({ html: document.documentElement.outerHTML, url }, { marked: true })
  if (!posting) return removeButton(document)
  placeButton(document, {
    label: "CV'mi bu ilana uyarla",
    anchor: findApplyAnchor(document),
    // Basıldığı anda yeniden okunuyor: liste ekranında seçili ilan değişmiş olabilir.
    onClick: () => {
      const fresh = readPosting({ html: document.documentElement.outerHTML, url: location.href }) ?? posting
      send({ type: "uyarla-ilan", text: fresh.text, url: location.href })
    },
  })
  tries = MAX_TRIES
}

function schedule(): void {
  if (timer !== undefined) return
  timer = setTimeout(evaluate, SETTLE_MS)
}

/** Sayfa değişti: adres değiştiyse, düğme koptuysa ya da ilan hâlâ aranıyorsa yeniden bak. */
const observer = new MutationObserver((records) => {
  if (records.every((r) => (r.target as Element).closest?.("uyarla-dugme"))) return
  const buttonGone = tries >= MAX_TRIES && !document.querySelector("uyarla-dugme") && lastUrl === location.href
  if (location.href !== lastUrl || tries < MAX_TRIES || buttonGone) {
    if (buttonGone) tries = MAX_TRIES - 2
    schedule()
  }
})

void chrome.storage.local.get(SETTING_KEY).then((stored) => {
  enabled = stored[SETTING_KEY] !== false
  observer.observe(document.documentElement, { childList: true, subtree: true })
  schedule()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(SETTING_KEY in changes)) return
  enabled = changes[SETTING_KEY]!.newValue !== false
  tries = 0
  schedule()
})
