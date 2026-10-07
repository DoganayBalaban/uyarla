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
    }): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

const SUBJECT = "Uyarla'ya giriş bağlantın"

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Marka renkleriyle giriş e-postası.
 *
 * E-posta istemcilerinin çoğu <style> bloğunu, flex'i ve dönüşümleri
 * kırpıyor; bu yüzden düzen tablolarla, stiller satır içinde. Buton da bir
 * tablo hücresi: Outlook dahil her yerde tıklanabilir kalıyor. Butonun
 * çalışmadığı istemciler için bağlantı altta açık metin olarak da var.
 */
function body(url: string): string {
  const href = escapeHtml(url)
  // E-posta istemcilerinin çoğu SVG göstermiyor; logo PNG, site kökünden.
  const logo = escapeHtml(`${siteUrl()}/brand/uyarla-logo.png`)
  const font = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tek tıkla giriş yap. Bağlantı 15 dakika geçerli.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 24px;font-family:${font};">
            <img src="${logo}" width="131" height="28" alt="uyarla" style="display:block;border:0;outline:none;text-decoration:none;">
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 32px;font-family:${font};">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">Giriş bağlantın hazır</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#334155;">Merhaba, aşağıdaki butona tıklayarak Uyarla'ya girebilirsin. Şifre yok, bağlantı yeterli.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#2b4eff" style="border-radius:10px;">
                  <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Uyarla'ya gir</a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Bağlantı <strong style="color:#0f172a;">15 dakika</strong> geçerli ve tek kullanımlık.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2e8f0;">
              <tr>
                <td style="padding-top:20px;font-size:12px;line-height:1.6;color:#64748b;">
                  Buton çalışmıyorsa bu adresi tarayıcına yapıştır:<br>
                  <a href="${href}" target="_blank" style="color:#2b4eff;word-break:break-all;">${href}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:${font};font-size:12px;line-height:1.6;color:#64748b;">
            Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabında bir değişiklik olmaz.<br>
            uyarla · Her ilana, doğru CV.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
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
