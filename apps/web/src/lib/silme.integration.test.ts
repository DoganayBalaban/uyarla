import { mkdtemp, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it, expect, afterEach, beforeAll } from "vitest"
import { prisma } from "@uyarla/db"
import { kullanicilariSil, silmeIslemleri } from "./silme"

const temizlenecek: string[] = []
let depo: string

beforeAll(async () => {
  // Gerçek dosyalarla çalışıyoruz: depo dışı yol kontrolü ancak diskte
  // sınanabilir. Geçici dizin, testin depoya yanlışlıkla dokunmasını önlüyor.
  depo = await mkdtemp(join(tmpdir(), "uyarla-silme-"))
})

afterEach(async () => {
  // Testler zaten silme testi, ama başarısız bir koşuda satırlar kalır.
  // Sıra silmeIslemleri'ndeki sıranın aynısı.
  await prisma.$transaction(silmeIslemleri(prisma, temizlenecek))
  temizlenecek.length = 0
})

async function kullaniciYap(ad: string) {
  const u = await prisma.user.create({
    data: { name: ad, email: `${ad}-${Date.now()}-${Math.random()}@test.local` },
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

/** Bir kullanıcının tam zinciri: CV → sürüm → ilan → analiz → uyarlama + oturum. */
async function isUret(userId: string, etiket: string) {
  const filePath = join(depo, `${etiket}-${Math.random()}.pdf`)
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

describe("hesap silme · gerçek veritabanı", () => {
  it("kullanıcının tüm verisini ve CV dosyasını kaldırır", async () => {
    const kullanici = await kullaniciYap("sahibi")
    const is = await isUret(kullanici.id, "sahibi")

    expect(await varMi(is.filePath)).toBe(true)

    const sonuc = await kullanicilariSil(prisma, [kullanici.id], depo)

    expect(sonuc.kullanici).toBe(1)
    expect(sonuc.dosya.silinen).toBe(1)
    expect(sonuc.dosya.atlanan).toEqual([])

    // Sekiz tablonun hepsi: bir tanesinin unutulması kişisel verinin
    // kalması demek, o yüzden hepsi tek tek soruluyor.
    expect(await prisma.adaptation.findUnique({ where: { id: is.adaptation.id } })).toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).toBeNull()
    expect(await prisma.resumeVersion.findUnique({ where: { id: is.version.id } })).toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: is.posting.id } })).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: is.session.id } })).toBeNull()
    expect(await prisma.account.findUnique({ where: { id: is.account.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: kullanici.id } })).toBeNull()

    // Ve disk: veritabanı satırı gitmiş ama CV dosyası kalmışsa söz tutulmadı.
    expect(await varMi(is.filePath)).toBe(false)
  })

  it("başka kullanıcıların verisine DOKUNMAZ", async () => {
    // Bu testin varlık sebebi: `where` koşulu düşerse bütün kullanıcıların
    // verisi silinir. Devralmada veri yanlış hesaba geçiyordu; burada hiç
    // geri gelmiyor.
    const silinecek = await kullaniciYap("silinecek")
    const baskasi = await kullaniciYap("baskasi")

    await isUret(silinecek.id, "silinecek")
    const digeri = await isUret(baskasi.id, "baskasi")

    const sonuc = await kullanicilariSil(prisma, [silinecek.id], depo)
    expect(sonuc.kullanici).toBe(1)

    expect(await prisma.user.findUnique({ where: { id: baskasi.id } })).not.toBeNull()
    expect(await prisma.adaptation.findUnique({ where: { id: digeri.adaptation.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: digeri.analysis.id } })).not.toBeNull()
    expect(
      await prisma.resumeVersion.findUnique({ where: { id: digeri.version.id } }),
    ).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: digeri.resume.id } })).not.toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: digeri.posting.id } })).not.toBeNull()
    expect(await prisma.session.findUnique({ where: { id: digeri.session.id } })).not.toBeNull()
    expect(await prisma.account.findUnique({ where: { id: digeri.account.id } })).not.toBeNull()

    // Diğerinin CV dosyası da diskte duruyor olmalı.
    expect(await varMi(digeri.filePath)).toBe(true)
  })

  it("işlem düşerse hiçbir satır ve hiçbir dosya gitmez", async () => {
    // Atomikliğin kanıtı. Kurgu: başka bir kullanıcının analizi, silinecek
    // kullanıcının ilanına bağlanıyor. `Analysis_jobPostingId_fkey` RESTRICT
    // taşıyor, yani jobPosting silinemez ve işlem beşinci adımda düşer — o
    // noktada adaptation, analysis, resumeVersion ve resume zaten silinmiş
    // durumdadır. Geri alma çalışmıyorsa hesap yarı silinmiş kalır.
    const silinecek = await kullaniciYap("yarim")
    const baskasi = await kullaniciYap("engel")

    const is = await isUret(silinecek.id, "yarim")
    const digeri = await isUret(baskasi.id, "engel")
    await prisma.analysis.update({
      where: { id: digeri.analysis.id },
      data: { jobPostingId: is.posting.id },
    })

    await expect(kullanicilariSil(prisma, [silinecek.id], depo)).rejects.toThrow()

    // Hiçbiri gitmemiş olmalı.
    expect(await prisma.adaptation.findUnique({ where: { id: is.adaptation.id } })).not.toBeNull()
    expect(await prisma.analysis.findUnique({ where: { id: is.analysis.id } })).not.toBeNull()
    expect(await prisma.resumeVersion.findUnique({ where: { id: is.version.id } })).not.toBeNull()
    expect(await prisma.resume.findUnique({ where: { id: is.resume.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: silinecek.id } })).not.toBeNull()

    // Dosya silme işlemden SONRA çalıştığı için hiç çalışmamış olmalı:
    // veritabanı geri alındıysa kayıt dosyasız kalmamalı.
    expect(await varMi(is.filePath)).toBe(true)

    // Kurulan bağı geri alıyoruz; afterEach bu sırayla sökemez.
    await prisma.analysis.update({
      where: { id: digeri.analysis.id },
      data: { jobPostingId: digeri.posting.id },
    })
  })

  it("depo dışındaki dosya yolunu atlar, silmez", async () => {
    // filePath bozuk ya da elle değiştirilmişse `unlink` rastgele bir dosyayı
    // silmeye kalkmasın.
    const kullanici = await kullaniciYap("disyol")
    const disYol = join(tmpdir(), `uyarla-depo-disi-${Math.random()}.pdf`)
    await writeFile(disYol, "depo dışı")
    await prisma.resume.create({
      data: { userId: kullanici.id, filePath: disYol, rawText: "metin" },
    })

    const sonuc = await kullanicilariSil(prisma, [kullanici.id], depo)

    expect(sonuc.dosya.silinen).toBe(0)
    expect(sonuc.dosya.atlanan).toEqual([disYol])
    expect(await varMi(disYol)).toBe(true)
    expect(await prisma.user.findUnique({ where: { id: kullanici.id } })).toBeNull()
  })

  it("boş listede hiçbir şey yapmaz", async () => {
    const kullanici = await kullaniciYap("dokunulmaz")
    const sonuc = await kullanicilariSil(prisma, [], depo)
    expect(sonuc.kullanici).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: kullanici.id } })).not.toBeNull()
  })
})
