import { createAuthClient } from "better-auth/react"
import { anonymousClient, magicLinkClient } from "better-auth/client/plugins"

/** İstemci tarafı kimlik. React bileşenleri bunu kullanıyor. */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), anonymousClient()],
})

export const { signIn, signOut, useSession } = authClient
