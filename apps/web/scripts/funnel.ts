import { prisma } from "@uyarla/db"
import { computeFunnel } from "../src/server/funnel"

/**
 * Huni raporu (DOG-62); /admin sayfasıyla aynı hesap.
 *
 *   pnpm --filter @uyarla/web funnel            # son 7 gün
 *   pnpm --filter @uyarla/web funnel --days 30
 */
const LABEL = { analyzed: "Analiz", registered: "Kayıt", adapted: "Uyarlama", downloaded: "İndirme" } as const

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const i = argv.indexOf("--days")
  const days = i === -1 ? 7 : Number(argv[i + 1])
  if (!Number.isFinite(days) || days <= 0) {
    console.error("--days pozitif bir sayı olmalı")
    process.exitCode = 1
    return
  }
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const f = await computeFunnel(prisma, { from, to })

  console.log(`[huni] son ${days} gün`)
  for (const s of f.steps) {
    const rate = s.fromPrevious === null ? "" : `  (%${Math.round(s.fromPrevious * 100)})`
    console.log(`  ${LABEL[s.key].padEnd(9)} ${String(s.users).padStart(5)}${rate}`)
  }
  const median = f.medianDurationMs === null ? "—" : `${(f.medianDurationMs / 1000).toFixed(1)} sn`
  console.log(
    `  ${f.analyses.total} analiz · ${f.analyses.failed} başarısız ` +
      `(%${Math.round(f.analyses.failureRate * 100)}) · medyan ${median}`,
  )
}

main()
  .catch((error: unknown) => {
    console.error("[huni] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
