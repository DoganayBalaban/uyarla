import { toDocumentModel, type DocumentModel } from "@uyarla/core/document/model"
import { withContact } from "@uyarla/core/document/contact"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { prisma } from "@uyarla/db"

/**
 * İndirilen belgenin modelini kuran fonksiyon. İndirme ve tek sayfa planı
 * (DOG-93) aynı belgeyi görmeli: sayfa sayısı iletişim satırına ve bölüm
 * sırasına da bağlı.
 */
export async function documentModelFor(ownerId: string): Promise<(profile: ResumeProfile) => DocumentModel> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true, phone: true, isAnonymous: true, goal: true },
  })
  return (profile) => {
    // İlk işini arayanda eğitim deneyimden önce (DOG-55), CV'nin kendi sırası
    // bilinmiyorsa (K-60).
    const base = toDocumentModel(profile, { educationFirst: owner?.goal === "first_job" })
    return {
      ...base,
      // İletişim satırı: CV'de e-posta/telefon yoksa hesaptaki bilgi (DOG-58).
      contact: withContact(base.contact, {
        // Anonim oturumun e-postası yer tutucu; belgeye yazılmıyor.
        email: owner && !owner.isAnonymous ? owner.email : null,
        phone: owner?.phone ?? null,
      }),
    }
  }
}
