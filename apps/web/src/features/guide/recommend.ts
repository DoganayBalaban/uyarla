/**
 * "Nereden başlamalıyım?" (DOG-101): dört soruyla ilk adım. Kurallar burada,
 * saf ve testli; sayfa yalnızca soruları ve sonucu çiziyor.
 *
 * Öneri yalnızca uyarla'da gerçekten olan bir işe götürüyor ve paket
 * satmıyor. Gerekçelerde sayı yok: elimizde ölçülmüş bir oran yokken
 * "adayların %75'i" gibi cümle kurmuyoruz (marka rehberi §11).
 */

export type Stage = "preparing" | "no_response" | "interviewing" | "passive"
export type ResumeState = "ready" | "outdated" | "none"
export type LinkedInState = "active" | "weak" | "none"

export interface GuideAnswers {
  stage: Stage
  hasPosting: boolean
  resume: ResumeState
  linkedin: LinkedInState
}

export interface GuideStep {
  id: "analyze" | "sample_posting" | "sample_report" | "jobs" | "linkedin" | "interviews"
  title: string
  why: string
  href: string
  cta: string
  /** Kayıt istiyor; anonimde giriş ekranına gidiyor. */
  registered: boolean
}

export interface GuideQuestion<K extends keyof GuideAnswers = keyof GuideAnswers> {
  key: K
  title: string
  options: Array<{ value: GuideAnswers[K]; label: string; hint?: string }>
}

export const GUIDE_QUESTIONS: [
  GuideQuestion<"stage">,
  GuideQuestion<"hasPosting">,
  GuideQuestion<"resume">,
  GuideQuestion<"linkedin">,
] = [
  {
    key: "stage",
    title: "İş aramanın neresindesin?",
    options: [
      { value: "preparing", label: "Henüz başvurmadım", hint: "CV'mi hazırlıyorum." },
      { value: "no_response", label: "Başvuruyorum, dönüş gelmiyor", hint: "Ret ya da sessizlik." },
      { value: "interviewing", label: "Mülakatlara çağrılıyorum", hint: "Sıra görüşmelerde." },
      { value: "passive", label: "Çalışıyorum, fırsatlara bakıyorum", hint: "Acelem yok." },
    ],
  },
  {
    key: "hasPosting",
    title: "Başvurmak istediğin bir ilan var mı?",
    options: [
      { value: true, label: "Var", hint: "Metni ya da bağlantısı elimde." },
      { value: false, label: "Henüz yok", hint: "Önce ilan bulmam gerek." },
    ],
  },
  {
    key: "resume",
    title: "CV'n ne durumda?",
    options: [
      { value: "ready", label: "Güncel", hint: "PDF ya da Word dosyası hazır." },
      { value: "outdated", label: "Eski ya da yarım", hint: "Son işim ya da becerilerim eksik." },
      { value: "none", label: "CV'm yok", hint: "Hiç hazırlamadım." },
    ],
  },
  {
    key: "linkedin",
    title: "LinkedIn profilin ne durumda?",
    options: [
      { value: "active", label: "Güncel", hint: "Başlık ve deneyimler yerinde." },
      { value: "weak", label: "Var ama bakımsız", hint: "Uzun zamandır dokunmadım." },
      { value: "none", label: "Profilim yok" },
    ],
  },
]

const STEPS: Record<GuideStep["id"], GuideStep> = {
  analyze: {
    id: "analyze",
    title: "CV'ni bu ilanla karşılaştır",
    why: "İlandaki her gereksinimin CV'nde karşılığı var mı, hangi anahtar kelimeler eksik; bir dakikada görürsün. Kayıt gerekmez.",
    href: "/analyze",
    cta: "Analize başla",
    registered: false,
  },
  sample_posting: {
    id: "sample_posting",
    title: "Örnek bir ilanla dene",
    why: "Elinde ilan yoksa da CV'nin nasıl okunduğunu görebilirsin: hazır örnek ilanlardan birini seç.",
    href: "/analyze#ornek-ilanlar",
    cta: "Örnek ilanla dene",
    registered: false,
  },
  sample_report: {
    id: "sample_report",
    title: "Örnek raporla ATS'nin neye baktığını gör",
    why: "uyarla sıfırdan CV yazmıyor; var olan CV'ni ilana göre düzenliyor. CV'ni hazırlarken örnek rapor, ilanların neyi aradığını gösterir.",
    href: "/ornek-rapor",
    cta: "Örnek raporu aç",
    registered: false,
  },
  jobs: {
    id: "jobs",
    title: "Sana uyan ilanları bul",
    why: "Profilinden kurulan sorguyla iş sitelerinde arar; beğendiğin ilanı getirip uyumunu ölçersin.",
    href: "/jobs",
    cta: "İş ara",
    registered: true,
  },
  linkedin: {
    id: "linkedin",
    title: "LinkedIn profilini gözden geçir",
    why: "Profilinin PDF'ini hedeflediğin ilanlarla karşılaştırır: eksik kalan beceriler, başlık ve “Hakkında” önerileri.",
    href: "/linkedin",
    cta: "LinkedIn raporu",
    registered: true,
  },
  interviews: {
    id: "interviews",
    title: "Mülakata hazırlan",
    why: "Panoda mülakat aşamasındaki başvuru için olası soruları ve CV'ndeki kanıtla cevap iskeletlerini hazırlar; yazılı pratik de var.",
    href: "/interviews",
    cta: "Mülakatlar",
    registered: true,
  },
}

/**
 * Önerilen ilk adım ve en çok iki yan adım. Sıra: önce eldeki işi
 * bitirmek (mülakat), sonra eldeki ilan, sonra ilan bulmak.
 */
export function recommendStart(answers: GuideAnswers): { primary: GuideStep; next: GuideStep[]; note: string | null } {
  const order: GuideStep[] = []

  if (answers.resume === "none") {
    order.push(STEPS.sample_report, answers.hasPosting ? STEPS.analyze : STEPS.sample_posting)
  } else if (answers.stage === "interviewing") {
    // Hazırlık panodaki başvurudan çalışıyor; boş Mülakatlar'a göndermek çıkmaz.
    order.push(
      {
        ...STEPS.analyze,
        title: "Çağrıldığın ilanı analiz et",
        why: "Mülakat hazırlığı başvurunun ilanı ve CV'n üzerinden çalışıyor. Önce ilanı analiz et; başvuru panona düşer, aşamasını mülakat yapınca hazırlık açılır.",
      },
      STEPS.interviews,
    )
  } else if (answers.hasPosting) {
    order.push(STEPS.analyze)
  } else if (answers.stage === "passive" && answers.linkedin === "weak") {
    // Aktif aramayan için ilk temas çoğu zaman profilden geliyor.
    order.push(STEPS.linkedin, STEPS.jobs)
  } else {
    order.push(STEPS.jobs, STEPS.sample_posting)
  }

  // LinkedIn raporu profil PDF'inden çalışıyor; profili olmayana önerilmiyor.
  if (answers.linkedin === "weak") order.push(STEPS.linkedin)
  if (answers.resume !== "none") order.push(STEPS.sample_posting)
  order.push(STEPS.sample_report)

  const seen = new Set<GuideStep["id"]>()
  const unique = order.filter((step) => !seen.has(step.id) && seen.add(step.id))
  const [primary, ...rest] = unique

  return { primary: primary!, next: rest.slice(0, 2), note: noteFor(answers) }
}

function noteFor(answers: GuideAnswers): string | null {
  if (answers.resume === "none") {
    return "Önce kısa, düz bir CV hazırla: iletişim, deneyim, eğitim ve beceriler yeterli. Tasarım değil içerik önemli; ATS düz metni en iyi okuyor."
  }
  if (answers.resume === "outdated") {
    return "Eski CV'nle de başlayabilirsin: analiz neyin eksik kaldığını gösterir, uyarlamada eklenenleri sen onaylarsın."
  }
  if (answers.stage === "no_response") {
    return "Dönüş gelmiyorsa ilk bakılacak yer, CV'nin ilandaki gereksinimleri karşılayıp karşılamadığı. Her ilana aynı CV'yi göndermek, ilanın aradığı kelimeleri kaçırmanın kolay yolu."
  }
  return null
}
