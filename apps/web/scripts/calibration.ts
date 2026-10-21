import { prisma } from "@uyarla/db"
import { outcomesByBand } from "../src/features/applications/outcomes"
import type { Stage } from "../src/features/applications/board"

/**
 * Uyum skoru mülakatı öngörüyor mu (DOG-124): skor bandına göre mülakata
 * dönüş oranı. Salt okunur; yalnızca toplamlar yazılıyor. Anonim hesaplar ve
 * test alan adları (ornek.com, example.com) dışarıda.
 *
 *   pnpm --filter @uyarla/web calibration
 *
 * Eşikleri değiştirmek için yeterli veri yoksa oran gösterilmiyor: bantta en
 * az MIN_RESOLVED sonuçlanan başvuru olmalı.
 */
const MIN_RESOLVED = 10

async function main(): Promise<void> {
  const rows = await prisma.analysis.findMany({
    where: {
      status: "done",
      score: { not: null },
      stage: { not: "saved" },
      user: { isAnonymous: false, NOT: [{ email: { endsWith: "@ornek.com" } }, { email: { endsWith: "@example.com" } }] },
    },
    select: { score: true, stage: true, userId: true },
  })
  const users = new Set(rows.map((r) => r.userId)).size
  console.log(`[kalibrasyon] ${rows.length} başvuru · ${users} kullanıcı`)
  for (const b of outcomesByBand(rows.map((r) => ({ score: r.score, stage: r.stage as Stage })))) {
    const rate = b.resolved >= MIN_RESOLVED ? `%${Math.round((b.positive / b.resolved) * 100)}` : `az (<${MIN_RESOLVED})`
    console.log(`  ${b.label.padEnd(12)} sonuçlanan ${String(b.resolved).padStart(3)} · mülakat/teklif ${String(b.positive).padStart(3)} · bekleyen ${String(b.waiting).padStart(3)} · oran ${rate}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error("[kalibrasyon] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
