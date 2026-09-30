import type { prisma } from "@uyarla/db"
import { deleteUsers as deleteUsers, type DeletionResult as DeletionResult } from "./deleteAccount"

/** Prisma istemci tipi; devral.ts ve silme.ts ile aynı gerekçe. */
type Db = typeof prisma

/**
 * Anonim kaydın diskte kalabileceği süre.
 *
 * BU DEĞER ÖLÇÜLMEDİ, TAHMİN. Hız limiti değerlerinde olduğu gibi (spec §9)
 * yapılandırmada duruyor ve gerçek rakam kullanım verisiyle ayarlanacak:
 * kayıt olan ziyaretçilerin ilk analizden kaç gün sonra döndüğü verisi
 * biriktiğinde ölçülebilir.
 *
 * Tahminin iki yanındaki gerekçe: KVKK açısından kullanılmayan bir CV'nin
 * süresiz saklanması savunulabilir değil (üst sınır), ama ziyaretçi bir ay
 * içinde dönüp kayıt olabilir ve devralma o kaydın durmasına bağlı (alt
 * sınır). 30 gün ikisinin arasında seçilmiş bir sayı, ölçülmüş bir eşik
 * değil.
 */
export const RETENTION_DAYS = 30

/** Bu tarihten ESKİ anonim kayıtlar siliniyor. */
export function cutoffDate(nowDate: Date, dayCount: number = RETENTION_DAYS): Date {
  // 0 ya da negatif gün "az önce gelen ziyaretçiyi de sil" demek: elini tam o
  // anda CV'sinin üzerinde olan kullanıcının verisini siler. Sessizce geçmek
  // yerine duruyoruz.
  if (!Number.isFinite(dayCount) || dayCount <= 0) {
    throw new Error("Temizlik için gün sayısı pozitif olmalı")
  }
  return new Date(nowDate.getTime() - dayCount * 24 * 60 * 60 * 1000)
}

export interface AnonymousWhere {
  isAnonymous: true
  createdAt: { lt: Date }
}

/**
 * Silinecek anonim kullanıcıların koşulu.
 *
 * Saf fonksiyon ve ayrı duruyor çünkü bu dosyanın tüm riski burada: iki
 * koşuldan biri düşerse kayıtlı kullanıcıların ya da dünkü ziyaretçilerin
 * verisi silinir. Test koşulu birebir doğruluyor.
 *
 * `isAnonymous: true` tam eşitlik. Alan şemada nullable (`Boolean?`, K-34) ve
 * `not: false` yazılsaydı NULL taşıyan kayıtlı kullanıcılar da eşleşirdi.
 *
 * `lt`, `lte` değil: sınırda duran kaydı bırakıyoruz. Geri alınamaz bir
 * işlemde eşitlik hâlinde silmemek doğru taraf.
 */
export function staleAnonymousWhere(nowDate: Date, dayCount: number = RETENTION_DAYS): AnonymousWhere {
  return { isAnonymous: true, createdAt: { lt: cutoffDate(nowDate, dayCount) } }
}

export interface CleanupResult extends DeletionResult {
  /** Silinmeye aday bulunan kullanıcı sayısı. */
  found: number
  /** Bu tarihten eski kayıtlar silindi. */
  cutoff: Date
}

export interface CleanupOptions {
  now?: Date
  days?: number
  /** Kuru çalıştırma: bulur, sayar, hiçbir şey silmez. */
  dryRun?: boolean
}

/**
 * 30 günden eski anonim kullanıcıları ve tüm verisini siler.
 *
 * Kayıt olanların anonim kaydı `onLinkAccount` sonrasında zaten siliniyor
 * (bkz. `devral.ts`); burada kalanlar kayıt olmadan giden ziyaretçiler.
 *
 * Silme işini kendisi yapmıyor, `kullanicilariSil`'e devrediyor: hesap silme
 * akışıyla (#14) aynı kod. İki kopya tutmak, biri düzeltilip öteki
 * unutulduğunda veri sızdırırdı.
 *
 * `deneme` kipi geri alınamaz bir iş için pazarlık değil zorunluluk: cron'a
 * bağlanmadan önce neyin silineceği görülebilmeli.
 */
export async function cleanupAnonymousUsers(
  prisma: Db,
  { now: nowDate = new Date(), days: dayCount = RETENTION_DAYS, dryRun: dryRun = false }: CleanupOptions = {},
): Promise<CleanupResult> {
  const condition = staleAnonymousWhere(nowDate, dayCount)

  const candidates = await prisma.user.findMany({ where: condition, select: { id: true } })
  const ids = candidates.map((k) => k.id)

  if (dryRun || ids.length === 0) {
    return {
      found: ids.length,
      cutoff: condition.createdAt.lt,
      deletedUsers: 0,
      files: { deleted: 0, skipped: [] },
    }
  }

  const result = await deleteUsers(prisma, ids)
  return { found: ids.length, cutoff: condition.createdAt.lt, ...result }
}
