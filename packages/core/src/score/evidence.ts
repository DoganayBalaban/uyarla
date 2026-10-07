import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Eşleştirmenin ve kullanıcıya gösterilecek kanıtın birimi.
 *
 * CV bütün olarak değil, madde düzeyinde gömülüyor (spec §7): kullanıcıya
 * "bu gereksinimi şu maddeniz karşılıyor" diyebilmek için eşleştirmenin de
 * madde düzeyinde olması gerekiyor.
 */
export interface Evidence {
  /**
   * Gömülecek ve kullanıcıya gösterilecek metin. Deneyim maddelerinde unvan
   * ve kurum bağlamını taşır: "panel geliştirdi" tek başına hangi rolde
   * yapıldığını anlatmaz ve anlamsal eşleşme zayıflar.
   */
  text: string
  /**
   * Tam kelime eşleşmesinin bakacağı metin — bağlam ön eki OLMADAN.
   *
   * Ayrı olmasının sebebi somut: unvan ön eki her maddenin başında
   * tekrarlandığı için, unvana denk gelen bir anahtar kelime CV'deki tüm
   * maddelerle eşleşiyor ve kanıt olarak rastgele biri gösteriliyordu.
   * Unvan artık kendi kanıt kaydına sahip (kind: "role"); gerçekten unvan
   * eşleştiğinde kullanıcıya unvan gösterilir.
   */
  matchText: string
  /**
   * `language` ve `summary` sonradan eklendi (K-38): "İyi derecede İngilizce"
   * gereksinimi Diller bölümünde "İngilizce (ileri)" yazan adayda eksik
   * çıkıyordu, "3 yıllık performans pazarlaması deneyimi" özette yazdığı
   * hâlde görülmüyordu.
   */
  kind: "role" | "bullet" | "skill" | "education" | "language" | "summary"
  /** Ham CV metnindeki karşılığı; Sprint 2 uydurma kontrolü için. */
  sourceRef: string | null
}

export function collectEvidence(profile: ResumeProfile): Evidence[] {
  const evidence: Evidence[] = []

  for (const job of profile.experience) {
    const roleEntry = `${job.title} · ${job.company}`

    // Unvan kendi başına kanıttır: ilan "React geliştirici" arıyorsa ve
    // adayın unvanı buysa, bu maddelerden bağımsız bir kanıttır.
    evidence.push({ text: roleEntry, matchText: roleEntry, kind: "role", sourceRef: null })

    for (const bullet of job.bullets) {
      evidence.push({
        text: `${roleEntry}: ${bullet.text}`,
        matchText: bullet.text,
        kind: "bullet",
        sourceRef: bullet.sourceRef,
      })
    }
  }

  for (const skill of profile.skills) {
    evidence.push({ text: skill, matchText: skill, kind: "skill", sourceRef: null })
  }

  for (const edu of profile.education) {
    const content = [edu.school, edu.degree, edu.field].filter(Boolean).join(", ")
    evidence.push({ text: content, matchText: content, kind: "education", sourceRef: null })
  }

  for (const lang of profile.languages) {
    evidence.push({ text: lang, matchText: lang, kind: "language", sourceRef: null })
  }

  // Özet en sonda: kelime eşleşmesi ilk uygun kanıtı aldığı için aynı terim
  // bir maddede de geçiyorsa kullanıcıya madde gösterilir. Cümle cümle
  // bölünüyor ki kanıt olarak koca paragraf değil ilgili cümle görünsün.
  for (const sentence of summarySentences(profile.summary)) {
    evidence.push({ text: sentence, matchText: sentence, kind: "summary", sourceRef: null })
  }

  // Boş alanlar (ayrıştırıcının bıraktığı "" dil/beceri, boş okul) kanıt
  // değil; üstelik OpenAI gömme API'si boş girdiyi 400 ile reddediyor ve
  // analizin tamamı düşüyordu.
  return evidence.filter((item) => item.text.trim().length > 0)
}

function summarySentences(summaryText: string | null): string[] {
  if (!summaryText) return []
  return summaryText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=\p{Lu})/u)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}
