import type { Requirement } from "../schemas/job.js"
import type { Evidence } from "./evidence.js"

/**
 * Skor sabitleri. Tek yerde toplanıyor; değerlendirme setinde (Görev 13)
 * ayarlanacak — koda dağılmıyor (spec §7).
 */
export interface ScoringConfig {
  /** "must" gereksinimlerinin ağırlığı. */
  mustWeight: number
  /** "nice" gereksinimlerinin ağırlığı. */
  niceWeight: number
  /** Bu değerin altındaki kosinüs benzerliği eşleşme sayılmaz. */
  semanticThreshold: number
  /**
   * Anlamsal eşleşmenin devreye girdiği gereksinim türleri.
   *
   * Yapılandırılabilir olmasının sebebi ölçüm: birikmiş işler #7 "anlamsal
   * katmanı yalnızca soft türünde kullan" diyordu ve bu kapsam olmadan
   * hipotez sınanamazdı (K-36). Sınandı, reddedildi — ama set büyüdüğünde
   * (birikmiş işler #4) tarama tekrarlanabilsin diye kapsam kaldı.
   */
  semanticTypes: readonly Requirement["type"][]
  /**
   * Her gereksinim türünün kanıt sayabildiği kanıt türleri.
   *
   * Gereksinimin türü, onu karşılayabilecek kanıtın türünü sınırlar: bir
   * *deneyim* gereksinimini beceri listesindeki bir satır karşılamaz, çünkü
   * beceri listesi bir iddiadır — nerede, ne kadar, hangi rolde kullanıldığını
   * söylemez (K-36).
   */
  evidenceKindsByType: Readonly<Record<Requirement["type"], readonly Evidence["kind"][]>>
  /**
   * Özet cümlesinden gelen eşleşmenin katkı çarpanı.
   *
   * Özet adayın kendi hakkındaki iddiasıdır; nerede ve hangi rolde yapıldığını
   * söyleyen bir madde kadar güçlü kanıt değil. Ama hiç sayılmaması da yanlış:
   * "3 yıllık performans pazarlaması deneyimi" özette yazan adayda gereksinim
   * tamamen eksik görünüyordu (K-38).
   */
  summaryWeight: number
  /**
   * Özet cümlesinin ANLAMSAL kanıt sayılabildiği gereksinim türleri (DOG-108).
   *
   * Beceri, adayın yaptığı işten (madde), listelediğinden ya da özette adıyla
   * geçmesinden (kelime eşleşmesi) kanıtlanır. Kendini anlatan bir cümleden
   * anlamsal tahmin beceri kanıtı değil: "Üreterek öğrenmeye … önem
   * veriyorum" cümlesi "Makine öğrenmesi"yle 0,541 eşleşiyordu. Deneyim ve
   * kişisel özellik ise özette doğal olarak anlatılıyor ("üretim ortamında
   * mavi yaka ekiplerle", 0,544, doğru). Kelime eşleşmesi her türde açık.
   */
  summarySemanticTypes: readonly Requirement["type"][]
  /**
   * Skora katılmayan gereksinim türleri (DOG-103). Eşleşmeleri hâlâ
   * hesaplanıyor ve ekranda ayrı gösteriliyor; yalnızca skoru etkilemiyorlar.
   *
   * Kişisel nitelikler ("ekiple çalışmaya uygun") CV'den lafzen
   * kanıtlanamıyor: değerlendirme setinde iyi uyumlu 7 çiftteki 17 soft
   * gereksinimden 1'i karşılandı ve skoru aşağı çekiyorlardı (cv-f×ilan-8: 34,
   * soft hariç 77). K2'de iki katılımcı bunların haksız yere "eksik"
   * sayıldığını söyledi: "Kimse CV'sinde 'ekiple çalışmaya uygun biriyim'
   * yazmaz." İlanda yalnızca bu türden gereksinim varsa sayılıyorlar.
   */
  unscoredTypes: readonly Requirement["type"][]
  /**
   * İlan unvanının CV'de geçmesinin ağırlığı (DOG-103); zorunlu bir
   * gereksinimle aynı. Tam eşleşme 1, kısmi 0,5, yok 0 katkı. İşe alımcılar
   * ATS'de unvanla arıyor (DOG-87) ve unvanı skora katmayınca ekran aynı anda
   * "Yüksek uyum" ve "ilandaki unvan CV'nde geçmiyor" diyordu (muhasebe CV'si
   * × İK ilanı: 42).
   */
  titleWeight: number
  /**
   * Eşiği geçen anlamsal eşleşmenin katkısı: benzerlik değeri kadar
   * ("similarity") ya da tam ("full").
   */
  semanticCredit: "similarity" | "full"
}

const ALL_EVIDENCE_KINDS: readonly Evidence["kind"][] = [
  "role",
  "bullet",
  "skill",
  "education",
  "language",
  "summary",
]

/**
 * Formülün 2. sürümü (DOG-103), olduğu gibi. Kayıtlı analizler kendi
 * sürümüyle yeniden hesaplanıyor ("ilanda yok" işareti, düzeltmeler); bu
 * değerler sonraki sürümlerde değişmemeli.
 *
 * Eşik bilinçli olarak yüksek: uydurma eşleşme (yanlış pozitif), kaçırmadan
 * daha zararlıdır — kullanıcıya olmayan bir yetkinliği varmış gibi gösterir
 * ve dürüstlük ilkesini çiğner (spec §7).
 */
const REVISION_2: ScoringConfig = {
  mustWeight: 2.0,
  niceWeight: 1.0,
  // text-embedding-3-small ile ölçüldü (DOG-42). Eşik gömme modeline bağlı:
  // BGE-M3'te 0,65 idi (K-40), OpenAI'da benzerlikler daha düşük çıkıyor ve
  // 0,65 anlamsal katmanı tümüyle kapatıyordu.
  semanticThreshold: 0.5,
  // Bütün türler: anlamsal katmanı soft'a daraltmak 10 çiftte isabeti
  // %91,1'den %85,7'ye düşürüyor (K-36).
  semanticTypes: ["skill", "experience", "education", "soft"],
  evidenceKindsByType: {
    skill: ALL_EVIDENCE_KINDS,
    // Yalnızca anlatı kanıtı: deneyim gereksinimini beceri listesi ya da
    // diploma satırı karşılamaz. Ölçümde uydurmayı 3'ten 2'ye indirdi ve
    // hiçbir meşru eşleşmeyi düşürmedi (K-36).
    //
    // Özet de anlatı sayılıyor, ama `summaryWeight` ile indirimli (K-38).
    experience: ["role", "bullet", "summary"],
    // Eğitim gereksinimini yalnızca eğitim kanıtına daraltmak ölçümde iki
    // meşru eşleşmeyi düşürüyor: ilan "Yazılım Mühendisliği" derken CV'nin
    // beceri satırı "Yazılım Geliştirme" köprüyü kuruyor (K-36).
    education: ALL_EVIDENCE_KINDS,
    soft: ALL_EVIDENCE_KINDS,
    // Koşul anlamsal eşleşmez (semanticTypes'ta yok); ehliyet, askerlik, şehir
    // CV'nin herhangi bir yerinde yazabilir (score/conditions.ts).
    condition: ALL_EVIDENCE_KINDS,
  },
  summaryWeight: 0.75,
  summarySemanticTypes: ["experience", "soft"],
  // Koşullar (DOG-115) da skora girmiyor: CV'den çoğu zaman anlaşılamıyorlar
  // ("seyahat engeli olmayan") ve evet/hayır sorusu oldukları için ayrı
  // kutuda gösteriliyorlar.
  unscoredTypes: ["soft", "condition"],
  titleWeight: 2,
  semanticCredit: "similarity",
}

/** 1. sürüm: kişisel nitelikler skorda, unvan yok. */
const REVISION_1: ScoringConfig = { ...REVISION_2, unscoredTypes: [], titleWeight: 0 }

export const DEFAULT_SCORING_CONFIG: ScoringConfig = REVISION_2

/**
 * Skor formülünün sürümü; analiz sonucuna yazılıyor. 2: soft gereksinimler
 * skordan çıktı, unvan girdi (DOG-103). Eski sonuçların kayıtlı skoru eski
 * formülle; yenisiyle karşılaştırılacaksa yeniden hesaplanmalı.
 */
export const SCORING_REVISION = 2

const PAST_REVISIONS: Readonly<Record<number, ScoringConfig>> = { 1: REVISION_1, 2: REVISION_2 }

/**
 * Kayıtlı bir sonucun formülü. Sürümü olmayan sonuç 1. sürüm; bilinmeyen
 * yeni bir sürüm bugünkü formül sayılıyor.
 */
export function scoringConfigFor(revision: number | undefined): ScoringConfig {
  const r = revision ?? 1
  if (r >= SCORING_REVISION) return DEFAULT_SCORING_CONFIG
  return PAST_REVISIONS[r] ?? REVISION_1
}
