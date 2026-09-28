import type { ResumeProfile } from "../schemas/resume.js"

export type Dil = "tr" | "en"

/**
 * Metnin dili: Türkçe mi İngilizce mi.
 *
 * Kararı modele bırakmıyoruz. Prompt'lar Türkçe yazılı ve küçük model
 * "kaynağın dilinde yaz" talimatına rağmen İngilizce CV'yi Türkçeye
 * çeviriyordu (K-39). Dil kodda bir kez belirleniyor, prompt'a açıkça
 * yazılıyor ve belge başlıkları da ona göre seçiliyor.
 *
 * Sayım basit ve bilinçli olarak kaba: Türkçeye özgü harfler ve iki dilin en
 * sık işlev kelimeleri. CV metni kısa ama bu işaretler her cümlede geçiyor.
 */
export function detectLanguage(metin: string): Dil {
  const kucuk = metin.toLocaleLowerCase("tr")
  const kelimeler = kucuk.split(/[^\p{L}]+/u).filter(Boolean)

  let tr = (kucuk.match(/[çğıöşü]/g) ?? []).length * 0.5
  let en = 0
  for (const k of kelimeler) {
    if (TR_KELIMELER.has(k)) tr++
    else if (EN_KELIMELER.has(k)) en++
  }
  // Eşitlikte Türkçe: ürünün birincil dili ve eski davranış.
  return en > tr ? "en" : "tr"
}

const TR_KELIMELER = new Set([
  "ve", "ile", "bir", "bu", "için", "olarak", "da", "de", "ettim", "yaptım",
  "geliştirdim", "yönettim", "sağladım", "oldu", "olan", "gibi", "çok", "en",
  "deneyim", "yıllık", "halen", "günümüz", "lisans", "üniversitesi",
])

const EN_KELIMELER = new Set([
  "and", "with", "the", "for", "to", "of", "in", "a", "an", "on", "by", "as",
  "developed", "built", "led", "managed", "improved", "designed", "implemented",
  "reduced", "increased", "experience", "years", "present", "university",
])

/** CV'nin dili: özet ve deneyim maddeleri üzerinden. */
export function resumeLanguage(profile: ResumeProfile): Dil {
  return detectLanguage(
    [
      profile.summary ?? "",
      ...profile.experience.flatMap((j) => [j.title, ...j.bullets.map((b) => b.sourceRef || b.text)]),
    ].join(" "),
  )
}
