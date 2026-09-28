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
const LISTE_AYIRAC = /\s*(,|\s&\s|\bve\b|\band\b|\bveya\b|\bya da\b|\byahut\b|\bor\b)\s*/i
const SECENEK = /^(veya|ya da|yahut|or)$/i

/** Cümleyi bağımsız parçalara ayıranlar. "/" dahil değil: "CI/CD" tek kavramdır. */
const CUMLE_AYIRAC = /\s*[;:•]\s*|\s+ile\s+/i

/**
 * "-ıp" ulacı: "A/B testleri tasarlayıp sonuçlarını raporlamak" iki ayrı
 * iştir. "-ship" ile biten İngilizce kelimeler (leadership) ve "ekip" gibi
 * kısa kelimeler hariç.
 */
const ULAC =
  /\s+(?!(?:\p{L}*ship|takip|sahip|kulüp)(?=\s|$))\p{L}{3,}(?:y)?(?:ıp|ip|up|üp)(?=\s|$)/iu

/** Başta duran ve kavrama ait olmayan kalıplar. */
const ON_DOLGU =
  /^(en az\s+\d+\+?\s*yıl(lık)?\s+|at least\s+\d+\+?\s*years?\s+(of\s+)?|\d+\+?\s*yıl(lık)?\s+|\d+\+?\s*years?\s+(of\s+)?|hands on with\s+|experience (with|in)\s+|deneyim(i|li)?\s+|tercihen\s+|preferably\s+|good\s+|strong\s+|solid\s+|equivalent\s+|iyi derecede\s+|çok iyi( derecede)?\s+|ileri (düzey|seviye)(de)?\s+|orta (düzey|seviye)(de)?\s+|akıcı\s+|fluent\s+|proficient in\s+|good command of\s+|takım içinde\s+|ekip içinde\s+|profesyonel\s+|professional\s+|temel\s+|basic\s+)/i

/** Sonda duran ve kavrama ait olmayan kalıplar. */
const ARKA_DOLGU =
  /\s+(deneyim(i|e|leri|lerine)?|tecrübe(si|ye|leri)?|bilgi(si|sine|leri)?|bilgisi olan|süreç(i|e|leri|lerine|lerinde|lerini)?|süreci|teknoloji(si|leri|lerine)?|yetkinli(k|ği|kleri)|kullanım(ı)?|konu(sunda|larında|larına)|alan(ında|larında)|hakimiyet(i)?|hakim|sahibi|sahip|uzmanlığı|mezun(u|ları)?|bölüm(ü|ünden|lerinden)?|beceri(si|leri)|zorunludur|şarttır|gerekmektedir|beklenmektedir|aranmaktadır|tercih sebebidir|vb|vs|etc|gibi|experience|knowledge|skills?|frameworks?|technologies|tools?|proficiency|expertise|background|practices)$/i

/** Başka kelimeden sonra gelen iş adları: "tasarım sistemi geliştirme" → "tasarım sistemi". */
const ARKA_IS = /\s+(geliştirme|geliştirilmesi|oluşturma|yazma|kurma|kurulumu|çalışma|kullanma|yapma|tasarlama)$/i

/** Araç/birliktelik eki: "ROAS hedefleriyle" → "ROAS". */
const ARKA_BIRLIKTE = /\s+\p{L}{3,}(?:ıyla|iyle|uyla|üyle|yla|yle)$/iu

/**
 * Tamlama: "TikTok Ads kampanyalarının kurulumu" → "TikTok Ads". Yalnızca kalan
 * kısım büyük harf taşıyorsa (marka, teknoloji adı) uygulanıyor; "takımın
 * yönetimi" gibi sıradan tamlamalara dokunulmuyor.
 */
const TAMLAMA = /^(.*\p{Lu}.*?)\s+\p{L}+(?:nın|nin|nun|nün)(?:\s+\p{L}+)?$/u

/** Anlamı kendi başına taşımayan yardımcı fiiller. */
const YARDIMCI_FIIL =
  /^(olmak|bilmek|yapmak|etmek|kullanmak|çalışmak|bulunmak|geliştirmek|sahip olmak|hakim olmak|\p{L}+(?:abil|ebil)mek)$/iu

/** Belirtme durumundaki nesne: "sonuçlarını raporlamak" → "raporlama". */
const BELIRTME = /(?:ını|ini|unu|ünü|nı|ni|nu|nü|yı|yi|yu|yü)$/i

/** Tek başına kavram sayılmayacak kalıntılar. */
const ANLAMSIZ =
  /^(deneyim(i|e|li)?|tecrübe(si)?|bilgi(si)?|konusunda|konularında|sahibi olmak|hakim olmak|olmak|mezun olmak|ilgili bölümlerden mezun olmak|benzer bir işte|profesyonel|professional|optimizasyon(u)?|kurulum(u)?|yönetim(i)?|bakım(ı)?|geliştirilmesi|experience|knowledge|skills?|equivalent|etc|vb|vs|gibi|the|and|or|ve|veya|with|in|of|a|an)$/i

/**
 * Ortak başı paylaşan tek kelimelik niteleyiciler. Liste bilinçli olarak dar:
 * "SQL ve NoSQL veri tabanları" gibi ifadelerde baş paylaşılmıyor ve genel
 * bir kural o durumu bozuyordu.
 */
const NITELEYICI =
  /^(birim|unit|entegrasyon|integration|fonksiyonel|functional|manuel|manual|otomasyon|automation|performans|performance|yük|load|regresyon|regression|frontend|backend|önyüz|arka yüz|web|mobil|mobile|ön|arka)$/i

/** Genel eğitim gereksinimi: "Üniversitelerin ilgili bölümlerinden mezun". */
const GENEL_EGITIM_KELIMESI =
  /^(üniversite\p{L}*|lisans|önlisans|yüksek|derece\p{L}*|ilgili|bölüm\p{L}*|fakülte\p{L}*|mezun\p{L}*|olmak|olan|tercihen|university|degree|bachelor'?s?|related|field|fields|in|a|or|of|from|graduate|en|az)$/iu

const GENEL_EGITIM_KAVRAMI: Concept = {
  term: "Üniversite mezunu",
  synonyms: ["üniversite", "university", "lisans", "bachelor", "önlisans", "yüksek lisans", "master", "fakülte"],
}

const MIN_UZUNLUK = 2
const MAX_UZUNLUK = 45

interface Parca {
  term: string
  synonyms: string[]
}

export function splitIntoConcepts(
  requirementText: string,
  type?: Requirement["type"],
): Concept[] {
  const metin = requirementText.trim()

  if (type === "education" && genelEgitimMi(metin)) return [GENEL_EGITIM_KAVRAMI]

  // Parantezler yer tutucuyla değiştiriliyor ki içlerindeki virgül ve "veya"
  // dış listeyi bölmesin; içerik sonra ait olduğu kavrama bağlanıyor.
  const parantezler: string[] = []
  const tutuculu = metin.replace(/\(([^()]*)\)/g, (_, ic: string) => {
    parantezler.push(ic)
    return ` \u0000${parantezler.length - 1}\u0000 `
  })

  const kavramlar: Concept[] = []
  for (const cumle of cumlelereBol(tutuculu)) {
    kavramlar.push(...cumleKavramlari(cumle, parantezler))
  }

  // Tekilleştirme: "Docker ve Container teknolojileri" gibi ifadelerde aynı
  // terim iki kez çıkabiliyor.
  const gorulen = new Set<string>()
  const benzersiz = kavramlar.filter((k) => {
    const anahtar = k.term.toLocaleLowerCase("tr")
    if (gorulen.has(anahtar)) return false
    gorulen.add(anahtar)
    return true
  })

  // Hiç kavram çıkmayan gereksinimler var — "Benzer bir işte en az 5 yıl
  // deneyim sahibi olmak" gibi. Bunlar tek kavram sayılıp bütün hâlleriyle
  // aranıyor; skorlamanın her gereksinim için en az bir kavrama ihtiyacı var.
  if (benzersiz.length === 0) return [{ term: metin, synonyms: [] }]
  return benzersiz
}

function cumlelereBol(metin: string): string[] {
  return metin
    .split(CUMLE_AYIRAC)
    .flatMap((parca) => parca.split(ULAC))
    .map((p) => p.trim())
    .filter(Boolean)
}

function cumleKavramlari(cumle: string, parantezler: string[]): Concept[] {
  const tokenlar = cumle.split(LISTE_AYIRAC)
  const ogeler: string[] = []
  let secenekli = false
  for (let i = 0; i < tokenlar.length; i++) {
    const t = tokenlar[i]!.trim()
    if (i % 2 === 1) {
      if (SECENEK.test(t)) secenekli = true
      continue
    }
    if (t) ogeler.push(t)
  }

  // Parantez içeriği önündeki öğeye bağlanıyor. Çok öğeli içerik ("Jest,
  // Playwright veya Cypress") bir "ve" listesinin tamamının örneği sayılıyor.
  const parcalar: Parca[] = []
  let listeOrnekleri: string[] = []
  for (const oge of ogeler) {
    const esler: string[] = []
    const yalin = oge.replace(/\u0000(\d+)\u0000/g, (_, n: string) => {
      const icerik = parantezIcerigi(parantezler[Number(n)] ?? "")
      // Tek terim kısaltma ya da eş anlamlı ("(SSR)", "(WCAG)"); çok terim
      // örnek listesi, aşağıda ayrı kavram oluyor.
      if (icerik.length > 1) listeOrnekleri = icerik
      else esler.push(...icerik)
      return " "
    })
    const term = temizle(yalin)
    if (!gecerliMi(term)) {
      // Öğe dolgudan ibaretse ama parantezi varsa ("(SSR) deneyimi"),
      // parantezdeki terim kavram oluyor.
      if (esler[0]) parcalar.push({ term: esler[0], synonyms: esler.slice(1) })
      continue
    }
    parcalar.push({ term, synonyms: esler })
  }

  ortakBasiDagit(parcalar)

  const sonuc: Concept[] =
    secenekli && parcalar.length > 1
      ? [
          {
            term: parcalar.map((p) => p.term).join(" / "),
            synonyms: [...new Set(parcalar.flatMap((p) => [p.term, ...p.synonyms]))],
          },
        ]
      : parcalar

  // Çok öğeli parantez ("Jest, Playwright veya Cypress") eş anlamlı değil,
  // örnek araç listesi: ayrı bir seçenek kavramı oluyor. Eş anlamlı sayılsaydı
  // yalnızca Jest bilen aday "entegrasyon testleri"ni de karşılamış
  // sayılıyor, özet yazımı da bu terimi kaynağında yokken kullanabiliyordu
  // (K-38).
  if (listeOrnekleri.length > 1) {
    sonuc.push({ term: listeOrnekleri.join(" / "), synonyms: listeOrnekleri })
  }
  return sonuc
}

/** "Birim ve entegrasyon testleri" → "Birim testleri", "entegrasyon testleri". */
function ortakBasiDagit(parcalar: Parca[]): void {
  const son = parcalar[parcalar.length - 1]
  if (!son) return
  const sonKelimeler = son.term.split(/\s+/)
  if (sonKelimeler.length < 2) return
  const bas = sonKelimeler[sonKelimeler.length - 1]!
  for (const p of parcalar.slice(0, -1)) {
    if (!p.term.includes(" ") && NITELEYICI.test(p.term)) p.term = `${p.term} ${bas}`
  }
}

function parantezIcerigi(ic: string): string[] {
  return ic
    .replace(/^(ör\.|örn\.|örneğin|e\.g\.|eg\.|i\.e\.|such as)\s*/i, "")
    .split(LISTE_AYIRAC)
    .filter((_, i) => i % 2 === 0)
    .map(temizle)
    .filter(gecerliMi)
}

function gecerliMi(p: string): boolean {
  return p.length >= MIN_UZUNLUK && p.length <= MAX_UZUNLUK && !ANLAMSIZ.test(kucuk(p))
}

/**
 * Türkçe küçültme. Kalıplar bunun üzerinde deneniyor: JavaScript'in `/i`
 * bayrağı "İ" ile "i"yi eşleştirmiyor ve "İyi derecede İngilizce" dolgusu
 * tutmuyordu. Türkçe küçültme uzunluğu koruduğu için eşleşen parça özgün
 * metinden aynı uzunlukta kesilebiliyor.
 */
function kucuk(p: string): string {
  return p.toLocaleLowerCase("tr")
}

function bastanKirp(p: string, kalip: RegExp): string {
  const m = kucuk(p).match(kalip)
  return m && m.index === 0 ? p.slice(m[0].length) : p
}

function sondanKirp(p: string, kalip: RegExp): string {
  const m = kucuk(p).match(kalip)
  return m ? p.slice(0, p.length - m[0].length) : p
}

function genelEgitimMi(metin: string): boolean {
  const kelimeler = metin
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  return kelimeler.length > 0 && kelimeler.every((k) => GENEL_EGITIM_KELIMESI.test(k))
}

function temizle(parca: string): string {
  let p = parca.replace(/\s+/g, " ").trim()
  // Dolgular birden çok katman olabiliyor: "at least 3 years of hands on with X"
  for (let i = 0; i < 4; i++) {
    const oncesi = p
    p = fiilleriAyikla(p)
    p = sondanKirp(bastanKirp(p, ON_DOLGU), ARKA_DOLGU).trim()
    if (p.includes(" ")) {
      p = sondanKirp(sondanKirp(p, ARKA_IS), ARKA_BIRLIKTE).trim()
      const tamlama = p.match(TAMLAMA)
      if (tamlama) p = tamlama[1]!.trim()
    }
    if (p === oncesi) break
  }
  return p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})\]+#]+$/gu, "").trim()
}

/**
 * Sondaki mastarı ayıklar. Yardımcı fiil atılıyor ("GraphQL ile çalışmış
 * olmak"); anlam taşıyan fiil ada çevriliyor ve belirtme durumundaki nesnesi
 * atılıyor ("sonuçlarını raporlamak" → "raporlama").
 */
function fiilleriAyikla(p: string): string {
  const kelimeler = p.split(" ")
  const son = kelimeler[kelimeler.length - 1] ?? ""
  if (!/m(a|e)k$/i.test(son) || son.length < 5) return p

  const ikili = kelimeler.slice(-2).join(" ")
  if (kelimeler.length >= 2 && YARDIMCI_FIIL.test(ikili)) {
    return kelimeler.slice(0, -2).join(" ")
  }
  if (YARDIMCI_FIIL.test(son)) {
    // Önündeki ortaç da yardımcı fiile ait: "çalışmış olmak".
    return kelimeler.slice(0, -1).join(" ").replace(/(^|\s+)\p{L}+m[ıiuü]ş$/iu, "")
  }

  const ad = son.slice(0, -1)
  const onceki = kelimeler.slice(0, -1)
  if (onceki.length > 0 && BELIRTME.test(onceki[onceki.length - 1]!)) onceki.pop()
  return onceki.length > 0 ? `${onceki.join(" ")} ${ad}` : ad
}
