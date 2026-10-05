import OpenAI from "openai"
import { TransientError } from "../errors.js"
import { classifyApiError } from "./apiError.js"
import type { EmbeddingProvider } from "./types.js"

export interface EmbeddingConfig {
  baseUrl: string
  model: string
  timeoutMs: number
  /** Barındırılan API (OpenAI) için; yerel sunucuda boş kalır. */
  apiKey?: string
}

/**
 * Embedding sunucusu üretken modelden AYRI yapılandırılır (K-12).
 *
 * İkisi aynı adrese bağlanırsa sessiz bir kuplaj doğar: üretken modeli
 * değiştirmek — ki süre baskısı nedeniyle muhtemel (K-09) — embedding
 * tarafını da bozar.
 */
export function embeddingConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  const baseUrl = env.EMBEDDING_BASE_URL
  const model = env.EMBEDDING_MODEL
  if (!baseUrl) throw new Error("EMBEDDING_BASE_URL ortam değişkeni zorunlu")
  if (!model) throw new Error("EMBEDDING_MODEL ortam değişkeni zorunlu")
  return {
    baseUrl,
    model,
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60000),
    // Üretken modelin anahtarına düşmüyor: ikisi farklı sağlayıcıda olabilir (K-12).
    ...(env.EMBEDDING_API_KEY ? { apiKey: env.EMBEDDING_API_KEY } : {}),
  }
}

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface EmbeddingClient {
  embeddings: {
    create(args: Record<string, unknown>): Promise<{
      data: Array<{ index: number; embedding: number[] }>
    }>
  }
}

/**
 * OpenAI uyumlu embedding ucu. Ollama, LM Studio ve OpenAI aynı protokolü konuşuyor;
 * sınıf hangisine bağlandığını değil, ne konuştuğunu anlatıyor.
 */
export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly client: EmbeddingClient

  constructor(
    private readonly cfg: EmbeddingConfig,
    client?: EmbeddingClient,
  ) {
    this.client =
      client ??
      (new OpenAI({
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey ?? "yerel", // yerel sunucular anahtar doğrulamıyor
        timeout: cfg.timeoutMs,
      }) as unknown as EmbeddingClient)
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    let response
    try {
      response = await this.client.embeddings.create({
        model: this.cfg.model,
        input: texts,
      })
    } catch (cause) {
      throw classifyApiError(cause, "Embedding çağrısı", "embedding")
    }

    // Sunucu sırayı garanti etmiyor; index alanına göre yerleştiriliyor.
    // Seyrek dizi (`new Array(n)`) kullanılmıyor: .some() ve .every() seyrek
    // dizilerde boşlukları atlar, eksiklik kontrolü sessizce çalışmaz olur.
    const vectors: Array<number[] | undefined> = Array.from({ length: texts.length })
    for (const item of response.data) {
      vectors[item.index] = item.embedding
    }

    // Eksik vektör sessizce geçilmemeli: skor servisi kanıtları indekse göre
    // hizalıyor, bir boşluk yanlış gereksinime kanıt gösterilmesi demek.
    const hasMissing = vectors.some((v) => v === undefined)
    if (hasMissing) {
      throw new TransientError(
        `Embedding eksik döndü: ${texts.length} metin gönderildi, ${response.data.length} vektör geldi`,
        "embedding_incomplete",
      )
    }

    return vectors as number[][]
  }
}

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
