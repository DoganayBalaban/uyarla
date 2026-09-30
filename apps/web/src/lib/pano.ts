/**
 * Başvuru panosunun saf mantığı: aşamalar, etiketler ve kartların
 * sıralanması. Veritabanına dokunmuyor; test edilebilir kalsın diye API
 * uçlarından ayrı.
 */

export const ASAMALAR = ["saved", "applied", "interview", "offer", "rejected"] as const
export type Asama = (typeof ASAMALAR)[number]

/** Marka rehberi §8: "başvuru panosu" terimi; sütun adları kısa fiil/isim. */
export const ASAMA_ETIKETI: Record<Asama, string> = {
  saved: "Kaydedildi",
  applied: "Başvuruldu",
  interview: "Mülakat",
  offer: "Teklif",
  rejected: "Olmadı",
}

/**
 * Aşamanın rengi; pano sütunlarında ve dashboard'da aynı. Aşama bir durum
 * bildirdiği için durum renkleri burada yerinde (rehber §9.2).
 */
export const ASAMA_RENGI: Record<Asama, string> = {
  saved: "bg-gri",
  applied: "bg-mavi",
  interview: "bg-kehribar",
  offer: "bg-yesil",
  rejected: "bg-kirmizi",
}

export function gecerliAsama(deger: unknown): deger is Asama {
  return typeof deger === "string" && (ASAMALAR as readonly string[]).includes(deger)
}

export const NOT_UZUNLUGU = 500

export interface PanoKarti {
  analysisId: string
  pozisyon: string
  skor: number | null
  asama: Asama
  asamaTarihi: string | null
  not: string | null
  olusturulma: string
  uyarlama: { id: string; durum: string } | null
}

/** Panonun veritabanından okuduğu alanlar; iki uç da aynı seçimi kullanıyor. */
export const PANO_SECIMI = {
  id: true,
  score: true,
  stage: true,
  stageChangedAt: true,
  note: true,
  createdAt: true,
  jobPosting: { select: { position: true, rawText: true } },
  adaptation: { select: { id: true, status: true } },
} as const

/** Veritabanından gelen satır; yalnızca panonun okuduğu alanlar. */
export interface PanoSatiri {
  id: string
  score: number | null
  stage: string
  stageChangedAt: Date | null
  note: string | null
  createdAt: Date
  jobPosting: { position: string; rawText: string }
  adaptation: { id: string; status: string } | null
}

/**
 * Pozisyon adı ilan çıkarımından geliyor; boşsa (eski kayıtlar, Sprint 1)
 * ilan metninin ilk dolu satırı kullanılıyor.
 */
export function pozisyonAdi(position: string, rawText: string): string {
  if (position.trim()) return position.trim()
  const ilk = rawText.split("\n").find((s) => s.trim())?.trim() ?? ""
  return ilk.length > 80 ? `${ilk.slice(0, 77)}…` : ilk || "İsimsiz ilan"
}

export function panoKarti(s: PanoSatiri): PanoKarti {
  return {
    analysisId: s.id,
    pozisyon: pozisyonAdi(s.jobPosting.position, s.jobPosting.rawText),
    skor: s.score === null ? null : Math.round(s.score),
    asama: gecerliAsama(s.stage) ? s.stage : "saved",
    asamaTarihi: s.stageChangedAt?.toISOString() ?? null,
    not: s.note,
    olusturulma: s.createdAt.toISOString(),
    uyarlama: s.adaptation ? { id: s.adaptation.id, durum: s.adaptation.status } : null,
  }
}

/** Kartları sütunlara dağıtır; her sütunda en son hareket eden üstte. */
export function sutunlaraDagit(kartlar: PanoKarti[]): Record<Asama, PanoKarti[]> {
  const sutunlar = Object.fromEntries(ASAMALAR.map((a) => [a, [] as PanoKarti[]])) as Record<
    Asama,
    PanoKarti[]
  >
  for (const k of kartlar) sutunlar[k.asama].push(k)
  const zaman = (k: PanoKarti) => Date.parse(k.asamaTarihi ?? k.olusturulma)
  for (const a of ASAMALAR) sutunlar[a].sort((x, y) => zaman(y) - zaman(x))
  return sutunlar
}
