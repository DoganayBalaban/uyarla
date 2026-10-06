import { access, mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { LocalFileStore } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { AuthError } from "@/server/authz"
import { deletionOperations } from "@/server/deleteAccount"
import {
  LibraryFullError,
  addFileToLibrary,
  createResume,
  findLibraryResume,
  listLibrary,
  removeFromLibrary,
  updateLibraryResume,
} from "@/server/resumeLibrary"

const toClean: string[] = []

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(name: string) {
  const u = await prisma.user.create({
    data: { name, email: `${name}-${Date.now()}-${Math.random()}@test.local` },
  })
  toClean.push(u.id)
  return u
}

function save(userId: string, fileName: string) {
  return createResume(prisma, { userId, filePath: `/tmp/${Math.random()}.pdf`, fileName, saveToLibrary: true })
}

describe("resume library", () => {
  it("saves the first CV as default and keeps one default", async () => {
    const u = await makeUser("lib-a")
    const first = await save(u.id, "a.pdf")
    const second = await save(u.id, "b.pdf")
    expect(first.savedToLibrary).toBe(true)

    let rows = await listLibrary(prisma, u.id)
    expect(rows.find((r) => r.id === first.resumeId)?.isDefault).toBe(true)
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1)

    await updateLibraryResume(prisma, u.id, second.resumeId, { isDefault: true })
    rows = await listLibrary(prisma, u.id)
    expect(rows.filter((r) => r.isDefault).map((r) => r.id)).toEqual([second.resumeId])
  })

  it("does not save a sixth CV but still creates the resume for the analysis", async () => {
    const u = await makeUser("lib-b")
    for (let i = 0; i < 5; i++) await save(u.id, `${i}.pdf`)
    const sixth = await save(u.id, "6.pdf")
    expect(sixth.savedToLibrary).toBe(false)
    expect(await prisma.resume.count({ where: { id: sixth.resumeId } })).toBe(1)
    expect(await listLibrary(prisma, u.id)).toHaveLength(5)
  })

  it("throws LibraryFullError when adding directly to a full library", async () => {
    const u = await makeUser("lib-c")
    for (let i = 0; i < 5; i++) await save(u.id, `${i}.pdf`)
    await expect(
      createResume(prisma, { userId: u.id, filePath: "/tmp/x.pdf", fileName: "x.pdf", saveToLibrary: "required" }),
    ).rejects.toBeInstanceOf(LibraryFullError)
  })

  it("hides other users' and removed CVs behind 404", async () => {
    const owner = await makeUser("lib-d")
    const other = await makeUser("lib-e")
    const { resumeId } = await save(owner.id, "a.pdf")

    await expect(findLibraryResume(prisma, other.id, resumeId)).rejects.toMatchObject({ status: 404 })
    await removeFromLibrary(prisma, owner.id, resumeId)
    await expect(findLibraryResume(prisma, owner.id, resumeId)).rejects.toBeInstanceOf(AuthError)
    await expect(removeFromLibrary(prisma, other.id, resumeId)).rejects.toMatchObject({ status: 404 })
  })

  it("removing keeps the resume and its analyses, and hands the default over", async () => {
    const u = await makeUser("lib-f")
    const first = await save(u.id, "a.pdf")
    const second = await save(u.id, "b.pdf")
    const version = await prisma.resumeVersion.create({
      data: { resumeId: first.resumeId, profile: {}, source: "parsed", versionNo: 1 },
    })
    const posting = await prisma.jobPosting.create({
      data: { userId: u.id, rawText: "ilan", requirements: [], language: "tr" },
    })
    const analysis = await prisma.analysis.create({
      data: { userId: u.id, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "t", status: "done" },
    })

    await removeFromLibrary(prisma, u.id, first.resumeId)

    expect(await prisma.analysis.count({ where: { id: analysis.id } })).toBe(1)
    const rows = await listLibrary(prisma, u.id)
    expect(rows.map((r) => r.id)).toEqual([second.resumeId])
    expect(rows[0]!.isDefault).toBe(true)
  })

  it("an analysis-only resume is not in the library", async () => {
    const u = await makeUser("lib-g")
    const { resumeId, savedToLibrary } = await createResume(prisma, {
      userId: u.id,
      filePath: "/tmp/a.pdf",
      fileName: "a.pdf",
      saveToLibrary: false,
    })
    expect(savedToLibrary).toBe(false)
    await expect(findLibraryResume(prisma, u.id, resumeId)).rejects.toMatchObject({ status: 404 })
  })

  it("keeps the limit and a single default under concurrent saves", async () => {
    const u = await makeUser("lib-race")
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => save(u.id, `${i}.pdf`)))
    expect(results.every((r) => r.status === "fulfilled")).toBe(true)
    const rows = await listLibrary(prisma, u.id)
    expect(rows).toHaveLength(5)
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1)
  })

  it("keeps a single default under concurrent make-default requests", async () => {
    const u = await makeUser("lib-race2")
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push((await save(u.id, `${i}.pdf`)).resumeId)
    await Promise.all(ids.slice(1).map((id) => updateLibraryResume(prisma, u.id, id, { isDefault: true })))
    const rows = await listLibrary(prisma, u.id)
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1)
  })

  it("adds a file with its label in one step", async () => {
    const u = await makeUser("lib-file")
    const store = new LocalFileStore(await mkdtemp(join(tmpdir(), "uyarla-lib-")))
    const resume = await addFileToLibrary(prisma, store, {
      userId: u.id,
      buffer: Buffer.from("pdf"),
      fileName: "cv.pdf",
      label: "Frontend CV",
    })
    expect(resume).toMatchObject({ label: "Frontend CV", fileName: "cv.pdf", isDefault: true })
    const row = await prisma.resume.findUniqueOrThrow({ where: { id: resume.id } })
    await expect(access(row.filePath)).resolves.toBeUndefined()
  })

  it("does not leave the stored file behind when the database write fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uyarla-lib-"))
    const store = new LocalFileStore(dir)
    // Var olmayan kullanıcı: yabancı anahtar yazımı düşürüyor.
    await expect(
      addFileToLibrary(prisma, store, { userId: "yok", buffer: Buffer.from("pdf"), fileName: "cv.pdf", label: null }),
    ).rejects.toThrow()
    expect(await readdir(dir)).toEqual([])
  })

  it("rejects a full library before writing the file", async () => {
    const u = await makeUser("lib-file-full")
    for (let i = 0; i < 5; i++) await save(u.id, `${i}.pdf`)
    const dir = await mkdtemp(join(tmpdir(), "uyarla-lib-"))
    await expect(
      addFileToLibrary(prisma, new LocalFileStore(dir), {
        userId: u.id,
        buffer: Buffer.from("pdf"),
        fileName: "cv.pdf",
        label: null,
      }),
    ).rejects.toBeInstanceOf(LibraryFullError)
    expect(await readdir(dir)).toEqual([])
  })
})
