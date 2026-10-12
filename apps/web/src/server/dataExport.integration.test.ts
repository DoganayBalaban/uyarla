import { prisma } from "@uyarla/db"
import { afterEach, describe, expect, it } from "vitest"
import { collectUserData } from "@/server/dataExport"
import { deletionOperations } from "@/server/deleteAccount"

const toClean: string[] = []

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

/** Çalışma anında üretilen sahte giriş değerleri; kodda sabit bir "şifre" durmasın. */
const fakeHash = () => `test-ozet-${Math.random().toString(36).slice(2)}`

/** CV'si, ilanı, analizi, uyarlaması ve oturumu olan bir kullanıcı. */
async function makeUserWithData(tag: string) {
  const user = await prisma.user.create({
    data: { name: tag, email: `${tag}-${Date.now()}-${Math.random()}@test.local`, phone: "+90 555 000 00 00" },
  })
  toClean.push(user.id)
  const resume = await prisma.resume.create({
    data: { userId: user.id, filePath: `resumes/${tag}.pdf`, rawText: `${tag} CV metni`, fileName: `${tag}.pdf` },
  })
  const version = await prisma.resumeVersion.create({
    data: { resumeId: resume.id, profile: { fullName: tag }, source: "parsed", versionNo: 1 },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId: user.id, rawText: `${tag} ilanı`, requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: { userId: user.id, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "test", status: "done", score: 40 },
  })
  await prisma.adaptation.create({ data: { analysisId: analysis.id, draft: { tag }, modelId: "test", status: "ready" } })
  await prisma.session.create({
    data: { id: `s-${tag}-${Math.random()}`, userId: user.id, token: `oturum-${fakeHash()}`, expiresAt: new Date(Date.now() + 3600e3) },
  })
  await prisma.account.create({
    data: { id: `a-${tag}-${Math.random()}`, userId: user.id, accountId: tag, providerId: "credential", password: fakeHash() },
  })
  return user
}

describe("collectUserData", () => {
  it("returns every record of the user and nothing of another user", async () => {
    const ayse = await makeUserWithData("ayse")
    await makeUserWithData("mehmet")

    const data = await collectUserData(prisma, ayse.id)
    const json = JSON.stringify(data)

    expect(data.user.email).toBe(ayse.email)
    expect(data.user.phone).toBe("+90 555 000 00 00")
    expect(data.resumes).toHaveLength(1)
    expect(data.resumes[0]!.rawText).toBe("ayse CV metni")
    expect((data.resumes[0]!.versions as unknown[]).length).toBe(1)
    expect(data.jobPostings).toHaveLength(1)
    expect(data.analyses).toHaveLength(1)
    expect((data.analyses[0] as { adaptation: { draft: unknown } }).adaptation.draft).toEqual({ tag: "ayse" })
    expect(data.sessions).toHaveLength(1)
    expect(data.accounts).toEqual([expect.objectContaining({ providerId: "credential" })])
    expect(json).not.toContain("mehmet")
  })

  it("leaves out session tokens and password hashes", async () => {
    const ayse = await makeUserWithData("ayse")
    const json = JSON.stringify(await collectUserData(prisma, ayse.id))
    expect(json).not.toContain("oturum-test-ozet-")
    expect(json).not.toContain("test-ozet-")
  })
})
