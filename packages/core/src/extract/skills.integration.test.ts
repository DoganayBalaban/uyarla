import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { SkillLinesSchema, skillLinesJsonSchema } from "../schemas/resume.js"
import { flattenSkillLines } from "./skills.js"
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
const CATEGORIZED_BLOCK = `TECHNICAL SKILLS

AI / LLM
LLMs, Generative AI, RAG, AI Agents, MCP, prompt engineering, embeddings, tool calling

Backend
Python, FastAPI, REST APIs, SSE, PostgreSQL, Supabase

Frontend
React, ReactFlow, Zustand, JavaScript/TypeScript

DevOps / Tools
Docker, Git, GitHub Actions, Linux`

/**
 * İki alt başlıklı gerçek bir CV bölümü. Model bu biçimde iki bölümden
 * yalnızca birini döndürüyor, diğerini tümüyle atıyordu (K-19).
 */
const TWO_PART = `Core Skills
Test Case Design & Execution: Creating and executing structured test scenarios.
Manual Testing: Performing functional, regression, and integration testing.
Technical Skills
Programming & Query Languages: Java, SQL Queries
Automation Testing Tools: Selenium WebDriver, TestNG
QA & Collaboration Tools: JIRA, Postman`

describe("skill extraction · real model", () => {
  it("skips no group in a section with two subheadings", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await llm.extract({
      prompt: SKILLS_PROMPT,
      schemaName: "resume_skills",
      schema: skillLinesJsonSchema,
      input: TWO_PART,
    })
    const skills = flattenSkillLines(SkillLinesSchema.parse(data))
    const lower = skills.map((s) => s.toLowerCase()).join(" ")

    console.log(`[ölçüm] iki bölümlü: ${skills.length} beceri — ${JSON.stringify(skills)}`)

    // Her iki gruptan da beceri gelmeli.
    expect(lower).toContain("manual testing")
    expect(lower).toContain("java")
    expect(lower).toContain("jira")
    // Bölüm başlıkları beceri sayılmamalı.
    expect(skills.map((s) => s.toLowerCase())).not.toContain("core skills")
    expect(skills.map((s) => s.toLowerCase())).not.toContain("technical skills")
  })

  it("extracts skills, not headings, from a categorized skill section", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await llm.extract({
      prompt: SKILLS_PROMPT,
      schemaName: "resume_skills",
      schema: skillLinesJsonSchema,
      input: CATEGORIZED_BLOCK,
    })
    const skills = flattenSkillLines(SkillLinesSchema.parse(data))
    const lower = skills.map((s) => s.toLowerCase())

    console.log(`[ölçüm] ${skills.length} beceri çıkarıldı`)

    // Kategori başlıkları beceri sayılmamalı.
    expect(lower).not.toContain("backend")
    expect(lower).not.toContain("frontend")
    expect(lower).not.toContain("devops / tools")

    // Gerçek beceriler çıkarılmalı — ilanların aradığı şeyler bunlar.
    for (const expected of ["rag", "mcp", "python", "react", "docker"]) {
      expect(lower.some((s) => s.includes(expected))).toBe(true)
    }

    expect(skills.length).toBeGreaterThanOrEqual(15)
  })
})
