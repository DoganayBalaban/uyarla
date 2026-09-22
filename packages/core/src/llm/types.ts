export interface ExtractOptions {
  /** Sistem yönergesi: modelden ne istediğimiz. */
  prompt: string
  /** Şemanın adı; LM Studio json_schema kısıtında zorunlu. */
  schemaName: string
  /** JSON Schema — Zod şemasından üretilir (Görev 5). */
  schema: Record<string, unknown>
  /** İşlenecek ham metin. */
  input: string
}

export interface ExtractResult<T> {
  data: T
  /** Analysis.tokenUsage için (spec §5). */
  tokens: number
}

export interface LlmProvider {
  extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>>
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface LlmConfig {
  baseUrl: string
  model: string
  timeoutMs: number
}

/**
 * Sağlayıcı yapılandırmasını ortamdan okur.
 * Model adının kodda geçtiği tek nokta burası değil — hiçbir yerde geçmiyor;
 * bu fonksiyon onu ortamdan alıyor (K-03).
 */
export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const baseUrl = env.LLM_BASE_URL
  const model = env.LLM_MODEL
  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL ve LLM_MODEL ortam değişkenleri zorunlu")
  }
  return { baseUrl, model, timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60000) }
}
