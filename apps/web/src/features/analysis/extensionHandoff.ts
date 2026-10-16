import { MIN_JOB_TEXT_LENGTH } from "@/features/analysis/schema"

/**
 * Tarayıcı eklentisinden gelen ilan (DOG-70).
 *
 * Eklenti uyarla'yı `/analyze#ilan=<metin>&kaynak=<sayfa>` ile açıyor.
 * `#` kısmı sunucuya gitmiyor: ilan metni istek günlüklerine düşmüyor ve
 * yeni bir API ucu gerekmiyor.
 */
export interface ExtensionHandoff {
  jobText: string
  sourceUrl: string | null
  /** Eklentinin ürettiği tek kullanımlık jeton (DOG-71); kendiliğinden göndermeden önce doğrulanıyor. */
  token: string | null
}

export function readExtensionHandoff(hash: string, search: string): ExtensionHandoff | null {
  // Kalıcı sonuç adresi (?analiz=) sonucu gösteriyor; form doldurulmuyor.
  if (new URLSearchParams(search).has("analiz")) return null
  if (!hash.startsWith("#ilan=")) return null
  let params: URLSearchParams
  try {
    // URLSearchParams "+"yı boşluğa çeviriyor; eklenti encodeURIComponent
    // kullandığı için "+" zaten %2B. Bozuk kodlamayı decodeURIComponent yakalıyor.
    decodeURIComponent(hash.slice(1))
    params = new URLSearchParams(hash.slice(1))
  } catch {
    return null
  }
  const jobText = (params.get("ilan") ?? "").trim()
  if (jobText.length < MIN_JOB_TEXT_LENGTH) return null
  const source = params.get("kaynak")
  const sourceUrl = source && /^https?:\/\//i.test(source) ? source : null
  return { jobText, sourceUrl, token: params.get("jeton") || null }
}

/**
 * Kayıtlı kullanıcı, ön seçili kütüphane CV'si ve eklentinin doğruladığı bir
 * bağlantı varsa analiz beklemeden başlar. Doğrulanmamış bağlantı (başka bir
 * sitenin `#ilan=` adresi) formu doldurur ama analizi başlatmaz (DOG-71).
 */
export function shouldAutoSubmit(input: {
  registered: boolean
  resumeId: string | undefined
  jobText: string
  verified: boolean
}): boolean {
  return input.verified && input.registered && !!input.resumeId && input.jobText.trim().length >= MIN_JOB_TEXT_LENGTH
}

/** `chrome.runtime.sendMessage(extensionId, message, callback)` imzası. */
export type SendMessage = (extensionId: string, message: unknown, callback: (response: unknown) => void) => void

/** Tarayıcının eklentiye mesaj yolu; Chrome dışında ya da eklenti yoksa undefined. */
export function browserSendMessage(): SendMessage | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: { sendMessage?: SendMessage; lastError?: unknown } } }).chrome?.runtime
  if (!runtime?.sendMessage) return undefined
  return (id, message, callback) => {
    try {
      runtime.sendMessage!(id, message, (response) => {
        // lastError okunmazsa Chrome konsola "Unchecked runtime.lastError" yazıyor.
        void runtime.lastError
        callback(response)
      })
    } catch {
      callback(undefined)
    }
  }
}

/**
 * Jetonu eklentiye sorar (DOG-71). Yapılandırılmış kimliklerden biri "geçerli"
 * derse doğrulanmış. Eklenti kurulu değilse, kimlik yoksa ya da süre dolarsa
 * doğrulanmamış: kendiliğinden gönderme yerine form dolu bekler.
 */
export async function verifyHandoff(
  token: string | null,
  extensionIds: string[],
  send: SendMessage | undefined,
  timeoutMs = 1500,
): Promise<boolean> {
  if (!token || !send || extensionIds.length === 0) return false
  const asks = extensionIds.map(
    (id) =>
      new Promise<boolean>((resolve) => {
        send(id, { type: "uyarla-jeton", token }, (response) =>
          resolve((response as { valid?: unknown } | undefined)?.valid === true),
        )
      }),
  )
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
  // Herhangi biri doğrularsa yeter; hepsi reddederse ya da süre dolarsa false.
  const anyValid = Promise.all(asks.map((a) => a.then((ok) => (ok ? Promise.reject(true) : false)))).then(
    () => false,
    () => true,
  )
  return Promise.race([anyValid, timeout])
}

/** `NEXT_PUBLIC_EXTENSION_IDS`: virgülle ayrılmış eklenti kimlikleri (geliştirme, mağaza). */
export function extensionIdsFromEnv(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((id) => id.trim()).filter(Boolean)
}

/** Tek kullanımlık kapı: Strict Mode efekti iki kez çalıştırsa da bir gönderim. */
export function createAutoSubmitGate(): () => boolean {
  let open = true
  return () => {
    if (!open) return false
    open = false
    return true
  }
}
