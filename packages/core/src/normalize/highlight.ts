import { normalizeToken, normalizeTokens } from "./turkish.js"

/**
 * İlan terimlerinin metindeki yerleri (DOG-92): vurgulama için karakter
 * aralıkları. Eşleşme skorlamanın `containsKeyword` kuralıyla aynı (ek
 * soyma, eş anlamlı ve çok kelimeli karşılıklar); ekranda vurgulanan terim
 * skorda da sayılır, vurgulanmayan sayılmaz.
 */
export interface KeywordSpan {
  start: number
  end: number
  /** Eşleşen arama terimi (ilandaki terim ya da eş anlamlısı). */
  keyword: string
}

/** Metindeki kelimeler ve konumları; `normalizeText` ile aynı sınırlar. */
function words(text: string): Array<{ start: number; end: number; stem: string }> {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
    start: m.index!,
    end: m.index! + m[0].length,
    stem: normalizeToken(m[0]),
  }))
}

/**
 * Kökleri `normalizeTokens` gibi çok kelimeli karşılıklarda birleştirir,
 * her birleşik kökün metindeki aralığını koruyarak.
 */
function tokensWithRanges(text: string): Array<{ start: number; end: number; token: string }> {
  const ws = words(text)
  const out: Array<{ start: number; end: number; token: string }> = []
  for (let i = 0; i < ws.length; ) {
    let merged = false
    for (let n = Math.min(4, ws.length - i); n >= 2; n--) {
      const slice = ws.slice(i, i + n)
      const joined = normalizeTokens(text.slice(slice[0]!.start, slice[n - 1]!.end))
      // Birden çok kelime tek köke indiyse bir karşılık eşleşmiş demektir.
      if (joined.length === 1 && slice.some((w) => w.stem !== joined[0])) {
        out.push({ start: slice[0]!.start, end: slice[n - 1]!.end, token: joined[0]! })
        i += n
        merged = true
        break
      }
    }
    if (!merged) {
      out.push({ start: ws[i]!.start, end: ws[i]!.end, token: ws[i]!.stem })
      i++
    }
  }
  return out
}

export function keywordSpans(text: string, keywords: readonly string[]): KeywordSpan[] {
  const tokens = tokensWithRanges(text)
  const needles = keywords
    .map((keyword) => ({ keyword, parts: normalizeTokens(keyword) }))
    .filter((n) => n.parts.length > 0)
    // Uzun terim önce: "makine öğrenmesi" varken "öğrenme" ayrıca boyanmasın.
    .sort((a, b) => b.parts.length - a.parts.length)
  const taken = new Array<boolean>(tokens.length).fill(false)
  const spans: KeywordSpan[] = []
  for (const { keyword, parts } of needles) {
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (parts.every((p, j) => tokens[i + j]!.token === p && !taken[i + j])) {
        for (let j = 0; j < parts.length; j++) taken[i + j] = true
        // Kesme işaretli ek vurguya dahil ("API'leri"); eşleşme yine terimde.
        const last = tokens[i + parts.length - 1]!.end
        const suffix = text.slice(last).match(/^['’]\p{L}+/u)?.[0].length ?? 0
        if (suffix) taken[i + parts.length] = true
        spans.push({ start: tokens[i]!.start, end: last + suffix, keyword })
      }
    }
  }
  return spans.sort((a, b) => a.start - b.start)
}
