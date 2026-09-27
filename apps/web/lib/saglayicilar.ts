/**
 * Sosyal giriş sağlayıcıları.
 *
 * Bir sağlayıcı yalnızca iki ortam değişkeni de doluysa açılıyor. Böylece
 * giriş ekranı butonları her zaman gösterebiliyor, kimlik bilgisi eklenen
 * sağlayıcı ek kod gerektirmeden çalışmaya başlıyor.
 */
export const SAGLAYICILAR = ["google", "linkedin", "github"] as const
export type Saglayici = (typeof SAGLAYICILAR)[number]

const ENV: Record<Saglayici, { id: string; secret: string }> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  linkedin: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
}

/** Kimlik bilgileri tanımlı sağlayıcılar ve bilgileri. Yalnızca sunucuda. */
export function saglayiciAyarlari(
  env: Record<string, string | undefined> = process.env,
): Partial<Record<Saglayici, { clientId: string; clientSecret: string }>> {
  const ayarlar: Partial<Record<Saglayici, { clientId: string; clientSecret: string }>> = {}
  for (const s of SAGLAYICILAR) {
    const clientId = env[ENV[s].id]
    const clientSecret = env[ENV[s].secret]
    if (clientId && clientSecret) ayarlar[s] = { clientId, clientSecret }
  }
  return ayarlar
}

export function acikSaglayicilar(env?: Record<string, string | undefined>): Saglayici[] {
  return Object.keys(saglayiciAyarlari(env)) as Saglayici[]
}
