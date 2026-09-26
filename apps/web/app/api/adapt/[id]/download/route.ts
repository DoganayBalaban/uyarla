import { applyAdaptation, hasPendingDecisions, toDocumentModel } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { loadAdaptation } from "@/lib/adaptation"
import { authErrorResponse, ensureOwner, getSession } from "@/lib/authz"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf"

  const yuk = await loadAdaptation(id)
  if (!yuk?.draft || !yuk.profile || !yuk.resumeId) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  try {
    ensureOwner(yuk.ownerId, await getSession())
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    throw error
  }

  // İndirme kapısı (spec §8; §16'da "asla kesilmeyecek" listesinde): uyarı
  // taşıyan bir madde karara bağlanmadan belge üretilmez.
  if (hasPendingDecisions(yuk.draft)) {
    return NextResponse.json(
      {
        error: "Önce işaretli maddeler için karar ver. Sonra indirebilirsin.",
        code: "pending_decisions",
      },
      { status: 409 },
    )
  }

  const uyarlanmis = applyAdaptation(yuk.profile, yuk.draft)

  // Nihai eser burada doğuyor: indirilen belge tam olarak onaylanan hâl
  // (spec §4). Çalışma hâli (draft) ile nihai sürüm farklı şeyler.
  const mevcut = await prisma.resumeVersion.count({ where: { resumeId: yuk.resumeId } })
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: yuk.resumeId,
      profile: uyarlanmis as unknown as object,
      source: "adapted",
      versionNo: mevcut + 1,
    },
  })
  await prisma.adaptation.update({ where: { id }, data: { resumeVersionId: version.id } })

  const model = toDocumentModel(uyarlanmis)

  // Tembel import: pdfkit ve docx ağır bağımlılıklar. Sprint 1'de pdf-parse'ın
  // Next sunucu katmanında üst seviyeden yüklenemediğini görmüştük; yalnızca
  // indirme anında yükleniyorlar.
  const { renderPdf } = await import("@uyarla/core/document/pdf")
  const { renderDocx } = await import("@uyarla/core/document/docx")

  const buffer = format === "docx" ? await renderDocx(model) : await renderPdf(model)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      "Content-Disposition": `attachment; filename="uyarla-cv.${format}"`,
    },
  })
}
