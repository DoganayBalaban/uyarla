import { describe, it, expect, vi } from "vitest"
import { LmStudioProvider } from "./lmstudio.js"
import { llmConfigFromEnv } from "./types.js"
import { TransientError } from "../errors.js"

const cfg = { baseUrl: "http://localhost:1234/v1", model: "test-model", timeoutMs: 1000 }

const fakeClient = (impl: unknown) =>
  ({ chat: { completions: { create: impl } } }) as never

describe("LmStudioProvider", () => {
  it("passes the schema constraint and model to the request and parses the JSON", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"name":"Elif"}' } }],
      usage: { total_tokens: 42 },
    })
    const provider = new LmStudioProvider(cfg, fakeClient(create))

    const result = await provider.extract<{ name: string }>({
      prompt: "Adı çıkar",
      schemaName: "kisi",
      schema: { type: "object", properties: { name: { type: "string" } } },
      input: "Adım Elif",
    })

    expect(result.data).toEqual({ name: "Elif" })
    expect(result.tokens).toBe(42)

    const args = create.mock.calls[0]![0] as Record<string, unknown>
    expect(args.model).toBe("test-model")
    expect(args.temperature).toBe(0)
    expect(args.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "kisi", strict: true },
    })
  })

  it("sends the prompt as the system message and the input as the user message", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "{}" } }],
    })
    await new LmStudioProvider(cfg, fakeClient(create)).extract({
      prompt: "yönerge", schemaName: "s", schema: {}, input: "girdi",
    })

    const args = create.mock.calls[0]![0] as { messages: Array<{ role: string; content: string }> }
    expect(args.messages).toEqual([
      { role: "system", content: "yönerge" },
      { role: "user", content: "girdi" },
    ])
  })

  it("counts tokens as 0 when usage is missing", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] })),
    )
    const result = await provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" })
    expect(result.tokens).toBe(0)
  })

  it("turns a network error into a transient error", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))),
    )
    await expect(
      provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" }),
    ).rejects.toBeInstanceOf(TransientError)
  })

  it("treats an empty response as a transient error", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockResolvedValue({ choices: [{ message: { content: "" } }] })),
    )
    await expect(
      provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" }),
    ).rejects.toBeInstanceOf(TransientError)
  })

  it("treats invalid JSON as a transient error and puts the raw output in the message", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockResolvedValue({ choices: [{ message: { content: "{bozuk" } }] })),
    )
    await expect(
      provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" }),
    ).rejects.toMatchObject({ code: "llm_invalid_json" })
  })
})

describe("llmConfigFromEnv", () => {
  it("reads from the environment", () => {
    expect(
      llmConfigFromEnv({
        LLM_BASE_URL: "http://x/v1", LLM_MODEL: "m", LLM_TIMEOUT_MS: "5000",
      } as NodeJS.ProcessEnv),
    ).toEqual({ baseUrl: "http://x/v1", model: "m", timeoutMs: 5000 })
  })

  it("errors when the model is undefined", () => {
    expect(() =>
      llmConfigFromEnv({ LLM_BASE_URL: "http://x/v1" } as NodeJS.ProcessEnv),
    ).toThrow(/LLM_MODEL/)
  })
})
