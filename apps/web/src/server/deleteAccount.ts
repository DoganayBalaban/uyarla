import { fileStoreFromEnv, type FileStore } from "@uyarla/core"
import type { prisma } from "@uyarla/db"

/**
 * Prisma istemci tipi, @uyarla/db'nin dışa açtığı örnekten türetiliyor.
 *
 * @prisma/client doğrudan import edilmiyor: apps/web onu bağımlılık olarak
 * tutmuyor ve veritabanına her zaman @uyarla/db üzerinden gidiyor
 * (devral.ts ile aynı gerekçe).
 */
type Db = typeof prisma

/** `$transaction`'a verilebilecek silme işlemleri. */
type Operation = ReturnType<Db["resume"]["deleteMany"]>

/**
 * Silme sırası. Yabancı anahtarlar çocukları önce istiyor ve sıra
 * DOKÜMANTASYON DEĞİL, çalıştırılan gerçek sıra — bu diziden üretiliyor.
 *
 * Neden bu sıra:
 *   adaptation     → analysis'e ve resumeVersion'a bakıyor
 *   analysis       → resumeVersion'a ve jobPosting'e bakıyor
 *   resumeVersion  → resume'a bakıyor
 *   resume         → user'a bakıyor
 *   jobPosting     → user'a bakıyor (analysis'ten SONRA gelmeli)
 *   session, account → user'a bakıyor
 *   user           → en son
 *
 * `session` ve `account` şemada `onDelete: Cascade` taşıyor, yani `user`
 * silinince kendiliğinden giderler. Yine de açıkça siliniyorlar: geri
 * alınamaz bir işlemin kapsamı, şemadaki bir niteliğin ileride değişmesine
 * bağlı kalmasın.
 *
 * Ölçülen davranış: `Analysis.resumeVersionId` ve `Adaptation.resumeVersionId`
 * yabancı anahtarları `ON DELETE SET NULL` taşıyor (nullable oldukları için
 * Prisma'nın öntanımlısı). Yani bir kullanıcının CV sürümü silinirken, ona
 * bağlı BAŞKA bir satır varsa o satır silinmez, alanı NULL olur. Uygulama
 * akışında çapraz kullanıcı bağı kurulamıyor — sürüm hep CV'nin sahibine
 * ait — ama sıraya bir tablo eklenirken bu varsayım yeniden sınanmalı.
 */
export const DELETION_ORDER = [
  "adaptation",
  "analysis",
  "resumeVersion",
  "resume",
  "jobPosting",
  "session",
  "account",
  "user",
] as const

type TableName = (typeof DELETION_ORDER)[number]

/**
 * Her tablonun kullanıcıya nasıl bağlandığı. Tek yerde duruyor ki bir tabloyu
 * eklerken koşulunu yazmayı atlamak mümkün olmasın.
 */
function condition(tablo: TableName, ids: string[]): { where: object } {
  switch (tablo) {
    // Adaptation'da userId yok: analysisId benzersiz ve sahiplik analizden
    // okunuyor (K-35).
    case "adaptation":
      return { where: { analysis: { userId: { in: ids } } } }
    // ResumeVersion'da da yok: sahiplik CV'den geliyor.
    case "resumeVersion":
      return { where: { resume: { userId: { in: ids } } } }
    case "user":
      return { where: { id: { in: ids } } }
    default:
      return { where: { userId: { in: ids } } }
  }
}

/**
 * Bir ya da birden çok kullanıcının TÜM verisini kaldıran işlemleri üretir.
 *
 * İşlemler döndürülüyor, çalıştırılmıyor: çağıran hepsini tek `$transaction`
 * içinde koşturmak zorunda. Yarısı silinmiş bir hesap, hiç silinmemişten
 * kötü — CV'si gitmiş ama analizleri duruyor bir kullanıcı ne silinmiş ne
 * duruyor sayılır.
 *
 * Hem hesap silme akışı (#14) hem anonim temizlik işi (#13) buradan geçiyor;
 * iki kopya tutmak, biri düzeltilip öteki unutulduğunda veri sızdırırdı.
 */
export function deletionOperations(prisma: Db, userIds: string[]): Operation[] {
  if (userIds.some((id) => !id)) {
    throw new Error("Silme için boş kimlik verilemez")
  }

  const ids = [...new Set(userIds)]
  // Boş listede erken çıkış: `{ in: [] }` Prisma'da hiçbir satırı tutmasa da,
  // silen bir sorguyu hiç kurmamak daha güvenli.
  if (ids.length === 0) return []

  const client = prisma as unknown as Record<TableName, { deleteMany(args: { where: object }): Operation }>
  return DELETION_ORDER.map((tablo) => client[tablo].deleteMany(condition(tablo, ids)))
}

export interface FileDeletionResult {
  deleted: number
  /** Depoya ait olmadığı için dokunulmayan başvurular. */
  skipped: string[]
}

/**
 * Verilen dosyaları depodan siler.
 *
 * `Resume.filePath` veritabanından geliyor; depo, kendine ait olmayan bir
 * başvuruya dokunmuyor (yerel diskte depo dizini dışı, S3'te başka bucket ya
 * da önek). Eksik dosya hata değil: hesap silme bu yüzden başarısız olmamalı.
 */
export async function deleteFiles(paths: string[], store: FileStore): Promise<FileDeletionResult> {
  const result: FileDeletionResult = { deleted: 0, skipped: [] }
  for (const path of paths) {
    if (await store.delete(path)) result.deleted += 1
    else result.skipped.push(path)
  }
  return result
}

export interface DeletionResult {
  /** Gerçekten silinen kullanıcı sayısı. */
  deletedUsers: number
  files: FileDeletionResult
}

/**
 * Kullanıcıları ve tüm verisini siler.
 *
 * Sıra bilinçli ve tersine çevrilemez:
 *
 *   1. Dosya yolları OKUNUR — kayıtlar gidince yolu bulmanın yolu kalmıyor.
 *   2. Veritabanı TEK işlemde silinir — yarısı silinmiş hesap olmasın.
 *   3. Dosyalar depodan silinir — işlem DIŞINDA ve SONRA.
 *
 * Üçüncü adımın işlem dışında olması bir uzlaşma: dosya silinip işlem geri
 * alınırsa kayıt dosyasız kalır (kullanıcı CV'sini göremez ama kaydı var).
 * Tersi durumda ise diskte sahipsiz bir dosya kalır — temizlik işiyle
 * toplanabilir, kullanıcıya hiçbir şey kırılmaz. İkisinden ikincisi zararsız.
 */
export async function deleteUsers(
  prisma: Db,
  userIds: string[],
  store: FileStore = fileStoreFromEnv(),
): Promise<DeletionResult> {
  const ids = [...new Set(userIds.filter((id) => id))]
  if (ids.length === 0) return { deletedUsers: 0, files: { deleted: 0, skipped: [] } }

  const resumes = await prisma.resume.findMany({
    where: { userId: { in: ids } },
    select: { filePath: true },
  })

  const results = await prisma.$transaction(deletionOperations(prisma, ids))
  // Son işlem `user` silme; silinen hesap sayısı orada.
  const dbUser = results[results.length - 1]?.count ?? 0

  const storedFile = await deleteFiles(
    resumes.map((resumeFile) => resumeFile.filePath),
    store,
  )

  return { deletedUsers: dbUser, files: storedFile }
}
