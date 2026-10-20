import type { prisma } from "@uyarla/db"
import JSZip from "jszip"
import type { DELETION_ORDER } from "@/server/deleteAccount"

type Db = typeof prisma

/**
 * "Verilerimi indir" (DOG-63, KVKK md. 11).
 *
 * Kapsam hesap silmeyle aynı: silinen her tablo burada da var. Test
 * `EXPORTED_TABLES`'ı `DELETION_ORDER` ile karşılaştırıyor; birine tablo
 * eklenip ötekinde unutulursa kırmızıya dönüyor.
 *
 * Dışarıda kalanlar bilinçli: oturum anahtarı (`Session.token`), sosyal giriş
 * jetonları ve şifre özeti (`Account`). Bunlar kişinin verisi değil, hesaba
 * erişim anahtarı; ZIP bir yere düşerse hesabı ele geçirtir. Depodaki iç
 * dosya yolu da yazılmıyor; dosyanın kendisi ZIP'te.
 */
export const EXPORTED_TABLES = [
  "user",
  "account",
  "session",
  "resume",
  "resumeVersion",
  "jobPosting",
  "analysis",
  "adaptation",
  "accessPass",
  "excludedConcept",
  "emailLog",
  "emailConsent",
] as const satisfies readonly (typeof DELETION_ORDER)[number][]

export interface ExportedResume {
  id: string
  fileName: string | null
  /** Yalnızca ZIP'e dosya koymak için; JSON'a yazılmıyor. */
  filePath: string
  [key: string]: unknown
}

export interface UserDataExport {
  exportedAt: string
  user: Record<string, unknown>
  accounts: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  resumes: ExportedResume[]
  jobPostings: Record<string, unknown>[]
  analyses: Record<string, unknown>[]
  /**
   * Erişim dönemleri (DOG-34). Polar sipariş numarası da var (DOG-78): iade ya
   * da fatura talebinde kullanıcının elindeki tek referans. Erişim anahtarı
   * değil; Polar'ın gönderdiği makbuzda da yazıyor.
   */
  accessPasses: Record<string, unknown>[]
  /** "Tüm ilanlarda hariç tut" listesi (DOG-90). */
  excludedConcepts: Record<string, unknown>[]
  /** Gönderilen e-postalar: tür ve zaman, içerik yok (DOG-128). */
  emailLogs: Record<string, unknown>[]
  /** Ürün haberleri onayının geçmişi (DOG-130). */
  emailConsents: Record<string, unknown>[]
}

export async function collectUserData(db: Db, userId: string, now = new Date()): Promise<UserDataExport> {
  const [user, accounts, sessions, resumes, jobPostings, analyses, accessPasses, excludedConcepts, emailLogs, emailConsents] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        phone: true,
        applicationReminders: true,
        accessUpdates: true,
        productNews: true,
        goal: true,
        targetRole: true,
        emailVerified: true,
        onboardedAt: true,
        createdAt: true,
      },
    }),
    db.account.findMany({ where: { userId }, select: { providerId: true, createdAt: true } }),
    db.session.findMany({
      where: { userId },
      select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    }),
    db.resume.findMany({
      where: { userId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        label: true,
        savedAt: true,
        isDefault: true,
        rawText: true,
        createdAt: true,
        versions: { select: { versionNo: true, source: true, profile: true, createdAt: true } },
      },
    }),
    db.jobPosting.findMany({
      where: { userId },
      select: {
        id: true,
        position: true,
        rawText: true,
        requirements: true,
        language: true,
        seniority: true,
        // İlan adresi (DOG-95).
        sourceUrl: true,
        createdAt: true,
      },
    }),
    db.analysis.findMany({
      where: { userId },
      select: {
        id: true,
        jobPostingId: true,
        score: true,
        result: true,
        status: true,
        stage: true,
        note: true,
        interviewAt: true,
        reminderSentAt: true,
        // Kullanıcının istediği taslaklar ve yazdığı metinler (DOG-117, DOG-118,
        // DOG-97, DOG-123).
        followUps: true,
        interviewPrep: true,
        formAnswers: true,
        createdAt: true,
        adaptation: { select: { draft: true, coverLetter: true, status: true, createdAt: true } },
      },
    }),
    db.accessPass.findMany({
      where: { userId },
      select: { plan: true, startsAt: true, endsAt: true, status: true, providerOrderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.excludedConcept.findMany({
      where: { userId },
      select: { term: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.emailLog.findMany({
      where: { userId },
      select: { kind: true, category: true, sentAt: true },
      orderBy: { sentAt: "asc" },
    }),
    db.emailConsent.findMany({
      where: { userId },
      select: { purpose: true, granted: true, source: true, textVersion: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return {
    exportedAt: now.toISOString(),
    user,
    accounts,
    sessions,
    resumes,
    jobPostings,
    analyses,
    accessPasses,
    excludedConcepts,
    emailLogs,
    emailConsents,
  }
}

const README = (missing: string[]) =>
  [
    "uyarla · verilerin",
    "",
    "veriler.json  Hesabın, CV'lerin (metin ve ayrıştırılmış sürümler), ilanlar,",
    "              analizler, uyarlamalar ve ön yazılar.",
    "cvler/        Yüklediğin CV dosyalarının kendisi.",
    "",
    "Oturum anahtarları ve giriş jetonları güvenlik nedeniyle bu dosyaya eklenmez.",
    ...(missing.length
      ? ["", "Depoda bulunamayan dosyalar (metinleri veriler.json'da duruyor):", ...missing.map((m) => `  - ${m}`)]
      : []),
    "",
  ].join("\n")

/** Dosya adında yol ayırıcı ve denetim karakteri bırakmıyor. */
function safeName(name: string): string {
  return name.replace(/[/\\\u0000-\u001f]/g, "_").slice(0, 120) || "cv"
}

export async function buildExportZip(
  data: UserDataExport,
  readFile: (filePath: string) => Promise<Buffer | null>,
): Promise<Buffer> {
  const zip = new JSZip()
  const missing: string[] = []

  for (const resume of data.resumes) {
    const name = `${resume.id}-${safeName(resume.fileName ?? "cv")}`
    const content = await readFile(resume.filePath).catch(() => null)
    if (content) zip.file(`cvler/${name}`, content)
    else missing.push(resume.fileName ?? resume.id)
  }

  const publicData = {
    ...data,
    resumes: data.resumes.map(({ filePath: _filePath, ...rest }) => rest),
  }
  zip.file("veriler.json", JSON.stringify(publicData, null, 2))
  zip.file("BENIOKU.txt", README(missing))
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
