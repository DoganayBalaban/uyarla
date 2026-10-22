/**
 * Bekleme ekranlarının saf yardımcıları (analiz ve uyarlama). Ekran yalnızca
 * gerçek veriyi çiziyor: kullanıcının yapıştırdığı metnin satırları ve geçen
 * süre. Tahmini yüzde ya da kalan süre yok.
 */

/** Geçen süre "d:ss" biçiminde; bir saati geçmiyor, negatif süre 0. */
export function elapsedLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/** Metnin ilk dolu satırları, boşlukları sadeleşmiş ve kısaltılmış. */
export function previewLines(text: string | null | undefined, max = 10, maxLength = 90): string[] {
  if (!text) return []
  const lines: string[] = []
  for (const raw of text.split(/\r?\n|\r/)) {
    const line = raw.replace(/\s+/g, " ").trim()
    if (!line) continue
    lines.push(line.length > maxLength ? `${line.slice(0, maxLength - 1).trimEnd()}…` : line)
    if (lines.length >= max) break
  }
  return lines
}
