/**
 * İşleri sırayla çalıştırır. Analiz sonucunu değiştiren PATCH'ler sonucu okuyup
 * bütün olarak yazıyor; üst üste binerlerse sonraki öncekini sessizce siler.
 * Yavaş bir beyan bitmeden başlayan uyarlama da eksik profil okur (K-114).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task)
    tail = run.catch(() => {})
    return run
  }
}
