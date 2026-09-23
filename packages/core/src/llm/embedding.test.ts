import { describe, it, expect, vi } from "vitest"
import {
  OpenAiCompatibleEmbeddingProvider,
  cosineSimilarity,
  embeddingConfigFromEnv,
} from "./embedding.js"
import { TransientError } from "../errors.js"

const cfg = { baseUrl: "http://localhost:11434/v1", model: "bge-m3", timeoutMs: 1000 }
const fakeClient = (impl: unknown) => ({ embeddings: { create: impl } }) as never

describe("cosineSimilarity", () => {
  it("aynı vektör için 1 döner", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it("dik vektörler için 0 döner", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("zıt vektörler için -1 döner", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it("sıfır vektörde 0 döner, NaN değil", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
  })

  it("farklı boyutlu vektörlerde hata fırlatır", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/boyut/i)
  })
})

describe("EmbeddingProvider", () => {
  it("metinleri tek toplu çağrıda gömer ve sırayı korur", async () => {
    // Sunucu sırayı garanti etmiyor; index alanına göre yerleştirilmeli.
    const create = vi.fn().mockResolvedValue({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
    })
    const provider = new OpenAiCompatibleEmbeddingProvider(cfg, fakeClient(create))

    const vectors = await provider.embed(["ilk", "ikinci"])

    expect(create).toHaveBeenCalledTimes(1)
    expect(vectors).toEqual([
      [1, 0],
      [0, 1],
    ])
  })

  it("modeli ve girdiyi isteğe geçirir", async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1] }] })
    await new OpenAiCompatibleEmbeddingProvider(cfg, fakeClient(create)).embed(["metin"])

    const args = create.mock.calls[0]![0] as Record<string, unknown>
    expect(args.model).toBe("bge-m3")
    expect(args.input).toEqual(["metin"])
  })

  it("boş liste için çağrı yapmaz", async () => {
    const create = vi.fn()
    const provider = new OpenAiCompatibleEmbeddingProvider(cfg, fakeClient(create))
    expect(await provider.embed([])).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it("ağ hatasını geçici hataya çevirir", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(
      cfg,
      fakeClient(vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))),
    )
    await expect(provider.embed(["a"])).rejects.toBeInstanceOf(TransientError)
  })

  it("eksik vektör dönerse hata verir, sessizce boşluk bırakmaz", async () => {
    // Hizalama bozulursa skor yanlış gereksinime kanıt gösterir.
    const provider = new OpenAiCompatibleEmbeddingProvider(
      cfg,
      fakeClient(vi.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1] }] })),
    )
    await expect(provider.embed(["a", "b"])).rejects.toMatchObject({
      code: "embedding_incomplete",
    })
  })
})

describe("embeddingConfigFromEnv", () => {
  it("embedding sunucusunu üretken modelden ayrı okur", () => {
    expect(
      embeddingConfigFromEnv({
        LLM_BASE_URL: "http://localhost:1234/v1",
        EMBEDDING_BASE_URL: "http://localhost:11434/v1",
        EMBEDDING_MODEL: "bge-m3",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      baseUrl: "http://localhost:11434/v1",
      model: "bge-m3",
      timeoutMs: 60000,
    })
  })

  it("model tanımsızsa hata verir", () => {
    expect(() =>
      embeddingConfigFromEnv({ EMBEDDING_BASE_URL: "http://x/v1" } as NodeJS.ProcessEnv),
    ).toThrow(/EMBEDDING_MODEL/)
  })

  it("adres tanımsızsa hata verir", () => {
    expect(() =>
      embeddingConfigFromEnv({ EMBEDDING_MODEL: "bge-m3" } as NodeJS.ProcessEnv),
    ).toThrow(/EMBEDDING_BASE_URL/)
  })
})
