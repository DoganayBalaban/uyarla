import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { devralmaIslemleri } from "./devral"

const temizlenecek: string[] = []

afterEach(async () => {
  // Sıra önemli: yabancı anahtarlar önce çocukları istiyor.
  await prisma.analysis.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.resume.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.user.deleteMany({ where: { id: { in: temizlenecek } } })
  temizlenecek.length = 0
})

async function kullaniciYap(ad: string) {
  const u = await prisma.user.create({
    data: { name: ad, email: `${ad}-${Date.now()}-${Math.random()}@test.local` },
  })
  temizlenecek.push(u.id)
  return u
}

async function isUret(userId: string) {
  const resume = await prisma.resume.create({
    data: { userId, filePath: "/tmp/x.pdf", rawText: "metin" },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, modelId: "test", status: "done", score: 42 },
  })
  return { resume, posting, analysis }
}

describe("devralma · gerçek veritabanı", () => {
  it("anonim kullanıcının işini yeni hesaba taşır", async () => {
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    const { resume, posting, analysis } = await isUret(anonim.id)

    await prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id))

    expect((await prisma.resume.findUnique({ where: { id: resume.id } }))!.userId).toBe(yeni.id)
    expect((await prisma.analysis.findUnique({ where: { id: analysis.id } }))!.userId).toBe(
      yeni.id,
    )
    expect((await prisma.jobPosting.findUnique({ where: { id: posting.id } }))!.userId).toBe(
      yeni.id,
    )
  })

  it("başka kullanıcıların verisine DOKUNMAZ", async () => {
    // Bu testin varlık sebebi: where koşulu düşerse bütün kullanıcıların
    // verisi tek hesaba taşınır ve bu kişisel veri sızıntısıdır.
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    const baskasi = await kullaniciYap("baskasi")

    await isUret(anonim.id)
    const digerininIsi = await isUret(baskasi.id)

    await prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id))

    const digerininResume = await prisma.resume.findUnique({
      where: { id: digerininIsi.resume.id },
    })
    expect(digerininResume!.userId).toBe(baskasi.id)
    const digerininAnalizi = await prisma.analysis.findUnique({
      where: { id: digerininIsi.analysis.id },
    })
    expect(digerininAnalizi!.userId).toBe(baskasi.id)
  })

  it("taşınacak iş yoksa sessizce geçer", async () => {
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    await expect(
      prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id)),
    ).resolves.toBeDefined()
  })
})
