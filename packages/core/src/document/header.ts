import { hasPhone } from "../format/check.js"
import type { Language } from "../normalize/language.js"
import { linkParts, type TextPart } from "./links.js"

/**
 * Belgenin başlığı: unvan satırı ve iletişim parçaları (CV biçimi, 9 Kasım
 * 2026).
 *
 * CV'nin başlık satırı olduğu gibi basılıyordu: "AI ENGINEER | FULL-STACK
 * AI ENGINEER · Istanbul, Türkiye • GitHub: github.com/x • Portfolio: …".
 * Üç ayrı ayraç, çift boşluk, etiketler ve unvanla iletişim aynı satırda;
 * kullanıcı belgeyi "yapıştırılmış gibi" buldu. Satır parçalarına ayrılıyor:
 * unvanlar bir satır, konum ve iletişim bir satır, tek tip ayraçla.
 *
 * Kurallı ve kayıpsız: tanınmayan parça unvan sayılıyor, hiçbir parça
 * düşmüyor. Yapay zekâ kullanılmıyor; aynı girdi hep aynı başlığı veriyor.
 */
export interface DocumentHeader {
  /** Unvanlar, " · " ile; yoksa null. */
  title: string | null
  /** Konum, e-posta, telefon ve bağlantılar; CV'deki sırayla, konum önde. */
  contacts: TextPart[]
}

/** Satırdaki ayraçlar: dikey çizgi, orta nokta, madde imi, iki ve daha fazla boşluk. */
const SEPARATOR = /\s*(?:\||•|·|•|\s{2,})\s*/

/** "GitHub: x", "LinkedIn : Ad Soyad", "E-posta: x". Etiket kısa ve harflerden oluşuyor. */
const LABELLED = /^([\p{L}][\p{L} -]{0,18})\s*:\s*(.+)$/u

/** "İstanbul, Türkiye", "Cairo, Egypt": virgülle ayrılmış iki yer adı. */
const LOCATION = /^[\p{L}][\p{L} .'-]*,\s*[\p{L}][\p{L} .'-]*$/u
/** Virgüllü unvan konum sanılmasın: "Senior Engineer, Backend". */
const ROLE_WORD =
  /engineer|developer|manager|specialist|analyst|designer|consultant|lead|intern|scientist|backend|frontend|full|data|senior|junior|mühendis|geliştirici|uzman|yönetici|analist|tasarımcı|danışman|stajyer/i

/** Büyük harfle yazılmış unvanda büyük kalan bağlaçlar dışındaki kısa kelimeler kısaltma sayılıyor (AI, SEO, HR). */
const CONNECTORS: Record<Language, ReadonlySet<string>> = {
  tr: new Set(["ve", "ile", "veya"]),
  en: new Set(["and", "of", "for", "the", "to", "in", "or"]),
}

export function documentHeader(line: string | null, language: Language): DocumentHeader {
  const titles: string[] = []
  const contacts: TextPart[] = []
  let location: string | null = null

  for (const raw of (line ?? "").split(SEPARATOR)) {
    const token = raw.trim()
    if (!token) continue
    // Önce parçanın tamamı: "https://x.dev" bir "https" etiketi değil.
    const whole = asLink(token)
    const labelled = whole ? null : token.match(LABELLED)
    const value = labelled ? labelled[2]!.trim() : token

    const link = whole ?? asLink(value)
    if (link) {
      contacts.push(link)
    } else if (hasPhone(value) && /^[+\d\s().-]+$/.test(value)) {
      contacts.push({ text: value.replace(/\s+/g, " "), href: null })
    } else if (labelled) {
      // Bağlantı olmayan etiketli değer ("Medium: @ad", "LinkedIn : Ad"):
      // etiket anlam taşıyor, kalıyor; boşluğu düzeltiliyor.
      contacts.push({ text: `${labelled[1]!.trim()}: ${value}`, href: null })
    } else if (!location && LOCATION.test(token) && !ROLE_WORD.test(token)) {
      location = token
    } else {
      titles.push(tidyTitle(token, language))
    }
  }

  return {
    title: titles.length > 0 ? titles.join(" · ") : null,
    contacts: location ? [{ text: location, href: null }, ...contacts] : contacts,
  }
}

/**
 * Parçanın tamamı tek bir e-posta ya da adres mi. Görünen metin protokolsüz
 * ve sondaki eğik çizgisiz: "https://github.com/x/" → "github.com/x".
 */
function asLink(value: string): TextPart | null {
  const parts = linkParts(value, { bareDomains: true })
  if (parts.length !== 1 || !parts[0]!.href) return null
  const href = parts[0]!.href
  if (href.startsWith("mailto:")) return { text: value, href }
  return { text: value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""), href }
}

/**
 * Tamamı büyük harfle yazılmış unvan normal yazıma çevriliyor: "FULL-STACK
 * AI ENGINEER" → "Full-Stack AI Engineer". Kısa kelimeler (AI, SEO, HR)
 * kısaltma sayılıp büyük kalıyor; bağlaçlar küçülüyor. Karışık yazılmış
 * unvana dokunulmuyor: adayın tercihi.
 */
function tidyTitle(title: string, language: Language): string {
  const locale = language === "tr" ? "tr" : "en"
  const hasLower = title !== title.toLocaleUpperCase(locale) && title !== title.toUpperCase()
  if (hasLower || !/\p{L}{4}/u.test(title)) return title
  return title
    .split(/(\s+|-|\/)/)
    .map((word, i) => {
      if (!/\p{L}/u.test(word)) return word
      const lower = word.toLocaleLowerCase(locale)
      if (i > 0 && CONNECTORS[language].has(lower)) return lower
      if (word.length <= 3) return word
      return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1)
    })
    .join("")
}
