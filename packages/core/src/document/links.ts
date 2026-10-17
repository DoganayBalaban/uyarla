/**
 * Metni bağlantılı parçalara ayırır (DOG-106): e-posta, LinkedIn, GitHub ve
 * portföy adresleri indirilen PDF ve DOCX'te tıklanabilir olsun. K2'de bir
 * katılımcı bu yüzden belgeyi göndermeyeceğini söyledi.
 *
 * Metin değişmiyor; yalnızca bağlantı ekleniyor. Parçaların birleşimi her
 * zaman girdinin kendisi.
 */
export interface TextPart {
  text: string
  href: string | null
}

const STOP = "[^\\s,;|·•<>()\"']"
const EMAIL = "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+"
const EXPLICIT = `(?:https?:\\/\\/|www\\.)${STOP}+`
const KNOWN_HOST =
  `(?:[A-Za-z0-9-]+\\.)*(?:linkedin\\.com|github\\.com|gitlab\\.com|behance\\.net|dribbble\\.com|medium\\.com|kaggle\\.com|huggingface\\.co)(?:\\/${STOP}*)?`
/**
 * Yalnızca iletişim satırında: çıplak alan adı ("aday.dev", "ornek.com.tr").
 * Küçük harf şartı bilerek: "ASP.NET" bir beceri, alan adı değil. Gövde
 * satırlarında kullanılmıyor; "Node.js" gibi adlar orada çok.
 */
const BARE_DOMAIN =
  `[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:com|net|org|io|dev|app|me|co|ai|tech|site|xyz|info|tr)(?![A-Za-z0-9-])(?:\\/${STOP}*)?`

// Önünde harf, nokta, @ ya da / varsa başka bir şeyin parçası (e-postanın alanı gibi).
const BEFORE = "(?<![A-Za-z0-9@./-])"
const STRICT = new RegExp(`${BEFORE}(?:(${EMAIL})|(${EXPLICIT}|${KNOWN_HOST}))`, "g")
const LOOSE = new RegExp(`${BEFORE}(?:(${EMAIL})|(${EXPLICIT}|${KNOWN_HOST}|${BARE_DOMAIN}))`, "g")

/** Cümle sonundaki noktalama bağlantıya dahil değil. */
const TRAILING = /[.,;:!?]+$/

export function linkParts(text: string, options: { bareDomains?: boolean } = {}): TextPart[] {
  const pattern = options.bareDomains ? LOOSE : STRICT
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const raw = match[0]
    const value = raw.replace(TRAILING, "")
    const start = match.index
    if (start > last) parts.push({ text: text.slice(last, start), href: null })
    const href = match[1] ? `mailto:${value}` : /^https?:\/\//i.test(value) ? value : `https://${value}`
    parts.push({ text: value, href })
    last = start + value.length
  }
  if (last < text.length) parts.push({ text: text.slice(last), href: null })
  return parts.length > 0 ? parts : [{ text, href: null }]
}
