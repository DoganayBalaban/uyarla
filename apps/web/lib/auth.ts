import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { anonymous, magicLink } from "better-auth/plugins"
import { prisma } from "@uyarla/db"

/**
 * Kimlik katmanı. `packages/core` bunu bilmiyor ve bilmemeli: kimlik HTTP
 * katmanının işi, alan mantığı oturumdan bağımsız kalıyor.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    magicLink({
      // Gerçek gönderim Görev 2'de; CLI'ın şema üretmesi için eklentinin
      // etkin olması yeterli.
      sendMagicLink: async () => {},
    }),
    anonymous(),
  ],
})
