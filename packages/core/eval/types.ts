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

/** Bir çiftin uyarlama ölçümü (spec §12). */
export interface AdaptMetrics {
  id: string
  bulletCount: number
  /** Doğrulamadan uyarıyla dönen madde sayısı. */
  flaggedCount: number
  /** Hangi kontrolün kaç kez devreye girdiği. */
  byKind: Record<string, number>
  scoreBefore: number
  /** Tüm yeniden yazımlar kabul edilmiş varsayımıyla: uyarlamanın üst sınırı. */
  scoreAfter: number
  /**
   * Yalnızca doğrulamayı geçen maddeler kabul edilmiş varsayımıyla.
   *
   * Ürünün gerçek vaadi bu. Üst sınır, kullanıcının reddedeceği uydurma
   * içerikten gelen kazancı da sayıyor — ilk koşuda bir çift 0'dan 33'e
   * çıkmıştı ama 8 maddenin 6'sı işaretliydi.
   */
  scoreAfterCleanOnly: number
  durationMs: number
  /** Yeniden yazımı patlayan madde sayısı (spec §13). */
  failedCount: number
  /** Modelin maddeyi hiç değiştirmediği durumlar; prompt zayıflığının işareti. */
  unchangedCount: number
}
