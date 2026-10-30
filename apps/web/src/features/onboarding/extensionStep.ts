/**
 * Kurulumun son adımı: Chrome eklentisi. Eklenti yalnızca masaüstü Chrome
 * ve Chromium tarayıcılarında (Edge, Brave, Opera) çalışıyor; telefonda ve
 * Safari'de adım gösterilmiyor, kurulu olana da. Saf: tarayıcı bilgisi
 * dışarıdan geliyor.
 */
export function offersExtension(input: { userAgent: string; installed: boolean }): boolean {
  if (input.installed) return false
  const ua = input.userAgent
  // iOS'taki Chrome "CriOS" diye geçiyor ve eklenti çalıştıramıyor.
  return /Chrome\/\d/.test(ua) && !/Mobile|Android|CriOS/.test(ua)
}

/** "Chrome'a ekle"nin hedefi: mağaza yayımlanana kadar eklentinin tanıtım sayfası. */
export function extensionTarget(storeUrl: string | null): string {
  return storeUrl ?? "/eklenti"
}
