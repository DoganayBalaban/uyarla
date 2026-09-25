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

const profil: ResumeProfile = {
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

const ilan: JobPostingData = {
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
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: [] }],
    },
  ],
}

const skor: ScoreResult = {
  score: 50,
  missingKeywords: ["Kubernetes"],
  requirements: [
    {
      requirement: ilan.requirements[0]!,
      status: "matched",
      confidence: 1,
      method: "keyword",
      evidence: { text: "React", matchText: "React", kind: "skill", sourceRef: null },
      matchedConcepts: ["React"],
      missingConcepts: [],
    },
    {
      requirement: ilan.requirements[1]!,
      status: "missing",
      confidence: 0,
      method: null,
      evidence: null,
      matchedConcepts: [],
      missingConcepts: ["Kubernetes"],
    },
  ],
}

/** Kaydedilen taslağı yakalayan sahte store. */
function sahteStore() {
  const kayit: { draft?: AdaptationDraft; status?: string; errorClass?: string } = {}
  const store: AdaptationStore = {
    getAdaptationContext: vi.fn(async () => ({ profile: profil, posting: ilan, result: skor })),
    saveDraft: vi.fn(async ({ draft, status }) => {
      kayit.draft = draft
      kayit.status = status
    }),
    failAdaptation: vi.fn(async (_id, errorClass) => {
      kayit.errorClass = errorClass
    }),
  }
  return { store, kayit }
}

/** Her çağrıda verilen metni döndüren sahte model. */
function sahteLlm(map: (girdi: string) => string): LlmProvider {
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
function yansitanLlm(): LlmProvider {
  return {
    extract: vi.fn(async ({ input }) => ({
      data: { rewritten: input.split("\n")[0]!.replace(/^(Madde|Özet): /, "") } as never,
      tokens: 10,
    })),
  }
}

/** Her metne aynı vektörü veren sahte embedding — sapma hep 1.0 çıkar. */
const sahteEmbedding = { embed: vi.fn(async (t: string[]) => t.map(() => [1, 0])) }

describe("runAdaptation", () => {
  it("her madde için bir çağrı yapar ve taslağı kaydeder", async () => {
    const { store, kayit } = sahteStore()
    const llm = sahteLlm(() => "yeniden yazıldı")

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    // 2 madde + 1 özet = 3 çağrı
    expect(llm.extract).toHaveBeenCalledTimes(3)
    expect(kayit.draft!.bullets).toHaveLength(2)
    expect(kayit.draft!.bullets[0]!.id).toBe("0-0")
  })

  it("becerileri ilana göre sıralar", async () => {
    const { store, kayit } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "x"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(kayit.draft!.skillOrder).toEqual(["React", "Excel"])
  })

  it("temiz maddeyi accepted, uyarılı maddeyi pending yapar", async () => {
    // K-26: risk tabanlı onay. Doğrulamayı geçen madde tek tıkla geri
    // alınır; uyarı taşıyan madde indirmeyi bloklar.
    const { store, kayit } = sahteStore()
    const llm = sahteLlm((girdi) =>
      girdi.includes("%40") ? "Süreyi %90 düşürdüm" : "React ile paneli geliştirdim",
    )

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    expect(kayit.draft!.bullets[0]!.decision).toBe("accepted")
    expect(kayit.draft!.bullets[1]!.decision).toBe("pending")
    expect(kayit.draft!.bullets[1]!.verification.issues[0]!.kind).toBe("number_mismatch")
  })

  it("uyarılı madde varsa durum draft kalır", async () => {
    const { store, kayit } = sahteStore()
    const llm = sahteLlm((girdi) => (girdi.includes("%40") ? "Süreyi %90 düşürdüm" : "yeni"))
    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })
    expect(kayit.status).toBe("draft")
  })

  it("hepsi temizse durum ready olur", async () => {
    const { store, kayit } = sahteStore()
    await runAdaptation(
      { llm: yansitanLlm(), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(kayit.draft!.bullets.every((b) => b.verification.status === "ok")).toBe(true)
    expect(kayit.status).toBe("ready")
  })

  it("bir maddeye ilan terimi sızarsa onu pending yapar", async () => {
    // Uydurmanın en tehlikeli biçimi (spec §7.2): model ilanın istediğini
    // CV'ye yazıveriyor. Burada React, ikinci maddenin kaynağında geçmiyor.
    const { store, kayit } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "React ile paneli geliştirdim"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )

    const ikinci = kayit.draft!.bullets[1]!
    expect(ikinci.decision).toBe("pending")
    expect(ikinci.verification.issues.map((i) => i.kind)).toContain("posting_term_injected")
  })

  it("bir madde patlarsa o madde orijinal kalır, diğerleri etkilenmez", async () => {
    // spec §13: madde başına izolasyon.
    let sayac = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        sayac++
        if (sayac === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 4 }
      }),
    }
    const { store, kayit } = sahteStore()
    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    const patlayan = kayit.draft!.bullets.find((b) => b.rewritten === b.original)
    expect(patlayan).toBeDefined()
    expect(patlayan!.verification.issues).toEqual([])
    expect(patlayan!.decision).toBe("accepted")
  })

  it("özeti olmayan CV'de özet çağrısı yapmaz", async () => {
    const { store, kayit } = sahteStore()
    store.getAdaptationContext = vi.fn(async () => ({
      profile: { ...profil, summary: null },
      posting: ilan,
      result: skor,
    }))
    const llm = sahteLlm(() => "yeni")

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(kayit.draft!.summary.original).toBeNull()
    expect(kayit.draft!.summary.rewritten).toBe("")
  })

  it("token toplamını kaydeder", async () => {
    const { store } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "yeni"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(vi.mocked(store.saveDraft).mock.calls[0]![0].tokenUsage).toBe(30)
  })

  it("bağlam okunamazsa uyarlamayı başarısız işaretler ve hatayı yeniden fırlatır", async () => {
    const { store, kayit } = sahteStore()
    store.getAdaptationContext = vi.fn(async () => {
      throw new Error("bulunamadı")
    })

    await expect(
      runAdaptation(
        { llm: sahteLlm(() => "yeni"), embedding: sahteEmbedding, store },
        { adaptationId: "a1" },
      ),
    ).rejects.toThrow("bulunamadı")
    expect(kayit.errorClass).toBe("unknown")
  })

  it("ilerleme aşamalarını sırayla bildirir", async () => {
    const asamalar: string[] = []
    const { store } = sahteStore()
    await runAdaptation(
      {
        llm: sahteLlm(() => "yeni"),
        embedding: sahteEmbedding,
        store,
        onProgress: (s) => asamalar.push(s),
      },
      { adaptationId: "a1" },
    )
    expect(asamalar).toEqual(["yeniden_yaziliyor", "kontrol_ediliyor", "tamamlandi"])
  })
})
