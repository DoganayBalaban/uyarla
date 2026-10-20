import { siteUrl } from "@/lib/site"
import { FONT, emailButton, emailShell, escapeHtml } from "@/server/mail"

/**
 * E-posta şablonları (DOG-126). Her şablon konu, HTML ve düz metin döndürüyor;
 * gönderim ve kayıt `send.ts`'de. Ton marka rehberi §6: sen dili, suçlamayan,
 * aciliyet baskısı yok. Her e-postada tek iş, tek düğme.
 */
export interface EmailContent {
  subject: string
  html: string
  text: string
}

const SIGN = "uyarla · Her ilana, doğru CV."
const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" })
/** "YYYY-AA-GG" gün değerleri saat dilimi kaydırmadan biçimleniyor. */
const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" })
const day = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`))

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#111114;">${escapeHtml(text)}</h1>`
}
function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${text}</p>`
}
function h2(text: string): string {
  return `<h2 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#111114;">${escapeHtml(text)}</h2>`
}
function list(items: string[]): string {
  return `<ul style="margin:0 0 20px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.5;color:#111114;">${items.join("")}</ul>`
}
function li(main: string, detail: string): string {
  return `<li style="margin:0 0 8px;">${main}<br><span style="font-size:13px;color:#64748b;">${detail}</span></li>`
}
function role(position: string, company: string | null): string {
  return `${escapeHtml(position)}${company ? ` <span style="color:#64748b;">· ${escapeHtml(company)}</span>` : ""}`
}
const roleText = (position: string, company: string | null) => `${position}${company ? ` · ${company}` : ""}`

/** Kapatılabilen e-postaların alt bilgisi: imzalı çıkış ya da Hesabım. */
function footer(reason: string, unsubscribe: string | null, label: string): string {
  const off = unsubscribe
    ? `İstemiyorsan <a href="${escapeHtml(unsubscribe)}" style="color:#2f4be0;">${label} tek tıkla kapatabilirsin</a>.`
    : `İstemiyorsan <a href="${escapeHtml(`${siteUrl()}/account`)}" style="color:#2f4be0;">Hesabım</a> sayfasından kapatabilirsin.`
  return `${reason} ${off} Bu e-postayı yanıtlarsan bize ulaşır.<br>${SIGN}`
}
function footerText(unsubscribe: string | null): string {
  return unsubscribe ? `Kapatmak için: ${unsubscribe}` : `Hesabım sayfasından kapatabilirsin: ${siteUrl()}/account`
}

// ——— Başvuru hatırlatmaları (DOG-98, DOG-128, DOG-120) ———

export interface FollowupItem {
  position: string
  company: string | null
  appliedAt: Date
}
export interface InterviewItem {
  position: string
  company: string | null
  /** "YYYY-AA-GG" */
  interviewAt: string
  adaptationId: string | null
}
export interface DeadlineItem {
  position: string
  company: string | null
  /** "YYYY-AA-GG" */
  deadline: string
  adaptationId: string | null
}

export interface ReminderBundle {
  followups: FollowupItem[]
  interviews: InterviewItem[]
  deadlines: DeadlineItem[]
}

/**
 * Bir günün başvuru hatırlatmaları tek e-postada (sıklık sınırı, DOG-126).
 * Konu en zamana bağlı olandan: yarınki mülakat, sonra yaklaşan son gün,
 * sonra takip.
 */
export function applicationRemindersEmail(bundle: ReminderBundle, unsubscribe: string | null = null): EmailContent {
  const board = `${siteUrl()}/applications`
  const { followups, interviews, deadlines } = bundle
  const subject =
    interviews.length === 1
      ? `Yarın ${interviews[0]!.company ?? interviews[0]!.position} mülakatın var`
      : interviews.length > 1
        ? `Yarın ${interviews.length} mülakatın var`
        : deadlines.length > 0
          ? "Son başvuru günü yaklaşıyor"
          : "Başvurularından haber var mı?"

  // Tek bir uyarlanmış ilan varsa düğme doğrudan ona: CV ve ön yazı orada.
  const only = [...interviews, ...deadlines]
  const target = only.length === 1 && followups.length === 0 && only[0]!.adaptationId ? `${siteUrl()}/adapt/${only[0]!.adaptationId}` : null

  const parts: string[] = [h1(subject)]
  const text: string[] = [subject, ""]

  if (interviews.length) {
    parts.push(
      p("Uyarladığın CV'ye, ön yazına ve ilana bir kez daha bakmak için iyi bir an: mülakatta CV'ndeki her maddeyi bir örnekle anlatabilmen gerekecek."),
    )
    parts.push(list(interviews.map((i) => li(role(i.position, i.company), `${escapeHtml(day(i.interviewAt))} · mülakat`))))
    text.push("Yarınki mülakatların:", ...interviews.map((i) => `- ${roleText(i.position, i.company)} (${day(i.interviewAt)})`), "")
  }
  if (deadlines.length) {
    if (interviews.length) parts.push(h2("Son başvuru günü yaklaşanlar"))
    parts.push(p("Bu ilanlar için CV'ni uyarladın ama henüz başvurmadın."))
    parts.push(list(deadlines.map((d) => li(role(d.position, d.company), `Son gün ${escapeHtml(day(d.deadline))}`))))
    text.push("Son başvuru günü yaklaşanlar:", ...deadlines.map((d) => `- ${roleText(d.position, d.company)} (son gün ${day(d.deadline)})`), "")
  }
  if (followups.length) {
    if (interviews.length || deadlines.length) parts.push(h2("Bir haftadır ses çıkmayanlar"))
    parts.push(
      p(
        `Bir haftadır aşaması değişmeyen ${followups.length === 1 ? "bir başvurun" : `${followups.length} başvurun`} var. Cevap geldiyse panoda güncelle; gelmediyse kısa bir takip e-postası atmanın tam zamanı.`,
      ),
    )
    parts.push(list(followups.map((f) => li(role(f.position, f.company), `${escapeHtml(DATE.format(f.appliedAt))} tarihinde başvurdun`))))
    text.push(
      "Bir haftadır aşaması değişmeyen başvuruların:",
      ...followups.map((f) => `- ${roleText(f.position, f.company)} (${DATE.format(f.appliedAt)} tarihinde başvurdun)`),
      "",
    )
  }
  parts.push(emailButton(target ?? board, target ? "Uyarladığın CV'yi aç" : "Başvuru panosunu aç"))
  text.push(target ?? board, "", footerText(unsubscribe))

  return {
    subject,
    html: emailShell({
      title: subject,
      preheader: interviews.length ? "Mülakatından önce kısa bir hatırlatma." : "Başvuruların için kısa bir hatırlatma.",
      content: parts.join("\n"),
      footer: footer("Bu hatırlatmaları başvuruların için gönderiyoruz; her biri bir kez.", unsubscribe, "hatırlatmaları"),
    }),
    text: text.join("\n"),
  }
}

// ——— Erişim dönemi (DOG-129) ———

/** "Dönemin bitmesine 2 gün kaldı": bilgilendirme; otomatik yenileme yok, satış dili yok. */
export function accessEndingEmail(endsAt: Date, unsubscribe: string | null = null): EmailContent {
  const date = DATE.format(endsAt)
  const subject = `Erişim dönemin ${date} tarihinde bitiyor`
  const html = emailShell({
    title: subject,
    preheader: "Dönem otomatik yenilenmiyor; bitince ücretsiz plana dönersin.",
    content: [
      h1(subject),
      p(
        "Dönem otomatik yenilenmiyor; bitince ücretsiz plana dönersin. Analizlerin, uyarlamaların ve başvuru panon yerinde kalır. Bekleyen bir ilan varsa bitmeden uyarlayabilirsin.",
      ),
      emailButton(`${siteUrl()}/analyze`, "Uyarlamaya devam et"),
    ].join("\n"),
    footer: footer("Bu bilgiyi erişim dönemin için bir kez gönderiyoruz.", unsubscribe, "erişim dönemi bilgilerini"),
  })
  return {
    subject,
    html,
    text: [
      subject,
      "",
      "Dönem otomatik yenilenmiyor; bitince ücretsiz plana dönersin. Analizlerin, uyarlamaların ve başvuru panon yerinde kalır.",
      `${siteUrl()}/analyze`,
      "",
      footerText(unsubscribe),
    ].join("\n"),
  }
}

/** Ödeme bildirimi işlenince (işlem e-postası). Makbuz Polar'dan ayrıca geliyor. */
export function accessOpenedEmail(endsAt: Date): EmailContent {
  const date = DATE.format(endsAt)
  const subject = "Erişimin açıldı"
  return {
    subject,
    html: emailShell({
      title: subject,
      preheader: `${date} tarihine kadar istediğin kadar uyarlayabilirsin.`,
      content: [
        h1(subject),
        p(`<strong>${escapeHtml(date)}</strong> tarihine kadar istediğin kadar CV uyarlayabilir ve ön yazı oluşturabilirsin. Dönem otomatik yenilenmiyor.`),
        emailButton(`${siteUrl()}/analyze`, "Uyarlamaya başla"),
      ].join("\n"),
      footer: `Ödeme makbuzun Polar'dan ayrıca gelir. Bir sorun varsa bu e-postayı yanıtla.<br>${SIGN}`,
    }),
    text: [subject, "", `${date} tarihine kadar istediğin kadar CV uyarlayabilirsin. Dönem otomatik yenilenmiyor.`, `${siteUrl()}/analyze`].join("\n"),
  }
}

/** Hesap silindikten sonra (işlem e-postası); adres yalnızca bu gönderim için bellekte. */
export function accountDeletedEmail(): EmailContent {
  const subject = "Hesabın ve verilerin silindi"
  const body =
    "İstediğin gibi hesabını sildik: CV dosyaların, CV metnin, analizlerin, uyarlamaların ve ön yazıların artık bizde yok. Paket satın aldıysan, ödemeyi alan Polar fatura kaydını yasal saklama süresi boyunca tutar."
  return {
    subject,
    html: emailShell({
      title: subject,
      preheader: "Bu, hesabınla ilgili gönderdiğimiz son e-posta.",
      content: [h1(subject), p(escapeHtml(body)), p("Bir gün yeniden uyarla'ya ihtiyacın olursa sıfırdan başlayabilirsin.")].join("\n"),
      footer: `Bu, hesabınla ilgili gönderdiğimiz son e-posta. Bu isteği sen yapmadıysan hemen yanıtla.<br>${SIGN}`,
    }),
    text: [subject, "", body, "", "Bu isteği sen yapmadıysan bu e-postayı yanıtla."].join("\n"),
  }
}

// ——— Ürün haberleri ve öneriler (DOG-130; açık onayla) ———

/** Kayıt olup CV yükleyen ama henüz analiz yapmayana, bir kez. */
export function activationNoAnalysisEmail(unsubscribe: string | null = null): EmailContent {
  const subject = "CV'n hazır, bir ilanla dene"
  const body =
    "CV'ni yükledin. Başvurmak istediğin bir ilanı yapıştır; CV'nin ne kadar uyduğunu ve eksik kalan kavramları bir dakikada görürsün."
  return {
    subject,
    html: emailShell({
      title: subject,
      preheader: "İlk analizin bir dakika sürer.",
      content: [h1(subject), p(escapeHtml(body)), emailButton(`${siteUrl()}/analyze`, "İlanla dene")].join("\n"),
      footer: footer("Bu e-postayı ürün haberlerine onay verdiğin için aldın.", unsubscribe, "ürün haberlerini"),
    }),
    text: [subject, "", body, `${siteUrl()}/analyze`, "", footerText(unsubscribe)].join("\n"),
  }
}

/** Analiz yapıp ücretsiz uyarlamasını kullanmayana, bir kez. */
export function activationFreeUnusedEmail(unsubscribe: string | null = null): EmailContent {
  const subject = "Ücretsiz uyarlaman seni bekliyor"
  const body =
    "Analizini yaptın; bir sonraki adım CV'ni o ilana uyarlamak. Deneyiminde olanı ilanın diliyle yazarız, olmayan bir şeyi eklemeyiz. İlk uyarlama ücretsiz."
  return {
    subject,
    html: emailShell({
      title: subject,
      preheader: "İlk uyarlama ücretsiz.",
      content: [h1(subject), p(escapeHtml(body)), emailButton(`${siteUrl()}/applications`, "Analizlerine dön")].join("\n"),
      footer: footer("Bu e-postayı ürün haberlerine onay verdiğin için aldın.", unsubscribe, "ürün haberlerini"),
    }),
    text: [subject, "", body, `${siteUrl()}/applications`, "", footerText(unsubscribe)].join("\n"),
  }
}
