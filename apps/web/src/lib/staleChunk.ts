/**
 * Dağıtımdan sonra bayat sayfa parçası (DOG-140). Açık kalan bir sekme yeni
 * bir sayfaya geçerken eski dağıtımın kod parçasını istiyor; parça artık
 * sunucuda yok. Sayfa bir kez yeniden yükleniyor; ikinci kez olursa döngüye
 * girmeden normal hata sayfası görünüyor.
 *
 * Jobscan'in yönlendirici kancasındaki çözümün karşılığı (rakip analizi 2).
 */
const PATTERNS = [
  /Loading chunk [\w/.-]+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
]

const KEY = "uyarla:bayat-parca"
/** Bu süre içinde ikinci yeniden yükleme yok. */
const WINDOW_MS = 60_000

export function isStaleChunkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return typeof error === "string" && PATTERNS.some((p) => p.test(error))
  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === "ChunkLoadError") return true
  return typeof message === "string" && PATTERNS.some((p) => p.test(message))
}

interface ReloadDeps {
  storage: Pick<Storage, "getItem" | "setItem"> | null
  reload: () => void
  now: () => number
}

/**
 * Son bir dakikada denenmediyse sayfayı yeniden yükler ve true döner. Tarayıcı
 * deposu yoksa (gizli pencere, engel) döngü riskine girmeden false.
 */
export function reloadOnce(deps: ReloadDeps = browserDeps()): boolean {
  if (!deps.storage) return false
  try {
    const last = Number(deps.storage.getItem(KEY) ?? 0)
    if (deps.now() - last < WINDOW_MS) return false
    deps.storage.setItem(KEY, String(deps.now()))
  } catch {
    return false
  }
  deps.reload()
  return true
}

function browserDeps(): ReloadDeps {
  let storage: ReloadDeps["storage"] = null
  try {
    storage = window.sessionStorage
  } catch {
    storage = null
  }
  return { storage, reload: () => window.location.reload(), now: () => Date.now() }
}

/** Hata sınırları için: bayat parçaysa yeniden yükler ve true döner. */
export function recoverFromStaleChunk(error: unknown): boolean {
  return isStaleChunkError(error) && reloadOnce()
}
