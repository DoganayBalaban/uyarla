import type { prisma } from "@uyarla/db"

/**
 * Prisma istemci tipi, @uyarla/db'nin dışa açtığı örnekten türetiliyor.
 *
 * @prisma/client doğrudan import edilmiyor: apps/web onu bağımlılık olarak
 * tutmuyor ve veritabanına her zaman @uyarla/db üzerinden gidiyor.
 */
type Db = typeof prisma

/** `$transaction`'a verilebilecek, sahipliği taşıyan işlemler. */
type Islem = ReturnType<Db["resume"]["updateMany"]>

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
export function devralmaIslemleri(
  prisma: Db,
  anonimId: string,
  yeniId: string,
): Islem[] {
  if (!anonimId || !yeniId) throw new Error("Devralma için iki kimlik de gerekli")
  // Kendine taşımak anlamsız ve bir hata işareti; sessizce geçmek yerine
  // hiçbir şey yapmıyoruz.
  if (anonimId === yeniId) return []

  const kosul = { where: { userId: anonimId }, data: { userId: yeniId } }
  return [
    prisma.resume.updateMany(kosul),
    prisma.analysis.updateMany(kosul),
    prisma.jobPosting.updateMany(kosul),
  ]
}
