import { Resend } from "resend"

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface MailClient {
  emails: {
    send(args: {
      from: string
      to: string
      subject: string
      html: string
    }): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

const KONU = "Uyarla'ya giriş bağlantın"

function govde(url: string): string {
  // Sade HTML: e-posta istemcilerinin çoğu CSS'i kırpıyor ve bağlantının
  // her yerde tıklanabilir kalması gönderinin tek işi.
  return `
    <p>Merhaba,</p>
    <p>Aşağıdaki bağlantıya tıklayarak Uyarla'ya girebilirsin:</p>
    <p><a href="${url}">Uyarla'ya gir</a></p>
    <p>Bağlantı 15 dakika geçerli ve tek kullanımlık.</p>
    <p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
  `
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
  const anahtar = process.env.RESEND_API_KEY

  if (!anahtar && !client) {
    console.info(
      `\n[kimlik] E-posta gönderilmedi (RESEND_API_KEY yok).\n` +
        `  alıcı   : ${input.email}\n` +
        `  bağlantı: ${input.url}\n`,
    )
    return
  }

  const mail = client ?? (new Resend(anahtar) as unknown as MailClient)
  const { error } = await mail.emails.send({
    from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
    to: input.email,
    subject: KONU,
    html: govde(input.url),
  })

  // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
  if (error) throw new Error(`E-posta gönderilemedi: ${error.message}`)
}
