import { fileStoreFromEnv, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { labelSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { LibraryFullError, canSave, countLibrary, createResume, listLibrary } from "@/server/resumeLibrary"
import { validateResumeFile } from "@/server/upload"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
    return NextResponse.json({ resumes: await listLibrary(prisma, user.id) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Kütüphaneye CV yükler (onboarding ve hesabım). Doluysa dosya depoya hiç yazılmıyor. */
export async function POST(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const form = await request.formData()
    const file = form.get("cv")
    validateResumeFile(file)
    if (!(file instanceof File)) {
      throw new PermanentError("CV'ni seçer misin? PDF ya da DOCX olabilir.", "missing_file")
    }
    const label = labelSchema.safeParse(String(form.get("label") ?? ""))
    if (!label.success) throw new PermanentError(firstIssue(label.error).message, "invalid_label")

    if (!canSave(await countLibrary(prisma, user.id))) throw new LibraryFullError()

    const filePath = await fileStoreFromEnv().save(Buffer.from(await file.arrayBuffer()), file.name)
    const { resumeId } = await createResume(prisma, {
      userId: user.id,
      filePath,
      fileName: file.name,
      saveToLibrary: "required",
    })
    if (label.data) await prisma.resume.update({ where: { id: resumeId }, data: { label: label.data } })

    const resume = (await listLibrary(prisma, user.id)).find((r) => r.id === resumeId)
    return NextResponse.json({ resume })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    if (error instanceof PermanentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("[api/resumes]", error)
    return NextResponse.json({ error: "CV'ni kaydedemedik. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}
