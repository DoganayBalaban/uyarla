/**
 * Hata izleme olaylarından kişisel veriyi temizler (DOG-62).
 *
 * Sentry bir veri işleyen: ona giden olayda CV metni, e-posta, telefon ya da
 * oturum çerezi olmamalı (KVKK). SDK'nın `dataCollection` ayarı kullanıcı,
 * çerez, başlık ve gövde toplamayı zaten kapatıyor; bu katman ikinci kilit. İstek
 * gövdesi (yüklenen CV, ilan metni) ve hata mesajlarına sızmış e-posta ya
 * da telefon burada siliniyor.
 *
 * Sentry tipine bağlı değil: core SDK'ya bağımlı olmasın, web ve worker
 * kendi SDK'sının `beforeSend` kancasından çağırsın.
 */
export interface ScrubbableEvent {
  message?: string
  request?: {
    url?: string
    method?: string
    data?: unknown
    cookies?: unknown
    query_string?: unknown
    headers?: Record<string, string>
    [key: string]: unknown
  }
  user?: { id?: string | number; [key: string]: unknown }
  exception?: { values?: Array<{ value?: string; [key: string]: unknown }> }
  [key: string]: unknown
}

const SAFE_HEADERS = new Set(["user-agent", "content-type", "accept-language", "referer"])
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu
// En az 10 rakam içeren telefon benzeri dizi; tarih ve kimlik numarası gibi
// kısa sayılara dokunmuyor.
const PHONE = /\+?\d[\d\s().-]{8,}\d/g

function maskText(text: string): string {
  return text.replace(EMAIL, "[e-posta]").replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[telefon]" : m))
}

/** SDK'nın kendi olay tipiyle de çağrılabilsin diye genel; alanlar yapısal okunuyor. */
export function scrubErrorEvent<T extends object>(input: T): T {
  const event = input as unknown as ScrubbableEvent
  if (event.request) {
    const { data: _data, cookies: _cookies, query_string: _query, headers, ...rest } = event.request
    const safeHeaders = headers
      ? Object.fromEntries(Object.entries(headers).filter(([k]) => SAFE_HEADERS.has(k.toLowerCase())))
      : undefined
    event.request = { ...rest, ...(safeHeaders ? { headers: safeHeaders } : {}) }
  }
  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id }
  }
  if (typeof event.message === "string") event.message = maskText(event.message)
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") value.value = maskText(value.value)
  }
  return input
}
