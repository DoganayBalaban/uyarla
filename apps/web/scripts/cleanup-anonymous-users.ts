import { prisma } from "@uyarla/db"
import { RETENTION_DAYS, cleanupAnonymousUsers } from "../src/server/cleanupAnonymousUsers"

/**
 * Anonim kullanıcı temizlik betiği.
 *
 * Zamanlanmış görev altyapısı yok (K-02: worker ayrı bir sunucuda, Vercel'in
 * fonksiyonları sürekli çalışamıyor). Bu yüzden mantık `src/server/cleanupAnonymousUsers.ts`'te
 * test edilebilir duruyor ve burada yalnızca çağrılıyor — cron'a bağlamak
 * dağıtım kararına bağlı bir satır.
 *
 *   pnpm --filter @uyarla/web cleanup:anonymous            # dener, hiçbir şey silmez
 *   pnpm --filter @uyarla/web cleanup:anonymous --delete      # gerçekten siler
 *   pnpm --filter @uyarla/web cleanup:anonymous --delete --days 60
 *
 * Öntanımlı DENEME kipinde: geri alınamaz bir işi çalıştırmak açık bir
 * bayrak istemeli. Yanlışlıkla çalıştırılan bir betik, hiç yazılmamış bir
 * betikten kötü.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const shouldDelete = argv.includes("--delete")

  const daysIndex = argv.indexOf("--days")
  const days = daysIndex === -1 ? RETENTION_DAYS : Number(argv[daysIndex + 1])
  if (!Number.isFinite(days) || days <= 0) {
    console.error("--days pozitif bir sayı olmalı")
    process.exitCode = 1
    return
  }

  const result = await cleanupAnonymousUsers(prisma, { days, dryRun: !shouldDelete })

  const cutoffDay = result.cutoff.toISOString().slice(0, 10)
  if (!shouldDelete) {
    console.log(
      `[temizlik] DENEME · ${cutoffDay} tarihinden eski ${result.found} anonim kullanıcı bulundu.`,
    )
    console.log("[temizlik] Silmek için --delete ekle.")
    return
  }

  console.log(
    `[temizlik] ${cutoffDay} tarihinden eski ${result.deletedUsers} anonim kullanıcı silindi ` +
      `(${result.files.deleted} CV dosyası).`,
  )
  // Atlanan yol bir veri bütünlüğü işareti: depo dizini değişmiş ya da satır
  // bozuk olabilir. Sessizce geçmek, diskte kişisel veri bırakmak olurdu.
  if (result.files.skipped.length > 0) {
    console.warn(
      `[temizlik] ${result.files.skipped.length} dosya depo dizini dışında olduğu için atlandı:`,
      result.files.skipped,
    )
  }
}

main()
  .catch((error: unknown) => {
    console.error("[temizlik] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
