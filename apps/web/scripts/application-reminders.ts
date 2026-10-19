import { prisma } from "@uyarla/db"
import { sendApplicationReminders } from "../src/server/applicationReminders"

/**
 * Başvuru takip hatırlatmaları (DOG-98). Mantık
 * `src/server/applicationReminders.ts`'te test edilebilir duruyor.
 *
 * Üretimde anonim temizlikle aynı Railway cron servisi günde bir çalıştırıyor
 * (`cleanup:cron`, 07:00 UTC = 10:00 TR); ayrı servis gerekmiyor. Servisin
 * ortamında RESEND_API_KEY, EMAIL_FROM, BETTER_AUTH_URL (e-postadaki
 * bağlantılar) ve EMAIL_LINK_SECRET (tek tıkla çıkış, DOG-127) tanımlı olmalı.
 *
 *   pnpm --filter @uyarla/web reminders:applications          # dener, göndermez
 *   pnpm --filter @uyarla/web reminders:applications --send   # gönderir
 *
 * Öntanımlı DENEME kipinde: kullanıcılara e-posta göndermek açık bir bayrak
 * istemeli.
 */
async function main(): Promise<void> {
  const send = process.argv.includes("--send")
  // Bağlantılar siteUrl'den (BETTER_AUTH_URL); yoksa e-postaya localhost
  // adresi yazılırdı.
  if (send && !process.env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL yok; e-postadaki bağlantılar yanlış olurdu.")
  const result = await sendApplicationReminders(prisma, { dryRun: !send })
  if (!send) {
    console.log(
      `[hatırlatma] DENEME · ${result.users} kullanıcının ${result.applications} başvurusu hatırlatılacak. Göndermek için --send ekle.`,
    )
    return
  }
  console.log(`[hatırlatma] ${result.sent} e-posta gönderildi, ${result.failed} gönderilemedi (${result.applications} başvuru).`)
  if (result.failed > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("[hatırlatma] durdu:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
