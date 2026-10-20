/**
 * İlanın yayınlandığı platform ve ona özel başvuru ipuçları (DOG-95).
 *
 * Tespit deterministik: ilan adresinin alan adı. İpuçları yalnızca
 * platformun kendi yardım sayfasında ya da belgesinde okunabilen bilgiye
 * dayanıyor, her birinin kaynağı yanında; tahmin yok. Okuyamadığımız bir
 * konuda ipucu yazmıyoruz (Workday'in otomatik doldurması gibi). Kontrol
 * tarihi: 20 Ekim 2026 (K-85).
 */
export type PlatformId = "kariyernet" | "linkedin" | "greenhouse" | "lever" | "workday" | "successfactors" | "kariyerkapisi"

export interface PlatformTip {
  text: string
  source: { label: string; url: string }
}

export interface Platform {
  id: PlatformId
  name: string
  tips: PlatformTip[]
}

const GREENHOUSE_FORMATS = {
  label: "Greenhouse Support",
  url: "https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads",
}
const LINKEDIN_RESUME = { label: "LinkedIn Yardım", url: "https://www.linkedin.com/help/linkedin/answer/a510363" }
const KARIYERNET_GUIDE = {
  label: "Kariyer.net Kariyer Rehberi",
  url: "https://www.kariyer.net/kariyer-rehberi/cv-hazirlarken-en-cok-sorulan-sorular/",
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  kariyernet: {
    id: "kariyernet",
    name: "Kariyer.net",
    tips: [
      {
        text: "İşverenler adayları Kariyer.net'in kendi özgeçmiş formu üzerinden filtreliyor. Uyarlanmış CV'ndeki ifadeleri formdaki alanlara da taşı; Word dosyasını özgeçmişine ek olarak koyabilirsin.",
        source: KARIYERNET_GUIDE,
      },
      {
        text: "Ön yazını Kariyerim altındaki Dosyalarım / Ön yazılarım alanına kaydedip başvuruda seçebilirsin.",
        source: KARIYERNET_GUIDE,
      },
    ],
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    tips: [
      {
        text: "Kolay Başvuru'da CV Word ya da PDF olmalı; LinkedIn 2 MB'tan küçük dosya öneriyor.",
        source: LINKEDIN_RESUME,
      },
      {
        text: "LinkedIn son yüklediğin dört CV'yi saklıyor. Başvururken bu ilana uyarladığın dosyayı seçtiğinden emin ol.",
        source: LINKEDIN_RESUME,
      },
    ],
  },
  greenhouse: {
    id: "greenhouse",
    name: "Greenhouse",
    tips: [
      {
        text: "Greenhouse CV ve ön yazı için doc, docx, pdf, rtf ve txt dosyalarını kabul ediyor; indirdiğin PDF ya da DOCX olur.",
        source: GREENHOUSE_FORMATS,
      },
    ],
  },
  lever: {
    id: "lever",
    name: "Lever",
    tips: [
      {
        text: "Lever başvurusunda CV dosya olarak yükleniyor; ayrıca adayın serbest yazdığı bir ek bilgi alanı var. Ön yazın varsa oraya yapıştırabilirsin.",
        source: { label: "Lever Postings API", url: "https://github.com/lever/postings-api" },
      },
    ],
  },
  workday: {
    id: "workday",
    name: "Workday",
    tips: [
      {
        text: "Workday'in CV okuyan bileşeni DOC, DOCX, PDF, RTF ve TXT dosyalarını destekliyor; indirdiğin PDF ya da DOCX olur. Şirket ayarları farklı olabilir, yükleme ekranındaki listeye bak.",
        source: {
          label: "Workday HiredScore belgesi",
          url: "https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/concept--candidate-profiles.html",
        },
      },
    ],
  },
  successfactors: {
    id: "successfactors",
    name: "SAP SuccessFactors",
    tips: [
      {
        text: "SuccessFactors CV ve ön yazı için doc, docx, pdf ve txt dosyalarını kabul ediyor; pptx ve xlsx desteklenmiyor. İndirdiğin PDF ya da DOCX olur.",
        source: {
          label: "SAP Help Portal",
          url: "https://help.sap.com/docs/successfactors-recruiting/setting-up-and-maintaining-sap-successfactors-recruiting/candidate-profile-in-sap-successfactors",
        },
      },
    ],
  },
  kariyerkapisi: {
    id: "kariyerkapisi",
    name: "Kariyer Kapısı",
    tips: [
      {
        text: "Kariyer Kapısı e-Devlet'le bütünleşik; başvuruda istenen belgeler kurumlara otomatik iletiliyor. Başvurmadan önce e-Devlet'teki bilgilerini kontrol et; ilanın istediği ek belgeler ilan metninde yazıyor.",
        source: { label: "Kariyer Kapısı SSS", url: "https://kariyerkapisi.gov.tr/sss" },
      },
    ],
  },
}

/** Alan adı kalıpları; alt alan adları da eşleşiyor (acme.wd3.myworkdayjobs.com). */
const HOSTS: Array<[PlatformId, string[]]> = [
  ["kariyernet", ["kariyer.net"]],
  ["linkedin", ["linkedin.com"]],
  ["greenhouse", ["greenhouse.io"]],
  ["lever", ["lever.co"]],
  ["workday", ["myworkdayjobs.com", "myworkdaysite.com", "myworkday.com"]],
  ["successfactors", ["successfactors.com", "successfactors.eu", "sapsf.com", "sapsf.eu"]],
  ["kariyerkapisi", ["kariyerkapisi.gov.tr", "kariyerkapisi.cbiko.gov.tr", "isealimkariyerkapisi.cbiko.gov.tr"]],
]

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

export function detectPlatform(url: string | null | undefined): PlatformId | null {
  const host = url ? hostOf(url) : null
  if (!host) return null
  for (const [id, domains] of HOSTS) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return id
  }
  return null
}

/**
 * Saklanan ilan adresi: yalnızca http(s), sorgu ve # kısmı atılmış. Sorgu
 * izleme ve aday kimliği taşıyabiliyor; platformu tanımak için yol yeterli.
 */
export function sanitizeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    parsed.search = ""
    parsed.hash = ""
    parsed.username = ""
    parsed.password = ""
    const clean = parsed.toString()
    return clean.length <= 500 ? clean : null
  } catch {
    return null
  }
}
