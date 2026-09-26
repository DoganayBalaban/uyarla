import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { anonymous, magicLink } from "better-auth/plugins"
import { prisma } from "@uyarla/db"
import { devralmaIslemleri } from "./devral"
import { sendMagicLinkEmail } from "./mail"

/**
 * Kimlik katmanı. `packages/core` bunu bilmiyor ve bilmemeli: kimlik HTTP
 * katmanının işi, alan mantığı oturumdan bağımsız kalıyor.
 *
 * Tek giriş yöntemi magic link (spec §6). Parola yok: unutulacak bir şey
 * yok, sızacak bir şey yok, ve tek seferlik CV uyarlaması için parola
 * kurmak gereksiz sürtünme.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Kimlik uçlarının kendi limiti (spec §9). Bir e-posta adresine bağlantı
  // yağmuru yapılmasını engelliyor. Pahalı uçların limiti ayrı (Görev 6).
  rateLimit: { enabled: true, window: 60, max: 3 },

  // Google buraya gelecek. Kimlik bilgileri .env'ye eklendiğinde açılıyor;
  // şimdilik boş (spec §6).
  socialProviders: {},

  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 dakika
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url })
      },
    }),
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        // Tek işlemde: yarısı taşınmış bir kullanıcı, hiç taşınmamıştan daha
        // kötü — skorunu görüyor ama CV'si yok (spec §7).
        await prisma.$transaction(
          devralmaIslemleri(prisma, anonymousUser.user.id, newUser.user.id),
        )
      },
    }),
    // EN SONDA olmak zorunda: sunucu tarafında auth.api.* çağrıldığında
    // Set-Cookie'yi Next'in çerez deposuna yazıyor. Olmadan anonim oturum
    // kuruluyor ama isteği yapan tarafa ulaşmıyor.
    nextCookies(),
  ],
})
