import { join, resolve } from "node:path"

/**
 * Çıkarım önbelleğinin dizini. Öntanımlı `eval/cache/`; modelleri
 * karşılaştırırken her model kendi dizininde çalışsın diye `EVAL_CACHE` ile
 * değiştirilebiliyor (ör. `eval/cache/modeller/qwen3.5-9b`). Aksi hâlde
 * `--refresh` bir modelin taban çizgisini ötekinin çıktısıyla ezer.
 */
export function onbellekDizini(kok: string): string {
  return process.env.EVAL_CACHE ? resolve(process.env.EVAL_CACHE) : join(kok, "cache")
}

export interface ExpectedRequirement {
  /** Gereksinimi tanımak için ilandaki metinden ayırt edici bir parça. */
  match: string
  /** Bu gereksinim CV'de karşılanmış sayılmalı mı? */
  shouldMatch: boolean
  /** Karşılanıyorsa kanıt olarak beklenen CV maddesinden ayırt edici bir parça. */
  evidenceContains?: string
}

export interface EvalPair {
  id: string
  /** sources/cv altındaki dosya adı. */
  cv: string
  /** sources/ilan altındaki dosya adı. */
  ilan: string
  /** Bu çiftin neyi sınadığı ve verinin nereden geldiği. */
  note: string
  expectations: ExpectedRequirement[]
}

export interface PairMetrics {
  id: string
  /** Doğru sınıflandırılan gereksinim sayısı. */
  hits: number
  /** CV'de kanıt var, sistem missing dedi. */
  misses: number
  /** CV'de kanıt yok, sistem matched dedi. Uydurma — en zararlısı. */
  fabrications: number
  /** Beklentide tanımlı ama ilan çıkarımında hiç üretilmemiş gereksinimler. */
  notExtracted: number
  score: number
  durationMs: number
  /** Eşleşmelerin hangi aşamadan geldiği; anlamsal katmanın katkısını gösterir. */
  byKeyword: number
  bySemantic: number
}

export interface EvalTotals {
  hits: number
  misses: number
  fabrications: number
  notExtracted: number
  byKeyword: number
  bySemantic: number
}

/** Bir çiftin uyarlama ölçümü (spec §12, K-38). */
export interface AdaptMetrics {
  id: string
  bulletCount: number
  /** CV ile ilan aynı dilde mi; değilse maddelere terim hedefi verilmiyor (K-39). */
  sameLanguage: boolean
  /** Modele hedefle gönderilen madde sayısı. */
  rewrittenCount: number
  /** Kullanıcıya onay için önerilen madde sayısı. */
  proposedCount: number
  /** Yazılıp atılan maddeler, nedene göre (adapt/draft.ts). */
  discarded: Record<string, number>
  /** Özet yazımı kabul edildi mi. */
  summaryAccepted: boolean
  /** Maddelerden beceri listesine eklenen terimler. */
  addedSkills: string[]
  /** Atılan yazımlar: özgün metin, yazım ve atan kuralın gerekçesi. */
  discards: Array<{
    id: string
    reason: string
    detail: string
    original: string
    rewritten: string
  }>
  scoreBefore: number
  /** Yalnızca önerilen maddeler onaylanmış varsayımıyla. */
  scoreBullets: number
  /** Önerilen maddeler, özet ve eklenen beceriler: kullanıcının göreceği sonuç. */
  scoreFull: number
  durationMs: number
}
