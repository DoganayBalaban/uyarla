import type { prisma } from "@uyarla/db"
import { kullanicilariSil, type SilmeSonucu } from "./silme"

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
export const TEMIZLIK_GUN = 30

/** Bu tarihten ESKİ anonim kayıtlar siliniyor. */
export function kesimTarihi(simdi: Date, gun: number = TEMIZLIK_GUN): Date {
  // 0 ya da negatif gün "az önce gelen ziyaretçiyi de sil" demek: elini tam o
  // anda CV'sinin üzerinde olan kullanıcının verisini siler. Sessizce geçmek
  // yerine duruyoruz.
  if (!Number.isFinite(gun) || gun <= 0) {
    throw new Error("Temizlik için gün sayısı pozitif olmalı")
  }
  return new Date(simdi.getTime() - gun * 24 * 60 * 60 * 1000)
}

export interface AnonimKosulu {
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
export function eskiAnonimKosulu(simdi: Date, gun: number = TEMIZLIK_GUN): AnonimKosulu {
  return { isAnonymous: true, createdAt: { lt: kesimTarihi(simdi, gun) } }
}

export interface TemizlikSonucu extends SilmeSonucu {
  /** Silinmeye aday bulunan kullanıcı sayısı. */
  bulunan: number
  /** Bu tarihten eski kayıtlar silindi. */
  kesim: Date
}

export interface TemizlikSecenekleri {
  simdi?: Date
  gun?: number
  /** Kuru çalıştırma: bulur, sayar, hiçbir şey silmez. */
  deneme?: boolean
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
export async function temizlikYap(
  prisma: Db,
  { simdi = new Date(), gun = TEMIZLIK_GUN, deneme = false }: TemizlikSecenekleri = {},
): Promise<TemizlikSonucu> {
  const kosul = eskiAnonimKosulu(simdi, gun)

  const adaylar = await prisma.user.findMany({ where: kosul, select: { id: true } })
  const idler = adaylar.map((k) => k.id)

  if (deneme || idler.length === 0) {
    return {
      bulunan: idler.length,
      kesim: kosul.createdAt.lt,
      kullanici: 0,
      dosya: { silinen: 0, atlanan: [] },
    }
  }

  const sonuc = await kullanicilariSil(prisma, idler)
  return { bulunan: idler.length, kesim: kosul.createdAt.lt, ...sonuc }
}
