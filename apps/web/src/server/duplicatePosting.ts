import type { prisma } from "@uyarla/db"

type Db = typeof prisma

/**
 * Aynı ilan daha önce analiz edildi mi (DOG-98). Jobscan "aynı iş zaten
 * kayıtlıysa" uyarıyor; bizde ikinci analiz hem panoya ikinci bir kart
 * ekliyor hem LLM maliyeti. Kayıtlı CV seçildiyse eşleşme o CV'yle sınırlı:
 * aynı ilanı farklı bir CV ile denemek meşru. Metin birebir karşılaştırılıyor;
 * kullanıcı aynı ilanı yeniden yapıştırdığında metin de aynı oluyor.
 */
export async function findPreviousAnalysis(
  db: Db,
  input: { userId: string; jobText: string; resumeId: string | null },
): Promise<{ id: string; createdAt: Date } | null> {
  return db.analysis.findFirst({
    where: {
      userId: input.userId,
      status: "done",
      jobPosting: { rawText: input.jobText },
      ...(input.resumeId ? { resumeVersion: { resumeId: input.resumeId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  })
}
