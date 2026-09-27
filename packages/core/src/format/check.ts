import JSZip from "jszip"
import { bolumBasligi, type Bolum } from "../extract/segment.js"

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

export type FormatSeviye = "sorun" | "uyari"

export interface FormatBulgu {
  kod: string
  seviye: FormatSeviye
  baslik: string
  aciklama: string
}

export interface FormatRaporu {
  bulgular: FormatBulgu[]
  /** Geçilen kontrollerin kısa adları; arayüz "8 kontrol geçti" diyor. */
  gecenler: string[]
}

const EPOSTA = /[\w.+-]+@[\w-]+(\.[\w-]+)+/
// +90 5xx…, 05xx…, (5xx) … Aday dizi en az 10 hane içermeli; ayrıca
// "2016 - 2020" gibi iki yıldan oluşan bir tarih aralığı telefon sayılmıyor.
const TELEFON_ADAYI = /\+?\d[\d\s().-]{8,}\d/g
const YIL_ARALIGI = /^(19|20)\d{2}\D+(19|20)\d{2}$/

function telefonVar(text: string): boolean {
  for (const [aday] of text.matchAll(TELEFON_ADAYI)) {
    const hane = aday.replace(/\D/g, "").length
    if (hane >= 10 && hane <= 13 && !YIL_ARALIGI.test(aday.trim())) return true
  }
  return false
}
const YIL = /\b(19[6-9]\d|20[0-4]\d)\b/g
// Özel kullanım alanı: ikon fontları (Font Awesome vb.) burada. ATS'e
// anlamsız kare ya da boş karakter olarak düşüyor.
const IKON_KARAKTERI = /[-]/g

const KISA_KELIME = 150
const UZUN_KELIME = 1100

export async function checkFormat(input: {
  filename: string
  buffer: Buffer
  text: string
}): Promise<FormatRaporu> {
  const bulgular: FormatBulgu[] = []
  const gecenler: string[] = []

  const ext = input.filename.toLowerCase().split(".").pop()
  const docx = ext === "docx" ? await docxYapisi(input.buffer) : null

  metinKontrolleri(input.text, docx, bulgular, gecenler)
  if (docx) docxKontrolleri(docx, bulgular, gecenler)

  // Önce sorunlar, sonra uyarılar: arayüz sırayı olduğu gibi gösteriyor.
  bulgular.sort((a, b) => (a.seviye === b.seviye ? 0 : a.seviye === "sorun" ? -1 : 1))
  return { bulgular, gecenler }
}

function metinKontrolleri(
  text: string,
  docx: DocxYapisi | null,
  bulgular: FormatBulgu[],
  gecenler: string[],
): void {
  // İletişim. DOCX'te üst bilgideki e-posta metin çıkarımına girmiyor; bunu
  // ayrıca söylemek "e-posta yok" demekten çok daha yararlı.
  if (EPOSTA.test(text)) {
    gecenler.push("E-posta adresi")
  } else if (docx && EPOSTA.test(docx.ustAltMetin)) {
    bulgular.push({
      kod: "eposta_ust_bilgide",
      seviye: "sorun",
      baslik: "E-posta adresin üst veya alt bilgide",
      aciklama:
        "Birçok ATS üst ve alt bilgiyi okumuyor; e-postan hiç görünmeyebilir. İletişim bilgilerini belgenin gövdesine, adının altına taşı.",
    })
  } else {
    bulgular.push({
      kod: "eposta_yok",
      seviye: "sorun",
      baslik: "E-posta adresi bulunamadı",
      aciklama:
        "İşe alımcının sana ulaşabilmesi için e-posta adresini adının altına düz metin olarak yaz.",
    })
  }

  if (telefonVar(text) || (docx && telefonVar(docx.ustAltMetin))) {
    gecenler.push("Telefon numarası")
  } else {
    bulgular.push({
      kod: "telefon_yok",
      seviye: "uyari",
      baslik: "Telefon numarası bulunamadı",
      aciklama: "Telefon numaranı e-postanın yanına eklemen işe alımcının işini kolaylaştırır.",
    })
  }

  // Bölüm başlıkları.
  const satirlar = text.split("\n")
  const basliklar = satirlar.map((s) => bolumBasligi(s))
  const bulunan = new Set(basliklar.filter((b): b is Bolum => b !== null))

  const BASLIKLAR: { bolum: Bolum; ad: string; seviye: FormatSeviye; ornek: string }[] = [
    { bolum: "experience", ad: "Deneyim", seviye: "sorun", ornek: "“Deneyim” ya da “İş Deneyimi”" },
    { bolum: "education", ad: "Eğitim", seviye: "uyari", ornek: "“Eğitim”" },
    { bolum: "skills", ad: "Beceriler", seviye: "uyari", ornek: "“Beceriler” ya da “Yetkinlikler”" },
  ]
  for (const b of BASLIKLAR) {
    if (bulunan.has(b.bolum)) {
      gecenler.push(`${b.ad} başlığı`)
    } else {
      bulgular.push({
        kod: `baslik_yok_${b.bolum}`,
        seviye: b.seviye,
        baslik: `${b.ad} bölümü tanınmadı`,
        aciklama: `ATS'ler bölümleri başlığından tanıyor. Standart bir başlık kullan: ${b.ornek}. Yaratıcı başlıklar (ör. “Yolculuğum”) bölümün atlanmasına yol açabilir.`,
      })
    }
  }

  // İki sütun belirtisi: bir başlığın hemen ardından, arada içerik olmadan
  // başka bir başlık geliyor. Sütunlar iç içe okununca tam olarak bu
  // görünüyor (birikmiş işler #8: HAKKIMDA → PROFESYONEL DENEYİM).
  if (ardArdaBaslik(satirlar, basliklar)) {
    bulgular.push({
      kod: "sutun_belirtisi",
      seviye: "uyari",
      baslik: "Metin sırası karışmış olabilir",
      aciklama:
        "Bazı bölüm başlıkları arada içerik olmadan art arda okunuyor. Bu genelde iki sütunlu düzenlerde olur: ATS sütunları iç içe okur ve bilgiler yanlış bölüme düşer. Tek sütunlu bir düzen daha güvenli.",
    })
  } else {
    gecenler.push("Okuma sırası")
  }

  // Tarihler.
  const yillar = text.match(YIL) ?? []
  if (yillar.length >= 2) {
    gecenler.push("Tarihler")
  } else {
    bulgular.push({
      kod: "tarih_yok",
      seviye: "uyari",
      baslik: "Tarih bulunamadı",
      aciklama:
        "Deneyim ve eğitimlerinin yanına başlangıç ve bitiş tarihlerini yaz (ör. “03/2022 – Günümüz”). ATS'ler deneyim süresini bu tarihlerden hesaplıyor.",
    })
  }

  // Uzunluk.
  const kelime = text.split(/\s+/).filter(Boolean).length
  if (kelime < KISA_KELIME) {
    bulgular.push({
      kod: "cok_kisa",
      seviye: "uyari",
      baslik: "CV çok kısa görünüyor",
      aciklama: `Yaklaşık ${kelime} kelime okuyabildik. Metnin bir kısmı görsel ya da metin kutusu içindeyse ATS onu da okuyamıyor olabilir.`,
    })
  } else if (kelime > UZUN_KELIME) {
    bulgular.push({
      kod: "cok_uzun",
      seviye: "uyari",
      baslik: "CV uzun görünüyor",
      aciklama: `Yaklaşık ${kelime} kelime. Çoğu pozisyon için 1–2 sayfa yeterli; ilanla ilgisi az olan maddeleri kısaltabilirsin.`,
    })
  } else {
    gecenler.push("Uzunluk")
  }

  // İkon fontları.
  const ikonlar = text.match(IKON_KARAKTERI)?.length ?? 0
  if (ikonlar >= 3) {
    bulgular.push({
      kod: "ikon_karakteri",
      seviye: "uyari",
      baslik: "İkon karakterleri var",
      aciklama:
        "Telefon, e-posta ya da konum ikonları ATS'e anlamsız karakter olarak düşüyor. İkonların yerine “Telefon:”, “E-posta:” gibi düz etiketler kullan.",
    })
  } else {
    gecenler.push("Özel karakterler")
  }
}

function ardArdaBaslik(satirlar: string[], basliklar: (Bolum | null)[]): boolean {
  let oncekiBaslik = false
  for (let i = 0; i < satirlar.length; i++) {
    if (!satirlar[i]!.trim()) continue
    const baslik = basliklar[i] !== null && basliklar[i] !== "yoksay"
    if (baslik && oncekiBaslik) return true
    oncekiBaslik = baslik
  }
  return false
}

// ——— DOCX yapısı ———

interface DocxYapisi {
  tabloSayisi: number
  metinKutusu: boolean
  sutunSayisi: number
  ustAltMetin: string
  gorselSayisi: number
}

async function docxYapisi(buffer: Buffer): Promise<DocxYapisi | null> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    // Metin çıkarımı zaten başarılı olduysa bozuk yapı bu kontrolü
    // durdurmamalı; yalnızca yapısal kontroller atlanıyor.
    return null
  }
  const govde = (await zip.file("word/document.xml")?.async("string")) ?? ""

  const ustAlt: string[] = []
  for (const ad of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(ad)) {
      ustAlt.push(xmlMetni((await zip.file(ad)?.async("string")) ?? ""))
    }
  }

  const sutunlar = [...govde.matchAll(/<w:cols\b[^>]*\bw:num="(\d+)"/g)].map((m) => Number(m[1]))

  return {
    tabloSayisi: (govde.match(/<w:tbl>/g) ?? []).length + (govde.match(/<w:tbl /g) ?? []).length,
    metinKutusu: /<w:txbxContent\b/.test(govde),
    sutunSayisi: Math.max(1, ...sutunlar),
    ustAltMetin: ustAlt.join("\n"),
    gorselSayisi: Object.keys(zip.files).filter((a) => a.startsWith("word/media/")).length,
  }
}

/** w:t düğümlerinin metni; üst/alt bilgide e-posta ve telefon aramak için. */
function xmlMetni(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" ")
}

function docxKontrolleri(d: DocxYapisi, bulgular: FormatBulgu[], gecenler: string[]): void {
  if (d.metinKutusu) {
    bulgular.push({
      kod: "metin_kutusu",
      seviye: "sorun",
      baslik: "Metin kutusu kullanılmış",
      aciklama:
        "Metin kutularının içindeki yazıları birçok ATS hiç okumuyor. Bu bölümleri normal paragraf olarak yeniden yaz.",
    })
  } else {
    gecenler.push("Metin kutusu yok")
  }

  if (d.sutunSayisi > 1) {
    bulgular.push({
      kod: "cok_sutun",
      seviye: "sorun",
      baslik: `${d.sutunSayisi} sütunlu sayfa düzeni`,
      aciklama:
        "ATS'ler sütunları soldan sağa, satır satır okuyabiliyor; iki sütunun cümleleri birbirine karışıyor. Tek sütunlu bir düzen kullan.",
    })
  } else {
    gecenler.push("Tek sütun")
  }

  if (d.tabloSayisi > 0) {
    bulgular.push({
      kod: "tablo",
      seviye: "uyari",
      baslik: "Tablo kullanılmış",
      aciklama:
        "Bazı ATS'ler tablo hücrelerini yanlış sırada okuyor ya da atlıyor. Deneyim ve beceriler gibi önemli bölümleri tablo dışında tut.",
    })
  } else {
    gecenler.push("Tablo yok")
  }

  // E-posta üst bilgideyse bu daha özgül bulgu zaten eklendi; ikisini
  // birden göstermek aynı şeyi iki kez söylemek olur.
  const epostaZatenSoylendi = bulgular.some((b) => b.kod === "eposta_ust_bilgide")
  if (d.ustAltMetin.trim() && !epostaZatenSoylendi) {
    bulgular.push({
      kod: "ust_alt_bilgi",
      seviye: "uyari",
      baslik: "Üst veya alt bilgide yazı var",
      aciklama:
        "Birçok ATS üst ve alt bilgiyi okumuyor. Önemli bir bilgi (ad, iletişim) oradaysa belgenin gövdesine taşı.",
    })
  } else if (!d.ustAltMetin.trim()) {
    gecenler.push("Üst/alt bilgi")
  }

  if (d.gorselSayisi > 0) {
    bulgular.push({
      kod: "gorsel",
      seviye: "uyari",
      baslik: "Görsel var",
      aciklama:
        "ATS görsellerin içindeki yazıyı okuyamıyor. Fotoğraf dışında görsel içinde bilgi (beceri grafiği, logo) varsa metin olarak da yaz.",
    })
  } else {
    gecenler.push("Görsel yok")
  }
}
