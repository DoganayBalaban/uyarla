/**
 * Eski Türkçe JSON anahtarlarını yeni anahtarlara taşır (DOG-39):
 * Analysis.result.format ve Adaptation.coverLetter.
 *
 *   pnpm --filter @uyarla/web migrate:json-keys          deneme: neyin değişeceğini sayar
 *   pnpm --filter @uyarla/web migrate:json-keys --apply  yazar
 *
 * İkinci kez çalıştırmak güvenli; taşınmış kayıtlar atlanır.
 */
import { prisma } from "@uyarla/db"
import { upgradeCoverLetter, upgradeFormatReport } from "../lib/legacyJsonKeys"

const apply = process.argv.includes("--apply")

async function main() {
  let analyses = 0
  for (const a of await prisma.analysis.findMany({ select: { id: true, result: true } })) {
    const result = a.result as Record<string, unknown> | null
    if (!result || !("format" in result)) continue
    const { value, changed } = upgradeFormatReport(result.format)
    if (!changed) continue
    analyses++
    if (apply) {
      await prisma.analysis.update({ where: { id: a.id }, data: { result: { ...result, format: value } as object } })
    }
  }

  let letters = 0
  for (const ad of await prisma.adaptation.findMany({ select: { id: true, coverLetter: true } })) {
    const { value, changed } = upgradeCoverLetter(ad.coverLetter)
    if (!changed) continue
    letters++
    if (apply) await prisma.adaptation.update({ where: { id: ad.id }, data: { coverLetter: value as object } })
  }

  console.log(`${apply ? "taşındı" : "taşınacak (deneme)"}: ${analyses} analiz, ${letters} ön yazı`)
}

main().finally(() => prisma.$disconnect())
