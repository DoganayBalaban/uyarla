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
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it("returns 0 for a zero vector, not NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
  })

  it("throws for vectors of different dimensions", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/boyut/i)
  })
})

describe("EmbeddingProvider", () => {
  it("embeds texts in a single batch call and keeps order", async () => {
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

  it("passes the model and input to the request", async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1] }] })
    await new OpenAiCompatibleEmbeddingProvider(cfg, fakeClient(create)).embed(["metin"])

    const args = create.mock.calls[0]![0] as Record<string, unknown>
    expect(args.model).toBe("bge-m3")
    expect(args.input).toEqual(["metin"])
  })

  it("makes no call for an empty list", async () => {
    const create = vi.fn()
    const provider = new OpenAiCompatibleEmbeddingProvider(cfg, fakeClient(create))
    expect(await provider.embed([])).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it("turns a network error into a transient error", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(
      cfg,
      fakeClient(vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))),
    )
    await expect(provider.embed(["a"])).rejects.toBeInstanceOf(TransientError)
  })

  it("errors on a missing vector instead of silently leaving a gap", async () => {
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
  it("reads the embedding server separately from the generative model", () => {
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

  it("reads its own API key, not the generative model's", () => {
    const env = {
      EMBEDDING_BASE_URL: "https://api.openai.com/v1",
      EMBEDDING_MODEL: "text-embedding-3-small",
      LLM_API_KEY: "sk-llm",
    } as NodeJS.ProcessEnv
    expect(embeddingConfigFromEnv(env).apiKey).toBeUndefined()
    expect(embeddingConfigFromEnv({ ...env, EMBEDDING_API_KEY: "sk-emb" }).apiKey).toBe("sk-emb")
  })

  it("errors when the model is undefined", () => {
    expect(() =>
      embeddingConfigFromEnv({ EMBEDDING_BASE_URL: "http://x/v1" } as NodeJS.ProcessEnv),
    ).toThrow(/EMBEDDING_MODEL/)
  })

  it("errors when the URL is undefined", () => {
    expect(() =>
      embeddingConfigFromEnv({ EMBEDDING_MODEL: "bge-m3" } as NodeJS.ProcessEnv),
    ).toThrow(/EMBEDDING_BASE_URL/)
  })
})
