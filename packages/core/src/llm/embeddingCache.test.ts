import { describe, expect, it } from "vitest"
import { CachedEmbeddingProvider, type VectorStore } from "./embeddingCache.js"
import type { EmbeddingProvider } from "./types.js"

/** Her çağrıda farklı vektör dönen sağlayıcı: OpenAI gömmelerindeki gürültünün taklidi. */
function noisyProvider() {
  const calls: string[][] = []
  let n = 0
  const provider: EmbeddingProvider = {
    async embed(texts) {
      calls.push(texts)
      n++
      return texts.map((t) => [t.length + n / 100, 0.5])
    },
  }
  return { provider, calls }
}

function memoryStore(): VectorStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    async mget(keys) {
      return keys.map((k) => data.get(k) ?? null)
    },
    async mset(entries) {
      for (const [k, v] of entries) data.set(k, v)
    },
  }
}

describe("CachedEmbeddingProvider", () => {
  it("aynı metne ikinci çağrıda aynı vektörü veriyor", async () => {
    const { provider } = noisyProvider()
    const cached = new CachedEmbeddingProvider(provider, memoryStore(), "m")

    const [first] = await cached.embed(["React"])
    const [second] = await cached.embed(["React"])

    expect(second).toEqual(first)
  })

  it("yalnızca önbellekte olmayan metinleri sağlayıcıya gönderiyor, sırayı koruyor", async () => {
    const { provider, calls } = noisyProvider()
    const cached = new CachedEmbeddingProvider(provider, memoryStore(), "m")
    await cached.embed(["a", "bb"])

    const vecs = await cached.embed(["ccc", "a", "ccc"])

    expect(calls[1]).toEqual(["ccc"])
    expect(vecs).toHaveLength(3)
    expect(vecs[0]).toEqual(vecs[2])
    expect(vecs[1]![0]).toBeCloseTo(1.01, 5)
  })

  it("model adı anahtara giriyor: başka model önbelleği paylaşmıyor", async () => {
    const store = memoryStore()
    const { provider, calls } = noisyProvider()
    await new CachedEmbeddingProvider(provider, store, "m1").embed(["a"])
    await new CachedEmbeddingProvider(provider, store, "m2").embed(["a"])

    expect(calls).toHaveLength(2)
  })

  it("önbellek hata verirse sağlayıcıya düşüyor", async () => {
    const { provider } = noisyProvider()
    const broken: VectorStore = {
      mget: async () => {
        throw new Error("redis yok")
      },
      mset: async () => {
        throw new Error("redis yok")
      },
    }
    const vecs = await new CachedEmbeddingProvider(provider, broken, "m").embed(["a"])

    expect(vecs).toHaveLength(1)
  })

  it("önbellek yanıt vermezse beklemeden sağlayıcıya düşüyor", async () => {
    const { provider } = noisyProvider()
    const hanging: VectorStore = {
      mget: () => new Promise(() => {}),
      mset: () => new Promise(() => {}),
    }
    const cached = new CachedEmbeddingProvider(provider, hanging, "m", { timeoutMs: 20 })

    await expect(cached.embed(["a"])).resolves.toHaveLength(1)
  })

  it("boş listede hiçbir şey çağırmıyor", async () => {
    const { provider, calls } = noisyProvider()
    expect(await new CachedEmbeddingProvider(provider, memoryStore(), "m").embed([])).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
