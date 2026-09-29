import { mkdtemp, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it, expect, afterEach, beforeAll } from "vitest"
import { prisma } from "@uyarla/db"
import { silmeIslemleri } from "./silme"
import { temizlikYap } from "./temizlik"

const temizlenecek: string[] = []
let depo: string

/**
 * Testin "şimdi"si GEÇMİŞTE, 2020'de.
 *
 * `temizlikYap` veritabanının tamamına bakıyor ve geliştirme veritabanı
 * paylaşılıyor. Gerçek "şimdi" verilseydi test, başka birinin bıraktığı eski
 * anonim kayıtları da silerdi. Kesim 2020'ye çekildiğinde yalnızca bu testin
 * ürettiği (yine 2020'de yaşlandırılmış) kayıtlar eşleşiyor; 2026'da
 * oluşturulmuş hiçbir satır koşula girmiyor.
 */
const SIMDI = new Date("2020-06-01T12:00:00.000Z")

beforeAll(async () => {
  depo = await mkdtemp(join(tmpdir(), "uyarla-temizlik-"))
  // temizlikYap dosya yolunu STORAGE_DIR'dan okuyor; testin gerçek depoya
  // dokunmaması için geçici dizine yönlendiriyoruz.
  process.env.STORAGE_DIR = depo
})

afterEach(async () => {
  await prisma.$transaction(silmeIslemleri(prisma, temizlenecek))
  temizlenecek.length = 0
})

/**
 * Belirtilen yaşta bir kullanıcı üretir.
 *
 * `createdAt` şemada `@default(now())`, ama Prisma verilen değeri kabul
 * ediyor — yaşlandırmak için saati beklemeden yazabiliyoruz.
 */
async function kullaniciYap(ad: string, gunOnce: number, anonim: boolean) {
  const u = await prisma.user.create({
    data: {
      name: ad,
      email: `${ad}-${Date.now()}-${Math.random()}@test.local`,
      isAnonymous: anonim,
      createdAt: new Date(SIMDI.getTime() - gunOnce * 24 * 60 * 60 * 1000),
    },
  })
  temizlenecek.push(u.id)
  return u
}

function varMi(yol: string): Promise<boolean> {
  return access(yol).then(
    () => true,
    () => false,
  )
}

/** CV, ilan ve analiz üretir; CV dosyası gerçekten diske yazılıyor. */
async function isUret(userId: string, etiket: string) {
  const filePath = join(depo, `${etiket}-${Math.random()}.pdf`)
  await writeFile(filePath, "sahte pdf")

  const resume = await prisma.resume.create({
    data: { userId, filePath, rawText: "metin" },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, modelId: "test", status: "done", score: 42 },
  })
  return { filePath, resume, posting, analysis }
}

describe("anonim temizlik · gerçek veritabanı", () => {
  it("30 günden eski anonim kullanıcıyı ve verisini siler", async () => {
    const eski = await kullaniciYap("eski-anonim", 45, true)
    const is = await isUret(eski.id, "eski-anonim")

    const sonuc = await temizlikYap(prisma, { simdi: SIMDI })

    expect(sonuc.bulunan).toBeGreaterThanOrEqual(1)
    expect(await prisma.user.findUnique({ where: { id: eski.id } })).toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).toBeNull()
    // Diskteki CV de gitmeli: satır silinip dosya kalırsa KVKK açısından
    // hiçbir şey değişmemiş olur.
    expect(await varMi(is.filePath)).toBe(false)
  })

  it("KAYITLI kullanıcının verisine DOKUNMAZ, ne kadar eski olursa olsun", async () => {
    // Bu testin varlık sebebi: `isAnonymous` koşulu düşerse ürünün bütün
    // kullanıcıları silinir. Bir yıllık kayıtlı hesap en zor kaybedilecek şey.
    const kayitli = await kullaniciYap("eski-kayitli", 365, false)
    const is = await isUret(kayitli.id, "eski-kayitli")

    await temizlikYap(prisma, { simdi: SIMDI })

    expect(await prisma.user.findUnique({ where: { id: kayitli.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).not.toBeNull()
    expect(await varMi(is.filePath)).toBe(true)
  })

  it("isAnonymous NULL olan kullanıcıya DOKUNMAZ", async () => {
    // Alan şemada nullable (K-34). `not: false` gibi bir koşul yazılsaydı bu
    // satır eşleşir ve Sprint 3A öncesinden kalan kayıtlı hesaplar silinirdi.
    const nullKullanici = await prisma.user.create({
      data: {
        name: "null-bayrak",
        email: `null-${Date.now()}-${Math.random()}@test.local`,
        isAnonymous: null,
        createdAt: new Date(SIMDI.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
    })
    temizlenecek.push(nullKullanici.id)

    await temizlikYap(prisma, { simdi: SIMDI })

    expect(await prisma.user.findUnique({ where: { id: nullKullanici.id } })).not.toBeNull()
  })

  it("30 günden yeni anonim kullanıcıya DOKUNMAZ", async () => {
    // Ziyaretçi bir ay içinde dönüp kayıt olabilir; huninin dayandığı
    // varsayım bu (spec §7).
    const yeni = await kullaniciYap("yeni-anonim", 10, true)
    const is = await isUret(yeni.id, "yeni-anonim")

    await temizlikYap(prisma, { simdi: SIMDI })

    expect(await prisma.user.findUnique({ where: { id: yeni.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await varMi(is.filePath)).toBe(true)
  })

  it("sınırda duran kaydı bırakır", async () => {
    // Tam 30 gün: `lt` kullandığımız için eşleşmiyor. Geri alınamaz bir işlemde
    // eşitlik hâlinde silmemek doğru taraf.
    const sinir = await kullaniciYap("sinir", 30, true)

    await temizlikYap(prisma, { simdi: SIMDI })

    expect(await prisma.user.findUnique({ where: { id: sinir.id } })).not.toBeNull()
  })

  it("deneme kipinde sayar ama silmez", async () => {
    const eski = await kullaniciYap("deneme", 45, true)
    const is = await isUret(eski.id, "deneme")

    const sonuc = await temizlikYap(prisma, { simdi: SIMDI, deneme: true })

    expect(sonuc.bulunan).toBeGreaterThanOrEqual(1)
    expect(sonuc.kullanici).toBe(0)
    expect(sonuc.dosya.silinen).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: eski.id } })).not.toBeNull()
    expect(await varMi(is.filePath)).toBe(true)
  })

  it("gün sayısı verildiğinde kesimi oraya taşır", async () => {
    const onGunluk = await kullaniciYap("on-gunluk", 10, true)

    const sonuc = await temizlikYap(prisma, { simdi: SIMDI, gun: 7 })

    expect(sonuc.kesim.toISOString()).toBe("2020-05-25T12:00:00.000Z")
    expect(await prisma.user.findUnique({ where: { id: onGunluk.id } })).toBeNull()
  })
})
