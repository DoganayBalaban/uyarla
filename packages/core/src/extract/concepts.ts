import type { Concept, Requirement } from "../schemas/job.js"

/**
 * Bir gereksinim metnini kavramlarına böler.
 *
 * Bu iş LLM'e verildi ve üç farklı biçimde üç farklı şekilde başarısız oldu:
 * iç içe şemada kavramları eksik çıkardı, düz şemada eş anlamlıları boş
 * bıraktı, sıkılaştırılmış prompt'ta listeyi ikinci gereksinimde kapattı.
 * Aynı ilanda kod bölmesi 5 kavram bulurken model 1 buluyordu (K-23).
 *
 * Oysa bileşik bir gereksinimi parçalamak metin işlemedir. İlk sürüm yalnızca
 * virgül ve "ve" tanıyordu; uçtan uca testte Türkçe ilanların sık kullandığı
 * yapılarda çöp kavram üretti ve var olan nitelikler "eksik" göründü
 * (K-38):
 *
 *   "React ve TypeScript ile en az 4 yıl profesyonel deneyim"
 *       → "TypeScript ile en az 4 yıl profesyonel"
 *   "Birim ve entegrasyon testleri (Jest, Playwright veya Cypress)"
 *       → "Birim", "entegrasyon testleri (Jest", "Cypress)"
 *   "GraphQL ile çalışmış olmak" → "GraphQL ile çalışmış olmak"
 *
 * Şimdi tanınanlar:
 *   - "ile": araç ile iş ayrı kavramlar ("Storybook ile tasarım sistemi").
 *   - "veya / or / ya da": listenin tamamı seçenektir, biri yeter.
 *   - Parantez: içindeki terimler önündeki kavramın eş anlamlısı ya da
 *     örneğidir ("erişilebilirlik (WCAG)", "testler (Jest, Cypress)").
 *   - Ortak baş: "Birim ve entegrasyon testleri" iki ayrı testtir.
 *   - Fiil kalıpları: "-mak/-mek", "-abilmek", "-ıp" ulaçları, "-ıyla".
 *   - Dolgular: "iyi derecede", "takım içinde", "hakimiyet", "süreçlerine".
 */

/** Liste içindeki ayırıcılar; seçenek bildirenler ayrıca işaretleniyor. */
const LIST_SEPARATOR = /\s*(,|\s&\s|\bve\b|\band\b|\bveya\b|\bya da\b|\byahut\b|\bor\b)\s*/i
const OPTIONS = /^(veya|ya da|yahut|or)$/i

/** Cümleyi bağımsız parçalara ayıranlar. "/" dahil değil: "CI/CD" tek kavramdır. */
const SENTENCE_SEPARATOR = /\s*[;:•]\s*|\s+ile\s+/i

/**
 * "-ıp" ulacı: "A/B testleri tasarlayıp sonuçlarını raporlamak" iki ayrı
 * iştir. "-ship" ile biten İngilizce kelimeler (leadership) ve "ekip" gibi
 * kısa kelimeler hariç.
 */
const GERUND =
  /\s+(?!(?:\p{L}*ship|takip|sahip|kulüp)(?=\s|$))\p{L}{3,}(?:y)?(?:ıp|ip|up|üp)(?=\s|$)/iu

/** Başta duran ve kavrama ait olmayan kalıplar. */
const FRONT_PADDING =
  /^(en az\s+\d+\+?\s*yıl(lık)?\s+|at least\s+\d+\+?\s*years?\s+(of\s+)?|\d+\+?\s*yıl(lık)?\s+|\d+\+?\s*years?\s+(of\s+)?|hands on with\s+|experience (with|in)\s+|deneyim(i|li)?\s+|tercihen\s+|preferably\s+|good\s+|strong\s+|solid\s+|equivalent\s+|iyi derecede\s+|çok iyi( derecede)?\s+|ileri (düzey|seviye)(de)?\s+|orta (düzey|seviye)(de)?\s+|akıcı\s+|fluent\s+|proficient in\s+|good command of\s+|takım içinde\s+|ekip içinde\s+|profesyonel\s+|professional\s+|temel\s+|basic\s+)/i

/** Sonda duran ve kavrama ait olmayan kalıplar. */
const BACK_PADDING =
  /\s+(deneyim(i|e|leri|lerine)?|tecrübe(si|ye|leri)?|bilgi(si|sine|leri)?|bilgisi olan|süreç(i|e|leri|lerine|lerinde|lerini)?|süreci|teknoloji(si|leri|lerine)?|yetkinli(k|ği|kleri)|kullanım(ı)?|konu(sunda|larında|larına)|alan(ında|larında)|hakimiyet(i)?|hakim|sahibi|sahip|uzmanlığı|mezun(u|ları)?|bölüm(ü|ünden|lerinden)?|beceri(si|leri)|zorunludur|şarttır|gerekmektedir|beklenmektedir|aranmaktadır|tercih sebebidir|vb|vs|etc|gibi|experience|knowledge|skills?|frameworks?|technologies|tools?|proficiency|expertise|background|practices)$/i

/** Başka kelimeden sonra gelen iş adları: "tasarım sistemi geliştirme" → "tasarım sistemi". */
const BACKEND_WORK = /\s+(geliştirme|geliştirilmesi|oluşturma|yazma|kurma|kurulumu|çalışma|kullanma|yapma|tasarlama)$/i

/** Araç/birliktelik eki: "ROAS hedefleriyle" → "ROAS". */
const BACKEND_TOGETHER = /\s+\p{L}{3,}(?:ıyla|iyle|uyla|üyle|yla|yle)$/iu

/**
 * Tamlama: "TikTok Ads kampanyalarının kurulumu" → "TikTok Ads". Yalnızca kalan
 * kısım büyük harf taşıyorsa (marka, teknoloji adı) uygulanıyor; "takımın
 * yönetimi" gibi sıradan tamlamalara dokunulmuyor.
 */
const COMPOUND = /^(.*\p{Lu}.*?)\s+\p{L}+(?:nın|nin|nun|nün)(?:\s+\p{L}+)?$/u

/** Anlamı kendi başına taşımayan yardımcı fiiller. */
const AUXILIARY_VERB =
  /^(olmak|bilmek|yapmak|etmek|kullanmak|çalışmak|bulunmak|geliştirmek|sahip olmak|hakim olmak|\p{L}+(?:abil|ebil)mek)$/iu

/** Belirtme durumundaki nesne: "sonuçlarını raporlamak" → "raporlama". */
const DEFINITE_SUFFIX = /(?:ını|ini|unu|ünü|nı|ni|nu|nü|yı|yi|yu|yü)$/i

/** Tek başına kavram sayılmayacak kalıntılar. */
const MEANINGLESS =
  /^(deneyim(i|e|li)?|tecrübe(si)?|bilgi(si)?|konusunda|konularında|sahibi olmak|hakim olmak|olmak|mezun olmak|ilgili bölümlerden mezun olmak|benzer bir işte|profesyonel|professional|optimizasyon(u)?|kurulum(u)?|yönetim(i)?|bakım(ı)?|geliştirilmesi|experience|knowledge|skills?|equivalent|etc|vb|vs|gibi|the|and|or|ve|veya|with|in|of|a|an)$/i

/**
 * Ortak başı paylaşan tek kelimelik niteleyiciler. Liste bilinçli olarak dar:
 * "SQL ve NoSQL veri tabanları" gibi ifadelerde baş paylaşılmıyor ve genel
 * bir kural o durumu bozuyordu.
 */
const QUALIFIER =
  /^(birim|unit|entegrasyon|integration|fonksiyonel|functional|manuel|manual|otomasyon|automation|performans|performance|yük|load|regresyon|regression|frontend|backend|önyüz|arka yüz|web|mobil|mobile|ön|arka)$/i

/** Genel eğitim gereksinimi: "Üniversitelerin ilgili bölümlerinden mezun". */
const GENERAL_EDUCATION_WORD =
  /^(üniversite\p{L}*|lisans|önlisans|yüksek|derece\p{L}*|ilgili|bölüm\p{L}*|fakülte\p{L}*|mezun\p{L}*|olmak|olan|tercihen|university|degree|bachelor'?s?|related|field|fields|in|a|or|of|from|graduate|en|az)$/iu

const GENERAL_EDUCATION_CONCEPT: Concept = {
  term: "Üniversite mezunu",
  synonyms: ["üniversite", "university", "lisans", "bachelor", "önlisans", "yüksek lisans", "master", "fakülte"],
}

const MIN_LENGTH = 2
const MAX_LENGTH = 45

interface Fragment {
  term: string
  synonyms: string[]
}

export function splitIntoConcepts(
  requirementText: string,
  type?: Requirement["type"],
): Concept[] {
  const text = requirementText.trim()

  if (type === "education" && isGeneralEducation(text)) return [GENERAL_EDUCATION_CONCEPT]

  // Parantezler yer tutucuyla değiştiriliyor ki içlerindeki virgül ve "veya"
  // dış listeyi bölmesin; içerik sonra ait olduğu kavrama bağlanıyor.
  const parens: string[] = []
  const withPlaceholders = text.replace(/\(([^()]*)\)/g, (_, inner: string) => {
    parens.push(inner)
    return ` \u0000${parens.length - 1}\u0000 `
  })

  const conceptList: Concept[] = []
  for (const sentence of splitSentences(withPlaceholders)) {
    conceptList.push(...sentenceConcepts(sentence, parens))
  }

  // Tekilleştirme: "Docker ve Container teknolojileri" gibi ifadelerde aynı
  // terim iki kez çıkabiliyor.
  const seen = new Set<string>()
  const unique = conceptList.filter((k) => {
    const key = k.term.toLocaleLowerCase("tr")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Hiç kavram çıkmayan gereksinimler var — "Benzer bir işte en az 5 yıl
  // deneyim sahibi olmak" gibi. Bunlar tek kavram sayılıp bütün hâlleriyle
  // aranıyor; skorlamanın her gereksinim için en az bir kavrama ihtiyacı var.
  if (unique.length === 0) return [{ term: text, synonyms: [] }]
  return unique
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SEPARATOR)
    .flatMap((fragment) => fragment.split(GERUND))
    .map((p) => p.trim())
    .filter(Boolean)
}

function sentenceConcepts(sentence: string, parens: string[]): Concept[] {
  const tokenList = sentence.split(LIST_SEPARATOR)
  const itemList: string[] = []
  let withOptions = false
  for (let i = 0; i < tokenList.length; i++) {
    const t = tokenList[i]!.trim()
    if (i % 2 === 1) {
      if (OPTIONS.test(t)) withOptions = true
      continue
    }
    if (t) itemList.push(t)
  }

  // Parantez içeriği önündeki öğeye bağlanıyor. Çok öğeli içerik ("Jest,
  // Playwright veya Cypress") bir "ve" listesinin tamamının örneği sayılıyor.
  const fragments: Fragment[] = []
  let listExamples: string[] = []
  for (const item of itemList) {
    const synonymList: string[] = []
    const plain = item.replace(/\u0000(\d+)\u0000/g, (_, n: string) => {
      const contentText = parenContent(parens[Number(n)] ?? "")
      // Tek terim kısaltma ya da eş anlamlı ("(SSR)", "(WCAG)"); çok terim
      // örnek listesi, aşağıda ayrı kavram oluyor.
      if (contentText.length > 1) listExamples = contentText
      else synonymList.push(...contentText)
      return " "
    })
    const term = cleanup(plain)
    if (!isValid(term)) {
      // Öğe dolgudan ibaretse ama parantezi varsa ("(SSR) deneyimi"),
      // parantezdeki terim kavram oluyor.
      if (synonymList[0]) fragments.push({ term: synonymList[0], synonyms: synonymList.slice(1) })
      continue
    }
    fragments.push({ term, synonyms: synonymList })
  }

  distributeCommonHead(fragments)

  const outcome: Concept[] =
    withOptions && fragments.length > 1
      ? [
          {
            term: fragments.map((p) => p.term).join(" / "),
            synonyms: [...new Set(fragments.flatMap((p) => [p.term, ...p.synonyms]))],
          },
        ]
      : fragments

  // Çok öğeli parantez ("Jest, Playwright veya Cypress") eş anlamlı değil,
  // örnek araç listesi: ayrı bir seçenek kavramı oluyor. Eş anlamlı sayılsaydı
  // yalnızca Jest bilen aday "entegrasyon testleri"ni de karşılamış
  // sayılıyor, özet yazımı da bu terimi kaynağında yokken kullanabiliyordu
  // (K-38).
  if (listExamples.length > 1) {
    outcome.push({ term: listExamples.join(" / "), synonyms: listExamples })
  }
  return outcome
}

/** "Birim ve entegrasyon testleri" → "Birim testleri", "entegrasyon testleri". */
function distributeCommonHead(fragments: Fragment[]): void {
  const last = fragments[fragments.length - 1]
  if (!last) return
  const lastWords = last.term.split(/\s+/)
  if (lastWords.length < 2) return
  const head = lastWords[lastWords.length - 1]!
  for (const p of fragments.slice(0, -1)) {
    if (!p.term.includes(" ") && QUALIFIER.test(p.term)) p.term = `${p.term} ${head}`
  }
}

function parenContent(inner: string): string[] {
  return inner
    .replace(/^(ör\.|örn\.|örneğin|e\.g\.|eg\.|i\.e\.|such as)\s*/i, "")
    .split(LIST_SEPARATOR)
    .filter((_, i) => i % 2 === 0)
    .map(cleanup)
    .filter(isValid)
}

function isValid(p: string): boolean {
  return p.length >= MIN_LENGTH && p.length <= MAX_LENGTH && !MEANINGLESS.test(lower(p))
}

/**
 * Türkçe küçültme. Kalıplar bunun üzerinde deneniyor: JavaScript'in `/i`
 * bayrağı "İ" ile "i"yi eşleştirmiyor ve "İyi derecede İngilizce" dolgusu
 * tutmuyordu. Türkçe küçültme uzunluğu koruduğu için eşleşen parça özgün
 * metinden aynı uzunlukta kesilebiliyor.
 */
function lower(p: string): string {
  return p.toLocaleLowerCase("tr")
}

function trimLeading(p: string, pattern: RegExp): string {
  const m = lower(p).match(pattern)
  return m && m.index === 0 ? p.slice(m[0].length) : p
}

function trimTrailing(p: string, pattern: RegExp): string {
  const m = lower(p).match(pattern)
  return m ? p.slice(0, p.length - m[0].length) : p
}

function isGeneralEducation(text: string): boolean {
  const words = text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  return words.length > 0 && words.every((k) => GENERAL_EDUCATION_WORD.test(k))
}

function cleanup(fragment: string): string {
  let p = fragment.replace(/\s+/g, " ").trim()
  // Dolgular birden çok katman olabiliyor: "at least 3 years of hands on with X"
  for (let i = 0; i < 4; i++) {
    const before = p
    p = stripVerbs(p)
    p = trimTrailing(trimLeading(p, FRONT_PADDING), BACK_PADDING).trim()
    if (p.includes(" ")) {
      p = trimTrailing(trimTrailing(p, BACKEND_WORK), BACKEND_TOGETHER).trim()
      const compound = p.match(COMPOUND)
      if (compound) p = compound[1]!.trim()
    }
    if (p === before) break
  }
  return p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})\]+#]+$/gu, "").trim()
}

/**
 * Sondaki mastarı ayıklar. Yardımcı fiil atılıyor ("GraphQL ile çalışmış
 * olmak"); anlam taşıyan fiil ada çevriliyor ve belirtme durumundaki nesnesi
 * atılıyor ("sonuçlarını raporlamak" → "raporlama").
 */
function stripVerbs(p: string): string {
  const words = p.split(" ")
  const last = words[words.length - 1] ?? ""
  if (!/m(a|e)k$/i.test(last) || last.length < 5) return p

  const bigram = words.slice(-2).join(" ")
  if (words.length >= 2 && AUXILIARY_VERB.test(bigram)) {
    return words.slice(0, -2).join(" ")
  }
  if (AUXILIARY_VERB.test(last)) {
    // Önündeki ortaç da yardımcı fiile ait: "çalışmış olmak".
    return words.slice(0, -1).join(" ").replace(/(^|\s+)\p{L}+m[ıiuü]ş$/iu, "")
  }

  const name = last.slice(0, -1)
  const previous = words.slice(0, -1)
  if (previous.length > 0 && DEFINITE_SUFFIX.test(previous[previous.length - 1]!)) previous.pop()
  return previous.length > 0 ? `${previous.join(" ")} ${name}` : name
}
