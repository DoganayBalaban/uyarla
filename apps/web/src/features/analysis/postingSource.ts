/**
 * İlan kaynağı uyarısı (DOG-125). İlan adresinin alan adı beş sınıfa
 * ayrılıyor; sahte iş ilanı dolandırıcılığına karşı ucuz bir koruma.
 *
 *   portal       bilinen iş sitesi (Kariyer.net, LinkedIn…)
 *   ats          şirketlerin kullandığı bilinen başvuru sistemi (Greenhouse…)
 *   institution  resmî kurum (gov.tr)
 *   unverified   listede yok; çoğunlukla şirketin kendi sitesi, uyarı yumuşak
 *   lookalike    bilinen bir adı taşıyor ama o alan adı değil
 *                (greenhouse.io.evil.com, evil-greenhouse.io, kariyer-net.com)
 *
 * Eşleşme tam alan adı ya da `.alan` sonekiyle. Adresteki kullanıcı kısmı
 * (`greenhouse.io@evil.com`) URL ayrıştırılınca düşüyor; asıl alan adı
 * evil.com.
 */
export type PostingSourceKind = "portal" | "ats" | "institution" | "unverified" | "lookalike"

export interface PostingSource {
  kind: PostingSourceKind
  host: string
  /** Taklit edilen ad (yalnızca lookalike). */
  imitates?: string
}

const PORTALS: Array<[string, string]> = [
  ["kariyer.net", "Kariyer.net"],
  ["linkedin.com", "LinkedIn"],
  ["secretcv.com", "Secretcv"],
  ["yenibiris.com", "Yenibiris"],
  ["eleman.net", "Eleman.net"],
  ["isinolsun.com", "İşin Olsun"],
  ["youthall.com", "Youthall"],
  ["toptalent.co", "Toptalent"],
  ["indeed.com", "Indeed"],
  ["glassdoor.com", "Glassdoor"],
]

const ATS: Array<[string, string]> = [
  ["greenhouse.io", "Greenhouse"],
  ["lever.co", "Lever"],
  ["myworkdayjobs.com", "Workday"],
  ["myworkdaysite.com", "Workday"],
  ["myworkday.com", "Workday"],
  ["successfactors.com", "SAP SuccessFactors"],
  ["successfactors.eu", "SAP SuccessFactors"],
  ["sapsf.com", "SAP SuccessFactors"],
  ["sapsf.eu", "SAP SuccessFactors"],
  ["ashbyhq.com", "Ashby"],
  ["smartrecruiters.com", "SmartRecruiters"],
  ["workable.com", "Workable"],
  ["teamtailor.com", "Teamtailor"],
  ["recruitee.com", "Recruitee"],
  ["personio.de", "Personio"],
  ["personio.com", "Personio"],
  ["bamboohr.com", "BambooHR"],
  ["icims.com", "iCIMS"],
  ["taleo.net", "Taleo"],
  ["jobvite.com", "Jobvite"],
  ["breezy.hr", "Breezy HR"],
]

/** Resmî kurum sonekleri. */
const INSTITUTION_SUFFIXES = ["gov.tr", "edu.tr", "tsk.tr", "bel.tr"]

/**
 * Taklitte aranan ayırt edici marka etiketleri. Genel kelimeler ("eleman",
 * "lever", "indeed") tek başına aranmıyor; yanlış alarm verirler. Onlar için
 * yalnızca tam alan adının başka bir adın içinde geçmesine bakılıyor.
 */
const BRAND_LABELS: Array<[string, string]> = [
  ["linkedin", "LinkedIn"],
  ["kariyernet", "Kariyer.net"],
  ["secretcv", "Secretcv"],
  ["yenibiris", "Yenibiris"],
  ["greenhouse", "Greenhouse"],
  ["myworkdayjobs", "Workday"],
  ["successfactors", "SAP SuccessFactors"],
  ["smartrecruiters", "SmartRecruiters"],
  ["kariyerkapisi", "Kariyer Kapısı"],
]

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

export function classifyPostingSource(url: string | null | undefined): PostingSource | null {
  if (!url) return null
  let host: string
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  } catch {
    return null
  }
  if (PORTALS.some(([d]) => matches(host, d))) return { kind: "portal", host }
  if (ATS.some(([d]) => matches(host, d))) return { kind: "ats", host }
  if (INSTITUTION_SUFFIXES.some((d) => matches(host, d))) return { kind: "institution", host }
  // Tire nokta sayılıyor: "evil-greenhouse.io" → "evil.greenhouse.io".
  const dotted = host.replace(/-/g, ".")
  const known = [...PORTALS, ...ATS].find(([d]) => matches(dotted, d) || dotted.includes(`${d}.`))
  if (known) return { kind: "lookalike", host, imitates: known[1] }
  const labels = dotted.split(".")
  const brand = BRAND_LABELS.find(([label]) => labels.includes(label))
  if (brand) return { kind: "lookalike", host, imitates: brand[1] }
  return { kind: "unverified", host }
}

/** Sonuç ekranındaki uyarı; güvenilen kaynakta null. */
export function postingSourceWarning(source: PostingSource | null): { tone: "soft" | "strong"; text: string } | null {
  if (!source) return null
  if (source.kind === "lookalike") {
    return {
      tone: "strong",
      text: `Bu ilanın adresi (${source.host}) ${source.imitates} gibi görünüyor ama ${source.imitates}'in adresi değil. Başvurmadan önce ilanı şirketin resmi sitesinden doğrula; ücret, kimlik ya da banka bilgisi isteyen sayfalara bilgi verme.`,
    }
  }
  if (source.kind === "unverified") {
    return {
      tone: "soft",
      text: `Bu ilanın adresi (${source.host}) bildiğimiz bir iş sitesi ya da başvuru sistemi değil. Şirketin kendi sitesi olabilir; emin değilsen ilanı şirketin resmi sitesinden doğrula.`,
    }
  }
  return null
}
