/**
 * Süren analizin tarayıcıdaki kaydı.
 *
 * Analiz yerel modelde dakikalar sürebiliyor ve kullanıcı bu sırada başka
 * sayfalara geçiyor. Kayıt localStorage'da tutuluyor ki sayfa değişse,
 * yenilense, hatta ikinci sekme açılsa bile sağ alttaki bildirim analizi
 * izlemeye devam etsin ve bitince haber versin. Kayıt bir zustand deposunda;
 * localStorage'a kalıcılık katmanı yazıyor.
 *
 * Tek bir analiz izleniyor: yeni analiz eskisinin kaydının yerine geçer.
 */

import { useEffect } from "react"
import { create } from "zustand"
import { persist, type PersistStorage } from "zustand/middleware"

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

const STORAGE_KEY = "uyarla:active-analysis"
const STORE_VERSION = 1

interface ActiveAnalysisState {
  record: ActiveAnalysis | null
}

/**
 * Refaktör 1 (DOG-39) öncesi anahtar, alan adları ve aşama değerleri. Süren
 * bir analiz güncelleme sırasında kaybolmasın diye eski kayıt ilk okumada
 * yeni anahtara taşınıyor; bozuksa yalnızca siliniyor.
 */
const LEGACY_KEY = "uyarla:aktif-analiz"
const LEGACY_FIELDS: Record<string, keyof ActiveAnalysis> = {
  baslangic: "startedAt",
  durum: "status",
  asama: "stage",
  skor: "score",
  hata: "error",
  goruldu: "seen",
}
const LEGACY_STAGES: Record<string, string> = {
  cv_okunuyor: "reading_resume",
  ilan_okunuyor: "reading_posting",
  karsilastiriliyor: "comparing",
  tamamlandi: "completed",
}

function upgradeLegacyRecord(storage: Storage): void {
  const raw = storage.getItem(LEGACY_KEY)
  if (raw === null) return
  storage.removeItem(LEGACY_KEY)
  try {
    const old = JSON.parse(raw) as Record<string, unknown>
    const record = Object.fromEntries(Object.entries(old).map(([k, v]) => [LEGACY_FIELDS[k] ?? k, v]))
    if (typeof record.stage === "string") record.stage = LEGACY_STAGES[record.stage] ?? record.stage
    storage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Bozuk eski kayıt: taşınacak bir şey yok.
  }
}

function asRecord(value: unknown): ActiveAnalysis | null {
  return typeof (value as ActiveAnalysis | null)?.jobId === "string" ? (value as ActiveAnalysis) : null
}

/**
 * zustand'ın kalıcılık katmanı için localStorage sarmalayıcısı. Gizli pencere
 * ya da engellenmiş depolamada hata yutuluyor: kayıt bellekte yaşıyor,
 * bildirim sekmeler arasında çalışmıyor ama analiz sayfası çalışıyor.
 *
 * DOG-40 öncesi kayıt `{ state, version }` sarmalayıcısı olmadan, düz nesne
 * olarak yazılıyordu; ikisi de okunuyor.
 */
const storage: PersistStorage<ActiveAnalysisState> = {
  getItem(name) {
    if (typeof window === "undefined") return null
    try {
      upgradeLegacyRecord(window.localStorage)
      const raw = window.localStorage.getItem(name)
      if (raw === null) return { state: { record: null }, version: STORE_VERSION }
      const parsed = JSON.parse(raw) as { state?: { record?: unknown } } | null
      const record = parsed && "state" in parsed ? parsed.state?.record : parsed
      return { state: { record: asRecord(record) }, version: STORE_VERSION }
    } catch {
      return null
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, JSON.stringify(value))
    } catch {
      // bkz. yukarıdaki açıklama
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name)
    } catch {
      // bkz. yukarıdaki açıklama
    }
  },
}

export const useActiveAnalysisStore = create<ActiveAnalysisState>()(
  persist((): ActiveAnalysisState => ({ record: null }), {
    name: STORAGE_KEY,
    version: STORE_VERSION,
    storage,
    // Sunucu çizimiyle ilk istemci çizimi aynı olsun diye kayıt ilk efektte
    // okunuyor (useActiveAnalysis); okunmadan önce sonucu boş.
    skipHydration: true,
  }),
)

/** Kaydı localStorage'dan yeniden okur; depolama eşzamanlı olduğu için hemen biter. */
export function rehydrateActiveAnalysis(): void {
  void useActiveAnalysisStore.persist.rehydrate()
}

export function readActiveAnalysis(): ActiveAnalysis | null {
  if (!useActiveAnalysisStore.persist.hasHydrated()) rehydrateActiveAnalysis()
  return useActiveAnalysisStore.getState().record
}

/**
 * Bileşenler için kayıt. Aynı sekmedeki değişiklikler depodan, diğer
 * sekmelerdekiler `storage` olayıyla geliyor.
 */
export function useActiveAnalysis(): ActiveAnalysis | null {
  const record = useActiveAnalysisStore((s) => s.record)
  useEffect(() => {
    rehydrateActiveAnalysis()
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) rehydrateActiveAnalysis()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])
  return record
}

function write(record: ActiveAnalysis | null): void {
  useActiveAnalysisStore.setState({ record })
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
