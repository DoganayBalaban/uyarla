export type AsamaDurumu = "bekliyor" | "aktif" | "tamam" | "hata"

export interface Asama {
  id: string
  baslik: string
  aciklama?: string
  durum: AsamaDurumu
}

/**
 * Sıralı aşama kimliklerinden durumları türetir: aktif olandan öncekiler
 * tamam, sonrakiler sırada. Sunucu yalnızca mevcut aşamayı söylüyor.
 */
export function asamalariTuret(
  tanimlar: Omit<Asama, "durum">[],
  aktifId: string | null,
  bitti = false,
): Asama[] {
  const aktifIndeks = aktifId ? tanimlar.findIndex((t) => t.id === aktifId) : -1
  return tanimlar.map((t, i) => ({
    ...t,
    durum: bitti ? "tamam" : aktifIndeks === -1 ? (i === 0 ? "aktif" : "bekliyor") : i < aktifIndeks ? "tamam" : i === aktifIndeks ? "aktif" : "bekliyor",
  }))
}
