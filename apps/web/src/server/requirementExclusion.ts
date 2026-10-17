/**
 * Gereksinimi "ilanda yok, yanlış okunmuş" diye işaretleme (DOG-90).
 *
 * Analizin skoru (Analysis.score) değişmiyor: uyarlama "önce" skorunu oradan
 * okuyor ve sonra skoru tüm ilana göre hesaplıyor; birini değiştirmek önce/sonra
 * farkını yanıltırdı. İşaretler sonucun içinde duruyor, ekran düzeltilmiş skoru
 * ayrıca hesaplıyor. Aynı işaretler kavram ayırma hatalarının gerçek verisi.
 */
export function setRequirementExcluded(
  result: { requirements: unknown[]; excluded?: number[] },
  index: number,
  excluded: boolean,
): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= result.requirements.length) {
    throw new RangeError(`Gereksinim bulunamadı: ${index}`)
  }
  const current = new Set(result.excluded ?? [])
  if (excluded) current.add(index)
  else current.delete(index)
  return [...current].sort((a, b) => a - b)
}
