import { linkParts } from "../document/links.js"
import { segmentResume, stripLeadingHeading } from "../extract/segment.js"
import { normalizeText } from "../normalize/turkish.js"
import type { FormatFinding } from "./check.js"

/**
 * CV'nin yapı ve içerik kontrolleri (DOG-88). Jobscan'in kataloğundaki
 * kontrollerden Türkiye'deki CV'lere uyanlar: özet, amaç bölümü, boş
 * deneyim, tarih biçimi, web varlığı, referans ibaresi. Not ortalaması
 * alınmadı: 4'lük ve 100'lük ölçek ve "kaç yıl sonra kaldır" eşiği Türkiye'de
 * ayrı ölçülmeli.
 *
 * Hepsi işe alımcının okuduğu şeyle ilgili ("content" grubu); ATS'in okuyup
 * okuyamadığını textChecks ve docxChecks söylüyor.
 */
export function structureChecks(text: string, findings: FormatFinding[], passed: string[]): void {
  const blocks = segmentResume(text)
  const lines = text.split("\n").map((l) => l.trim())

  // Özet.
  if (stripLeadingHeading(blocks.summaryBlock).trim()) {
    passed.push("Özet")
  } else {
    findings.push({
      code: "summary_missing",
      severity: "warning",
      group: "content",
      title: "Özet bölümü yok",
      description:
        "İşe alımcı CV'ye çoğu zaman birkaç saniye bakıyor; en üstteki 2–3 cümlelik özet kim olduğunu ve ne aradığını o sürede söylüyor. ATS'ler de özetteki anahtar kelimeleri okuyor. Adının altına kısa bir “Özet” ya da “Hakkımda” bölümü ekle.",
    })
  }

  // Amaç bölümü.
  const objective = lines.find((l) => OBJECTIVE.test(fold(normalizeText(l))))
  if (objective) {
    findings.push({
      code: "objective_heading",
      severity: "warning",
      group: "content",
      title: `“${objective}” bölümü var`,
      description:
        "Kariyer hedefi bölümü ne istediğini anlatıyor; işe alımcı ise ne sunduğunu görmek istiyor. Bu bölümü deneyimini ve güçlü yanlarını özetleyen bir “Özet” bölümüne çevir.",
    })
  } else {
    passed.push("Amaç bölümü yok")
  }

  // Deneyim başlığı var ama altı boş. Başlık hiç yoksa textChecks söylüyor.
  const experienceBody = stripLeadingHeading(blocks.experienceBlock).trim()
  if (blocks.experienceBlock.trim() && !experienceBody && !blocks.projectsBlock.trim()) {
    findings.push({
      code: "experience_empty",
      severity: "problem",
      group: "content",
      title: "Deneyim bölümü boş görünüyor",
      description:
        "Deneyim başlığının altında okunabilen bir içerik bulamadık. İçerik görsel ya da metin kutusu içindeyse ATS onu da göremiyor; düz metin olarak yaz.",
    })
  }

  // Tarih biçimi: yalnızca deneyimde. Deneyimde "Mart 2023", eğitimde "2017"
  // yazmak yaygın ve sorun değil; aynı bölümde biçimin değişmesi ise ATS'in
  // süre hesabını ve okunurluğu bozuyor.
  const formats = dateFormats(experienceBody)
  if (formats.size > 1) {
    findings.push({
      code: "date_format_mixed",
      severity: "warning",
      group: "content",
      title: "Deneyim tarihleri farklı biçimlerde yazılmış",
      description:
        "ATS'ler deneyim süresini tarihlerden hesaplıyor; biçim değiştikçe yanlış okuma riski artıyor. Hepsini tek bir biçimde yaz: “03/2022 – Günümüz” ya da “Mart 2022 – Günümüz”.",
      examples: [...formats.values()].slice(0, 3),
    })
  } else if (formats.size === 1) {
    passed.push("Tarih biçimi")
  }

  // Web varlığı: LinkedIn, GitHub ya da kişisel site.
  if (linkParts(text, { bareDomains: true }).some((p) => p.href && !p.href.startsWith("mailto:")) || /linkedin/i.test(text)) {
    passed.push("Web bağlantısı")
  } else {
    findings.push({
      code: "web_presence_missing",
      severity: "warning",
      group: "content",
      title: "LinkedIn ya da web bağlantısı yok",
      description:
        "İşe alımcıların çoğu adayın LinkedIn profiline de bakıyor. İletişim satırına LinkedIn adresini, varsa GitHub ya da portföyünü ekle.",
    })
  }

  // Referans ibaresi.
  const reference = lines.find((l) => REFERENCES_ON_REQUEST.test(fold(normalizeText(l))))
  if (reference) {
    findings.push({
      code: "references_on_request",
      severity: "warning",
      group: "content",
      title: "“Referanslar istek üzerine” ibaresi var",
      description:
        "Referansların istenince verileceği zaten biliniyor; bu satır CV'de yer kaplıyor. Kaldırabilirsin.",
      examples: [reference],
    })
  } else {
    passed.push("Gereksiz ibare yok")
  }
}

/** Türkçe harfleri ASCII karşılığına indirir; noktalamaya dokunmaz. */
function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
}

/** Kendi satırında duran amaç başlığı; normalizeText ve fold'dan geçmiş metinle. */
const OBJECTIVE = /^(objective|career objective|professional objective|kariyer hedefi|kariyer hedefim|hedefim|amacim|kariyer amaci|is hedefi)$/

const REFERENCES_ON_REQUEST =
  /(references? (are )?available (upon|on) request|referanslar(im)? (istek|talep) (uzerine|halinde|edilmesi halinde)|referans(lar)? talep (edildiginde|halinde))/

const MONTH_NAMES =
  "ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"

/**
 * Tarih satırlarındaki biçimler, biçim başına ilk örnekle. Madde cümleleri
 * sayılmıyor: "2023'te hedefin %110'unu…" bir tarih biçimi değil. Sayısal
 * biçim dört haneli yıl ya da "/" istiyor: not ortalaması ("3.25") ay.yıl
 * sanılmasın.
 */
export function dateFormats(text: string): Map<string, string> {
  const found = new Map<string, string>()
  const named = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(19|20)\\d{2}\\b`, "g")
  const numeric = /\b(0?[1-9]|1[0-2])(\/(19|20)?\d{2}|[.-](19|20)\d{2})\b/g
  const year = /\b(19|20)\d{2}\b/g
  for (const line of text.split("\n")) {
    const t = line.trim()
    // Ayraçlar ("|", "—") kelime sayılmıyor.
    const words = t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
    if (!t || /^[•\-*▪–●◦]/.test(t) || words > MAX_DATE_LINE_WORDS) continue
    // fold uzunluğu koruyor; örnek özgün satırdan aynı konumla kesiliyor.
    let rest = fold(t)
    for (const [kind, pattern] of [["month_name", named], ["numeric", numeric], ["year", year]] as const) {
      for (const m of rest.matchAll(pattern)) {
        if (!found.has(kind)) found.set(kind, t.slice(m.index, m.index + m[0].length))
      }
      rest = rest.replace(pattern, (x) => " ".repeat(x.length))
    }
  }
  return found
}

/** Tarih satırı kısa: "Satış Uzmanı · Acme · Mart 2022 – Günümüz". */
const MAX_DATE_LINE_WORDS = 12
