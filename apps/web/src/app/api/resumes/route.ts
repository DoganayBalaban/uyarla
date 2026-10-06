import { fileStoreFromEnv, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { labelSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { addFileToLibrary, listLibrary } from "@/server/resumeLibrary"
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

/** Kütüphaneye CV yükler (onboarding ve hesabım). Kurallar addFileToLibrary'de. */
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

    const resume = await addFileToLibrary(prisma, fileStoreFromEnv(), {
      userId: user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      label: label.data,
    })
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
