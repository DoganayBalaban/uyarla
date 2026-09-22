import OpenAI from "openai"
import { TransientError } from "../errors.js"
import type { ExtractOptions, ExtractResult, LlmConfig, LlmProvider } from "./types.js"

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface ChatClient {
  chat: {
    completions: {
      create(args: Record<string, unknown>): Promise<{
        choices: Array<{ message: { content: string | null } }>
        usage?: { total_tokens?: number }
      }>
    }
  }
}

export class LmStudioProvider implements LlmProvider {
  private readonly client: ChatClient

  constructor(
    private readonly cfg: LlmConfig,
    client?: ChatClient,
  ) {
    this.client =
      client ??
      (new OpenAI({
        baseURL: cfg.baseUrl,
        apiKey: "lm-studio", // yerel sunucu anahtar doğrulamıyor
        timeout: cfg.timeoutMs,
      }) as unknown as ChatClient)
  }

  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    let response
    try {
      response = await this.client.chat.completions.create({
        model: this.cfg.model,
        messages: [
          { role: "system", content: opts.prompt },
          { role: "user", content: opts.input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
        },
        // Çıkarım yaratıcılık işi değil; aynı girdi aynı çıktıyı vermeli ki
        // değerlendirme setindeki iki çalıştırma karşılaştırılabilsin.
        temperature: 0,
      })
    } catch (cause) {
      throw new TransientError(
        `LLM çağrısı başarısız: ${(cause as Error).message}`,
        "llm_unreachable",
      )
    }

    const content = response.choices[0]?.message.content
    if (!content) {
      throw new TransientError("LLM boş yanıt döndü", "llm_empty_response")
    }

    // Şema kısıtı (K-04) bunu imkânsız kılmalı; yine de son savunma.
    // İki kez üst üste olması şemanın küçük model için fazla karmaşık
    // olduğunun sinyalidir (spec §11).
    try {
      return { data: JSON.parse(content) as T, tokens: response.usage?.total_tokens ?? 0 }
    } catch {
      throw new TransientError(
        `LLM geçersiz JSON döndü: ${content.slice(0, 200)}`,
        "llm_invalid_json",
      )
    }
  }
}
