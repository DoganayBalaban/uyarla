import type { prisma } from "@uyarla/db"
import { isSamplePosting } from "@/features/analysis/samplePostings"

type Db = typeof prisma

/**
 * Huni ölçümü (DOG-62).
 *
 * Ayrı bir olay izleme yok: dört adımın hepsi veritabanında zaten kayıtlı.
 * Üçüncü taraf bir işleyen eklenmiyor (KVKK) ve rapor geriye dönük çalışıyor.
 *
 *   analiz   → o dönemde en az bir analizi tamamlanan kullanıcı
 *   kayıt    → bu kullanıcılardan hesabı anonim olmayanlar
 *   uyarlama → analizlerinden en az birini uyarlayanlar
 *   indirme  → uyarlanmış CV'yi en az bir kez indirenler
 *
 * Sıra ürünün akışı: uyarlama kayıt istiyor, indirme uyarlamadan sonra
 * geliyor. Kayıt olan ziyaretçinin anonim analizleri hesabına taşındığı
 * için (`devral`) kullanıcı bazında saymak doğru sonucu veriyor.
 */
export interface FunnelAnalysisRow {
  userId: string
  status: "running" | "done" | "failed"
  durationMs: number | null
  isAnonymous: boolean
  adapted: boolean
  /** Uyarlanmış CV indirildiğinde `Adaptation.resumeVersionId` doluyor. */
  downloaded: boolean
  /** Düzenlenmeden gönderilen örnek ilan (DOG-101). */
  sample?: boolean
}

export type FunnelStepKey = "analyzed" | "registered" | "adapted" | "downloaded"

export interface FunnelStep {
  key: FunnelStepKey
  users: number
  /** Önceki adımdan bu adıma geçen oran; ilk adımda null. */
  fromPrevious: number | null
}

export interface FunnelSummary {
  steps: FunnelStep[]
  analyses: { total: number; done: number; failed: number; failureRate: number; sample: number }
  medianDurationMs: number | null
}

export function summarizeFunnel(rows: FunnelAnalysisRow[]): FunnelSummary {
  const users = new Map<string, { registered: boolean; adapted: boolean; downloaded: boolean }>()
  for (const r of rows) {
    if (r.status !== "done") continue
    const u = users.get(r.userId) ?? { registered: false, adapted: false, downloaded: false }
    u.registered ||= !r.isAnonymous
    u.adapted ||= r.adapted
    u.downloaded ||= r.downloaded
    users.set(r.userId, u)
  }
  const all = [...users.values()]
  // Her adım önceki adımları da geçmiş kişileri sayıyor: huni tekdüze azalıyor.
  const registered = all.filter((u) => u.registered)
  const adapted = registered.filter((u) => u.adapted)
  const counts: Record<FunnelStepKey, number> = {
    analyzed: all.length,
    registered: registered.length,
    adapted: adapted.length,
    downloaded: adapted.filter((u) => u.downloaded).length,
  }
  const order: FunnelStepKey[] = ["analyzed", "registered", "adapted", "downloaded"]
  const steps = order.map((key, i) => {
    const previous = i === 0 ? null : counts[order[i - 1]!]
    return {
      key,
      users: counts[key],
      fromPrevious: previous === null ? null : previous === 0 ? 0 : counts[key] / previous,
    }
  })

  const done = rows.filter((r) => r.status === "done").length
  const failed = rows.filter((r) => r.status === "failed").length
  const durations = rows
    .filter((r) => r.status === "done" && r.durationMs !== null)
    .map((r) => r.durationMs!)
    .sort((a, b) => a - b)

  return {
    steps,
    analyses: {
      total: rows.length,
      done,
      failed,
      // Sürmekte olanlar orana girmiyor: henüz başarılı da başarısız da değiller.
      failureRate: done + failed === 0 ? 0 : failed / (done + failed),
      // Örnek ilanla tamamlanan analiz: ilk denemenin engelini kaldırıyor mu?
      sample: rows.filter((r) => r.status === "done" && r.sample).length,
    },
    medianDurationMs: durations.length ? durations[Math.floor((durations.length - 1) / 2)]! : null,
  }
}

/** [from, to) aralığında başlayan analizlerden huni. */
export async function computeFunnel(db: Db, { from, to }: { from: Date; to: Date }): Promise<FunnelSummary> {
  const analyses = await db.analysis.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: {
      userId: true,
      status: true,
      durationMs: true,
      user: { select: { isAnonymous: true } },
      adaptation: { select: { resumeVersionId: true } },
      jobPosting: { select: { rawText: true } },
    },
  })
  return summarizeFunnel(
    analyses.map((a) => ({
      userId: a.userId,
      status: a.status,
      durationMs: a.durationMs,
      // Alan şemada nullable (K-34); yalnızca açık `true` anonim sayılıyor.
      isAnonymous: a.user.isAnonymous === true,
      adapted: a.adaptation !== null,
      downloaded: a.adaptation?.resumeVersionId != null,
      sample: isSamplePosting(a.jobPosting.rawText),
    })),
  )
}

// Yönetici kontrolü uyarlama ucunda da kullanılıyor (sınırsız hak); orada
// huni kodunu çekmemek için bağımlılıksız ayrı modülde (server/admin.ts).
export { isAdmin } from "@/server/admin"
