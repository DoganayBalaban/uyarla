import { mkdtemp, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it, expect, afterEach, beforeAll } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { cleanupAnonymousUsers } from "@/server/cleanupAnonymousUsers"

const toClean: string[] = []
let storage: string

/**
 * Testin "şimdi"si GEÇMİŞTE, 2020'de.
 *
 * `temizlikYap` veritabanının tamamına bakıyor ve geliştirme veritabanı
 * paylaşılıyor. Gerçek "şimdi" verilseydi test, başka birinin bıraktığı eski
 * anonim kayıtları da silerdi. Kesim 2020'ye çekildiğinde yalnızca bu testin
 * ürettiği (yine 2020'de yaşlandırılmış) kayıtlar eşleşiyor; 2026'da
 * oluşturulmuş hiçbir satır koşula girmiyor.
 */
const NOW = new Date("2020-06-01T12:00:00.000Z")

beforeAll(async () => {
  storage = await mkdtemp(join(tmpdir(), "uyarla-temizlik-"))
  // temizlikYap dosya yolunu STORAGE_DIR'dan okuyor; testin gerçek depoya
  // dokunmaması için geçici dizine yönlendiriyoruz.
  process.env.STORAGE_DIR = storage
})

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

/**
 * Belirtilen yaşta bir kullanıcı üretir.
 *
 * `createdAt` şemada `@default(now())`, ama Prisma verilen değeri kabul
 * ediyor — yaşlandırmak için saati beklemeden yazabiliyoruz.
 */
async function makeUser(userName: string, daysAgo: number, anonUser: boolean) {
  const u = await prisma.user.create({
    data: {
      name: userName,
      email: `${userName}-${Date.now()}-${Math.random()}@test.local`,
      isAnonymous: anonUser,
      createdAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    },
  })
  toClean.push(u.id)
  return u
}

function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

/** CV, ilan ve analiz üretir; CV dosyası gerçekten diske yazılıyor. */
async function makeJob(userId: string, label: string) {
  const filePath = join(storage, `${label}-${Math.random()}.pdf`)
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

describe("anonymous cleanup · real database", () => {
  it("deletes an anonymous user older than 30 days and their data", async () => {
    const old = await makeUser("eski-anonim", 45, true)
    const is = await makeJob(old.id, "eski-anonim")

    const result = await cleanupAnonymousUsers(prisma, { now: NOW })

    expect(result.found).toBeGreaterThanOrEqual(1)
    expect(await prisma.user.findUnique({ where: { id: old.id } })).toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).toBeNull()
    // Diskteki CV de gitmeli: satır silinip dosya kalırsa KVKK açısından
    // hiçbir şey değişmemiş olur.
    expect(await exists(is.filePath)).toBe(false)
  })

  it("does NOT touch a REGISTERED user's data however old", async () => {
    // Bu testin varlık sebebi: `isAnonymous` koşulu düşerse ürünün bütün
    // kullanıcıları silinir. Bir yıllık kayıtlı hesap en zor kaybedilecek şey.
    const registered = await makeUser("eski-kayitli", 365, false)
    const is = await makeJob(registered.id, "eski-kayitli")

    await cleanupAnonymousUsers(prisma, { now: NOW })

    expect(await prisma.user.findUnique({ where: { id: registered.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).not.toBeNull()
    expect(await exists(is.filePath)).toBe(true)
  })

  it("does NOT touch a user whose isAnonymous is NULL", async () => {
    // Alan şemada nullable (K-34). `not: false` gibi bir koşul yazılsaydı bu
    // satır eşleşir ve Sprint 3A öncesinden kalan kayıtlı hesaplar silinirdi.
    const nullUser = await prisma.user.create({
      data: {
        name: "null-bayrak",
        email: `null-${Date.now()}-${Math.random()}@test.local`,
        isAnonymous: null,
        createdAt: new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
    })
    toClean.push(nullUser.id)

    await cleanupAnonymousUsers(prisma, { now: NOW })

    expect(await prisma.user.findUnique({ where: { id: nullUser.id } })).not.toBeNull()
  })

  it("does NOT touch an anonymous user newer than 30 days", async () => {
    // Ziyaretçi bir ay içinde dönüp kayıt olabilir; huninin dayandığı
    // varsayım bu (spec §7).
    const fresh = await makeUser("yeni-anonim", 10, true)
    const is = await makeJob(fresh.id, "yeni-anonim")

    await cleanupAnonymousUsers(prisma, { now: NOW })

    expect(await prisma.user.findUnique({ where: { id: fresh.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await exists(is.filePath)).toBe(true)
  })

  it("keeps a record right at the boundary", async () => {
    // Tam 30 gün: `lt` kullandığımız için eşleşmiyor. Geri alınamaz bir işlemde
    // eşitlik hâlinde silmemek doğru taraf.
    const limit = await makeUser("sinir", 30, true)

    await cleanupAnonymousUsers(prisma, { now: NOW })

    expect(await prisma.user.findUnique({ where: { id: limit.id } })).not.toBeNull()
  })

  it("counts but does not delete in dry-run mode", async () => {
    const old = await makeUser("deneme", 45, true)
    const is = await makeJob(old.id, "deneme")

    const result = await cleanupAnonymousUsers(prisma, { now: NOW, dryRun: true })

    expect(result.found).toBeGreaterThanOrEqual(1)
    expect(result.deletedUsers).toBe(0)
    expect(result.files.deleted).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: old.id } })).not.toBeNull()
    expect(await exists(is.filePath)).toBe(true)
  })

  it("moves the cutoff when a day count is given", async () => {
    const tenDay = await makeUser("on-gunluk", 10, true)

    const result = await cleanupAnonymousUsers(prisma, { now: NOW, days: 7 })

    expect(result.cutoff.toISOString()).toBe("2020-05-25T12:00:00.000Z")
    expect(await prisma.user.findUnique({ where: { id: tenDay.id } })).toBeNull()
  })
})
