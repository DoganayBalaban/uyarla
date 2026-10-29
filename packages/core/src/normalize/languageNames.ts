import { normalizeText } from "./turkish.js"

/**
 * İlanlarda geçen diller: Türkçe ve İngilizce adlarıyla. Dil kontrolü
 * (score/languages.ts) ve kavram bölücü (extract/concepts.ts) aynı listeyi
 * kullanıyor.
 *
 * Kalıplar normalizeText biçiminde: küçük harf, "ı" → "i", noktalama boşluk.
 * Böylece "İyi derecede İngilizce" ve "FLUENT ENGLISH" aynı kalıba düşüyor;
 * JavaScript'in `i` bayrağı "İ"yi "i" saymıyor.
 */
export interface LanguageName {
  /** Türkçe adı ("İngilizce"). */
  name: string
  /** İngilizce adı ("English"). */
  en: string
  pattern: RegExp
  /** Yalnızca Türkçe adı tutan kalıp; kavramın adı ilanın yazdığı dilde kalsın diye. */
  turkish: RegExp
}

export const LANGUAGE_NAMES: LanguageName[] = [
  { name: "İngilizce", en: "English", pattern: /ingilizce|english/, turkish: /ingilizce/ },
  { name: "Almanca", en: "German", pattern: /almanca|german(?!y)|deutsch/, turkish: /almanca/ },
  { name: "Fransızca", en: "French", pattern: /fransizca|french|fran[cç]ais/, turkish: /fransizca/ },
  { name: "İspanyolca", en: "Spanish", pattern: /ispanyolca|spanish|espa[nñ]ol/, turkish: /ispanyolca/ },
  { name: "İtalyanca", en: "Italian", pattern: /italyanca|italian/, turkish: /italyanca/ },
  { name: "Rusça", en: "Russian", pattern: /rusça|russian/, turkish: /rusça/ },
  { name: "Arapça", en: "Arabic", pattern: /arapça|arabic/, turkish: /arapça/ },
  { name: "Çince", en: "Chinese", pattern: /çince|chinese|mandarin/, turkish: /çince/ },
  { name: "Japonca", en: "Japanese", pattern: /japonca|japanese/, turkish: /japonca/ },
  { name: "Korece", en: "Korean", pattern: /korece|korean/, turkish: /korece/ },
  { name: "Felemenkçe", en: "Dutch", pattern: /felemenkçe|hollandaca|dutch/, turkish: /felemenkçe|hollandaca/ },
  { name: "Portekizce", en: "Portuguese", pattern: /portekizce|portuguese/, turkish: /portekizce/ },
  { name: "Türkçe", en: "Turkish", pattern: /türkçe|turkish/, turkish: /türkçe/ },
]

/** Metinde adı geçen diller. */
export function mentionedLanguages(text: string): LanguageName[] {
  const folded = normalizeText(text)
  return LANGUAGE_NAMES.filter((l) => l.pattern.test(folded))
}
