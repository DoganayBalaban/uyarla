import { prisma } from "@uyarla/db"
import { TEMIZLIK_GUN, temizlikYap } from "../src/lib/temizlik"

/**
 * Anonim kullanıcı temizlik betiği.
 *
 * Zamanlanmış görev altyapısı yok (K-02: worker ayrı bir sunucuda, Vercel'in
 * fonksiyonları sürekli çalışamıyor). Bu yüzden mantık `lib/temizlik.ts`'te
 * test edilebilir duruyor ve burada yalnızca çağrılıyor — cron'a bağlamak
 * dağıtım kararına bağlı bir satır.
 *
 *   pnpm --filter @uyarla/web temizlik            # dener, hiçbir şey silmez
 *   pnpm --filter @uyarla/web temizlik --sil      # gerçekten siler
 *   pnpm --filter @uyarla/web temizlik --sil --gun 60
 *
 * Öntanımlı DENEME kipinde: geri alınamaz bir işi çalıştırmak açık bir
 * bayrak istemeli. Yanlışlıkla çalıştırılan bir betik, hiç yazılmamış bir
 * betikten kötü.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const sil = argv.includes("--sil")

  const gunIndex = argv.indexOf("--gun")
  const gun = gunIndex === -1 ? TEMIZLIK_GUN : Number(argv[gunIndex + 1])
  if (!Number.isFinite(gun) || gun <= 0) {
    console.error("--gun pozitif bir sayı olmalı")
    process.exitCode = 1
    return
  }

  const sonuc = await temizlikYap(prisma, { gun, deneme: !sil })

  const kesim = sonuc.kesim.toISOString().slice(0, 10)
  if (!sil) {
    console.log(
      `[temizlik] DENEME · ${kesim} tarihinden eski ${sonuc.bulunan} anonim kullanıcı bulundu.`,
    )
    console.log("[temizlik] Silmek için --sil ekle.")
    return
  }

  console.log(
    `[temizlik] ${kesim} tarihinden eski ${sonuc.kullanici} anonim kullanıcı silindi ` +
      `(${sonuc.dosya.silinen} CV dosyası).`,
  )
  // Atlanan yol bir veri bütünlüğü işareti: depo dizini değişmiş ya da satır
  // bozuk olabilir. Sessizce geçmek, diskte kişisel veri bırakmak olurdu.
  if (sonuc.dosya.atlanan.length > 0) {
    console.warn(
      `[temizlik] ${sonuc.dosya.atlanan.length} dosya depo dizini dışında olduğu için atlandı:`,
      sonuc.dosya.atlanan,
    )
  }
}

main()
  .catch((error: unknown) => {
    console.error("[temizlik] başarısız:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
