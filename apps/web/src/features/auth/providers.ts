/**
 * Sosyal giriş sağlayıcıları.
 *
 * Bir sağlayıcı yalnızca iki ortam değişkeni de doluysa açılıyor. Böylece
 * giriş ekranı butonları her zaman gösterebiliyor, kimlik bilgisi eklenen
 * sağlayıcı ek kod gerektirmeden çalışmaya başlıyor.
 */
export const PROVIDERS = ["google", "linkedin", "github"] as const
export type Provider = (typeof PROVIDERS)[number]

const ENV: Record<Provider, { id: string; secret: string }> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  linkedin: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
}

/** Kimlik bilgileri tanımlı sağlayıcılar ve bilgileri. Yalnızca sunucuda. */
export function providerSettings(
  env: Record<string, string | undefined> = process.env,
): Partial<Record<Provider, { clientId: string; clientSecret: string }>> {
  const settings: Partial<Record<Provider, { clientId: string; clientSecret: string }>> = {}
  for (const s of PROVIDERS) {
    const clientId = env[ENV[s].id]
    const clientSecret = env[ENV[s].secret]
    if (clientId && clientSecret) settings[s] = { clientId, clientSecret }
  }
  return settings
}

export function enabledProviders(env?: Record<string, string | undefined>): Provider[] {
  return Object.keys(providerSettings(env)) as Provider[]
}
