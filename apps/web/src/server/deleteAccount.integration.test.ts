import { mkdtemp, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it, expect, afterEach, beforeAll } from "vitest"
import { LocalFileStore } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { deleteUsers, deletionOperations } from "@/server/deleteAccount"

const toClean: string[] = []
let storage: string

beforeAll(async () => {
  // Gerçek dosyalarla çalışıyoruz: depo dışı yol kontrolü ancak diskte
  // sınanabilir. Geçici dizin, testin depoya yanlışlıkla dokunmasını önlüyor.
  storage = await mkdtemp(join(tmpdir(), "uyarla-silme-"))
})

afterEach(async () => {
  // Testler zaten silme testi, ama başarısız bir koşuda satırlar kalır.
  // Sıra deletionOperations'ndeki sıranın aynısı.
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(userName: string) {
  const u = await prisma.user.create({
    data: { name: userName, email: `${userName}-${Date.now()}-${Math.random()}@test.local` },
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

/** Bir kullanıcının tam zinciri: CV → sürüm → ilan → analiz → uyarlama + oturum. */
async function makeJob(userId: string, label: string) {
  const filePath = join(storage, `${label}-${Math.random()}.pdf`)
  await writeFile(filePath, "sahte pdf")

  const resume = await prisma.resume.create({
    data: { userId, filePath, rawText: "metin" },
  })
  const version = await prisma.resumeVersion.create({
    data: { resumeId: resume.id, profile: {}, source: "parsed", versionNo: 1 },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: {
      userId,
      jobPostingId: posting.id,
      resumeVersionId: version.id,
      modelId: "test",
      status: "done",
      score: 42,
    },
  })
  const adaptation = await prisma.adaptation.create({
    data: {
      analysisId: analysis.id,
      modelId: "test",
      status: "draft",
      // Uyarlama, ürettiği sürüme de bağlanıyor: silme sırası bu ikinci
      // yabancı anahtarı da aşmak zorunda.
      resumeVersionId: version.id,
      draft: {},
    },
  })
  const session = await prisma.session.create({
    data: {
      id: `s-${Math.random()}`,
      userId,
      token: `t-${Math.random()}`,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  })
  const account = await prisma.account.create({
    data: {
      id: `a-${Math.random()}`,
      userId,
      accountId: userId,
      providerId: "credential",
      updatedAt: new Date(),
    },
  })

  return { filePath, resume, version, posting, analysis, adaptation, session, account }
}

describe("account deletion · real database", () => {
  it("removes all of the user's data and resume file", async () => {
    const dbUser = await makeUser("sahibi")
    const is = await makeJob(dbUser.id, "sahibi")

    expect(await exists(is.filePath)).toBe(true)

    const result = await deleteUsers(prisma, [dbUser.id], new LocalFileStore(storage))

    expect(result.deletedUsers).toBe(1)
    expect(result.files.deleted).toBe(1)
    expect(result.files.skipped).toEqual([])

    // Sekiz tablonun hepsi: bir tanesinin unutulması kişisel verinin
    // kalması demek, o yüzden hepsi tek tek soruluyor.
    expect(await prisma.adaptation.findUnique({ where: { id: is.adaptation.id } })).toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).toBeNull()
    expect(await prisma.resumeVersion.findUnique({ where: { id: is.version.id } })).toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: is.session.id } })).toBeNull()
    expect(await prisma.account.findUnique({ where: { id: is.account.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: dbUser.id } })).toBeNull()

    // Ve disk: veritabanı satırı gitmiş ama CV dosyası kalmışsa söz tutulmadı.
    expect(await exists(is.filePath)).toBe(false)
  })

  it("does NOT touch other users' data", async () => {
    // Bu testin varlık sebebi: `where` koşulu düşerse bütün kullanıcıların
    // verisi silinir. Devralmada veri yanlış hesaba geçiyordu; burada hiç
    // geri gelmiyor.
    const toDelete = await makeUser("silinecek")
    const otherUser = await makeUser("baskasi")

    await makeJob(toDelete.id, "silinecek")
    const other = await makeJob(otherUser.id, "baskasi")

    const result = await deleteUsers(prisma, [toDelete.id], new LocalFileStore(storage))
    expect(result.deletedUsers).toBe(1)

    expect(await prisma.user.findUnique({ where: { id: otherUser.id } })).not.toBeNull()
    expect(await prisma.adaptation.findUnique({ where: { id: other.adaptation.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: other.analysis.id } })).not.toBeNull()
    expect(
      await prisma.resumeVersion.findUnique({ where: { id: other.version.id } }),
    ).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: other.resume.id } })).not.toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: other.posting.id } })).not.toBeNull()
    expect(await prisma.session.findUnique({ where: { id: other.session.id } })).not.toBeNull()
    expect(await prisma.account.findUnique({ where: { id: other.account.id } })).not.toBeNull()

    // Diğerinin CV dosyası da diskte duruyor olmalı.
    expect(await exists(other.filePath)).toBe(true)
  })

  it("no row and no file is removed if the transaction fails", async () => {
    // Atomikliğin kanıtı. Kurgu: başka bir kullanıcının analizi, silinecek
    // kullanıcının ilanına bağlanıyor. `Analysis_jobPostingId_fkey` RESTRICT
    // taşıyor, yani jobPosting silinemez ve işlem beşinci adımda düşer — o
    // noktada adaptation, analysis, resumeVersion ve resume zaten silinmiş
    // durumdadır. Geri alma çalışmıyorsa hesap yarı silinmiş kalır.
    const toDelete = await makeUser("yarim")
    const otherUser = await makeUser("engel")

    const is = await makeJob(toDelete.id, "yarim")
    const other = await makeJob(otherUser.id, "engel")
    await prisma.analysis.update({
      where: { id: other.analysis.id },
      data: { jobPostingId: is.posting.id },
    })

    await expect(deleteUsers(prisma, [toDelete.id], new LocalFileStore(storage))).rejects.toThrow()

    // Hiçbiri gitmemiş olmalı.
    expect(await prisma.adaptation.findUnique({ where: { id: is.adaptation.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).not.toBeNull()
    expect(await prisma.resumeVersion.findUnique({ where: { id: is.version.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: toDelete.id } })).not.toBeNull()

    // Dosya silme işlemden SONRA çalıştığı için hiç çalışmamış olmalı:
    // veritabanı geri alındıysa kayıt dosyasız kalmamalı.
    expect(await exists(is.filePath)).toBe(true)

    // Kurulan bağı geri alıyoruz; afterEach bu sırayla sökemez.
    await prisma.analysis.update({
      where: { id: other.analysis.id },
      data: { jobPostingId: other.posting.id },
    })
  })

  it("skips a file path outside storage without deleting", async () => {
    // filePath bozuk ya da elle değiştirilmişse `unlink` rastgele bir dosyayı
    // silmeye kalkmasın.
    const dbUser = await makeUser("disyol")
    const outsidePath = join(tmpdir(), `uyarla-depo-disi-${Math.random()}.pdf`)
    await writeFile(outsidePath, "depo dışı")
    await prisma.resume.create({
      data: { userId: dbUser.id, filePath: outsidePath, rawText: "metin" },
    })

    const result = await deleteUsers(prisma, [dbUser.id], new LocalFileStore(storage))

    expect(result.files.deleted).toBe(0)
    expect(result.files.skipped).toEqual([outsidePath])
    expect(await exists(outsidePath)).toBe(true)
    expect(await prisma.user.findUnique({ where: { id: dbUser.id } })).toBeNull()
  })

  it("does nothing for an empty list", async () => {
    const dbUser = await makeUser("dokunulmaz")
    const result = await deleteUsers(prisma, [], new LocalFileStore(storage))
    expect(result.deletedUsers).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: dbUser.id } })).not.toBeNull()
  })
})
