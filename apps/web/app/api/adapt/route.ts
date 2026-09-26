import { PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ADAPT_JOB_OPTIONS } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { adaptQueue } from "@/lib/adaptQueue"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/lib/rateLimit"
import {
  authErrorResponse,
  ensureOwner,
  ensureRegistered,
  getSession,
} from "@/lib/authz"

export const runtime = "nodejs"

/**
 * Uyarlama başlatır. Kayıt burada açılıyor, worker'da değil: kararlar ve
 * indirme de aynı kaydı adresliyor ve arayüzün beklemeden bir kimliğe
 * ihtiyacı var.
 */
export async function POST(request: Request) {
  try {
    const { analysisId } = (await request.json()) as { analysisId?: string }
    if (!analysisId) throw new PermanentError("Analiz kimliği gerekli.", "missing_analysis")

    // Kayıt kontrolü kaynağı ARAMADAN ÖNCE: aksi hâlde anonim kullanıcı
    // "bu analiz var" ile "yok" arasındaki farkı yanıt kodundan okuyabiliyor.
    // Oturum değişkende tutuluyor; Görev 6 hız limiti anahtarı için kullanacak.
    const oturum = ensureRegistered(await getSession())

    // Pahalı uç: madde başına LLM çağrısı (spec §9).
    await enforceRateLimit(redisStore, `uyarla:${oturum.user.id}`, RATE_LIMITS.kayitli)

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } })
    if (!analysis) throw new PermanentError("Analiz bulunamadı.", "analysis_not_found")
    if (analysis.status !== "done") {
      throw new PermanentError("Bu analiz henüz tamamlanmadı.", "analysis_incomplete")
    }

    ensureOwner(analysis.userId, oturum)

    // analysisId benzersiz: bir analizin tek uyarlaması olur (spec §5).
    // Varsa yeniden çalıştırmak yerine mevcut kaydı döndürüyoruz.
    const mevcut = await prisma.adaptation.findUnique({ where: { analysisId } })
    if (mevcut) return NextResponse.json({ adaptationId: mevcut.id })

    const adaptation = await prisma.adaptation.create({
      data: { analysisId, draft: {}, modelId: analysis.modelId, status: "running" },
    })

    await adaptQueue.add("adapt", { adaptationId: adaptation.id }, ADAPT_JOB_OPTIONS)

    return NextResponse.json({ adaptationId: adaptation.id })
  } catch (error) {
    const yetkiYaniti = authErrorResponse(error)
    if (yetkiYaniti) return yetkiYaniti
    if (error instanceof PermanentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("[api/adapt]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}
