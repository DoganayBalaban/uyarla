import type { FileStore } from "@uyarla/core/storage/fileStore"
import { PermanentError } from "@uyarla/core/errors"
import type { prisma } from "@uyarla/db"
import { LIBRARY_APPLICATIONS_SHOWN, LIBRARY_MAX, type LibraryApplication, type LibraryResume, type ResumePatch } from "@/features/resumes/schema"
import { AuthError } from "@/server/authz"
import { storeUploadedResume } from "@/server/storeUpload"

type Db = typeof prisma
/** Transaction istemcisi de yetiyor: yalnızca resume tablosu kullanılıyor. */
type ResumeDb = Pick<Db, "resume">

/**
 * CV kütüphanesi (DOG-50, spec §2 ve §4). Kütüphane ayrı bir tablo değil:
 * `Resume.savedAt` doluysa CV kütüphanede. Analizde yüklenip kaydedilmeyen
 * CV'ler de Resume satırı, ama listede görünmüyor.
 *
 * Kurallar saf fonksiyonlarda. Yazan her transaction önce kullanıcı satırını
 * kilitliyor (`lockLibrary`): Postgres'in varsayılan READ COMMITTED düzeyinde
 * sayım ile yazma arasında kilit yok, iki istek aynı anda 6. CV'yi
 * kaydedebiliyor ya da iki varsayılan bırakabiliyordu. Kilit kullanıcı
 * başına; başka kullanıcıları bekletmiyor.
 */

export class LibraryFullError extends PermanentError {
  constructor() {
    super(`En fazla ${LIBRARY_MAX} CV kaydedebilirsin. Birini kaldırıp tekrar dener misin?`, "library_full")
  }
}

export function canSave(savedCount: number): boolean {
  return savedCount < LIBRARY_MAX
}

export function isFirstSaved(savedCount: number): boolean {
  return savedCount === 0
}

/** Varsayılan kaldırılınca en yeni kayıtlı CV devralıyor; kimse kalmadıysa yok. */
export function nextDefaultId(remaining: { id: string; savedAt: Date }[]): string | null {
  if (remaining.length === 0) return null
  return [...remaining].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())[0]!.id
}

/** Aynı kullanıcının kütüphane yazımlarını sıraya sokar; transaction bitince kalkar. */
async function lockLibrary(tx: Pick<Db, "$queryRaw">, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`
}

const LIBRARY_SELECT = { id: true, label: true, fileName: true, createdAt: true, isDefault: true } as const

function toLibraryResume(row: {
  id: string
  label: string | null
  fileName: string | null
  createdAt: Date
  isDefault: boolean
}): LibraryResume {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

/**
 * Varsayılan önce, sonra en yeni kaydedilen. Her CV'nin altında o CV'yle
 * yapılmış analizler (DOG-137): hangi başvuruya hangi CV gitti, kütüphaneden
 * de görünsün.
 */
export async function listLibrary(db: Pick<Db, "resume" | "analysis">, userId: string): Promise<LibraryResume[]> {
  const rows = await db.resume.findMany({
    where: { userId, savedAt: { not: null } },
    orderBy: [{ isDefault: "desc" }, { savedAt: "desc" }],
    select: LIBRARY_SELECT,
  })
  if (rows.length === 0) return []
  const analyses = await db.analysis.findMany({
    where: { userId, status: "done", resumeVersion: { resumeId: { in: rows.map((r) => r.id) } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stage: true,
      jobPosting: { select: { position: true, company: true } },
      resumeVersion: { select: { resumeId: true } },
    },
  })
  const byResume = groupApplications(
    analyses.map((a) => ({
      resumeId: a.resumeVersion!.resumeId,
      analysisId: a.id,
      position: a.jobPosting.position,
      company: a.jobPosting.company,
      stage: a.stage,
    })),
  )
  return rows.map((row) => ({ ...toLibraryResume(row), ...(byResume.get(row.id) ?? { applications: [], applicationCount: 0 }) }))
}

/** Analizleri CV'ye göre gruplar; girdi en yeni önce sıralı. */
export function groupApplications(
  rows: Array<LibraryApplication & { resumeId: string }>,
): Map<string, { applications: LibraryApplication[]; applicationCount: number }> {
  const out = new Map<string, { applications: LibraryApplication[]; applicationCount: number }>()
  for (const { resumeId, ...app } of rows) {
    const entry = out.get(resumeId) ?? { applications: [], applicationCount: 0 }
    entry.applicationCount++
    if (entry.applications.length < LIBRARY_APPLICATIONS_SHOWN) entry.applications.push(app)
    out.set(resumeId, entry)
  }
  return out
}

export function countLibrary(db: ResumeDb, userId: string): Promise<number> {
  return db.resume.count({ where: { userId, savedAt: { not: null } } })
}

/**
 * Kullanıcının kütüphanesindeki CV. Başkasınınki, kaldırılmış ya da hiç
 * kaydedilmemiş CV aynı 404'ü veriyor (K-35: var olduğunu sızdırma).
 */
export async function findLibraryResume(db: ResumeDb, userId: string, resumeId: string): Promise<{ id: string }> {
  const row = await db.resume.findFirst({
    where: { id: resumeId, userId, savedAt: { not: null } },
    select: { id: true },
  })
  if (!row) throw new AuthError("Bulunamadı.", 404, "not_found")
  return row
}

/**
 * Yeni Resume satırı. `saveToLibrary`:
 * - `false`: yalnızca analiz için.
 * - `true`: yer varsa kütüphaneye; doluysa kaydetmeden devam (analiz engellenmesin).
 * - `"required"`: doluysa LibraryFullError (kütüphaneye doğrudan yükleme).
 */
export async function createResume(
  db: Db,
  input: {
    userId: string
    filePath: string
    fileName: string
    saveToLibrary: boolean | "required"
    label?: string | null
    /** Yapıştırılan CV'de metin baştan belli (DOG-101); worker dosyadan çıkarmıyor. */
    rawText?: string
  },
): Promise<{ resumeId: string; savedToLibrary: boolean }> {
  return db.$transaction(async (tx) => {
    let save = false
    let makeDefault = false
    if (input.saveToLibrary) {
      await lockLibrary(tx, input.userId)
      const savedCount = await countLibrary(tx, input.userId)
      if (canSave(savedCount)) {
        save = true
        makeDefault = isFirstSaved(savedCount)
      } else if (input.saveToLibrary === "required") {
        throw new LibraryFullError()
      }
    }
    const row = await tx.resume.create({
      data: {
        userId: input.userId,
        filePath: input.filePath,
        fileName: input.fileName,
        label: input.label ?? null,
        rawText: input.rawText ?? "",
        savedAt: save ? new Date() : null,
        isDefault: makeDefault,
      },
      select: { id: true },
    })
    return { resumeId: row.id, savedToLibrary: save }
  })
}

export async function updateLibraryResume(
  db: Db,
  userId: string,
  resumeId: string,
  patch: ResumePatch,
): Promise<LibraryResume> {
  return db.$transaction(async (tx) => {
    await lockLibrary(tx, userId)
    await findLibraryResume(tx, userId, resumeId)
    if (patch.isDefault) {
      await tx.resume.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    }
    const row = await tx.resume.update({
      where: { id: resumeId },
      data: {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.isDefault ? { isDefault: true } : {}),
      },
      select: LIBRARY_SELECT,
    })
    return toLibraryResume(row)
  })
}

/** Yalnızca kütüphaneden çıkarıyor; satır ve bağlı analizler kalıyor. */
export async function removeFromLibrary(db: Db, userId: string, resumeId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockLibrary(tx, userId)
    await findLibraryResume(tx, userId, resumeId)
    await tx.resume.update({ where: { id: resumeId }, data: { savedAt: null, isDefault: false } })
    const hasDefault = await tx.resume.count({ where: { userId, savedAt: { not: null }, isDefault: true } })
    if (hasDefault > 0) return
    const remaining = await tx.resume.findMany({
      where: { userId, savedAt: { not: null } },
      select: { id: true, savedAt: true },
    })
    const heir = nextDefaultId(remaining.map((r) => ({ id: r.id, savedAt: r.savedAt! })))
    if (heir) await tx.resume.update({ where: { id: heir }, data: { isDefault: true } })
  })
}

/**
 * Dosyayı depoya yazıp kütüphaneye ekler (onboarding ve hesabım). Dolu
 * kütüphane dosya yazılmadan reddediliyor. Yazımdan sonra veritabanı
 * düşerse dosya geri siliniyor: satırı olmayan dosyayı hesap silme de
 * bulamaz (KVKK).
 */
export async function addFileToLibrary(
  db: Db,
  store: FileStore,
  input: { userId: string; buffer: Buffer; fileName: string; label: string | null },
): Promise<LibraryResume> {
  if (!canSave(await countLibrary(db, input.userId))) throw new LibraryFullError()

  const { resumeId } = await storeUploadedResume(store, input.buffer, input.fileName, (filePath) =>
    createResume(db, {
      userId: input.userId,
      filePath,
      fileName: input.fileName,
      saveToLibrary: "required",
      label: input.label,
    }),
  )

  const row = await db.resume.findUniqueOrThrow({ where: { id: resumeId }, select: LIBRARY_SELECT })
  return toLibraryResume(row)
}
