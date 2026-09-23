import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { SkillsSchema, skillsJsonSchema } from "../schemas/resume.js"
import { SKILLS_PROMPT } from "./prompts.js"

/**
 * Gerçek bir CV'den alınmış kategorili beceri bölümü.
 *
 * İlk uygulamada model yalnızca kategori başlıklarını döndürüyordu
 * ("AI / LLM", "Backend", "Frontend", "DevOps / Tools") ve altlarındaki
 * becerilerin hepsi kayboluyordu. Gerçek bir CV testinde skorun 14 çıkmasının
 * asıl sebebi buydu: CV'de RAG, MCP ve tool calling yazıyor, ilan tam olarak
 * bunları arıyordu, hiçbiri çıkarılmamıştı.
 */
const KATEGORILI_BLOK = `TECHNICAL SKILLS

AI / LLM
LLMs, Generative AI, RAG, AI Agents, MCP, prompt engineering, embeddings, tool calling

Backend
Python, FastAPI, REST APIs, SSE, PostgreSQL, Supabase

Frontend
React, ReactFlow, Zustand, JavaScript/TypeScript

DevOps / Tools
Docker, Git, GitHub Actions, Linux`

describe("beceri çıkarımı · gerçek model", () => {
  it("kategorili beceri bölümünde başlıkları değil becerileri çıkarır", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await llm.extract({
      prompt: SKILLS_PROMPT,
      schemaName: "resume_skills",
      schema: skillsJsonSchema,
      input: KATEGORILI_BLOK,
    })
    const { skills } = SkillsSchema.parse(data)
    const kucuk = skills.map((s) => s.toLowerCase())

    console.log(`[ölçüm] ${skills.length} beceri çıkarıldı`)

    // Kategori başlıkları beceri sayılmamalı.
    expect(kucuk).not.toContain("backend")
    expect(kucuk).not.toContain("frontend")
    expect(kucuk).not.toContain("devops / tools")

    // Gerçek beceriler çıkarılmalı — ilanların aradığı şeyler bunlar.
    for (const beklenen of ["rag", "mcp", "python", "react", "docker"]) {
      expect(kucuk.some((s) => s.includes(beklenen))).toBe(true)
    }

    expect(skills.length).toBeGreaterThanOrEqual(15)
  })
})
