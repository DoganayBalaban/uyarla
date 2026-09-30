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
 * Başlangıç değerleri hipotezdir. Eşik bilinçli olarak yüksek: uydurma
 * eşleşme (yanlış pozitif), kaçırmadan daha zararlıdır — kullanıcıya olmayan
 * bir yetkinliği varmış gibi gösterir ve dürüstlük ilkesini çiğner (spec §7).
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  mustWeight: 2.0,
  niceWeight: 1.0,
  semanticThreshold: 0.65,
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
  },
  summaryWeight: 0.75,
}
