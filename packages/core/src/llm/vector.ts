/**
 * Vektör yardımcıları. Bağımlılıksız: skor modülü bunu içe aktarıyor ve
 * tarayıcıda da çalışıyor; embedding.ts OpenAI istemcisini çektiği için
 * oradan alınsaydı istemci paketine sızardı (DOG-90, K-68).
 */

/** İki vektör arasındaki kosinüs benzerliği. Sıfır vektörde 0 döner. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vektör boyutları uyuşmuyor: ${a.length} ve ${b.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dot / denominator
}
