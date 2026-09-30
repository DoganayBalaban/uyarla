import { describe, it, expect, vi } from "vitest"
import type {
  AdaptationDraft,
  JobPostingData,
  LlmProvider,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"
import { runAdaptation } from "./adapt-pipeline.js"
import type { AdaptationStore } from "./adapt-types.js"

const testProfile: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Süreyi %40 düşürdüm", sourceRef: "Süreyi %40 düşürdüm" },
      ],
    },
  ],
  education: [],
  skills: ["Excel", "React"],
  languages: [],
  certifications: [],
}

const testPosting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "React", synonyms: [] }],
    },
    {
      text: "Konteyner yönetimi deneyimi",
      type: "skill",
      importance: "must",
      // Betimleyici kavram: özel adlar (Kubernetes gibi) terim uyumu hedefi
      // olamıyor (K-38), maddeler ancak böyle bir hedefle modele gidiyor.
      concepts: [{ term: "konteyner yönetimi", synonyms: [] }],
    },
    {
      text: "Süreç iyileştirme deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "süreç iyileştirme", synonyms: [] }],
    },
  ],
}

const testScore: ScoreResult = {
  score: 50,
  missingKeywords: ["konteyner yönetimi"],
  requirements: [
    {
      requirement: testPosting.requirements[0]!,
      status: "matched",
      confidence: 1,
      method: "keyword",
      evidence: { text: "React", matchText: "React", kind: "skill", sourceRef: null },
      matchedConcepts: ["React"],
      missingConcepts: [],
    },
    {
      requirement: testPosting.requirements[1]!,
      status: "missing",
      confidence: 0,
      method: null,
      evidence: null,
      matchedConcepts: [],
      missingConcepts: ["konteyner yönetimi"],
    },
    {
      requirement: testPosting.requirements[2]!,
      status: "missing",
      confidence: 0,
      method: null,
      evidence: null,
      matchedConcepts: [],
      missingConcepts: ["süreç iyileştirme"],
    },
  ],
}

/** Kaydedilen taslağı yakalayan sahte store. */
function fakeStore() {
  const record: { draft?: AdaptationDraft; status?: string; errorClass?: string } = {}
  const store: AdaptationStore = {
    getAdaptationContext: vi.fn(async () => ({ profile: testProfile, posting: testPosting, result: testScore })),
    saveDraft: vi.fn(async ({ draft, status }) => {
      record.draft = draft
      record.status = status
    }),
    failAdaptation: vi.fn(async (_id, errorClass) => {
      record.errorClass = errorClass
    }),
    saveCoverLetter: vi.fn(async () => {}),
  }
  return { store, record }
}

/** Her çağrıda verilen metni döndüren sahte model. */
function fakeLlm(map: (llmInput: string) => string): LlmProvider {
  return {
    extract: vi.fn(async ({ input }) => ({
      data: { rewritten: map(input) } as never,
      tokens: 10,
    })),
  }
}

/**
 * Maddeyi olduğu gibi geri veren sahte model.
 *
 * Her çağrıya sabit bir metin döndüren bir sahte işe yaramıyor: o metin
 * ikinci maddenin kaynağında geçmeyen bir ilan terimi taşırsa enjeksiyon
 * kontrolü haklı olarak uyarı veriyor. Temiz bir yeniden yazımı taklit
 * etmenin yolu, girdideki maddeyi yansıtmak.
 */
function echoLlm(): LlmProvider {
  return {
    extract: vi.fn(async ({ input }) => ({
      data: { rewritten: input.split("\n")[0]!.replace(/^(Madde|Özet): /, "") } as never,
      tokens: 10,
    })),
  }
}

/**
 * İki kümeli sahte embedding: "süre" geçen metinler bir yönde, diğerleri
 * öbür yönde. Böylece "konteyner yönetimi" birinci maddeye, "süreç
 * iyileştirme" ikinci maddeye en yakın oluyor; her kavram tek maddeye
 * verildiği için (K-38) iki maddenin de hedefi olması bunu gerektiriyor.
 * Yazım ile kaynağı aynı kümede kaldığı sürece sapma 1.0 çıkar.
 */
const fakeEmbedding = {
  embed: vi.fn(async (t: string[]) => t.map((m) => (/s[üu]re/i.test(m) ? [0, 1] : [1, 0]))),
}

describe("runAdaptation", () => {
  it("makes one call per bullet and saves the draft", async () => {
    const { store, record: record } = fakeStore()
    const llm = fakeLlm(() => "yeniden yazıldı")

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    // 2 madde + 1 özet = 3 çağrı
    expect(llm.extract).toHaveBeenCalledTimes(3)
    expect(record.draft!.bullets).toHaveLength(2)
    expect(record.draft!.bullets[0]!.id).toBe("0-0")
  })

  it("orders skills by the posting", async () => {
    const { store, record: record } = fakeStore()
    await runAdaptation(
      { llm: fakeLlm(() => "x"), embedding: fakeEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(record.draft!.skillOrder).toEqual(["React", "Excel"])
  })

  it("does not suggest a flagged rewrite; the bullet stays as is", async () => {
    // K-38: yalnızca hedefi olan maddeler yazılıyor; uyarılı bir yazım
    // başarısız bir denemedir ve kullanıcının önüne konmuyor (K-26'nın yerini
    // alıyor). Burada ikinci madde kaynağında olmayan bir sayı ekliyor.
    const { store, record: record } = fakeStore()
    const llm = fakeLlm((llmInput) =>
      llmInput.includes("%40") ? "Süreyi %40 düşürdüm, hızı %90 artırdım" : "React ile paneli geliştirdim",
    )

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    // Birinci madde temiz ama terim uyumu taşımıyor: o da önerilmiyor,
    // çünkü madde yazımının tek amacı terim uyumu (K-39).
    expect(record.draft!.bullets[0]!.rewritten).toBe("React ile panel yaptım")
    const second = record.draft!.bullets[1]!
    expect(second.rewritten).toBe(second.original)
    expect(second.decision).toBe("accepted")
    expect(record.status).toBe("ready")
  })

  it("status is ready when everything is clean", async () => {
    const { store, record: record } = fakeStore()
    await runAdaptation(
      { llm: echoLlm(), embedding: fakeEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(record.draft!.bullets.every((b) => b.verification.status === "ok")).toBe(true)
    expect(record.status).toBe("ready")
  })

  it("does not suggest a rewrite that injects a posting term", async () => {
    // Uydurmanın en tehlikeli biçimi (spec §7.2): model ilanın istediğini
    // CV'ye yazıveriyor. Burada React, ikinci maddenin kaynağında geçmiyor.
    const { store, record: record } = fakeStore()
    await runAdaptation(
      {
        llm: fakeLlm((llmInput) =>
          llmInput.includes("%40") ? "React ile süreyi %40 düşürdüm" : "React ile paneli geliştirdim",
        ),
        embedding: fakeEmbedding,
        store,
      },
      { adaptationId: "a1" },
    )

    const second = record.draft!.bullets[1]!
    expect(second.rewritten).toBe(second.original)
    expect(second.rewritten).not.toContain("React")
  })

  it("records a term alignment whose basis is in the bullet and leaves it for approval", async () => {
    // K-38: model ilan terimini kullandığında dayanağını maddeden birebir
    // gösteriyor; dayanak kaynakta geçiyorsa uydurma sayılmıyor. Terimin
    // deneyimi doğru anlatıp anlatmadığına ise kullanıcı karar veriyor.
    const { store, record: record } = fakeStore()
    const llm: LlmProvider = {
      extract: vi.fn(async ({ input }) => {
        if (!input.startsWith("Madde: React")) {
          return { data: { rewritten: input.split("\n")[0]!.replace(/^(Madde|Özet): /, "") } as never, tokens: 1 }
        }
        return {
          data: {
            rewritten: "React ile konteyner yönetimi paneli yaptım",
            alignments: [{ term: "konteyner yönetimi", basis: "panel yaptım" }],
          } as never,
          tokens: 1,
        }
      }),
    }

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    const first = record.draft!.bullets[0]!
    expect(first.alignments).toEqual([{ term: "konteyner yönetimi", basis: "panel yaptım" }])
    expect(first.verification.status).toBe("ok")
    expect(first.decision).toBe("pending")
  })

  it("treats a term whose basis is not in the bullet as fabrication and does not suggest the rewrite", async () => {
    const { store, record: record } = fakeStore()
    const llm: LlmProvider = {
      extract: vi.fn(async ({ input }) => ({
        data: (input.startsWith("Madde: React")
          ? {
              rewritten: "React ile konteyner yönetimi paneli yaptım",
              alignments: [{ term: "konteyner yönetimi", basis: "sunucu kurdum" }],
            }
          : { rewritten: input.split("\n")[0]!.replace(/^(Madde|Özet): /, ""), alignments: [] }) as never,
        tokens: 1,
      })),
    }

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    const first = record.draft!.bullets[0]!
    expect(first.rewritten).toBe(first.original)
    expect(first.alignments).toEqual([])
    expect(first.decision).toBe("accepted")
  })

  it("does not suggest a rewrite that loses source information; the bullet stays as is", async () => {
    // K-38: "sayfa yüklenme süresini %40 azalttım" → "web performansı %40
    // azalttım" gibi anlamı bozan ya da sayıyı düşüren yazımlar gösterilmiyor.
    const { store, record: record } = fakeStore()
    const llm = fakeLlm((llmInput) => (llmInput.includes("%40") ? "Süreyi azalttım" : "Panel yaptım"))
    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    for (const bullet of record.draft!.bullets) {
      expect(bullet.rewritten).toBe(bullet.original)
      expect(bullet.decision).toBe("accepted")
    }
  })

  it("does not translate bullets when adapting an English resume to a Turkish posting; writes the summary in English", async () => {
    // K-39: İngilizce CV Türkçeye çevriliyordu. Diller farklıysa terim uyumu
    // kapalı (maddeler modele gitmiyor), özet yazımına dil açıkça veriliyor.
    const { store, record: record } = fakeStore()
    const englishProfile: ResumeProfile = {
      ...testProfile,
      summary: "Frontend developer with experience in React.",
      experience: [
        {
          company: "Acme",
          title: "Developer",
          startDate: "2022",
          endDate: "Present",
          bullets: [
            { text: "Built the admin panel with React", sourceRef: "Built the admin panel with React" },
            { text: "Reduced load time by 40%", sourceRef: "Reduced load time by 40%" },
          ],
        },
      ],
    }
    store.getAdaptationContext = vi.fn(async () => ({ profile: englishProfile, posting: testPosting, result: testScore }))
    const llm = echoLlm()

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    const llmInputs = vi.mocked(llm.extract).mock.calls.map((c) => c[0].input)
    expect(llmInputs.filter((g) => g.startsWith("Madde:"))).toHaveLength(0)
    expect(llmInputs.find((g) => g.startsWith("Özet:"))).toContain("Dil: İngilizce")
    for (const bullet of record.draft!.bullets) expect(bullet.rewritten).toBe(bullet.original)
  })

  it("if one bullet fails it stays original; the others are unaffected", async () => {
    // spec §13: madde başına izolasyon.
    let counter = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        counter++
        if (counter === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 4 }
      }),
    }
    const { store, record: record } = fakeStore()
    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    const failedBullet = record.draft!.bullets.find((b) => b.rewritten === b.original)
    expect(failedBullet).toBeDefined()
    expect(failedBullet!.verification.issues).toEqual([])
    expect(failedBullet!.decision).toBe("accepted")
  })

  it("makes no summary call for a resume without a summary", async () => {
    const { store, record: record } = fakeStore()
    store.getAdaptationContext = vi.fn(async () => ({
      profile: { ...testProfile, summary: null },
      posting: testPosting,
      result: testScore,
    }))
    const llm = fakeLlm(() => "yeni")

    await runAdaptation({ llm, embedding: fakeEmbedding, store }, { adaptationId: "a1" })

    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(record.draft!.summary.original).toBeNull()
    expect(record.draft!.summary.rewritten).toBe("")
  })

  it("saves the token total", async () => {
    const { store } = fakeStore()
    await runAdaptation(
      { llm: fakeLlm(() => "yeni"), embedding: fakeEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(vi.mocked(store.saveDraft).mock.calls[0]![0].tokenUsage).toBe(30)
  })

  it("marks the adaptation failed and rethrows if the context cannot be read", async () => {
    const { store, record: record } = fakeStore()
    store.getAdaptationContext = vi.fn(async () => {
      throw new Error("bulunamadı")
    })

    await expect(
      runAdaptation(
        { llm: fakeLlm(() => "yeni"), embedding: fakeEmbedding, store },
        { adaptationId: "a1" },
      ),
    ).rejects.toThrow("bulunamadı")
    expect(record.errorClass).toBe("unknown")
  })

  it("reports progress stages in order", async () => {
    const stages: string[] = []
    const { store } = fakeStore()
    await runAdaptation(
      {
        llm: fakeLlm(() => "yeni"),
        embedding: fakeEmbedding,
        store,
        onProgress: (s) => stages.push(s),
      },
      { adaptationId: "a1" },
    )
    expect(stages).toEqual(["rewriting", "verifying", "completed"])
  })
})
