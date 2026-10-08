import { createHash } from "node:crypto"
import type { EmbeddingProvider } from "./types.js"

/**
 * Önbelleğin ihtiyaç duyduğu dar anahtar-değer yüzeyi. Core Redis'e bağımlı
 * değil; web ve worker kendi ioredis bağlantısıyla dolduruyor.
 */
export interface VectorStore {
  mget(keys: string[]): Promise<(string | null)[]>
  mset(entries: Array<[key: string, value: string]>): Promise<void>
}

export interface EmbeddingCacheOptions {
  /** Önbellek bu sürede yanıt vermezse sağlayıcıya düşülüyor. */
  timeoutMs?: number
}

/**
 * Gömmeleri metne göre önbelleğe alan sarmalayıcı (DOG-57).
 *
 * OpenAI aynı metne çağrıdan çağrıya ~1e-2 farklı vektör döndürüyor. Analiz
 * skoru bir kez, uyarlama sonrası skor her sayfa yüklemesinde hesaplandığı
 * için eşiğe yakın eşleşmeler hiçbir şey değişmeden ±1-2 puan oynuyordu.
 * Aynı metin hep aynı vektörü alınca değişmeyen kanıtlar skoru da değiştirmiyor.
 *
 * Önbellek yalnızca bir hızlandırıcı ve tutarlılık aracı: hata verirse ya da
 * yanıt vermezse gömme yine sağlayıcıdan geliyor, kullanıcı akışı kesilmiyor.
 */
export class CachedEmbeddingProvider implements EmbeddingProvider {
  private readonly timeoutMs: number

  constructor(
    private readonly inner: EmbeddingProvider,
    private readonly store: VectorStore,
    private readonly model: string,
    options: EmbeddingCacheOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 1000
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const unique = [...new Set(texts)]
    const keys = unique.map((t) => this.keyOf(t))
    const stored = (await this.withTimeout(this.store.mget(keys))) ?? keys.map(() => null)

    const vectorOf = new Map<string, number[]>()
    const missing: string[] = []
    unique.forEach((text, i) => {
      const hit = stored[i]
      if (hit) vectorOf.set(text, decode(hit))
      else missing.push(text)
    })

    if (missing.length > 0) {
      const fresh = await this.inner.embed(missing)
      const entries: Array<[string, string]> = []
      missing.forEach((text, i) => {
        const encoded = encode(fresh[i]!)
        entries.push([this.keyOf(text), encoded])
        // Taze vektör de float32'ye yuvarlanıyor: aksi hâlde aynı metin ilk
        // çağrıda float64, sonrakilerde float32 dönerdi.
        vectorOf.set(text, decode(encoded))
      })
      await this.withTimeout(this.store.mset(entries))
    }

    return texts.map((t) => vectorOf.get(t)!)
  }

  private keyOf(text: string): string {
    const digest = createHash("sha256").update(text).digest("hex")
    return `emb:v1:${this.model}:${digest}`
  }

  /** Hata ya da zaman aşımında null; çağıran sağlayıcıya düşüyor. */
  private async withTimeout<T>(promise: Promise<T>): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), this.timeoutMs)
    })
    try {
      return await Promise.race([promise, timeout])
    } catch (error) {
      console.warn("[embedding] önbellek kullanılamadı:", (error as Error).message)
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

// float32 + base64: 1536 boyutlu vektör ~8 KB, JSON'un yarısından az.
function encode(vector: number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString("base64")
}

function decode(value: string): number[] {
  // Kopya alınıyor: Buffer havuzdan geldiğinde byteOffset 4'ün katı olmayabilir.
  const bytes = new Uint8Array(Buffer.from(value, "base64"))
  return Array.from(new Float32Array(bytes.buffer))
}

/** ioredis bağlantısını `VectorStore`'a çeviriyor; kayıtlar `ttlSeconds` sonra siliniyor. */
export function redisVectorStore(
  redis: {
    mget(keys: string[]): Promise<(string | null)[]>
    multi(): { set(key: string, value: string, mode: "EX", seconds: number): unknown; exec(): Promise<unknown> }
  },
  ttlSeconds = 30 * 24 * 60 * 60,
): VectorStore {
  return {
    mget: (keys) => redis.mget(keys),
    async mset(entries) {
      const tx = redis.multi()
      for (const [key, value] of entries) tx.set(key, value, "EX", ttlSeconds)
      await tx.exec()
    },
  }
}
