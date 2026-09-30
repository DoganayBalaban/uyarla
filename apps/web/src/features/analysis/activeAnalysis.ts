/**
 * Süren analizin tarayıcıdaki kaydı.
 *
 * Analiz yerel modelde dakikalar sürebiliyor ve kullanıcı bu sırada başka
 * sayfalara geçiyor. Kayıt localStorage'da tutuluyor ki sayfa değişse,
 * yenilense, hatta ikinci sekme açılsa bile sağ alttaki bildirim analizi
 * izlemeye devam etsin ve bitince haber versin.
 *
 * Tek bir analiz izleniyor: yeni analiz eskisinin kaydının yerine geçer.
 */

export type ActiveAnalysisStatus = "running" | "completed" | "failed"

export interface ActiveAnalysis {
  jobId: string
  startedAt: number
  status: ActiveAnalysisStatus
  /** Son bildirilen aşama (reading_resume, reading_posting, comparing). */
  stage?: string
  analysisId?: string
  score?: number
  error?: string
  /** Kullanıcı sonucu gördü; bildirim artık gösterilmez. */
  seen?: boolean
}

const STORAGE_KEY = "uyarla:aktif-analiz"
/** Aynı sekmedeki dinleyiciler için; `storage` olayı yalnızca diğer sekmelerde tetiklenir. */
export const ACTIVE_ANALYSIS_EVENT = "uyarla:aktif-analiz"

export function readActiveAnalysis(): ActiveAnalysis | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as ActiveAnalysis
    return typeof record?.jobId === "string" ? record : null
  } catch {
    // Gizli pencere ya da engellenmiş depolama: bildirim çalışmaz, analiz
    // sayfası yine çalışır.
    return null
  }
}

function write(record: ActiveAnalysis | null): void {
  try {
    if (record) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // bkz. aktifAnaliziOku
  }
  window.dispatchEvent(new Event(ACTIVE_ANALYSIS_EVENT))
}

export function startActiveAnalysis(jobId: string): void {
  write({ jobId, startedAt: Date.now(), status: "running" })
}

/** Kaydı günceller; kayıt başka bir işe aitse dokunmaz. */
export function updateActiveAnalysis(jobId: string, change: Partial<ActiveAnalysis>): void {
  const record = readActiveAnalysis()
  if (!record || record.jobId !== jobId) return
  write({ ...record, ...change })
}

export function clearActiveAnalysis(): void {
  write(null)
}

/** Yoklama yanıtını kayda işler; analiz sayfası ve bildirim aynı kuralı kullanıyor. */
export function handleResponse(
  jobId: string,
  response: { status: string; stage?: string; analysisId?: string | null; score?: number | null; error?: string },
): void {
  if (response.status === "completed") {
    updateActiveAnalysis(jobId, {
      status: "completed",
      analysisId: response.analysisId ?? undefined,
      score: response.score ?? undefined,
    })
  } else if (response.status === "failed") {
    updateActiveAnalysis(jobId, { status: "failed", error: response.error })
  } else if (response.stage) {
    updateActiveAnalysis(jobId, { stage: response.stage })
  }
}

/** Kullanıcıya gösterilecek kısa aşama adı. */
export const STAGE_SHORT_LABEL: Record<string, string> = {
  reading_resume: "CV'ni okuyoruz",
  reading_posting: "İlanı okuyoruz",
  comparing: "İlanla karşılaştırıyoruz",
}

/** Sonucun kalıcı adresi (sayfa yenilense de açılır). */
export function resultPath(analysisId: string): string {
  return `/analyze?analiz=${encodeURIComponent(analysisId)}`
}
