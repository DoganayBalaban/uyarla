import { Resend } from "resend"
import { siteUrl } from "@/lib/site"

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface MailClient {
  emails: {
    send(args: {
      from: string
      to: string
      subject: string
      html: string
      text?: string
      /** Yanıtların gideceği adres (DOG-127); gönderen noreply. */
      replyTo?: string
      /** List-Unsubscribe gibi başlıklar (DOG-127). */
      headers?: Record<string, string>
    }): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

const SUBJECT = "Uyarla'ya giriş bağlantın"

export const FONT = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Marka renkleriyle e-posta iskeleti: logo, beyaz kart, alt bilgi.
 *
 * E-posta istemcilerinin çoğu <style> bloğunu, flex'i ve dönüşümleri
 * kırpıyor; bu yüzden düzen tablolarla, stiller satır içinde. `content` ve
 * `footer` hazır HTML; içindeki kullanıcı metni çağıran tarafından kaçışlanmalı.
 */
export function emailShell(input: { title: string; preheader: string; content: string; footer: string }): string {
  // E-posta istemcilerinin çoğu SVG göstermiyor; logo PNG, site kökünden.
  const logo = escapeHtml(`${siteUrl()}/brand/uyarla-logo.png`)
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 24px;font-family:${FONT};">
            <img src="${logo}" width="131" height="28" alt="uyarla" style="display:block;border:0;outline:none;text-decoration:none;">
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 32px;font-family:${FONT};">
${input.content}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b;">
            ${input.footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** Tablo hücresi buton: Outlook dahil her yerde tıklanabilir kalıyor. */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#2f4be0" style="border-radius:10px;">
                  <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
                </td>
              </tr>
            </table>`
}

/**
 * Giriş e-postası. Butonun çalışmadığı istemciler için bağlantı altta açık
 * metin olarak da var.
 */
function body(url: string): string {
  const href = escapeHtml(url)
  return emailShell({
    title: SUBJECT,
    preheader: "Tek tıkla giriş yap. Bağlantı 15 dakika geçerli.",
    content: `            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#111114;">Giriş bağlantın hazır</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#334155;">Merhaba, aşağıdaki butona tıklayarak Uyarla'ya girebilirsin. Şifre yok, bağlantı yeterli.</p>
            ${emailButton(url, "Uyarla'ya gir")}
            <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Bağlantı <strong style="color:#111114;">15 dakika</strong> geçerli ve tek kullanımlık.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2e8f0;">
              <tr>
                <td style="padding-top:20px;font-size:12px;line-height:1.6;color:#64748b;">
                  Buton çalışmıyorsa bu adresi tarayıcına yapıştır:<br>
                  <a href="${href}" target="_blank" style="color:#2f4be0;word-break:break-all;">${href}</a>
                </td>
              </tr>
            </table>`,
    footer: `Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabında bir değişiklik olmaz.<br>
            uyarla · Her ilana, doğru CV.`,
  })
}

function textBody(url: string): string {
  return [
    "Merhaba,",
    "",
    "Aşağıdaki bağlantıya tıklayarak Uyarla'ya girebilirsin:",
    url,
    "",
    "Bağlantı 15 dakika geçerli ve tek kullanımlık.",
    "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.",
  ].join("\n")
}

/**
 * Magic link e-postasını gönderir.
 *
 * `RESEND_API_KEY` tanımlı değilse bağlantı terminale yazılıyor ve e-posta
 * gönderilmiyor. Bu bir hata durumu değil, bilinçli bir geliştirme modu
 * (spec §6): kimse hesap açmadan da giriş akışını deneyebilmeli.
 */
export async function sendMagicLinkEmail(
  input: { email: string; url: string },
  client?: MailClient,
): Promise<void> {
  const storageKey = process.env.RESEND_API_KEY

  if (!storageKey && !client) {
    console.info(
      `\n[kimlik] E-posta gönderilmedi (RESEND_API_KEY yok).\n` +
        `  alıcı   : ${input.email}\n` +
        `  bağlantı: ${input.url}\n`,
    )
    return
  }

  const mail = client ?? (new Resend(storageKey) as unknown as MailClient)
  const { error } = await mail.emails.send({
    from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
    to: input.email,
    subject: SUBJECT,
    html: body(input.url),
    text: textBody(input.url),
  })

  // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
  if (error) throw new Error(`E-posta gönderilemedi: ${error.message}`)
}
