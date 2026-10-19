import { containsKeyword, normalizeText } from "../normalize/turkish.js"
import type { Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { Evidence } from "./evidence.js"

/**
 * Evet/hayır şartları (DOG-115): ikamet, ehliyet, askerlik, seyahat,
 * çalışma düzeni.
 *
 * Yetkinlik değiller; CV bunları ya düz bir satırla söyler ("Askerlik:
 * Tamamlandı", "B sınıfı ehliyet") ya hiç söylemez. Bu yüzden anlamsal
 * eşleşme yok ve kavram kelimeleri de aranmıyor: "seyahat engeli olmayan"
 * şartı bir maddedeki "seyahat acentesi" kelimesiyle "karşılanmış" görünürdü.
 * Yalnızca CV'nin cevap verebildiği üç konu aranıyor; bulunamayan her şart
 * "kontrol et" olarak kalıyor. CV'ye bakarak hiçbir şart "karşılanmıyor"
 * denmiyor: CV'de yazmaması adayın şartı karşılamadığı anlamına gelmez.
 */
interface Topic {
  /** Şart bu konuyu mu soruyor. */
  asks: RegExp
  /** CV satırı bu konuya cevap veriyor mu. */
  answers: RegExp
}

/** Kalıplar normalizeText biçiminde: küçük harf, "ı" → "i", noktalama boşluk. */
const TOPICS: Topic[] = [
  {
    asks: /ehliyet|sürücü belge|araç kullan|driv(?:ing|er s|ers) licen[cs]e|drive a (?:car|vehicle)/,
    // "B sınıfı" tek başına da cevap: tablolu CV'de "Sürücü belgesi | B
    // sınıfı" satırının etiketi ayrıştırmada düşebiliyor (eval cv-f).
    answers: /ehliyet|sürücü belge|driv(?:ing|er s|ers) licen[cs]e|(?<![\p{L}\p{N}])[a-e]1? sinifi/u,
  },
  {
    asks: /askerlik|military service/,
    answers: /askerlik|tecil|military service/,
  },
]

/**
 * İkamet şartında aranan şehirler. Tam liste değil: ilanlarda en sık geçenler.
 * Listede olmayan şehir "kontrol et"e düşüyor, yanlış eşleşmeye değil.
 */
const CITIES = [
  "İstanbul", "Istanbul", "Ankara", "İzmir", "Izmir", "Bursa", "Antalya", "Kocaeli", "Gebze", "Konya",
  "Adana", "Gaziantep", "Kayseri", "Eskişehir", "Mersin", "Samsun", "Trabzon", "Denizli", "Sakarya",
  "Tekirdağ", "Manisa", "Diyarbakır", "Erzurum", "Malatya", "Muğla", "Bodrum", "Aydın", "Balıkesir",
  "Çanakkale", "Edirne", "Hatay", "Kahramanmaraş", "Şanlıurfa", "Van", "Zonguldak", "Bolu", "Düzce",
]

/** "ikamet eden", "yaşayan", "based in": şart adayın oturduğu yeri soruyor. */
const RESIDENCE = /ikamet|yaşayan|yaşiyor|oturan|resid|based in|liv(?:e|es|ing) in/

/**
 * Şartın cevabını CV'de arayacak satırlar: profilin bütün metni. Skor
 * kanıtında olmayan sertifikalar ve diğer bölümler ("Kişisel Bilgiler")
 * burada var; ehliyet ve askerlik genelde oralarda yazıyor.
 */
function conditionLines(profile: ResumeProfile, evidence: Evidence[]): Evidence[] {
  const other = (text: string): Evidence => ({ text, matchText: text, kind: "other", sourceRef: null })
  return [
    ...evidence,
    ...(profile.headline ? [other(profile.headline)] : []),
    ...profile.experience.map((job) => other(`${job.title} · ${job.company}`)),
    ...profile.certifications.map(other),
    ...(profile.otherSections ?? []).flatMap((section) => section.lines.map((line) => other(`${section.heading}: ${line}`))),
  ].filter((item) => item.text.trim().length > 0)
}

function findAnswer(requirement: Requirement, lines: Evidence[]): Evidence | null {
  const text = requirement.text
  const folded = normalizeText(text)
  for (const topic of TOPICS) {
    if (!topic.asks.test(folded)) continue
    return lines.find((line) => topic.answers.test(normalizeText(line.matchText))) ?? null
  }
  if (RESIDENCE.test(folded)) {
    const cities = CITIES.filter((city) => containsKeyword(text, city))
    if (cities.length === 0) return null
    return lines.find((line) => cities.some((city) => containsKeyword(line.matchText, city))) ?? null
  }
  return null
}

/**
 * Şart sonucu. `matched`: CV'de şarta cevap veren satır var, kanıt o satır;
 * kullanıcı satırın şartı karşılayıp karşılamadığına kendisi bakıyor
 * ("Askerlik: Tecilli" bir ilan için yeterli, öteki için değil). `missing`:
 * "kontrol et". Skora girmiyor ve eksik kavram üretmiyor.
 */
export function matchCondition(
  requirement: Requirement,
  profile: ResumeProfile,
  evidence: Evidence[],
): { status: "matched" | "missing"; evidence: Evidence | null } {
  const answer = findAnswer(requirement, conditionLines(profile, evidence))
  return answer ? { status: "matched", evidence: answer } : { status: "missing", evidence: null }
}
