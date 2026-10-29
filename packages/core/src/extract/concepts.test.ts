import { describe, it, expect } from "vitest"
import { splitIntoConcepts } from "./concepts.js"

const termList = (text: string) => splitIntoConcepts(text).map((c) => c.term)

describe("splitIntoConcepts · from real postings", () => {
  it("splits a compound requirement separated by commas and 've'", () => {
    expect(termList("Python, REST API, SQL ve NoSQL veri tabanları konusunda deneyim")).toEqual([
      "Python", "REST API", "SQL", "NoSQL veri tabanları",
    ])
  })

  it("splits a five-part requirement completely", () => {
    // Model bu gereksinimde yalnızca 1 kavram çıkarıyordu.
    expect(
      termList("Generative AI Yetkinlikleri, OpenAI, Azure OpenAI, Anthropic Claude ve Gemini API"),
    ).toEqual(["Generative AI", "OpenAI", "Azure OpenAI", "Anthropic Claude", "Gemini API"])
  })

  it("does not split CI/CD in two", () => {
    expect(termList("Git ve CI/CD deneyimi")).toEqual(["Git", "CI/CD"])
  })

  it("also splits the list after a colon", () => {
    expect(
      termList("4+ years of production software engineering: APIs, services, testing, CI/CD"),
    ).toEqual(["production software engineering", "APIs", "services", "testing", "CI/CD"])
  })

  it("drops a leading duration phrase", () => {
    expect(termList("En az 3 yıl React deneyimi")).toEqual(["React"])
    expect(termList("At least 2 years of Kubernetes experience")).toEqual(["Kubernetes"])
  })

  it("drops English filler patterns and treats an 'or' list as options", () => {
    const [conceptItem, ...excess] = splitIntoConcepts(
      "Hands on with LangChain, LangGraph, or equivalent agent frameworks",
    )
    expect(excess).toHaveLength(0)
    expect(conceptItem!.term).toBe("LangChain / LangGraph / agent")
    expect(conceptItem!.synonyms).toEqual(["LangChain", "LangGraph", "agent"])
  })

  it("'ile' makes tool and task separate concepts and drops trailing filler", () => {
    expect(termList("Kubernetes ile konteyner yönetimi zorunludur")).toEqual([
      "Kubernetes", "konteyner yönetimi",
    ])
  })

  it("treats the whole text as one concept when no concept is found", () => {
    // "5 yıl deneyim" gibi gereksinimlerde aranacak somut bir terim yok;
    // skorlamanın yine de en az bir kavrama ihtiyacı var.
    const k = termList("Benzer bir işte en az 5 yıl deneyim sahibi olmak")
    expect(k).toHaveLength(1)
    expect(k[0]).toContain("5 yıl")
  })

  it("does not return the same term twice", () => {
    expect(termList("Docker ve Docker Compose")).toEqual(["Docker", "Docker Compose"])
  })

  it("returns a single concept for empty text", () => {
    expect(splitIntoConcepts("   ")).toHaveLength(1)
  })
})

/**
 * Uçtan uca testte çöp kavram üreten gereksinimler (K-38). İki ilan: fintech
 * frontend ve e-ticaret performans pazarlama.
 */
describe("splitIntoConcepts · Turkish constructions", () => {
  const conceptItem = (text: string, kindName?: Parameters<typeof splitIntoConcepts>[1]) =>
    splitIntoConcepts(text, kindName)

  it("drops the duration and filler after 'ile'", () => {
    expect(termList("React ve TypeScript ile en az 4 yıl profesyonel deneyim")).toEqual([
      "React", "TypeScript",
    ])
  })

  it("makes a parenthesized abbreviation a synonym of the preceding concept", () => {
    expect(conceptItem("Next.js ile sunucu tarafı render (SSR) deneyimi")).toEqual([
      // Araç eşlemesi (skor sürüm 3): "NextJS" yazan CV de karşılıyor.
      { term: "Next.js", synonyms: ["NextJS"] },
      { term: "sunucu tarafı render", synonyms: ["SSR"] },
    ])
    expect(conceptItem("Web performansı ve erişilebilirlik (WCAG) konusunda bilgi")).toEqual([
      { term: "Web performansı", synonyms: [] },
      { term: "erişilebilirlik", synonyms: ["WCAG"] },
    ])
  })

  it("distributes a common head and makes a parenthesized example list a separate option concept", () => {
    // Örnekler eş anlamlı değil: yalnızca Jest bilen aday entegrasyon
    // testini karşılamış sayılmamalı.
    expect(conceptItem("Birim ve entegrasyon testleri (Jest, Playwright veya Cypress)")).toEqual([
      { term: "Birim testleri", synonyms: [] },
      { term: "entegrasyon testleri", synonyms: [] },
      { term: "Jest / Playwright / Cypress", synonyms: ["Jest", "Playwright", "Cypress"] },
    ])
  })

  it("drops auxiliary verbs and fillers like 'hakimiyet'", () => {
    expect(termList("GraphQL ile çalışmış olmak")).toEqual(["GraphQL"])
    expect(conceptItem("CI/CD süreçlerine (GitHub Actions) hakimiyet")).toEqual([
      { term: "CI/CD", synonyms: ["GitHub Actions"] },
    ])
    expect(termList("Takım içinde mentorluk ve kod incelemesi deneyimi")).toEqual([
      "mentorluk", "kod incelemesi",
    ])
  })

  it("drops a leading level phrase even with a capital İ", () => {
    expect(termList("İyi derecede İngilizce")).toEqual(["İngilizce"])
  })

  it("turns a 'veya' list into a single option concept", () => {
    expect(conceptItem("Fintech veya ödeme sistemleri deneyimi")).toEqual([
      { term: "Fintech / ödeme sistemleri", synonyms: ["Fintech", "ödeme sistemleri"] },
    ])
  })

  it("drops a trailing task noun", () => {
    expect(termList("Storybook ile tasarım sistemi geliştirme")).toEqual([
      "Storybook", "tasarım sistemi",
    ])
  })

  it("extracts the brand from a compound and the term from a comitative suffix", () => {
    expect(
      termList("Google Ads, Meta Ads ve TikTok Ads kampanyalarının kurulumu ve optimizasyonu"),
    ).toEqual(["Google Ads", "Meta Ads", "TikTok Ads"])
    expect(termList("Bütçe yönetimi ve ROAS hedefleriyle çalışma deneyimi")).toEqual([
      "Bütçe yönetimi", "ROAS",
    ])
  })

  it("separates two tasks joined by a gerund and turns the infinitive into a noun", () => {
    expect(termList("A/B testleri tasarlayıp sonuçlarını raporlamak")).toEqual([
      "A/B testleri", "raporlama",
    ])
  })

  it("separates the option list before 'ile' and the task after it", () => {
    expect(termList("SQL veya Looker Studio ile veri analizi yapabilmek")).toEqual([
      "SQL / Looker Studio", "veri analizi",
    ])
  })

  it("does not mistake 'takip' and 'sahip' for gerunds", () => {
    expect(termList("Jira ile proje takip deneyimi")).toEqual(["Jira", "proje takip"])
  })

  it("turns a general education requirement into a degree concept", () => {
    const [k] = conceptItem("Üniversitelerin ilgili bölümlerinden mezun", "education")
    expect(k!.term).toBe("Üniversite mezunu")
    expect(k!.synonyms).toContain("lisans")
  })

  it("does not generalize an education requirement with a stated field", () => {
    expect(termList("Bilgisayar Mühendisliği mezunu")).not.toContain("Üniversite mezunu")
    expect(
      conceptItem("Bilgisayar Mühendisliği bölümünden mezun", "education")[0]!.term,
    ).not.toBe("Üniversite mezunu")
  })
})

describe("splitIntoConcepts · non-software postings (DOG-61)", () => {
  // Yazılım dışı ilanların cümle kalıpları; kavram olarak cümlenin tamamı
  // aranıyor ve hiçbir CV'de bulunmuyordu.
  it("drops a second-person verbal noun and a level phrase", () => {
    expect(termList("MS Excel programını orta seviyede kullanabilmeni")).toEqual(["MS Excel"])
    expect(termList("3 yıl muhasebe deneyimine sahip olmanı")).toEqual(["muhasebe"])
  })

  it("keeps the example inside a parenthesis without 'vb.'", () => {
    expect(splitIntoConcepts("ERP sistemleri (Logo vb.) konusunda bilgi sahibi olmanı")).toEqual([
      { term: "ERP sistemleri", synonyms: ["Logo"] },
    ])
  })

  it("drops a participle, an apostrophe suffix and soft qualifiers", () => {
    expect(
      termList("MS Office programlarını, özellikle Excel'i etkin kullanabilen, raporlama becerisi güçlü"),
    ).toEqual(["MS Office", "Excel", "raporlama"])
    expect(termList("Office Programlarını kullanabilen")).toEqual(["Office"])
    expect(termList("Perkotek programını aktif olarak kullanabilen")).toEqual(["Perkotek"])
  })

  it("keeps 'aktif' when it is part of the requirement", () => {
    expect(termList("Aktif araç kullanabilen")).toEqual(["Aktif araç"])
  })
})

describe("splitIntoConcepts · dil sınırı (DOG-73)", () => {
  it("drops 'ortamında' and treats two words joined by a slash as alternatives", () => {
    // Üretimde "Agile/Scrum ortamında" tek kavram kalıyordu; CV'deki "Agile
    // Methodologies (Scrum)" ne kelimeyle ne anlamla eşleşti.
    expect(splitIntoConcepts("Agile/Scrum ortamında çalışma deneyimi", "experience")).toEqual([
      { term: "Agile/Scrum", synonyms: ["Agile", "Scrum"] },
    ])
  })

  it("leaves slash acronyms as one concept", () => {
    // CI/CD, UI/UX, HTML/CSS seçenek değil; ayrılırlarsa yalnızca HTML bilen
    // aday HTML/CSS'i karşılamış sayılır.
    for (const term of ["CI/CD", "UI/UX", "HTML/CSS"]) {
      expect(splitIntoConcepts(term, "skill")).toEqual([{ term, synonyms: [] }])
    }
  })
})

describe("splitIntoConcepts · 'veya ilgili bölümler' (DOG-75)", () => {
  it("keeps the field name and drops 'related departments' as a concept", () => {
    // "ilgili bölümlerden" eş anlamlı olunca CV'deki herhangi bir "ilgili"
    // kelimesi eğitimi karşılayabiliyordu.
    expect(splitIntoConcepts("Bilgisayar Mühendisliği veya ilgili bölümlerden mezun", "education")).toEqual([
      { term: "Bilgisayar Mühendisliği", synonyms: [] },
    ])
    expect(splitIntoConcepts("Elektrik-Elektronik Mühendisliği veya ilgili mühendislik bölümlerinden mezun", "education")).toEqual([
      { term: "Elektrik-Elektronik Mühendisliği", synonyms: [] },
    ])
  })

  it("keeps several fields as options", () => {
    expect(splitIntoConcepts("Üniversitelerin İşletme, İktisat veya ilgili bölümlerinden mezun", "education")).toEqual([
      { term: "Üniversitelerin İşletme / İktisat", synonyms: ["Üniversitelerin İşletme", "İktisat"] },
    ])
  })

  it("handles the English form", () => {
    // Skor sürüm 3: derece sözcükleri atılıyor; CV'nin eğitim satırı
    // "B.Sc. Computer Science" yazıyor, kelime eşleşmesi kurulabilsin.
    expect(splitIntoConcepts("Bachelor's degree in Computer Science or related field", "education")).toEqual([
      { term: "Computer Science", synonyms: [] },
    ])
  })
})

/**
 * Değerlendirme setindeki ilanlarda yanlış bölünen gereksinimler (skor
 * sürüm 3). Beklenen çıktı, işe alımcının cümleden anladığı: "X ve Y gibi"
 * örnek listesi seçenektir, dolgu ve anlatı cümlesi kavram değildir.
 */
describe("splitIntoConcepts · examples, filler and narrative (scoring revision 3)", () => {
  const concepts = (text: string, type?: Parameters<typeof splitIntoConcepts>[1]) => splitIntoConcepts(text, type)
  const terms = (text: string, type?: Parameters<typeof splitIntoConcepts>[1]) => concepts(text, type).map((c) => c.term)

  it("turns a Turkish 'gibi' list into one option, with the category as an alternative", () => {
    const [portals, ...rest] = concepts("Kariyer.net ve LinkedIn gibi kariyer portallarını kullanabilen")
    expect(rest).toHaveLength(0)
    expect(portals!.term).toBe("Kariyer.net / LinkedIn")
    expect(portals!.synonyms).toEqual(expect.arrayContaining(["Kariyer.net", "LinkedIn", "kariyer portalları"]))

    const [tools] = concepts("Trello, Asana veya Jira gibi iş takip araçlarını etkin kullanabilen")
    expect(tools!.term).toBe("Trello / Asana / Jira")
    expect(tools!.synonyms).toContain("iş takip araçları")

    const [vectors] = concepts("FAISS, Pinecone, Weaviate, Milvus, Chroma veya Azure AI Search gibi vektör veritabanlarıyla çalışma deneyimi")
    expect(vectors!.term).toBe("FAISS / Pinecone / Weaviate / Milvus / Chroma / Azure AI Search")
    expect(vectors!.synonyms).toContain("vektör veritabanları")
  })

  it("keeps every example of a 'gibi' list and drops the generic head word", () => {
    const list = concepts("Meta Ads, Google Ads, LinkedIn Ads ve TikTok gibi kanallarda en az 5 yıl performans pazarlaması deneyimi")
    expect(list.map((c) => c.term)).toEqual(["Meta Ads / Google Ads / LinkedIn Ads / TikTok"])
    expect(list[0]!.synonyms).toContain("performans pazarlaması")
  })

  it("reads English 'such as' and 'including' lists as options", () => {
    const [solution, ...rest] = concepts(
      "Proven experience delivering at least one production-grade LLM solution, such as a RAG system, AI agent, or intelligent assistant",
    )
    expect(rest).toHaveLength(0)
    expect(solution!.term).toBe("RAG system / AI agent / intelligent assistant")
    expect(solution!.synonyms).toContain("production-grade LLM solution")

    expect(terms("Strong understanding of NLP concepts and their application to tasks such as classification, information extraction, NER, summarization, and semantic search")).toEqual([
      "NLP concepts",
      "classification / information extraction / NER / summarization / semantic search",
    ])
    expect(terms("Strong Python development skills, including clean code, testing, asynchronous programming, type safety, and version control")).toEqual([
      "Python development",
      "clean code / testing / asynchronous programming / type safety / version control",
    ])
  })

  it("drops narrative sentences and keeps the requirement sentence", () => {
    expect(terms("2+ years building LLM or agent systems that shipped to productions watching real users adopt. Not internal demos, not prototypes. Be ready to talk about what broke in production and what you did about it.")).toEqual([
      "LLM / agent systems",
    ])
    expect(terms("4+ years of production software engineering: APIs, services, data infrastructure. You've owned code that other people depended on, with tests, CI/CD, and on-call attached.")).toEqual([
      "production software engineering", "APIs", "services", "data infrastructure",
    ])
    expect(terms("Hands on with LangChain, LangGraph, or equivalent agent/orchestration frameworks. You've built with them, hit their limits, and worked around them.")).toEqual([
      "LangChain / LangGraph / agent/orchestration",
    ])
    expect(terms("Experience at early-stage startups or high-growth environments where you wore multiple hats.")).toEqual([
      "early-stage startups / high-growth environments",
    ])
  })

  it("does not count an 'is a strong advantage' sentence inside a requirement", () => {
    expect(terms("Experience developing AI applications on cloud platforms; GCP and Vertex AI experience is a strong advantage")).toEqual([
      "AI applications on cloud platforms",
    ])
  })

  it("strips English lead-ins and trailing preference words", () => {
    expect(terms("Solid expertise in RAG architectures, retrieval techniques, tool/function calling, context management, and document processing")).toEqual([
      "RAG architectures", "retrieval", "tool/function calling", "context management", "document processing",
    ])
    expect(terms("Familiarity with agent frameworks, MCP, vector databases, and model fine-tuning techniques is preferred")).toEqual([
      "agent", "MCP", "vector databases", "model fine-tuning",
    ])
    expect(terms("Retrieval-augmented generation (RAG) at depth: Hybrid and graph retrieval, chunking and embedding strategy, ranking, grounding.")).toEqual([
      "Retrieval-augmented generation", "Hybrid retrieval", "graph retrieval", "chunking", "embedding strategy", "ranking", "grounding",
    ])
  })

  it("reads degree requirements without the degree words", () => {
    expect(terms("Bachelor’s degree in Computer Engineering, Software Engineering, or a related field", "education")).toEqual([
      "Computer Engineering / Software Engineering",
    ])
    expect(terms("Master’s or Ph.D. is a plus", "education")).toEqual(["Master / Ph.D"])
    expect(terms("Üniversitelerin İnsan Kaynakları Yönetimi veya İktisadi ve İdari Bilimler lisans bölümlerinden mezun", "education")).toEqual([
      "Üniversitelerin İnsan Kaynakları Yönetimi / İktisadi ve İdari Bilimler",
    ])
  })

  it("reduces a language requirement to the language, with its other name", () => {
    for (const text of ["İyi derecede İngilizce bilen", "İyi seviyede İngilizce bilmek", "Tercihen iyi derecede İngilizce dil bilgisine sahip"]) {
      const [language, ...rest] = concepts(text)
      expect(rest, text).toHaveLength(0)
      expect(language!.term, text).toBe("İngilizce")
      expect(language!.synonyms, text).toContain("English")
    }
    const [english] = concepts("Excellent command of English")
    expect(english!.term).toBe("English")
    expect(english!.synonyms).toContain("İngilizce")
  })

  it("cuts Turkish 'konusunda / alanında / süreçlerinde' tails and duration phrases", () => {
    expect(terms("İnsan kaynakları alanında en az 3 yıl deneyimli")).toEqual(["İnsan kaynakları"])
    expect(terms("Yapay zekâ, makine öğrenmesi, doğal dil işleme veya veri bilimi alanlarında en az 5 yıl deneyim")).toEqual([
      "Yapay zekâ / makine öğrenmesi / doğal dil işleme / veri bilimi",
    ])
    expect(terms("Üretken yapay zekâ ve LLM tabanlı projelerde en az 2 yıl uygulamalı deneyim")).toEqual(["Üretken yapay zekâ", "LLM tabanlı projeler"])
    expect(terms("REST API, mikroservis mimarileri ve sistem entegrasyonları konusunda tecrübeli olmak")).toEqual([
      "REST API", "mikroservis mimarileri", "sistem entegrasyonları",
    ])
    expect(terms("Generative AI ve LLM tabanlı uygulamalar konusunda profesyonel proje geliştirme deneyimine sahip olmak")).toEqual([
      "Generative AI", "LLM tabanlı uygulamalar",
    ])
    expect(terms("AI Agent ve agentic workflow teknolojileri konusunda deneyimli olmak")).toEqual(["AI Agent", "agentic workflow"])
    expect(terms("VUK konusunda temel bilgi sahibi olmanı")).toEqual(["VUK"])
    expect(terms("MS Excel'i iyi derecede kullanabilen")).toEqual(["MS Excel"])
    expect(terms("Tercihen üretim / fabrika ortamında olmak üzere, insan kaynakları alanında en az 3-5 yıl tecrübe sahibi")).toEqual([
      "üretim / fabrika", "insan kaynakları",
    ])
    expect(terms("medikal estetik, sağlık turizmi veya klinik/hastane sektörlerinde edinilmiş deneyim tercih sebebidir")).toEqual([
      "medikal estetik / sağlık turizmi / klinik/hastane",
    ])
  })

  it("drops 'veya benzeri' tails, catch-alls and back-references", () => {
    expect(terms("LangChain, LlamaIndex, Semantic Kernel, AutoGen, CrewAI veya benzeri framework'lerden en az biriyle deneyim")).toEqual([
      "LangChain / LlamaIndex / Semantic Kernel / AutoGen / CrewAI",
    ])
    expect(terms("LangGraph, n8n veya benzeri agent orchestration ve workflow automation araçlarından en az biriyle uygulama geliştirmiş olmak")).toEqual([
      "LangGraph / n8n",
    ])
    expect(terms("LLM API’lerini kullanarak AI Agent, RAG veya benzeri LLM tabanlı uygulamalar geliştirmiş olmak")).toEqual([
      "LLM API", "AI Agent / RAG",
    ])
    expect(terms("4857 sayılı İş Kanunu, İş Hukuku, SGK mevzuatı ve ilgili yasal düzenlemeler hakkında bilgi sahibi")).toEqual([
      "4857 sayılı İş Kanunu", "İş Hukuku", "SGK mevzuatı",
    ])
    expect(terms("Raporlama ve içgörü üretimi süreçlerinde AI araçlarını (ChatGPT, Gemini, Claude vb.) aktif kullanan, bu araçları iş akışına entegre etmiş")).toEqual([
      "Raporlama", "içgörü üretimi", "ChatGPT / Gemini / Claude",
    ])
  })

  it("does not read a level phrase as an option list", () => {
    expect(terms("GA4, Google Tag Manager ve Looker Studio'da orta veya ileri düzey hakimiyet")).toEqual([
      "GA4", "Google Tag Manager", "Looker Studio",
    ])
  })

  it("keeps fixed phrases joined by 've' together", () => {
    expect(terms("İşe alım, oryantasyon, performans yönetimi, eğitim ve gelişim, özlük işleri ve çalışan ilişkileri süreçlerinde deneyimli")).toEqual([
      "İşe alım", "oryantasyon", "performans yönetimi", "eğitim ve gelişim", "özlük işleri", "çalışan ilişkileri",
    ])
  })

  it("never makes a place name a concept on its own", () => {
    expect(terms("Türkiye ve yurt dışı pazarlarını ayrı ayrı yönetebilecek çok pazarlı reklam yönetimi tecrübesi")).toEqual([
      "çok pazarlı reklam yönetimi",
    ])
  })

  it("drops the locative before 'deneyim': 'pazarlamada 2 yıl deneyim' is about 'pazarlama'", () => {
    expect(terms("Dijital pazarlamada en az 2 yıl deneyim")).toEqual(["Dijital pazarlama"])
    expect(terms("Satışta en az 3 yıl deneyimli")).toEqual(["Satış"])
    expect(terms("Muhasebede 3 yıl tecrübe")).toEqual(["Muhasebe"])
    // Türkçe ek kuralına uymayan sonlar kelimenin kendisi.
    expect(terms("Website deneyimi")).toEqual(["Website"])
    expect(terms("Node deneyimi")).toEqual(["Node"])
  })

  it("knows the common short names of tools", () => {
    // Örnek rapor: CV "GA4 ve Looker Studio ile … panolar" yazıyor, ilan "Google Analytics 4".
    const [ga] = concepts("Google Analytics 4 ile raporlama")
    expect(ga!.synonyms).toContain("GA4")
    const [ga4, gtm] = concepts("GA4 ve Google Tag Manager bilgisi")
    expect(ga4!.synonyms).toContain("Google Analytics 4")
    expect(gtm!.synonyms).toContain("GTM")
    expect(concepts("Kubernetes deneyimi")[0]!.synonyms).toContain("K8s")
    // Belirsiz kısa adlar eklenmiyor: "Office" bir CV'de "back office" olabilir.
    expect(concepts("MS Office programlarını kullanabilen")[0]!.synonyms).not.toContain("Office")
  })
})
