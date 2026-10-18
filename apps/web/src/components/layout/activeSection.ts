/**
 * Tanıtım sayfasında kaydırırken üst çubukta hangi bölümün yanacağı. Okuma
 * çizgisini (`line`, sayfa koordinatında) geçmiş son bölüm aktif; hero'da
 * henüz hiçbiri değil. Ara bölümler (bento, personalar) bir öncekinin
 * devamı sayılıyor, sekme sönüp yanıp durmasın diye.
 */
export function activeSection(sections: { id: string; top: number }[], line: number): string | null {
  let best: { id: string; top: number } | null = null
  for (const s of sections) {
    if (s.top <= line && (!best || s.top > best.top)) best = s
  }
  return best?.id ?? null
}
