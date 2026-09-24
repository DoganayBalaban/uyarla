import { normalizeText } from "../normalize/turkish.js"
import type { ResumeSegments } from "../schemas/resume.js"

/**
 * CV'yi bölümlerine kodla ayırır.
 *
 * Bu iş LLM'e verilmişti ve iki kez kırıldı: bir kez başlık satırlarını
 * bloğa koymayarak (K-10), bir kez de bölümleri yanlış etiketleyerek —
 * "TECHNICAL SKILLS" deneyim bloğuna, "ADDITIONAL" beceri bloğuna gitmişti.
 * İkincisinde CV'de açıkça yazan MCP, tool calling ve Docker hiç beceri
 * olarak çıkmadı.
 *
 * Metni başlığına göre kesmek deterministik bir iş; dil modeline ihtiyacı
 * yok. Kodda yapılınca kırıldığında sessiz değil kırmızı oluyor, her CV'de
 * ~10 saniye kazandırıyor ve üretimde bir çağrılık token maliyeti düşüyor.
 */

type Bolum = "summary" | "experience" | "education" | "skills" | "yoksay"

/** Başlık satırı bu uzunluğu aşmaz; aşıyorsa içerik satırıdır. */
const MAX_BASLIK_UZUNLUGU = 60

const KALIPLAR: Array<[Bolum, RegExp]> = [
  [
    "summary",
    /^(profile|profil|hakkimda|özet|ozet|summary|about( me)?|profesyonel özet|kariyer özeti)$/,
  ],
  ["experience", /^((work|professional|relevant)\s+)?(experience|employment|history)$/],
  ["experience", /^(iş\s+)?(deneyim|deneyimler|deneyimi|tecrübe|tecrübeler)$/],
  ["experience", /^(profesyonel deneyim|çalışma deneyimi|iş tecrübesi|kariyer geçmişi)$/],
  // Projeler deneyim sayılır: kanıt olarak aynı işi görüyorlar.
  [
    "experience",
    /^(selected\s+)?(projects|projeler|seçilmiş projeler|kişisel projeler|project experience)$/,
  ],
  ["education", /^(education|eğitim|egitim|öğrenim|akademik geçmiş|eğitim bilgileri)$/],
  [
    "skills",
    /^((core|technical|teknik|key|other)\s+)?(skills|competencies|beceriler|yetkinlikler|araçlar|tools)$/,
  ],
  ["skills", /^(tech stack|teknolojiler|teknik beceriler|uzmanlık alanları|technologies)$/],
  // Sertifika ve diller beceri bloğuna gider: çıkarıcının bunlar için ayrı
  // alanları var ve düzleştirme onları beceri listesinden eliyor (K-20).
  [
    "skills",
    /^(certifications?|certificates|sertifikalar|sertifikalar belgeler|belgeler|languages|diller|yabancı diller?)$/,
  ],
]

/** Tanınan ama dört bloğun hiçbirine ait olmayan bölümler. */
const YOKSAYILAN =
  /^(additional|references|referanslar|hobbies|ilgi alanları|awards|honors|ödüller|volunteer|gönüllü çalışmalar|publications|yayınlar|interests)$/

export function segmentResume(rawText: string): ResumeSegments {
  const satirlar = rawText.split("\n")
  const bloklar: Record<Bolum, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    yoksay: [],
  }

  // İlk başlıktan önceki satırlar ad, unvan ve iletişim bilgisidir; özete
  // yazılıyor. Eşleştirmede kullanılmıyor, ama atmanın da gereği yok.
  let aktif: Bolum = "summary"
  let baslikBulundu = false

  for (const satir of satirlar) {
    const bolum = baslikTuru(satir)
    if (bolum) {
      aktif = bolum
      baslikBulundu = true
    }
    // Başlığın kendisi de bloğa giriyor: K-10'daki kayıp tam da başlıkların
    // atılmasıydı ve çıkarıcılar bağlamdan yararlanıyor.
    bloklar[aktif].push(satir)
  }

  // Hiç başlık yoksa (tasarım ağırlıklı bazı CV'ler) bölemeyiz; her
  // çıkarıcıya ham metnin tamamı verilir. Bugünkü davranıştan kötü değil.
  if (!baslikBulundu) {
    const tam = rawText.trim()
    return {
      summaryBlock: tam,
      experienceBlock: tam,
      educationBlock: tam,
      skillsBlock: tam,
    }
  }

  return {
    summaryBlock: bloklar.summary.join("\n").trim(),
    experienceBlock: bloklar.experience.join("\n").trim(),
    educationBlock: bloklar.education.join("\n").trim(),
    skillsBlock: bloklar.skills.join("\n").trim(),
  }
}

function baslikTuru(satir: string): Bolum | null {
  const temiz = satir.trim()
  if (!temiz || temiz.length > MAX_BASLIK_UZUNLUGU) return null

  const n = normalizeText(temiz)
  if (!n) return null
  if (YOKSAYILAN.test(n)) return "yoksay"

  for (const [bolum, kalip] of KALIPLAR) {
    if (kalip.test(n)) return bolum
  }
  return null
}
