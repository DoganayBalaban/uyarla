import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { anonymous, magicLink } from "better-auth/plugins"
import { prisma } from "@uyarla/db"
import { claimOperations as claimOperations } from "@/server/claimAnonymousData"
import { sendMagicLinkEmail } from "@/server/mail"
import { providerSettings as providerSettings } from "@/features/auth/providers"

/**
 * Kimlik katmanı. `packages/core` bunu bilmiyor ve bilmemeli: kimlik HTTP
 * katmanının işi, alan mantığı oturumdan bağımsız kalıyor.
 *
 * Ana giriş yöntemi magic link (spec §6). Parola yok: unutulacak bir şey
 * yok, sızacak bir şey yok, ve tek seferlik CV uyarlaması için parola
 * kurmak gereksiz sürtünme. Google, LinkedIn ve GitHub isteğe bağlı:
 * kimlik bilgileri .env'de varsa açılıyorlar.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  /**
   * Kimlik uçlarının limiti (spec §9).
   *
   * Genel limit cömert, sıkı kural yalnızca magic link gönderimine
   * uygulanıyor. İlk hâli global dakikada 3'tü ve arayüzü kırıyordu:
   * useSession() oturumu yokluyor, /get-session dakikada 3'ü hemen aşıyor ve
   * oturum çubuğu hiç yüklenemiyordu (canlı denemede 429 görüldü).
   *
   * /get-session tümüyle muaf: oturum okumak pahalı değil ve arayüzün her
   * gezinmede ihtiyacı var.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Bir e-posta adresine bağlantı yağmuru yapılmasını engelliyor.
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/get-session": false,
    },
  },

  // Kimlik bilgisi .env'de olan sağlayıcılar açılıyor; hiçbiri yoksa boş.
  // Anonim kullanıcı sosyal girişle kaydolursa işi yine devralınıyor:
  // anonymous eklentisinin onLinkAccount'u giriş yönteminden bağımsız.
  socialProviders: providerSettings(),

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
          claimOperations(prisma, anonymousUser.user.id, newUser.user.id),
        )
      },
    }),
    // EN SONDA olmak zorunda: sunucu tarafında auth.api.* çağrıldığında
    // Set-Cookie'yi Next'in çerez deposuna yazıyor. Olmadan anonim oturum
    // kuruluyor ama isteği yapan tarafa ulaşmıyor.
    nextCookies(),
  ],
})
