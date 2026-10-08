import { applyAdaptation, hasPendingDecisions, toDocumentModel, withContact } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { loadAdaptation } from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf"

  const payload = await loadAdaptation(id)
  if (!payload?.draft || !payload.profile || !payload.resumeId) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  try {
    ensureOwner(payload.ownerId, await getSession())
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    throw error
  }

  // İndirme kapısı (spec §8; §16'da "asla kesilmeyecek" listesinde): uyarı
  // taşıyan bir madde karara bağlanmadan belge üretilmez.
  if (hasPendingDecisions(payload.draft)) {
    return NextResponse.json(
      {
        error: "Önce işaretli maddeler için karar ver. Sonra indirebilirsin.",
        code: "pending_decisions",
      },
      { status: 409 },
    )
  }

  const adapted = applyAdaptation(payload.profile, payload.draft)

  // Nihai eser burada doğuyor: indirilen belge tam olarak onaylanan hâl
  // (spec §4). Çalışma hâli (draft) ile nihai sürüm farklı şeyler.
  const existing = await prisma.resumeVersion.count({ where: { resumeId: payload.resumeId } })
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: payload.resumeId,
      profile: adapted as unknown as object,
      source: "adapted",
      versionNo: existing + 1,
    },
  })
  await prisma.adaptation.update({ where: { id }, data: { resumeVersionId: version.id } })

  // İletişim satırı: CV'de e-posta/telefon yoksa hesaptaki bilgi (DOG-58).
  const owner = await prisma.user.findUnique({
    where: { id: payload.ownerId! },
    select: { email: true, phone: true, isAnonymous: true },
  })
  const baseModel = toDocumentModel(adapted)
  const model = {
    ...baseModel,
    contact: withContact(baseModel.contact, {
      // Anonim oturumun e-postası yer tutucu; belgeye yazılmıyor.
      email: owner && !owner.isAnonymous ? owner.email : null,
      phone: owner?.phone ?? null,
    }),
  }

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
