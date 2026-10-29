import { mentionedLanguages } from "../normalize/languageNames.js"
import { normalizeText } from "../normalize/turkish.js"
import type { Concept, Requirement } from "../schemas/job.js"
import { CITIES } from "../score/conditions.js"

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
 *
 * Skorun 3. sürümünde eklenenler (değerlendirme setindeki ilanlardan):
 *   - Örnek listesi: "X, Y ve Z gibi araçlar", "such as X, Y", "including
 *     X, Y" — örneklerden biri yeter; "gibi"nin ardındaki tür adı ("kariyer
 *     portalları") seçeneğin eş anlamlısı.
 *   - Cümle: İngilizce gereksinimlerdeki anlatı ("You've owned code…", "Be
 *     ready to…") ve "… is a strong advantage" cümlesi kavram değil.
 *   - Düzey ve süre her yerde: "orta veya ileri düzey" seçenek listesi değil,
 *     "en az 3 yıl" kavramın parçası değil (süreyi score/duration.ts ölçüyor).
 *   - "X konusunda / alanında / süreçlerinde …": kavram X.
 *   - "veya benzeri …", "ilgili yasal düzenlemeler", "bu araçları …": kavram değil.
 *   - Dil gereksinimi dilin adına iniyor, öteki dildeki adıyla.
 */

/** Liste içindeki ayırıcılar; seçenek bildirenler ayrıca işaretleniyor. */
const LIST_SEPARATOR = /\s*(,|\s&\s|\bve\b|\band\b|\bveya\b|\bya da\b|\byahut\b|\bor\b)\s*/i
const OPTIONS = /^(veya|ya da|yahut|or)$/i

/**
 * Cümleyi bağımsız parçalara ayıranlar. "/" dahil değil: "CI/CD" tek kavramdır.
 * "kullanarak" da araçla işi ayırıyor ("LLM API'lerini kullanarak AI Agent").
 */
const SENTENCE_SEPARATOR = /\s*[;:•]\s*|\s+ile\s+|\s+kullanarak\s+/i

/** Nokta ve büyük harf: yeni cümle. "Ph.D. is a plus" bölünmüyor. */
const SENTENCE_END = /(?<=[.!?])\s+(?=\p{Lu})/u

/** İlk cümleden sonra gelen anlatı: okura hitap, açıklama, uyarı. */
const NARRATIVE = /^(?:you|you're|you've|we|we're|they|it|it's|this|that|these|those|be|not|bu|şu|bunlar|sen|siz)(?![\p{L}'’])/u

/** "… is a strong advantage", "tercih sebebidir": gereksinimin içindeki artı cümlesi. */
const ADVANTAGE =
  /(?:(?:is|are) (?:a |an )?(?:strong |big |great |huge |real )?(?:plus|advantage|bonus)|(?:is|are) preferred|tercih (?:sebebi|nedeni)(?:dir)?|avantaj(?:dır)?|artı(?:dır)?(?: olur)?)\.?$/u

/**
 * Düzey ifadesi: "orta veya ileri düzey", "iyi derecede". Listeden önce
 * siliniyor; yoksa "veya" onu seçenek listesine çeviriyordu.
 */
const LEVEL =
  /(?<![\p{L}])(?:çok iyi|iyi|orta|ileri|temel|başlangıç)(?:\s+(?:veya|ya da|ile|\/)\s+(?:çok iyi|iyi|orta|ileri|temel))?\s+(?:düzey|seviye|derece)(?:de|si|sinde|li)?(?![\p{L}])|(?<![\p{L}])(?:basic|intermediate|advanced|expert)(?:\s+(?:or|to)\s+(?:intermediate|advanced|expert))?\s+(?:level|proficiency)(?![\p{L}])/gu

/**
 * Süre: "en az 3 yıl", "3-5 yıl", "5+ years of". Kavramın parçası değil;
 * süreyi score/duration.ts gereksinim metninden ölçüyor.
 */
const DURATION =
  /(?:(?:en az|minimum|asgari|at least|min\.?)\s+)?\d+(?:\s*[-–]\s*\d+)?\+?\s*(?:yıl(?:lık)?|years?|yrs?)(?![\p{L}])(?:\s+of)?(?:\s+(?:uygulamalı|profesyonel|hands-on))?/gu

/**
 * Deneyimden önceki bulunma eki: "Dijital pazarlamada en az 2 yıl deneyim",
 * "Satışta deneyimli". Süre silinince kavram "pazarlamada" kalıyor ve CV'deki
 * "dijital pazarlama" ile eşleşmiyordu.
 */
const LOCATIVE_BEFORE_EXPERIENCE =
  /(\p{L}{3,})(da|de|ta|te)(?=(?:\s+(?:en az|minimum|asgari))?(?:\s+\d+(?:\s*[-–]\s*\d+)?\+?\s*yıl(?:lık)?)?\s+(?:deneyim|tecrübe))/gu

/**
 * Ek gerçekten bulunma eki mi: ünlü uyumu ("pazarlama-da", "muhasebe-de") ve
 * sertleşme ("satış-ta"). "website", "Node" gibi sonlar kelimenin kendisi.
 */
function isLocative(stem: string, suffix: string): boolean {
  const vowels = stem.match(/[aıoueiöü]/g)
  const lastVowel = vowels?.at(-1)
  if (!lastVowel) return false
  const back = "aıou".includes(lastVowel)
  if (back !== suffix.endsWith("a")) return false
  const voiceless = /[çfhkpsşt]$/.test(stem)
  return suffix.startsWith("t") ? voiceless : !voiceless
}

function dropLocative(text: string): string {
  let out = ""
  let last = 0
  for (const m of lower(text).matchAll(LOCATIVE_BEFORE_EXPERIENCE)) {
    // "konusunda deneyim", "süreçlerinde deneyimli": kuyruk kelimesi, TAIL_CUT kesiyor.
    if (TAIL_CUT.test(` ${m[0]} `) || !isLocative(m[1]!, m[2]!)) continue
    const suffixAt = m.index! + m[1]!.length
    out += text.slice(last, suffixAt)
    last = suffixAt + m[2]!.length
  }
  return out + text.slice(last)
}

/** "en az biriyle", "at least one of": seçenek listesinin ekidir, kavram değil. */
const AT_LEAST_ONE = /(?:en az|asgari)\s+bir(?:i|iyle|ini|inde|ine|inden)(?![\p{L}])|at least one(?:\s+of)?(?![\p{L}])/gu

/** "ve" ile bağlı ama tek kavram olan ifadeler. */
const FIXED_PHRASE = /(?:iktisadi ve idari bilimler|araştırma ve geliştirme|eğitim ve gelişim|research and development)/gu
const JOINED_VE = "\u0002"
const JOINED_AND = "\u0003"

/** Örnek listesi: Türkçede örnekler önce ("X ve Y gibi araçlar"), İngilizcede sonra. */
const EXAMPLES_TR = /\s+gibi(?:\s+|$)/u
const EXAMPLES_EN = /,?\s+(?:such as|e\.g\.,?|for example|for instance)\s+/u
const INCLUDING_EN = /,?\s+including\s+/u

/** Ortaç: "pazarlarını yönetebilecek çok pazarlı reklam yönetimi" → kavram ortaçtan sonrası. */
const PARTICIPLE_HEAD = /(?<![\p{L}])\p{L}+(?:abilecek|ebilecek|abilen|ebilen)\s+(?!(?:ve|veya|ya da|ile|and|or)(?![\p{L}]))(?=\p{L})/u

/** Seçenek listesinin "veya benzeri …" kuyruğu: o öğe ve ardından gelenler. */
const SIMILAR_TAIL = /^(?:benzer(?:i|leri)?|similar|vb\.?|vs\.?|etc\.?)(?![\p{L}])/u

/** Kapsam genişletme, geri gönderme: "ilgili yasal düzenlemeler", "bu araçları", "their application". */
const NOT_A_CONCEPT_START =
  /^(?:ilgili|related|a related|the related|diğer|other|bu|şu|bunları|these|this|those|their|its|our)(?![\p{L}])/u

/** "X konusunda / alanında / süreçlerinde …": kavram X, gerisi dolgu. */
const TAIL_CUT =
  /\s+(?:konusunda|konularında|alanında|alanlarında|süreçlerinde|süreçlerine|hakkında|sektöründe|sektörlerinde|ortamında|ortamlarında|olmak üzere)(?=\s|$)/u

/** İngilizce yan cümle: "agent systems that shipped …" → "agent systems". */
const RELATIVE_CLAUSE = /\s+(?:that|which|who|whose|where|when)\s/u

/** "kanallarda", "araçlarını": örnek listesinin ardındaki genel tür adı. */
const GENERIC_HEAD =
  /^(?:kanal|araç|platform|portal|program|sistem|framework|kütüphane|teknoloji|sektör|alan)\p{L}*\s+/u

/** Çoğul + hâl eki: "projelerde" → "projeler", "pazarlarını" → "pazarları". */
const PLURAL_CASE = /((?:lar|ler)(?:ı|i)?)(?:nda|nde|ndan|nden|da|de|dan|den|nı|ni|na|ne)$/u
/** Tür adında ek olarak "-yla": "veritabanlarıyla" → "veritabanları". */
const PLURAL_WITH = /((?:lar|ler)(?:ı|i))(?:yla|yle)$/u

/** Dil gereksiniminde dilin adı dışında kalabilecek kelimeler (normalizeText biçiminde). */
const LANGUAGE_FILLER = new Set([
  "dil", "dili", "bilgisi", "bilgisine", "bilen", "bilmek", "olan", "sahip", "konusan", "konuşan",
  "yazili", "sozlu", "sözlü", "okuma", "yazma", "seviye", "duzey", "düzey",
  "command", "of", "in", "excellent", "fluent", "fluency", "good", "strong", "proficiency", "proficient",
  "written", "spoken", "verbal", "and", "level", "language", "skills", "native", "ve",
])

/**
 * Araçların yaygın kısa ve eski adları. Özel adlarda anlamsal eşleşme kapalı
 * (K-38), yani "Google Analytics 4" isteyen ilan "GA4" yazan CV'yi ancak bu
 * eşlemeyle bulabiliyor. Tutucu: belirsiz kısa adlar ("Office", "Logo", "JS")
 * yok; bir CV'de "back office" ya da "logo tasarımı" olarak geçebilirler.
 */
const TOOL_ALIASES: string[][] = [
  ["Google Analytics 4", "GA4", "Google Analytics"],
  ["Google Tag Manager", "GTM"],
  ["Google Ads", "Google AdWords", "AdWords"],
  ["Meta Ads", "Facebook Ads"],
  ["Meta Business Suite", "Facebook Business Manager", "Meta Business Manager"],
  ["Looker Studio", "Google Data Studio", "Data Studio"],
  ["Power BI", "PowerBI"],
  ["SEO", "arama motoru optimizasyonu", "search engine optimization"],
  ["CRM", "customer relationship management", "müşteri ilişkileri yönetimi"],
  ["ERP", "enterprise resource planning", "kurumsal kaynak planlaması"],
  ["MS Office", "Microsoft Office"],
  ["MS Excel", "Microsoft Excel", "Excel"],
  ["Kubernetes", "K8s"],
  ["PostgreSQL", "Postgres"],
  ["Amazon Web Services", "AWS"],
  ["Google Cloud Platform", "Google Cloud", "GCP"],
  ["Microsoft Azure", "Azure"],
  ["React", "React.js", "ReactJS"],
  ["Vue", "Vue.js", "VueJS"],
  ["Next.js", "NextJS"],
  ["Node.js", "NodeJS"],
  ["Machine Learning", "ML", "makine öğrenmesi", "makine öğrenimi"],
  ["Natural Language Processing", "NLP", "doğal dil işleme"],
  ["LLM", "Large Language Model", "Large Language Models", "büyük dil modeli", "büyük dil modelleri"],
  ["Retrieval-augmented generation", "RAG"],
]
const ALIAS_OF = new Map(TOOL_ALIASES.flatMap((group) => group.map((name) => [name.toLocaleLowerCase("tr"), group] as const)))

function toolAliases(term: string): string[] {
  const group = ALIAS_OF.get(term.toLocaleLowerCase("tr"))
  return group ? group.filter((name) => name.toLocaleLowerCase("tr") !== term.toLocaleLowerCase("tr")) : []
}

/** Tek başına kavram olamayacak yer adları: "Türkiye" ilanda geçiyor diye her CV eşleşmesin. */
const PLACES = new Set(
  [...CITIES, "Türkiye", "Turkey", "Türkiye'de", "yurt dışı", "yurtdışı", "abroad", "Avrupa", "Europe"].map((c) =>
    c.toLocaleLowerCase("tr"),
  ),
)

/**
 * "-ıp" ulacı: "A/B testleri tasarlayıp sonuçlarını raporlamak" iki ayrı
 * iştir. "-ship" ile biten İngilizce kelimeler (leadership) ve "ekip" gibi
 * kısa kelimeler hariç.
 */
const GERUND =
  /\s+(?!(?:\p{L}*ship|takip|sahip|kulüp)(?=\s|$))\p{L}{3,}(?:y)?(?:ıp|ip|up|üp)(?=\s|$)/iu

/** Başta duran ve kavrama ait olmayan kalıplar. */
const FRONT_PADDING =
  /^(en az\s+\d+\+?\s*yıl(lık)?\s+|at least\s+\d+\+?\s*years?\s+(of\s+)?|\d+\+?\s*yıl(lık)?\s+|\d+\+?\s*years?\s+(of\s+)?|hands on with\s+|experience (with|in)\s+|deneyim(i|li)?\s+|tercihen\s+|preferably\s+|good\s+|strong\s+|solid\s+|equivalent\s+|iyi derecede\s+|çok iyi( derecede)?\s+|ileri (düzey|seviye)(de)?\s+|orta (düzey|seviye)(de)?\s+|akıcı\s+|fluent\s+|proficient in\s+|good command of\s+|takım içinde\s+|ekip içinde\s+|profesyonel\s+|professional\s+|temel\s+|basic\s+|özellikle\s+|especially\s+|(?:proven |demonstrated )?experience (?:delivering|building|developing|working with|working on|at|with|in)\s+|hands[- ]on (?:work |experience )?(?:with|in)\s+|(?:deep |thorough |excellent )?(?:expertise|understanding|knowledge|familiarity|proficiency|command|grasp) (?:of|in|with)\s+|(?:bachelor|master|ph\.?d)s?(?: degree)? (?:in|of)\s+|degree in\s+|excellent\s+|(?:a|an|the)\s+|building\s+|developing\s+|delivering\s+)/i

/** Sonda duran ve kavrama ait olmayan kalıplar. */
const BACK_PADDING =
  /\s+(deneyim(i|e|ine|leri|lerine)?|program(ı|ını|ları|larını|larına)?|güçlü|kuvvetli|gelişmiş|yüksek|tecrübe(si|ye|leri)?|bilgi(si|sine|leri)?|bilgisi olan|süreç(i|e|leri|lerine|lerinde|lerini)?|süreci|teknoloji(si|leri|lerine)?|yetkinli(k|ği|kleri)|kullanım(ı)?|konu(sunda|larında|larına)|alan(ında|larında)|ortam(ı|ında|larında)|hakimiyet(i)?|hakim|sahibi|sahip|uzmanlığı|mezun(u|ları)?|bölüm(ü|ünden|lerinden|leri|ler)?|beceri(si|leri)|zorunludur|şarttır|gerekmektedir|beklenmektedir|aranmaktadır|tercih sebebidir|vb|vs|etc|gibi|experience|knowledge|skills?|frameworks?|technologies|tools?|proficiency|expertise|background|practices|techniques|(?:is|are) (?:a |an )?(?:strong |big |great )?(?:plus|advantage|bonus)|(?:is|are) preferred|preferred|at depth|in depth|deneyimli|tecrübeli|deneyimine|edinilmiş|uygulamalı|lisans)$/i

/**
 * Sondaki sıfat-fiil ve ikinci tekil kişi ekli fiil adı: "Excel'i etkin
 * kullanabilen", "bilgi sahibi olmanı", "kullanabilmeni". Yazılım dışı
 * ilanlar gereksinimi okura hitap eden cümleyle yazıyor (DOG-61).
 */
const VERB_TAIL = /\s+\p{L}+(?:abilen|ebilen|abilecek|ebilecek|abilmeni|ebilmeni|manı|meni)$/u

/** Cümle ortasındaki düzey ve kullanım dolguları: "orta seviyede", "aktif olarak". */
const MID_PADDING =
  /\s+(?:(?:orta|ileri|iyi|temel) (?:seviyede|düzeyde)|(?:aktif|etkin) (?:olarak|şekilde)|etkin|tercihen|preferably)(?=\s|$)/giu

/** Kesme işaretli ek: "Excel'i" → "Excel". */
const APOSTROPHE_SUFFIX = /(\p{L})['’]\p{Ll}{1,7}(?=\s|$)/gu

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
  /^(deneyim(i|e|li)?|tecrübe(si)?|bilgi(si)?|konusunda|konularında|sahibi olmak|hakim olmak|olmak|mezun olmak|ilgili bölümlerden mezun olmak|benzer bir işte|benzer bir iş|profesyonel|professional|optimizasyon(u)?|kurulum(u)?|yönetim(i)?|bakım(ı)?|geliştirilmesi|experience|knowledge|skills?|equivalent|etc|vb|vs|gibi|the|and|or|ve|veya|with|in|of|a|an)$/i

/**
 * Ortak başı paylaşan tek kelimelik niteleyiciler. Liste bilinçli olarak dar:
 * "SQL ve NoSQL veri tabanları" gibi ifadelerde baş paylaşılmıyor ve genel
 * bir kural o durumu bozuyordu.
 */
const QUALIFIER =
  /^(birim|unit|entegrasyon|integration|fonksiyonel|functional|manuel|manual|otomasyon|automation|performans|performance|yük|load|regresyon|regression|frontend|backend|önyüz|arka yüz|web|mobil|mobile|ön|arka|hybrid|hibrit)$/i

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

  // Düzey, süre ve "en az biri" listeden önce siliniyor; "ve" ile bağlı sabit
  // ifadeler ("İktisadi ve İdari Bilimler") bölünmesin diye işaretleniyor.
  const prepared = joinFixedPhrases(removeAll(removeAll(removeAll(dropLocative(text), LEVEL), DURATION), AT_LEAST_ONE))

  // Parantezler yer tutucuyla değiştiriliyor ki içlerindeki virgül ve "veya"
  // dış listeyi bölmesin; içerik sonra ait olduğu kavrama bağlanıyor.
  const parens: string[] = []
  const withPlaceholders = prepared.replace(/\(([^()]*)\)/g, (_, inner: string) => {
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
  const restored = unique.map(restoreJoined)
  return type === "education" ? restored.map(educationConcept) : restored
}

/** Eşleşen parçaları siler; kalıp Türkçe küçültülmüş metinde aranıyor (bkz. lower). */
function removeAll(text: string, pattern: RegExp): string {
  let out = ""
  let last = 0
  for (const m of lower(text).matchAll(pattern)) {
    out += text.slice(last, m.index) + " "
    last = m.index! + m[0].length
  }
  return (out + text.slice(last)).replace(/\s+/g, " ").trim()
}

function joinFixedPhrases(text: string): string {
  let out = ""
  let last = 0
  for (const m of lower(text).matchAll(FIXED_PHRASE)) {
    const phrase = text.slice(m.index, m.index! + m[0].length)
    out += text.slice(last, m.index) + phrase.replace(/ ve /giu, ` ${JOINED_VE} `).replace(/ and /giu, ` ${JOINED_AND} `)
    last = m.index! + m[0].length
  }
  return out + text.slice(last)
}

function restoreJoined(concept: Concept): Concept {
  const restore = (s: string) => s.replaceAll(JOINED_VE, "ve").replaceAll(JOINED_AND, "and")
  return { ...concept, term: restore(concept.term), synonyms: concept.synonyms.map(restore) }
}

/**
 * "X veya ilgili bölümlerden mezun": "ilgili bölümler" bir bölüm adı değil,
 * kapsamı genişleten bir ifade (DOG-75). Seçenek olarak kalınca eş anlamlı
 * oluyor ve CV'deki herhangi bir "ilgili" kelimesi eğitimi karşılıyordu.
 * Kapsam genişlemesi skorlamada ele alınıyor (score.ts, `relatedFieldHeads`).
 */
function educationConcept(concept: Concept): Concept {
  const isOption = concept.term.includes(" / ")
  if (!isOption) return concept
  // Yalnızca kapsam ifadesi atılıyor; bölüm adına dokunulmuyor. "Üniversitelerin"
  // gibi önekler kavram vektörünü eğitim satırına yakın tutuyor, onları silmek
  // eval'de iki eğitim eşleşmesini özet ve rol satırına kaydırdı.
  const parts = concept.term
    .split(" / ")
    .filter((p) => !/^(ilgili|related)\b/iu.test(p) && !isGeneralEducation(p))
  if (parts.length === 0) return concept
  return parts.length === 1 ? { term: parts[0]!, synonyms: [] } : { term: parts.join(" / "), synonyms: parts }
}

/**
 * Cümleler ve bağımsız parçalar. İlk cümleden sonraki anlatı ("You've owned
 * code…") ve artı cümlesi ("GCP experience is a strong advantage") atılıyor;
 * ilk cümle her zaman kalıyor.
 */
function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_END)
    .flatMap((sentence) => sentence.split(SENTENCE_SEPARATOR))
    .flatMap((fragment) => fragment.split(GERUND))
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p, i) => i === 0 || !(NARRATIVE.test(lower(p)) || ADVANTAGE.test(lower(p))))
}

function sentenceConcepts(rawSentence: string, parens: string[]): Concept[] {
  const sentence = participleHead(rawSentence)
  const examples = splitExamples(sentence)
  if (!examples) return listConcepts(sentence, parens)

  const out: Concept[] = []
  let category: string | null = null
  if (examples.kind === "including") {
    // "Python development skills, including clean code, testing": tür kendi
    // başına bir kavram, örnekler ayrı bir seçenek.
    out.push(...listConcepts(examples.head, parens))
  } else if (examples.kind === "such") {
    // "… tasks such as classification, NER": son öğe örneklerin türü.
    const { items } = rawItems(examples.head)
    const last = items.pop()
    out.push(...listConcepts(items.join(", "), parens))
    category = last ? categoryPhrase(last) : null
  } else {
    // "Kariyer.net ve LinkedIn gibi kariyer portalları": tür gibi'den sonra.
    category = categoryPhrase(examples.tail)
  }
  const exampleText = examples.kind === "gibi" ? examples.head : examples.tail
  const option = optionConcept(fragmentsOf(rawItems(exampleText).items, parens).fragments, category ? [category] : [])
  if (option) out.push(option)
  return out
}

/** "… yönetebilecek çok pazarlı reklam yönetimi": ortaçtan önceki tümleç kavram değil. */
function participleHead(sentence: string): string {
  const m = lower(sentence).match(PARTICIPLE_HEAD)
  return m ? sentence.slice(m.index! + m[0].length) : sentence
}

function splitExamples(sentence: string): { kind: "gibi" | "such" | "including"; head: string; tail: string } | null {
  const low = lower(sentence)
  for (const [kind, pattern] of [["gibi", EXAMPLES_TR], ["such", EXAMPLES_EN], ["including", INCLUDING_EN]] as const) {
    const m = low.match(pattern)
    if (!m) continue
    const head = sentence.slice(0, m.index).trim()
    const tail = sentence.slice(m.index! + m[0].length).trim()
    if (head && (tail || kind === "gibi")) return { kind, head, tail }
  }
  return null
}

/** Listenin ham öğeleri ve "veya" ile seçenek bildirip bildirmediği. */
function rawItems(text: string): { items: string[]; withOptions: boolean } {
  const tokenList = text.split(LIST_SEPARATOR)
  const items: string[] = []
  let withOptions = false
  for (let i = 0; i < tokenList.length; i++) {
    const t = tokenList[i]!.trim()
    if (i % 2 === 1) {
      if (OPTIONS.test(t)) withOptions = true
      continue
    }
    if (t) items.push(t)
  }
  return { items, withOptions }
}

/**
 * Öğelerden kavram parçaları. "veya benzeri …" öğesi ve ardından gelenler,
 * kapsam genişletme ("ilgili yasal düzenlemeler") ve geri gönderme ("bu
 * araçları …") atılıyor.
 */
function fragmentsOf(items: string[], parens: string[]): { fragments: Fragment[]; listExamples: string[] } {
  const fragments: Fragment[] = []
  let listExamples: string[] = []
  for (const item of items) {
    const head = lower(item.replace(/\u0000\d+\u0000/g, " ").trim())
    if (SIMILAR_TAIL.test(head)) break
    if (NOT_A_CONCEPT_START.test(head)) continue
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
    if (!isValid(term) || PLACES.has(lower(term))) {
      // Öğe dolgudan ibaretse ama parantezi varsa ("(SSR) deneyimi"),
      // parantezdeki terim kavram oluyor.
      if (synonymList[0]) fragments.push({ term: synonymList[0], synonyms: synonymList.slice(1) })
      continue
    }
    const language = languageConcept(term)
    if (language) {
      fragments.push(language)
      continue
    }
    fragments.push({
      term,
      synonyms: [...new Set([...synonymList, ...slashAlternatives(term), ...spacedAlternatives(term), ...toolAliases(term)])],
    })
  }
  distributeCommonHead(fragments)
  return { fragments, listExamples }
}

function listConcepts(sentence: string, parens: string[]): Concept[] {
  const { items, withOptions } = rawItems(sentence)
  const { fragments, listExamples } = fragmentsOf(items, parens)

  const outcome: Concept[] =
    withOptions && fragments.length > 1 ? [optionConcept(fragments, [])!] : fragments

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

/** Seçeneklerden biri yeter: tek kavram, her seçenek ve tür adı eş anlamlı. */
function optionConcept(options: Fragment[], alternatives: string[]): Concept | null {
  if (options.length === 0) return alternatives[0] ? { term: alternatives[0], synonyms: alternatives.slice(1) } : null
  if (options.length === 1) {
    return { term: options[0]!.term, synonyms: [...new Set([...options[0]!.synonyms, ...alternatives])] }
  }
  return {
    term: options.map((p) => p.term).join(" / "),
    synonyms: [...new Set([...options.flatMap((p) => [p.term, ...p.synonyms]), ...alternatives])],
  }
}

/**
 * Örneklerin türü ("kariyer portallarını kullanabilen" → "kariyer
 * portalları"). Yalnızca eş anlamlı olarak kullanılıyor; tek kelimelik genel
 * bir ad ("vektör", "kanallar") her CV'de eşleşebileceği için alınmıyor.
 */
function categoryPhrase(text: string): string | null {
  if (NOT_A_CONCEPT_START.test(lower(text.trim()))) return null
  // "-yla" eki önce ayrılıyor; yoksa cleanup "veritabanlarıyla"yı birliktelik
  // eki sayıp kelimeyi tümden atıyor ("ROAS hedefleriyle" → "ROAS" için doğru).
  let p = cleanup(text.replace(/(\p{L}+(?:lar|ler)(?:ı|i))(?:yla|yle)(?=\s|$)/gu, "$1"))
  p = trimLeading(p, GENERIC_HEAD).trim()
  p = p.replace(PLURAL_WITH, "$1").replace(PLURAL_CASE, "$1")
  return isValid(p) && p.split(/\s+/).length >= 2 ? p : null
}

/**
 * Dil gereksinimi dilin adına iniyor: "İyi derecede İngilizce bilen" →
 * "İngilizce" (English). Yalnızca dilin adı ve dolgu kelimeleri varsa;
 * "English-speaking customer support" bir dil gereksinimi değil.
 */
function languageConcept(term: string): Concept | null {
  const languages = mentionedLanguages(term)
  if (languages.length !== 1) return null
  const language = languages[0]!
  const words = normalizeText(term).split(/\s+/).filter(Boolean)
  const rest = words.filter((w) => !language.pattern.test(w) && !LANGUAGE_FILLER.has(w))
  if (words.length > 5 || rest.length > 0) return null
  const turkish = language.turkish.test(normalizeText(term))
  return turkish ? { term: language.name, synonyms: [language.en] } : { term: language.en, synonyms: [language.name] }
}

/** "üretim / fabrika": boşluklu eğik çizgi seçenek bildiriyor. */
function spacedAlternatives(term: string): string[] {
  const parts = term.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts : []
}

/**
 * Eğik çizgiyle birleşmiş iki kelime seçenektir: "Agile/Scrum" isteyen ilan
 * ikisinden birini yeterli sayar ve CV genelde birini ayrı yazar ("Agile
 * Methodologies"). Kısaltmalar (CI/CD, UI/UX, HTML/CSS) tek kavram kalıyor:
 * parçaları büyük harf ya da kısa; ayrılırlarsa yalnızca HTML bilen aday
 * HTML/CSS'i karşılamış sayılırdı (DOG-73).
 */
function slashAlternatives(term: string): string[] {
  const parts = term.split("/")
  if (parts.length !== 2) return []
  const isWord = (p: string) => /^\p{L}{4,}$/u.test(p) && /\p{Ll}/u.test(p)
  return parts.every(isWord) ? parts : []
}

/** "Birim ve entegrasyon testleri" → "Birim testleri", "entegrasyon testleri". */
function distributeCommonHead(fragments: Fragment[]): void {
  // Baş, niteleyiciden sonra gelen ilk çok kelimeli öğenin son kelimesi:
  // "Hybrid and graph retrieval, chunking" → "Hybrid retrieval".
  for (const [i, p] of fragments.entries()) {
    if (p.term.includes(" ") || !QUALIFIER.test(p.term)) continue
    const next = fragments.slice(i + 1).find((q) => q.term.includes(" "))
    if (next) p.term = `${p.term} ${next.term.split(/\s+/).at(-1)!}`
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

/** Kalıbın başladığı yerden sonrasını atar. */
function cutAt(p: string, pattern: RegExp): string {
  const m = lower(p).match(pattern)
  return m ? p.slice(0, m.index).trim() : p
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
  let p = fragment
    .replace(/\s+/g, " ")
    .replace(APOSTROPHE_SUFFIX, "$1")
    .replace(MID_PADDING, "")
    .trim()
  // Dolgular birden çok katman olabiliyor: "at least 3 years of hands on with X"
  for (let i = 0; i < 6; i++) {
    const before = p
    // Sondaki noktalama dolgunun tanınmasını engelliyordu: "Logo vb." (DOG-61).
    p = p.replace(/[.,;:]+$/, "").trim()
    p = stripVerbs(p)
    p = trimTrailing(p, VERB_TAIL).trim()
    p = trimTrailing(trimLeading(p, FRONT_PADDING), BACK_PADDING).trim()
    p = cutAt(cutAt(p, TAIL_CUT), RELATIVE_CLAUSE)
    p = p.replace(PLURAL_CASE, "$1")
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
