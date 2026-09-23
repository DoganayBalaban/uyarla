import { TITLE_SYNONYMS } from "./titles.js"

/**
 * Ek soyulduktan sonra kökün inebileceği en kısa uzunluk.
 * Altına inmek "git", "sql", "api" gibi kısa terimleri bozar.
 */
const MIN_STEM_LENGTH = 4

/**
 * Soyulacak ekler. Uzunluğa göre azalan sırada denenirler (dizi kodda
 * sıralanıyor, elle sıraya güvenilmiyor).
 *
 * Bileşik biçimler (iyelik + hâl) ayrıca listelenir çünkü token başına
 * YALNIZCA BİR ek soyulur. Döngüsel soyma denendi ve aşırı soyuyordu:
 * "yazılımcıyım" önce "yazılım" oluyor, sonra "ım" da soyulup "yazıl"a
 * iniyordu. Tek ek kuralı sonucu öngörülebilir kılıyor.
 *
 * Bu liste kapsamlı bir Türkçe morfoloji çözümleyicisi değil; iş ilanı ve CV
 * metinlerinde sık geçen ekleri hedefler. Yetmediği yerde anlamsal eşleşme
 * (BGE-M3) devreye giriyor ve K-08'in açık bıraktığı kapı duruyor: gerekirse
 * bu katmanın arkasına gerçek bir morfoloji servisi takılabilir.
 */
const SUFFIXES = [
  "larımızın", "lerimizin", "larınızın", "lerinizin",
  "cılığı", "ciliği", "culuğu", "cülüğü",
  "larında", "lerinde", "lığında", "liğinde",
  "lardan", "lerden", "larını", "lerini",
  "sınız", "siniz", "sunuz", "sünüz",
  "cıyım", "ciyim", "cuyum", "cüyüm",
  "larda", "lerde", "ların", "lerin",
  "sına", "sine", "suna", "süne",
  "ları", "leri", "lığı", "liği", "luğu", "lüğü",
  "ında", "inde", "unda", "ünde",
  "lık", "lik", "luk", "lük",
  "dan", "den", "tan", "ten",
  "lar", "ler",
  "cı", "ci", "cu", "cü", "çı", "çi", "çu", "çü",
  "da", "de", "ta", "te",
  "sı", "si", "su", "sü",
  "ım", "im", "um", "üm",
  "ı", "i", "u", "ü",
].sort((a, b) => b.length - a.length)

/** Türkçe duyarlı küçültme, noktalama temizliği, boşluk tekleme. */
export function normalizeText(text: string): string {
  return text
    // Türkçe kritik: "I".toLowerCase() İngilizce kurallarla "i" verir,
    // oysa Türkçede "ı" olmalı. Yerel belirtmek şart.
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Tek kelimeyi köküne indirir ve eş anlamlıya çevirir.
 * Eş anlamlı sözlüğü hem soymadan önce hem sonra denenir: "reactjs" doğrudan
 * eşleşir, "yazılımcıyım" ise önce "yazılım" köküne inip sonra eşleşebilir.
 */
export function normalizeToken(word: string): string {
  let stem = normalizeText(word)

  // Sözlük her adımda denenir, yalnızca başta ve sonda değil. Aksi hâlde
  // "geliştirici" sözlükten doğrudan eşleşirken "geliştiricisiniz" soyulmaya
  // devam edip başka bir köke iner — iki biçim buluşamaz.
  const dogrudan = TITLE_SYNONYMS[stem]
  if (dogrudan) return dogrudan

  // Kök artık kısalmayana kadar ek soyulur. Tek ek soymak simetriyi bozuyor:
  // "yazılımcıyım" bir ekle "yazılım" olurken, anahtar kelime "yazılım" da
  // kendi ekini verip "yazıl"a iniyor ve iki taraf buluşamıyor. Sonuna kadar
  // soyunca ikisi de "yazıl"da buluşuyor.
  //
  // Aşırı soyma bu yüzden kabul edilebilir: önemli olan kökün "doğru" olması
  // değil, ilan ve CV tarafının AYNI köke inmesi.
  let degisti = true
  while (degisti) {
    degisti = false
    for (const suffix of SUFFIXES) {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= MIN_STEM_LENGTH) {
        stem = stem.slice(0, -suffix.length)
        degisti = true
        break
      }
    }
    const eslesme = TITLE_SYNONYMS[stem]
    if (eslesme) return eslesme
  }

  return stem
}

/** Metni normalleştirilmiş köklere ayırır. */
export function normalizeTokens(text: string): string[] {
  const normalized = normalizeText(text)
  if (!normalized) return []
  return normalized.split(" ").map(normalizeToken)
}

/**
 * Anahtar kelimenin metinde geçip geçmediği.
 *
 * Karşılaştırma tam kelime düzeyinde: "django" metnindeki "go" ile eşleşmez.
 * Uydurma eşleşme, kaçırmadan zararlıdır (spec §7).
 *
 * Çok kelimeli anahtar kelimelerde tüm kökler ardışık aranır, yani sıra
 * önemlidir: "takım çalışması" ararken "çalışma takımı" eşleşmez.
 */
export function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = normalizeTokens(keyword)
  if (needle.length === 0) return false

  const hay = normalizeTokens(haystack)
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((part, j) => hay[i + j] === part)) return true
  }
  return false
}
