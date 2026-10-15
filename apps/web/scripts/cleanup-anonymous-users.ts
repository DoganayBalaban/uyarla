import { prisma } from "@uyarla/db"
import {
  RETENTION_DAYS,
  cleanupAnonymousUsers,
  cleanupExpiredVerifications,
} from "../src/server/cleanupAnonymousUsers"

/**
 * Anonim kullanıcı temizlik betiği. Süresi geçmiş doğrulama satırlarını da
 * topluyor (DOG-33): ikisi aynı zamanlanmış göreve bağlanacak.
 *
 * Mantık `src/server/cleanupAnonymousUsers.ts`'te test edilebilir duruyor,
 * burada yalnızca çağrılıyor.
 *
 * Üretimde Railway'deki ayrı bir cron servisi her gün çalıştırıyor (DOG-25):
 * `pnpm --filter @uyarla/web cleanup:cron`. Worker'da değil, çünkü worker
 * kimlik ve kullanıcı verisi bilmiyor (spec §4); Vercel Cron'da değil, çünkü
 * silme fonksiyon süresine bağlı kalır ve Hobby planının 12 fonksiyon sınırı
 * dolu. Ortam değişkenleri servisin kendisinde (.env yok).
 *
 *   pnpm --filter @uyarla/web cleanup:anonymous            # dener, hiçbir şey silmez
 *   pnpm --filter @uyarla/web cleanup:anonymous --delete      # gerçekten siler
 *   pnpm --filter @uyarla/web cleanup:anonymous --delete --days 60
 *   pnpm --filter @uyarla/web cleanup:cron             # üretim: siler, .env okumaz
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
  const verifications = await cleanupExpiredVerifications(prisma, { dryRun: !shouldDelete })

  const cutoffDay = result.cutoff.toISOString().slice(0, 10)
  if (!shouldDelete) {
    console.log(
      `[temizlik] DENEME · ${cutoffDay} tarihinden eski ${result.found} anonim kullanıcı, ` +
        `süresi geçmiş ${verifications.found} doğrulama satırı bulundu.`,
    )
    console.log("[temizlik] Silmek için --delete ekle.")
    return
  }

  console.log(
    `[temizlik] ${cutoffDay} tarihinden eski ${result.deletedUsers} anonim kullanıcı silindi ` +
      `(${result.files.deleted} CV dosyası), süresi geçmiş ${verifications.deleted} doğrulama satırı silindi.`,
  )
  // Atlanan yol bir veri bütünlüğü işareti: depo dizini değişmiş ya da satır
  // bozuk olabilir. Sessizce geçmek, diskte kişisel veri bırakmak olurdu.
  if (result.files.skipped.length > 0) {
    console.warn(
      `[temizlik] ${result.files.skipped.length} dosya depoya ait olmadığı için atlandı:`,
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
