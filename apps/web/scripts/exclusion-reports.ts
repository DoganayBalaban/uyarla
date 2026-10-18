import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { prisma } from "@uyarla/db"
import { exclusionRecords } from "../src/server/exclusionData"

/**
 * DOG-90 işaret ve bildirimlerini değerlendirme setine aktarır: her satır bir
 * kullanıcı yargısı (ilan metni, gereksinim, kavramlar, neden). CV metni yok.
 *
 *   pnpm --filter @uyarla/web exclusion-reports
 *   pnpm --filter @uyarla/web exclusion-reports --out ../../packages/core/eval/reports/isaretler.jsonl
 */
const DEFAULT_OUT = "../../packages/core/eval/reports/isaretler.jsonl"

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const i = argv.indexOf("--out")
  const out = resolve(i === -1 ? DEFAULT_OUT : argv[i + 1]!)

  // JSON alanında "dizi boş değil" sorgusu Prisma'da yok; tamamlanan
  // analizleri sayfa sayfa okuyup süzüyoruz.
  const lines: string[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await prisma.analysis.findMany({
      where: { status: "done" },
      select: { id: true, createdAt: true, result: true, jobPosting: { select: { position: true, language: true, rawText: true } } },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (page.length === 0) break
    for (const a of page) for (const r of exclusionRecords(a)) lines.push(JSON.stringify(r))
    cursor = page.at(-1)!.id
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, lines.length ? `${lines.join("\n")}\n` : "")
  console.log(`[işaretler] ${lines.length} kayıt → ${out}`)
}

main()
  .catch((error: unknown) => {
    console.error("[işaretler] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
