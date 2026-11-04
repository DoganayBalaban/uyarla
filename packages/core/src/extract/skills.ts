import { normalizeText } from "../normalize/turkish.js"
import { isCertificateHeading, sectionHeading } from "./segment.js"
import type { SkillGroup, SkillLines } from "../schemas/resume.js"

/**
 * Bir öğenin beceri değil açıklama sayılacağı uzunluk sınırı.
 * "Selenium WebDriver" 18, "Page Object Model (POM)" 23 karakter; bir cümle
 * neredeyse her zaman bunun üstünde.
 */
const MAX_SKILL_LENGTH = 40

/**
 * Bu uzunluğa kadar, büyük harfle yazılmış kısa bir isim öbeği de beceri:
 * "Dil Bilgisi, Yazım ve Noktalama Kuralları" 41 karakter ve sınırda
 * düşüyordu. Cümleler ("Eğitim içerikleri ve uygulamalı atölyeler
 * hazırladım") küçük harfle sürdüğü için elenmeye devam ediyor.
 */
const MAX_TITLED_SKILL_LENGTH = 60
const MAX_TITLED_SKILL_WORDS = 6
/** Büyük harf sayımında atlanan bağlaçlar. */
const CONNECTIVES = new Set(["ve", "ile", "veya", "and", "or", "of", "&", "-", "/"])

/** Sertifika satırı en çok bu kadar kelime: ötesi açıklama cümlesi. */
const MAX_CERTIFICATE_WORDS = 12
/** Küçük harfle süren bir sertifika adı en çok bu kadar kelime; ötesi cümle. */
const MAX_LOWERCASE_CERTIFICATE_WORDS = 5

/**
 * Kendi başına duran bölüm başlıkları beceri sayılmaz.
 * Karşılaştırma normalizeText'ten geçmiş metinle yapılıyor: JavaScript'in
 * kendi küçültmesi "BECERİLER"i "beceri̇ler" yapıyor (birleşik noktayla) ve
 * eşleşme tutmuyor.
 */
const SECTION_HEADING =
  /^(core|technical|teknik|genel|other|diğer)?\s*(skills?|beceriler|yetkinlikler|araçlar|tools|diller|languages|sertifikalar?|belgeler|certifications?|sertifikalar belgeler|eğitim|education|deneyim|experience)$/

/**
 * Satır transkripsiyonunu beceri listesine çevirir.
 *
 * Kural, gerçek CV'lerde gözlenen iki satır biçiminden çıkarıldı:
 *
 *   "Programming Languages: Java, SQL"   → öğeler beceridir, etiket kategoridir
 *   "Manual Testing: Performing regression testing…" → etiket beceridir, öğe açıklamadır
 *
 * Ayrım öğenin biçiminden yapılıyor: kısa ve nokta içermiyorsa terim,
 * değilse cümle. Bu karar modelden istenmiyor — model iki biçimi
 * karıştırdığında sessizce yanlış veri üretiyordu; kodda yapılınca
 * deterministik ve test edilebilir oluyor (K-19).
 */
export function flattenSkillLines(data: SkillLines): string[] {
  return groupLines(data).flatMap((g) => g.items)
}

/**
 * Becerileri CV'deki kategorileriyle döndürür (DOG-106): "Backend: Python,
 * FastAPI" satırının etiketi grubun adı. Etiketin kendisi beceri olan
 * satırlar ("Manual Testing: Performing…") ve etiketsiz satırlar adsız
 * gruba giriyor; art arda gelenler tek grupta. Hiç adlı grup yoksa CV
 * kategori yazmamış demek ve sonuç `undefined`: belge düz listeye düşer.
 *
 * Öğeler `flattenSkillLines` ile aynı süzgeçten geçiyor; iki çıktının
 * birleşimi her zaman düz listenin kendisi.
 */
export function skillGroups(data: SkillLines): SkillGroup[] | undefined {
  const groups = groupLines(data)
  return groups.some((g) => g.name !== null) ? groups : undefined
}

function groupLines(data: SkillLines): SkillGroup[] {
  const groups: SkillGroup[] = []
  const add = (name: string | null, items: string[]) => {
    const last = groups.at(-1)
    if (name === null && last && last.name === null) last.items.push(...items)
    else groups.push({ name, items: [...items] })
  }

  for (const line of data.lines) {
    const termList = line.items.filter(
      (item) => looksLikeTerm(item) && !isSectionHeading(item),
    )
    const headingLabel = line.label.trim()
    const labelIsTerm = headingLabel !== "" && looksLikeTerm(headingLabel) && !isSectionHeading(headingLabel)

    if (termList.length > 0) {
      add(labelIsTerm && !namesItsItems(headingLabel, termList) ? headingLabel : null, termList)
      continue
    }

    // Etikete de aynı ölçüt uygulanıyor: bölümlemenin karıştığı CV'lerde
    // deneyim cümleleri beceri bloğuna sızabiliyor ve etiket olarak geliyor.
    if (labelIsTerm) add(null, [headingLabel])
  }

  // Dil ve sertifikalar kendi alanlarında zaten var; beceri sayılmamalılar.
  // Beceri bölümü olmayan CV'lerde bölümleme diller ve sertifikaları
  // skillsBlock'a koyuyor ve bunlar beceri gibi görünüyor. Bir katılım
  // belgesinin "Bilgisayar Mühendisliği mezunu" gereksinimiyle eşleşmesi
  // uydurma eşleşmedir (K-20).
  const others = new Set(
    [...data.languages, ...data.certifications].map((x) => normalizeText(x)),
  )
  // Dil düzeyden ve sözcük sırasından bağımsız karşılaştırılıyor: beceri
  // satırındaki "B1 seviye İngilizce" diller alanında "İngilizce B1" olarak
  // duruyordu ve eşleşmediği için beceri listesine sızıyordu (cv-c).
  const languages = new Set(data.languages.map(languageKey).filter(Boolean))
  // Aynı beceri iki grupta geçerse ilkinde kalıyor (düz liste de tekil).
  const seen = new Set<string>()
  return groups
    .map((g) => ({
      name: g.name,
      items: g.items.filter((b) => {
        const n = normalizeText(b)
        if (n.length === 0 || others.has(n) || languages.has(languageKey(b)) || seen.has(b)) return false
        seen.add(b)
        return true
      }),
    }))
    .filter((g) => g.items.length > 0)
}

/**
 * Etiket öğelerin kendisiyse kategori değildir: "Git & GitHub" satırını model
 * ["Git", "GitHub"] diye bölüyor ve belgede "Git & GitHub: Git, GitHub"
 * çıkıyordu (cv-c).
 */
function namesItsItems(label: string, items: string[]): boolean {
  const l = normalizeText(label)
  return items.every((item) => l.includes(normalizeText(item)))
}

/**
 * Kısa ve cümle noktası taşımayan metin terimdir; değilse cümledir.
 *
 * Kelime içindeki nokta cümle işareti değil: "Next.js", "Vue.js", "Node.js",
 * "ASP.NET". İlk sürüm her noktayı cümle sayıyordu ve bu beceriler sessizce
 * listeden düşüyor, indirilen CV'de de kayboluyordu (K-38). Cümle noktası
 * sonda ya da boşluktan önce durur.
 */
/**
 * Tek başına bir düzey ifadesi beceri değil: tablolu şablonlarda düzey ayrı
 * sütunda duruyor ve beceri sanılıyordu (DOG-60).
 */
const LEVEL =
  "(?:başlangıç|temel|orta|iyi|çok|ileri|uzman|seviye|düzey|beginner|basic|elementary|intermediate|good|advanced|expert|fluent|native|[abc][12])"
// normalizeText parantezleri siliyor: "B2 (iyi)" → "b2 iyi".
const PROFICIENCY = new RegExp(`^${LEVEL}(?:\\s+${LEVEL})*$`)

const LEVEL_WORD = new RegExp(`^${LEVEL}$`)

/** Dilin düzeysiz, sıralı sözcükleri: "B1 seviye İngilizce" ve "İngilizce B1" → "ingilizce". */
function languageKey(text: string): string {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w && !LEVEL_WORD.test(w))
    .sort()
    .join(" ")
}

/** Bağlaçlar dışındaki kelimelerin çoğu büyük harfle mi başlıyor. */
function isTitled(t: string): boolean {
  const words = t.split(/\s+/).filter((w) => w && !CONNECTIVES.has(w.toLocaleLowerCase("tr")))
  return words.length > 0 && words.filter((w) => /^[\p{Lu}\p{N}]/u.test(w)).length * 2 > words.length
}

function fitsLength(t: string): boolean {
  if (t.length <= MAX_SKILL_LENGTH) return true
  return t.length <= MAX_TITLED_SKILL_LENGTH && t.split(/\s+/).length <= MAX_TITLED_SKILL_WORDS && isTitled(t)
}

function looksLikeTerm(text: string): boolean {
  const t = text.trim()
  // " | " tablolu şablonun hücre ayırıcısı (DOG-60): "Alan | Düzey" bir
  // tablo başlığı, beceri değil.
  return (
    fitsLength(t) &&
    !/\.(\s|$)/.test(t) &&
    !t.includes(" | ") &&
    !PROFICIENCY.test(normalizeText(t))
  )
}

/**
 * Sertifika başlığının altındaki satırları sertifikalara taşır.
 *
 * Model "kurum / sertifika adı / açıklama" düzenindeki kayıtları ("EUCONS
 * SERTİFİKA" ⏎ "Temel HACCP Eğitimi" ⏎ açıklama) sertifika saymıyor, beceri
 * satırı olarak döndürüyordu: kurum adları beceri oldu, "üniversite mezunu"
 * şartını bir kongrenin düzenleyicisi karşıladı. Karar kodda veriliyor (K-19).
 *
 * Satırın yeri iki yoldan biliniyor: modelin çıktısındaki başlık satırı ya
 * da bölümlemenin ham metinden ayırdığı bölge (`region`). Model başlığı her
 * zaman geri yazmıyor; aynı PDF bir çalıştırmada başlıklı, bir başkasında
 * başlıksız döndü ve sertifika adı kayboldu. Bölgeyle eşleşmede satır
 * yalnızca sertifika bölgesinde geçmeli: "Python" bir sertifikanın adında
 * da geçse beceri bölümünde yazıyorsa beceri kalıyor. Açıklama cümleleri
 * atılıyor.
 */
export function separateCertificateLines(
  data: SkillLines,
  region: { certificates: string; skills: string } = { certificates: "", skills: "" },
): SkillLines {
  const certificateText = squash(region.certificates)
  const skillText = squash(region.skills)
  const inRegion = (label: string) => {
    const n = squash(label)
    return n.length >= 3 && certificateText.includes(n) && !skillText.includes(n)
  }
  if (!data.lines.some((line) => isCertificateHeading(line.label) || inRegion(line.label))) return data

  const lines: SkillLines["lines"] = []
  const certifications = [...data.certifications]
  // Model aynı kaydı tarihiyle sertifikalara koymuş olabilir: "12.04.2025 EUCONS SERTİFİKA".
  const known = certifications.map(squash)
  let underCertificates = false
  for (const line of data.lines) {
    const label = line.label.trim()
    if (isCertificateHeading(label)) {
      underCertificates = true
      continue
    }
    if (isSectionHeading(label)) {
      underCertificates = false
      lines.push(line)
      continue
    }
    if (!underCertificates && !inRegion(label)) {
      lines.push(line)
      continue
    }
    const text = line.items.length > 0 ? `${label}: ${line.items.join(", ")}` : label
    // Açıklama cümlesi: noktayla biter, çok uzundur ya da küçük harfle süren
    // düz yazıdır. Kısa küçük harfli adlar ("Pedagojik formasyon sertifikası") kalır.
    const words = text.split(/\s+/).length
    const sentence = /\.$/.test(text) || words > MAX_CERTIFICATE_WORDS || (words > MAX_LOWERCASE_CERTIFICATE_WORDS && !isTitled(text))
    const n = squash(text)
    if (!text || sentence || known.some((k) => k.includes(n) || n.includes(k))) continue
    known.push(n)
    certifications.push(text)
  }
  return { ...data, lines, certifications }
}

/** Karşılaştırma biçimi: satır sonları ve PDF'in kestiği kelimeler bir arada. */
function squash(text: string): string {
  return normalizeText(text).replace(/\s+/g, " ")
}

function isSectionHeading(text: string): boolean {
  // Bölümlemenin tanıdığı her başlık da ("Top Skills", "KİŞİSEL BECERİLER") başlıktır.
  return SECTION_HEADING.test(normalizeText(text)) || sectionHeading(text) !== null
}
