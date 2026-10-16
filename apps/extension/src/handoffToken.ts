/**
 * Eklentinin açtığı uyarla sekmesini doğrulayan tek kullanımlık jetonlar
 * (DOG-71).
 *
 * Adres `#ilan=…` ile her site tarafından üretilebiliyor; jeton olmadan
 * herhangi bir bağlantı kayıtlı kullanıcıda analiz başlatabiliyordu. Eklenti
 * uyarla'yı açarken jeton üretip saklıyor, sayfa kendiliğinden göndermeden
 * önce `chrome.runtime.sendMessage` ile soruyor; eklenti jetonu bir kez
 * doğrulayıp siliyor.
 *
 * Saf: depo düz bir nesne (jeton → son geçerlilik zamanı). Chrome tarafı
 * `chrome.storage.session`'a yazıp okuyor (background.ts).
 */
export type TokenStore = Record<string, number>

/** Sekmenin açılıp sayfanın soracağı süre; yavaş bağlantıda da yeterli. */
export const TOKEN_TTL_MS = 10 * 60 * 1000

export function issueToken(
  store: TokenStore,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): { store: TokenStore; token: string } {
  const token = newId()
  const live = Object.fromEntries(Object.entries(store).filter(([, expires]) => expires > now))
  return { store: { ...live, [token]: now + TOKEN_TTL_MS }, token }
}

export function redeemToken(store: TokenStore, token: string, now: number): { store: TokenStore; valid: boolean } {
  const expires = store[token]
  const { [token]: _used, ...rest } = store
  return { store: rest, valid: expires !== undefined && expires > now }
}
