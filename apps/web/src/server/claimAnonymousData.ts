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
  prisma: Db,
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
