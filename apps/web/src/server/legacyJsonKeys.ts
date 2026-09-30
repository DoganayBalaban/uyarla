/**
 * Refaktör 1 (DOG-39) öncesi Türkçe anahtarlarla yazılmış JSON alanlarını
 * yeni anahtarlara taşır: Analysis.result.format ve Adaptation.coverLetter.
 * Saf fonksiyonlar; veritabanıyla betik (scripts/migrate-json-keys.ts)
 * konuşuyor.
 *
 * İkinci kez çalıştırmak güvenli: yeni biçimdeki değer `changed: false` ile
 * olduğu gibi dönüyor.
 */

type Upgrade = { value: unknown; changed: boolean }

const REPORT_KEYS: Record<string, string> = { gecenler: "passed", bulgular: "findings" }
const FINDING_KEYS: Record<string, string> = {
  kod: "code",
  seviye: "severity",
  baslik: "title",
  aciklama: "description",
}
const SEVERITIES: Record<string, string> = { sorun: "problem", uyari: "warning" }
const FINDING_CODES: Record<string, string> = {
  cok_kisa: "too_short",
  cok_sutun: "multiple_columns",
  cok_uzun: "too_long",
  eposta_ust_bilgide: "email_in_header",
  eposta_yok: "email_missing",
  gorsel: "image",
  ikon_karakteri: "icon_characters",
  metin_kutusu: "text_box",
  sutun_belirtisi: "column_hint",
  tablo: "table",
  tarih_yok: "dates_missing",
  telefon_yok: "phone_missing",
  ust_alt_bilgi: "header_footer",
}
const LETTER_KEYS: Record<string, string> = {
  durum: "status",
  olusturulma: "createdAt",
  paragraflar: "paragraphs",
}
const PARAGRAPH_KEYS: Record<string, string> = { metin: "text", kontrol: "verification" }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const hasAnyKey = (obj: Record<string, unknown>, keys: Record<string, string>) =>
  Object.keys(obj).some((k) => k in keys)

function renameKeys(obj: Record<string, unknown>, keys: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [keys[k] ?? k, v]))
}

function upgradeFinding(value: unknown): unknown {
  if (!isObject(value)) return value
  const finding = renameKeys(value, FINDING_KEYS)
  if (typeof finding.severity === "string") finding.severity = SEVERITIES[finding.severity] ?? finding.severity
  if (typeof finding.code === "string") finding.code = FINDING_CODES[finding.code] ?? finding.code
  return finding
}

export function upgradeFormatReport(value: unknown): Upgrade {
  if (!isObject(value) || !hasAnyKey(value, REPORT_KEYS)) return { value, changed: false }
  const report = renameKeys(value, REPORT_KEYS)
  if (Array.isArray(report.findings)) report.findings = report.findings.map(upgradeFinding)
  return { value: report, changed: true }
}

export function upgradeCoverLetter(value: unknown): Upgrade {
  if (!isObject(value) || !hasAnyKey(value, LETTER_KEYS)) return { value, changed: false }
  const letter = renameKeys(value, LETTER_KEYS)
  if (Array.isArray(letter.paragraphs)) {
    letter.paragraphs = letter.paragraphs.map((p) => (isObject(p) ? renameKeys(p, PARAGRAPH_KEYS) : p))
  }
  return { value: letter, changed: true }
}
