import { prisma } from "@uyarla/db"
import { backfillScore } from "../src/server/exclusionData"

/**
 * K-67'den önce "ilanda yok" işareti konmuş analizlerin pano skorunu
 * (Analysis.score) düzeltir (DOG-90). Varsayılan yalnızca rapor; --apply yazar.
 *
 *   pnpm --filter @uyarla/web backfill:excluded
 *   pnpm --filter @uyarla/web backfill:excluded --apply
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply")
  const changes: Array<{ id: string; from: number; to: number }> = []
  let cursor: string | undefined
  for (;;) {
    const page = await prisma.analysis.findMany({
      where: { status: "done" },
      select: { id: true, score: true, result: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (page.length === 0) break
    for (const a of page) {
      const to = backfillScore(a)
      if (to !== null) changes.push({ id: a.id, from: a.score!, to })
    }
    cursor = page.at(-1)!.id
  }

  for (const c of changes) console.log(`  ${c.id}  ${c.from} → ${c.to}`)
  if (apply) {
    for (const c of changes) await prisma.analysis.update({ where: { id: c.id }, data: { score: c.to } })
    console.log(`[geri doldurma] ${changes.length} analiz güncellendi`)
  } else {
    console.log(`[geri doldurma] ${changes.length} analiz düzeltilecek; yazmak için --apply`)
  }
}

main()
  .catch((error: unknown) => {
    console.error("[geri doldurma] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
