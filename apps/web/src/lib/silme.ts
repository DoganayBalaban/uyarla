import { unlink } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"
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
type Islem = ReturnType<Db["resume"]["deleteMany"]>

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
export const SILME_SIRASI = [
  "adaptation",
  "analysis",
  "resumeVersion",
  "resume",
  "jobPosting",
  "session",
  "account",
  "user",
] as const

type Tablo = (typeof SILME_SIRASI)[number]

/**
 * Her tablonun kullanıcıya nasıl bağlandığı. Tek yerde duruyor ki bir tabloyu
 * eklerken koşulunu yazmayı atlamak mümkün olmasın.
 */
function kosul(tablo: Tablo, idler: string[]): { where: object } {
  switch (tablo) {
    // Adaptation'da userId yok: analysisId benzersiz ve sahiplik analizden
    // okunuyor (K-35).
    case "adaptation":
      return { where: { analysis: { userId: { in: idler } } } }
    // ResumeVersion'da da yok: sahiplik CV'den geliyor.
    case "resumeVersion":
      return { where: { resume: { userId: { in: idler } } } }
    case "user":
      return { where: { id: { in: idler } } }
    default:
      return { where: { userId: { in: idler } } }
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
export function silmeIslemleri(prisma: Db, kullaniciIdleri: string[]): Islem[] {
  if (kullaniciIdleri.some((id) => !id)) {
    throw new Error("Silme için boş kimlik verilemez")
  }

  const idler = [...new Set(kullaniciIdleri)]
  // Boş listede erken çıkış: `{ in: [] }` Prisma'da hiçbir satırı tutmasa da,
  // silen bir sorguyu hiç kurmamak daha güvenli.
  if (idler.length === 0) return []

  const client = prisma as unknown as Record<Tablo, { deleteMany(args: { where: object }): Islem }>
  return SILME_SIRASI.map((tablo) => client[tablo].deleteMany(kosul(tablo, idler)))
}

/**
 * Yol, depo dizininin ALTINDA mı.
 *
 * `Resume.filePath` veritabanından geliyor ve `unlink`'e doğrudan verilecek.
 * Bozuk ya da elle değiştirilmiş bir satırın depo dışındaki bir dosyayı
 * silmesini engelleyen tek şey bu kontrol.
 *
 * Düz `startsWith` yetmiyor: "/veri/storage-yedek" dizesi "/veri/storage" ile
 * başlıyor ama onun altında değil. `relative` ile bakmak bu tuzağı ve
 * ".." geçişlerini birlikte kapatıyor.
 */
export function depoIcindeMi(yol: string, depoDizini: string): boolean {
  const depo = resolve(depoDizini)
  const hedef = resolve(yol)
  const fark = relative(depo, hedef)
  return fark !== "" && !fark.startsWith("..") && !fark.startsWith(sep)
}

/** Varsayılan depo dizini; `LocalFileStore`'un kullandığı değerle aynı. */
export function depoDizini(): string {
  return process.env.STORAGE_DIR ?? "./storage"
}

export interface DosyaSonucu {
  silinen: number
  /** Depo dışında olduğu için dokunulmayan yollar. */
  atlanan: string[]
}

/**
 * Verilen yolları diskten siler.
 *
 * Eksik dosya hata değil: worker aynı kaydı okurken dosya elle silinmiş
 * olabilir ve bir hesap silme isteği bu yüzden başarısız olmamalı.
 */
export async function dosyalariSil(
  yollar: string[],
  depo = depoDizini(),
): Promise<DosyaSonucu> {
  const sonuc: DosyaSonucu = { silinen: 0, atlanan: [] }

  for (const yol of yollar) {
    if (!depoIcindeMi(yol, depo)) {
      sonuc.atlanan.push(yol)
      continue
    }
    try {
      await unlink(yol)
      sonuc.silinen += 1
    } catch (error) {
      // ENOENT: dosya zaten yok, istenen sonuç sağlanmış sayılıyor.
      if ((error as { code?: string }).code !== "ENOENT") throw error
    }
  }

  return sonuc
}

export interface SilmeSonucu {
  /** Gerçekten silinen kullanıcı sayısı. */
  kullanici: number
  dosya: DosyaSonucu
}

/**
 * Kullanıcıları ve tüm verisini siler.
 *
 * Sıra bilinçli ve tersine çevrilemez:
 *
 *   1. Dosya yolları OKUNUR — kayıtlar gidince yolu bulmanın yolu kalmıyor.
 *   2. Veritabanı TEK işlemde silinir — yarısı silinmiş hesap olmasın.
 *   3. Dosyalar diskten silinir — işlem DIŞINDA ve SONRA.
 *
 * Üçüncü adımın işlem dışında olması bir uzlaşma: dosya silinip işlem geri
 * alınırsa kayıt dosyasız kalır (kullanıcı CV'sini göremez ama kaydı var).
 * Tersi durumda ise diskte sahipsiz bir dosya kalır — temizlik işiyle
 * toplanabilir, kullanıcıya hiçbir şey kırılmaz. İkisinden ikincisi zararsız.
 */
export async function kullanicilariSil(
  prisma: Db,
  kullaniciIdleri: string[],
  depo = depoDizini(),
): Promise<SilmeSonucu> {
  const idler = [...new Set(kullaniciIdleri.filter((id) => id))]
  if (idler.length === 0) return { kullanici: 0, dosya: { silinen: 0, atlanan: [] } }

  const cvler = await prisma.resume.findMany({
    where: { userId: { in: idler } },
    select: { filePath: true },
  })

  const sonuclar = await prisma.$transaction(silmeIslemleri(prisma, idler))
  // Son işlem `user` silme; silinen hesap sayısı orada.
  const kullanici = sonuclar[sonuclar.length - 1]?.count ?? 0

  const dosya = await dosyalariSil(
    cvler.map((cv) => cv.filePath),
    depo,
  )

  return { kullanici, dosya }
}
