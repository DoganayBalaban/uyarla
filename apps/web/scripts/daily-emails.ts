import { prisma } from "@uyarla/db"
import { runDailyEmails } from "../src/server/email/daily"
import { mailClientFromEnv } from "../src/server/email/send"

/**
 * Günlük e-postalar (DOG-126..130): başvuru hatırlatmaları (takip, mülakat,
 * son başvuru tarihi), erişim dönemi bilgisi ve onaylı kullanıcıya ürün
 * haberleri. Mantık `src/server/email/daily.ts`'te test edilebilir duruyor.
 *
 * Üretimde anonim temizlikle aynı Railway cron servisi günde bir çalıştırıyor
 * (`cleanup:cron`, 07:00 UTC = 10:00 TR). Servisin ortamında RESEND_API_KEY,
 * EMAIL_FROM, BETTER_AUTH_URL (e-postadaki bağlantılar) ve EMAIL_LINK_SECRET
 * (tek tıkla çıkış, DOG-127) tanımlı olmalı. Ürün haberleri ayrıca
 * PRODUCT_EMAILS_ENABLED=1 istiyor; İYS kaydından önce açılmamalı.
 *
 *   pnpm --filter @uyarla/web emails:daily          # dener, göndermez
 *   pnpm --filter @uyarla/web emails:daily --send   # gönderir
 *
 * Öntanımlı DENEME kipinde: kullanıcılara e-posta göndermek açık bir bayrak
 * istemeli.
 */
async function main(): Promise<void> {
  const send = process.argv.includes("--send")
  // Bağlantılar siteUrl'den (BETTER_AUTH_URL); yoksa e-postaya localhost
  // adresi yazılırdı.
  if (send && !process.env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL yok; e-postadaki bağlantılar yanlış olurdu.")
  const client = mailClientFromEnv()
  if (send && !client) throw new Error("RESEND_API_KEY yok; e-posta gönderilemez.")
  const result = await runDailyEmails(prisma, { dryRun: !send, client })
  const kinds = Object.entries(result.byKind).map(([k, n]) => `${k} ${n}`).join(", ") || "yok"
  if (!send) {
    console.log(`[e-posta] DENEME · ${result.users} aday kullanıcı · türler: ${kinds} · ertelenen ${result.deferred}. Göndermek için --send ekle.`)
    return
  }
  console.log(`[e-posta] ${result.sent} gönderildi, ${result.failed} gönderilemedi, ${result.deferred} ertelendi · türler: ${kinds}`)
  if (result.failed > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("[e-posta] durdu:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
