import type { Concept } from "../schemas/job.js"

/**
 * Bir gereksinim metnini kavramlarına böler.
 *
 * Bu iş LLM'e verildi ve üç farklı biçimde üç farklı şekilde başarısız oldu:
 * iç içe şemada kavramları eksik çıkardı, düz şemada eş anlamlıları boş
 * bıraktı, sıkılaştırılmış prompt'ta listeyi ikinci gereksinimde kapattı.
 * Aynı ilanda kod bölmesi 5 kavram bulurken model 1 buluyordu (K-23).
 *
 * Oysa bileşik bir gereksinimi parçalamak metin işlemedir: virgül, "ve",
 * "and", iki nokta üst üste. Yorum gerektirmiyor.
 */

/** Kavramları ayıran işaretler. "/" dahil değil: "CI/CD" tek kavramdır. */
const AYIRAC = /\s*(?:,|;|:|•|\bve\b|\band\b|\bveya\b|\bor\b)\s*/i

/** Başta duran ve kavrama ait olmayan kalıplar. */
const ON_DOLGU =
  /^(en az\s+\d+\+?\s*yıl\s+|at least\s+\d+\+?\s*years?\s+(of\s+)?|\d+\+?\s*yıl\s+|\d+\+?\s*years?\s+(of\s+)?|hands on with\s+|experience (with|in)\s+|deneyim(i|li)?\s+|tercihen\s+|preferably\s+|good\s+|strong\s+|solid\s+|equivalent\s+)/i

/** Sonda duran ve kavrama ait olmayan kalıplar. */
const ARKA_DOLGU =
  /\s+(deneyimi|deneyim|tecrübesi|tecrübe|bilgisi|bilgi|teknolojileri|teknoloji|yetkinlikleri|yetkinliği|süreçleri|süreci|konularında|konusunda|alanında|kullanımı|experience|knowledge|skills?|frameworks?|technologies|tools?)$/i

/** Tek başına kavram sayılmayacak kalıntılar. */
const ANLAMSIZ =
  /^(deneyim(i|e|li)?|tecrübe(si)?|bilgi(si)?|konusunda|konularında|sahibi olmak|hakim olmak|olmak|mezun olmak|ilgili bölümlerden mezun olmak|benzer bir işte|experience|knowledge|skills?|equivalent|etc|vb|vs|gibi|the|and|or|ve|veya|with|in|of|a|an)$/i

const MIN_UZUNLUK = 2
const MAX_UZUNLUK = 45

export function splitIntoConcepts(requirementText: string): Concept[] {
  const parcalar = requirementText
    .split(AYIRAC)
    .map(temizle)
    .filter(
      (p) =>
        p.length >= MIN_UZUNLUK && p.length <= MAX_UZUNLUK && !ANLAMSIZ.test(p),
    )

  // Tekilleştirme: "Docker ve Container teknolojileri" gibi ifadelerde aynı
  // terim iki kez çıkabiliyor.
  const benzersiz = [...new Set(parcalar.map((p) => p.toLocaleLowerCase("tr")))]
  const kavramlar = benzersiz.map((_, i) => parcalar[parcalar.findIndex(
    (p) => p.toLocaleLowerCase("tr") === benzersiz[i],
  )]!)

  // Hiç kavram çıkmayan gereksinimler var — "Benzer bir işte en az 5 yıl
  // deneyim sahibi olmak" gibi. Bunlar tek kavram sayılıp bütün hâlleriyle
  // aranıyor; skorlamanın her gereksinim için en az bir kavrama ihtiyacı var.
  if (kavramlar.length === 0) {
    return [{ term: requirementText.trim(), synonyms: [] }]
  }

  return kavramlar.map((term) => ({ term, synonyms: [] }))
}

function temizle(parca: string): string {
  let p = parca.trim()
  // Dolgular birden çok katman olabiliyor: "at least 3 years of hands on with X"
  for (let i = 0; i < 3; i++) {
    const oncesi = p
    p = p.replace(ON_DOLGU, "").replace(ARKA_DOLGU, "").trim()
    if (p === oncesi) break
  }
  return p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})\]]+$/gu, "").trim()
}
