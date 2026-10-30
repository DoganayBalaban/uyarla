import type { prisma } from "@uyarla/db"

/**
 * Prisma istemci tipi, @uyarla/db'nin dışa açtığı örnekten türetiliyor.
 *
 * @prisma/client doğrudan import edilmiyor: apps/web onu bağımlılık olarak
 * tutmuyor ve veritabanına her zaman @uyarla/db üzerinden gidiyor.
 */
type Db = typeof prisma

/** `$transaction`'a verilebilecek, sahipliği taşıyan işlemler. */
type Operation = ReturnType<Db["resume"]["updateMany"]>

/**
 * Anonim kullanıcının işini yeni hesaba taşıyan işlemleri üretir.
 *
 * İşlemler döndürülüyor, çalıştırılmıyor: çağıran hepsini tek `$transaction`
 * içinde koşturuyor. Yarısı taşınmış bir kullanıcı, hiç taşınmamış
 * kullanıcıdan daha kötü — skorunu görüyor ama CV'si yok.
 *
 * `where` koşulu bu dosyanın en kritik satırı: düşerse bütün kullanıcıların
 * verisi tek hesaba taşınır. Test bu yüzden koşulu birebir doğruluyor.
 */
export function claimOperations(
  prisma: Pick<Db, "resume" | "analysis" | "jobPosting">,
  anonymousId: string,
  freshId: string,
): Operation[] {
  if (!anonymousId || !freshId) throw new Error("Devralma için iki kimlik de gerekli")
  // Kendine taşımak anlamsız ve bir hata işareti; sessizce geçmek yerine
  // hiçbir şey yapmıyoruz.
  if (anonymousId === freshId) return []

  const condition = { where: { userId: anonymousId }, data: { userId: freshId } }
  return [
    prisma.resume.updateMany(condition),
    prisma.analysis.updateMany(condition),
    prisma.jobPosting.updateMany(condition),
  ]
}

/**
 * İşi taşır; yeni hesabın CV kütüphanesi boşsa analizdeki en yeni CV
 * kütüphaneye varsayılan olarak giriyor (DOG-166). Kayıtsız analizde CV
 * kütüphaneye yazılmıyor (anonim kullanıcının kütüphanesi yok); kayıttan
 * sonra CV'lerim boş kalıyor, kurulum aynı CV'yi yeniden istiyordu. Dolu
 * kütüphaneye dokunulmuyor: kullanıcı kendi seçtiğini düzenlemiş.
 */
export async function claimAnonymousData(db: Db, anonymousId: string, freshId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const claimed = await tx.resume.findFirst({
      where: { userId: anonymousId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    for (const operation of claimOperations(tx, anonymousId, freshId)) await operation
    if (!claimed || anonymousId === freshId) return
    // Kütüphane yazımları kullanıcı satırını kilitliyor (resumeLibrary.ts).
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${freshId} FOR UPDATE`
    const saved = await tx.resume.count({ where: { userId: freshId, savedAt: { not: null } } })
    if (saved > 0) return
    await tx.resume.update({ where: { id: claimed.id }, data: { savedAt: new Date(), isDefault: true } })
  })
}
