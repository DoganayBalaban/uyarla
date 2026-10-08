import JSZip from "jszip"
import { sectionHeading, type ResumeSection } from "../extract/segment.js"

/**
 * CV'nin ATS tarafından okunabilirliğini kontrol eder.
 *
 * Skor "CV'n bu ilana uyuyor mu"yu ölçüyor; bu kontrol "ATS bu CV'yi doğru
 * okuyabilir mi"yi. İkisi ayrı: mükemmel eşleşen bir CV, deneyimi metin
 * kutusunda olduğu için ATS'e boş görünebilir.
 *
 * Tümüyle kural tabanlı, dil modeli yok. İki kaynak var:
 *   - Çıkarılmış metin (PDF ve DOCX): iletişim, başlıklar, tarihler, uzunluk.
 *   - DOCX'in iç yapısı: tablo, metin kutusu, sütun, üst/alt bilgi, görsel.
 *     PDF'te sayfa yapısını okumak ayrı bir iş (birikmiş işler #8); PDF için
 *     yalnızca metinden çıkarılabilenler kontrol ediliyor.
 */

export type FormatSeverity = "problem" | "warning"

export interface FormatFinding {
  code: string
  severity: FormatSeverity
  title: string
  description: string
}

export interface FormatReport {
  findings: FormatFinding[]
  /** Geçilen kontrollerin kısa adları; arayüz "8 kontrol geçti" diyor. */
  passed: string[]
}

export const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/
// +90 5xx…, 05xx…, (5xx) … Aday dizi en az 10 hane içermeli; ayrıca
// "2016 - 2020" gibi iki yıldan oluşan bir tarih aralığı telefon sayılmıyor.
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{8,}\d/g
const YEAR_RANGE = /^(19|20)\d{2}\D+(19|20)\d{2}$/

export function hasPhone(text: string): boolean {
  for (const [candidate] of text.matchAll(PHONE_CANDIDATE)) {
    const digitCount = candidate.replace(/\D/g, "").length
    if (digitCount >= 10 && digitCount <= 13 && !YEAR_RANGE.test(candidate.trim())) return true
  }
  return false
}
const YEAR = /\b(19[6-9]\d|20[0-4]\d)\b/g
// Özel kullanım alanı: ikon fontları (Font Awesome vb.) burada. ATS'e
// anlamsız kare ya da boş karakter olarak düşüyor.
const ICON_CHARACTER = /[-]/g

const SHORT_WORD = 150
const LONG_WORD = 1100

export async function checkFormat(input: {
  filename: string
  buffer: Buffer
  text: string
}): Promise<FormatReport> {
  const findings: FormatFinding[] = []
  const passed: string[] = []

  const ext = input.filename.toLowerCase().split(".").pop()
  const docx = ext === "docx" ? await docxStructure(input.buffer) : null

  textChecks(input.text, docx, findings, passed)
  if (docx) docxChecks(docx, findings, passed)

  // Önce sorunlar, sonra uyarılar: arayüz sırayı olduğu gibi gösteriyor.
  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "problem" ? -1 : 1))
  return { findings, passed }
}

function textChecks(
  text: string,
  docx: DocxStructure | null,
  findings: FormatFinding[],
  passed: string[],
): void {
  // İletişim. DOCX'te üst bilgideki e-posta metin çıkarımına girmiyor; bunu
  // ayrıca söylemek "e-posta yok" demekten çok daha yararlı.
  if (EMAIL.test(text)) {
    passed.push("E-posta adresi")
  } else if (docx && EMAIL.test(docx.headerFooterText)) {
    findings.push({
      code: "email_in_header",
      severity: "problem",
      title: "E-posta adresin üst veya alt bilgide",
      description:
        "Birçok ATS üst ve alt bilgiyi okumuyor; e-postan hiç görünmeyebilir. İletişim bilgilerini belgenin gövdesine, adının altına taşı.",
    })
  } else {
    findings.push({
      code: "email_missing",
      severity: "problem",
      title: "E-posta adresi bulunamadı",
      description:
        "İşe alımcının sana ulaşabilmesi için e-posta adresini adının altına düz metin olarak yaz.",
    })
  }

  if (hasPhone(text) || (docx && hasPhone(docx.headerFooterText))) {
    passed.push("Telefon numarası")
  } else {
    findings.push({
      code: "phone_missing",
      severity: "warning",
      title: "Telefon numarası bulunamadı",
      description: "Telefon numaranı e-postanın yanına eklemen işe alımcının işini kolaylaştırır.",
    })
  }

  // Bölüm başlıkları.
  const lineItems = text.split("\n")
  const headings = lineItems.map((s) => sectionHeading(s))
  const found = new Set(headings.filter((b): b is ResumeSection => b !== null))

  const HEADINGS: { section: ResumeSection; name: string; severity: FormatSeverity; example: string }[] = [
    { section: "experience", name: "Deneyim", severity: "problem", example: "“Deneyim” ya da “İş Deneyimi”" },
    { section: "education", name: "Eğitim", severity: "warning", example: "“Eğitim”" },
    { section: "skills", name: "Beceriler", severity: "warning", example: "“Beceriler” ya da “Yetkinlikler”" },
  ]
  for (const b of HEADINGS) {
    if (found.has(b.section)) {
      passed.push(`${b.name} başlığı`)
    } else {
      findings.push({
        code: `baslik_yok_${b.section}`,
        severity: b.severity,
        title: `${b.name} bölümü tanınmadı`,
        description: `ATS'ler bölümleri başlığından tanıyor. Standart bir başlık kullan: ${b.example}. Yaratıcı başlıklar (ör. “Yolculuğum”) bölümün atlanmasına yol açabilir.`,
      })
    }
  }

  // İki sütun belirtisi: bir başlığın hemen ardından, arada içerik olmadan
  // başka bir başlık geliyor. Sütunlar iç içe okununca tam olarak bu
  // görünüyor (birikmiş işler #8: HAKKIMDA → PROFESYONEL DENEYİM).
  if (consecutiveHeadings(lineItems, headings)) {
    findings.push({
      code: "column_hint",
      severity: "warning",
      title: "Metin sırası karışmış olabilir",
      description:
        "Bazı bölüm başlıkları arada içerik olmadan art arda okunuyor. Bu genelde iki sütunlu düzenlerde olur: ATS sütunları iç içe okur ve bilgiler yanlış bölüme düşer. Tek sütunlu bir düzen daha güvenli.",
    })
  } else {
    passed.push("Okuma sırası")
  }

  // Tarihler.
  const years = text.match(YEAR) ?? []
  if (years.length >= 2) {
    passed.push("Tarihler")
  } else {
    findings.push({
      code: "dates_missing",
      severity: "warning",
      title: "Tarih bulunamadı",
      description:
        "Deneyim ve eğitimlerinin yanına başlangıç ve bitiş tarihlerini yaz (ör. “03/2022 – Günümüz”). ATS'ler deneyim süresini bu tarihlerden hesaplıyor.",
    })
  }

  // Uzunluk.
  const word = text.split(/\s+/).filter(Boolean).length
  if (word < SHORT_WORD) {
    findings.push({
      code: "too_short",
      severity: "warning",
      title: "CV çok kısa görünüyor",
      description: `Yaklaşık ${word} kelime okuyabildik. Metnin bir kısmı görsel ya da metin kutusu içindeyse ATS onu da okuyamıyor olabilir.`,
    })
  } else if (word > LONG_WORD) {
    findings.push({
      code: "too_long",
      severity: "warning",
      title: "CV uzun görünüyor",
      description: `Yaklaşık ${word} kelime. Çoğu pozisyon için 1–2 sayfa yeterli; ilanla ilgisi az olan maddeleri kısaltabilirsin.`,
    })
  } else {
    passed.push("Uzunluk")
  }

  // İkon fontları.
  const icons = text.match(ICON_CHARACTER)?.length ?? 0
  if (icons >= 3) {
    findings.push({
      code: "icon_characters",
      severity: "warning",
      title: "İkon karakterleri var",
      description:
        "Telefon, e-posta ya da konum ikonları ATS'e anlamsız karakter olarak düşüyor. İkonların yerine “Telefon:”, “E-posta:” gibi düz etiketler kullan.",
    })
  } else {
    passed.push("Özel karakterler")
  }
}

function consecutiveHeadings(lineItems: string[], headings: (ResumeSection | null)[]): boolean {
  let previousHeading = false
  for (let i = 0; i < lineItems.length; i++) {
    if (!lineItems[i]!.trim()) continue
    const title = headings[i] !== null && headings[i] !== "ignore"
    if (title && previousHeading) return true
    previousHeading = title
  }
  return false
}

// ——— DOCX yapısı ———

interface DocxStructure {
  tableCount: number
  textBox: boolean
  columnCount: number
  headerFooterText: string
  imageCount: number
}

async function docxStructure(buffer: Buffer): Promise<DocxStructure | null> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    // Metin çıkarımı zaten başarılı olduysa bozuk yapı bu kontrolü
    // durdurmamalı; yalnızca yapısal kontroller atlanıyor.
    return null
  }
  const body = (await zip.file("word/document.xml")?.async("string")) ?? ""

  const headerFooter: string[] = []
  for (const name of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(name)) {
      headerFooter.push(xmlText((await zip.file(name)?.async("string")) ?? ""))
    }
  }

  const columns = [...body.matchAll(/<w:cols\b[^>]*\bw:num="(\d+)"/g)].map((m) => Number(m[1]))

  return {
    tableCount: (body.match(/<w:tbl>/g) ?? []).length + (body.match(/<w:tbl /g) ?? []).length,
    textBox: /<w:txbxContent\b/.test(body),
    columnCount: Math.max(1, ...columns),
    headerFooterText: headerFooter.join("\n"),
    imageCount: Object.keys(zip.files).filter((a) => a.startsWith("word/media/")).length,
  }
}

/** w:t düğümlerinin metni; üst/alt bilgide e-posta ve telefon aramak için. */
function xmlText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" ")
}

function docxChecks(d: DocxStructure, findings: FormatFinding[], passed: string[]): void {
  if (d.textBox) {
    findings.push({
      code: "text_box",
      severity: "problem",
      title: "Metin kutusu kullanılmış",
      description:
        "Metin kutularının içindeki yazıları birçok ATS hiç okumuyor. Bu bölümleri normal paragraf olarak yeniden yaz.",
    })
  } else {
    passed.push("Metin kutusu yok")
  }

  if (d.columnCount > 1) {
    findings.push({
      code: "multiple_columns",
      severity: "problem",
      title: `${d.columnCount} sütunlu sayfa düzeni`,
      description:
        "ATS'ler sütunları soldan sağa, satır satır okuyabiliyor; iki sütunun cümleleri birbirine karışıyor. Tek sütunlu bir düzen kullan.",
    })
  } else {
    passed.push("Tek sütun")
  }

  if (d.tableCount > 0) {
    findings.push({
      code: "table",
      severity: "warning",
      title: "Tablo kullanılmış",
      description:
        "Bazı ATS'ler tablo hücrelerini yanlış sırada okuyor ya da atlıyor. Deneyim ve beceriler gibi önemli bölümleri tablo dışında tut.",
    })
  } else {
    passed.push("Tablo yok")
  }

  // E-posta üst bilgideyse bu daha özgül bulgu zaten eklendi; ikisini
  // birden göstermek aynı şeyi iki kez söylemek olur.
  const emailAlreadyMentioned = findings.some((b) => b.code === "email_in_header")
  if (d.headerFooterText.trim() && !emailAlreadyMentioned) {
    findings.push({
      code: "header_footer",
      severity: "warning",
      title: "Üst veya alt bilgide yazı var",
      description:
        "Birçok ATS üst ve alt bilgiyi okumuyor. Önemli bir bilgi (ad, iletişim) oradaysa belgenin gövdesine taşı.",
    })
  } else if (!d.headerFooterText.trim()) {
    passed.push("Üst/alt bilgi")
  }

  if (d.imageCount > 0) {
    findings.push({
      code: "image",
      severity: "warning",
      title: "Görsel var",
      description:
        "ATS görsellerin içindeki yazıyı okuyamıyor. Fotoğraf dışında görsel içinde bilgi (beceri grafiği, logo) varsa metin olarak da yaz.",
    })
  } else {
    passed.push("Görsel yok")
  }
}
