import type { ScoreResultView } from "@/features/analysis/components/ScoreResult"
import { SAMPLE_POSTINGS } from "@/features/analysis/samplePostings"

/**
 * Örnek rapor (DOG-101): kayıt ya da CV olmadan "ne alacağım?" sorusunun
 * cevabı. Uydurma bir rapor değil; uyarla'nın gerçek çıktısı. Kurgusal
 * pazarlama CV'si (eval/sources/cv/cv-d-pazarlama, kişi ve şirketler
 * uydurma) örnek pazarlama ilanıyla yerelde analiz edildi (21 Ekim 2026),
 * sonuç olduğu gibi buraya alındı. Puanlama değişirse yeniden üretilmeli:
 * skorun 3. sürümünde (DOG-165, 29 Ekim 2026) ilanın gereksinim metinleri
 * aynı kalarak kavramlar yeniden bölündü ve skor yeniden hesaplandı (34 → 46);
 * biçim bulguları CV dosyasına bağlı, değişmedi.
 */
export const SAMPLE_REPORT_POSTING = SAMPLE_POSTINGS.find((p) => p.id === "marketing")!

export const SAMPLE_REPORT: ScoreResultView = {
  "score": 46,
  "format": {
    "passed": [
      "E-posta adresi",
      "Deneyim başlığı",
      "Eğitim başlığı",
      "Beceriler başlığı",
      "Okuma sırası",
      "Tarihler",
      "Uzunluk",
      "Özel karakterler",
      "Ölçülebilir sonuçlar",
      "Klişe ifadeler",
      "Özet",
      "Amaç bölümü yok",
      "Tarih biçimi",
      "Web bağlantısı",
      "Gereksiz ibare yok"
    ],
    "findings": [
      {
        "code": "phone_missing",
        "title": "Telefon numarası bulunamadı",
        "severity": "warning",
        "description": "Telefon numaranı e-postanın yanına eklemen işe alımcının işini kolaylaştırır."
      }
    ]
  },
  "titleMatch": {
    "position": "Dijital Pazarlama Uzmanı",
    "level": "none",
    "resumeTitle": null
  },
  "requirements": [
    {
      "method": "keyword",
      "status": "matched",
      "evidence": {
        "kind": "education",
        "text": "Marmara Üniversitesi, Lisans, İşletme"
      },
      "confidence": 1,
      "requirement": {
        "text": "İşletme, iletişim ya da ilgili bölümlerden lisans mezunu",
        "type": "education",
        "concepts": [
          {
            "term": "İşletme / iletişim",
            "synonyms": [
              "İşletme",
              "iletişim",
              "business / communication"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": []
    },
    {
      "method": "keyword",
      "status": "matched",
      "evidence": {
        "kind": "role",
        "text": "Digital Marketing Executive · Parlak Dijital Ajans"
      },
      "confidence": 1,
      "requirement": {
        "text": "Dijital pazarlamada en az 2 yıl deneyim",
        "type": "experience",
        "concepts": [
          {
            "term": "Dijital pazarlama",
            "synonyms": [
              "digital marketing"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": []
    },
    {
      "method": "keyword",
      "status": "matched",
      "evidence": {
        "kind": "skill",
        "text": "Google Ads"
      },
      "confidence": 0.5,
      "requirement": {
        "text": "Google Ads ve Meta Business Suite kullanımı",
        "type": "skill",
        "concepts": [
          {
            "term": "Google Ads",
            "synonyms": [
              "Google AdWords",
              "AdWords"
            ]
          },
          {
            "term": "Meta Business Suite",
            "synonyms": [
              "Facebook Business Manager",
              "Meta Business Manager"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": [
        "Meta Business Suite"
      ]
    },
    {
      "method": "keyword",
      "status": "matched",
      "evidence": {
        "kind": "bullet",
        "text": "Performance Marketing Specialist · Moda Sepeti: GA4 ve Looker Studio ile haftalık performans panolarını hazırladım."
      },
      "confidence": 0.5,
      "requirement": {
        "text": "Google Analytics 4 ile raporlama",
        "type": "skill",
        "concepts": [
          {
            "term": "Google Analytics 4",
            "synonyms": [
              "GA4",
              "Google Analytics"
            ]
          },
          {
            "term": "raporlama",
            "synonyms": [
              "reporting"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": [
        "raporlama"
      ]
    },
    {
      "method": null,
      "status": "missing",
      "evidence": null,
      "confidence": 0,
      "requirement": {
        "text": "Excel'de pivot tablo ve temel formüller",
        "type": "skill",
        "concepts": [
          {
            "term": "Excel pivot tablo",
            "synonyms": [
              "Excel pivot table"
            ]
          },
          {
            "term": "formüller",
            "synonyms": [
              "formulas"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": [
        "Excel pivot tablo",
        "formüller"
      ]
    },
    {
      "method": null,
      "status": "missing",
      "evidence": null,
      "confidence": 0,
      "requirement": {
        "text": "Analitik düşünme ve raporlama becerisi",
        "type": "soft",
        "concepts": [
          {
            "term": "Analitik düşünme",
            "synonyms": [
              "analytical thinking"
            ]
          },
          {
            "term": "raporlama",
            "synonyms": [
              "reporting"
            ]
          }
        ],
        "importance": "must"
      },
      "missingConcepts": [
        "Analitik düşünme",
        "raporlama"
      ]
    },
    {
      "method": "semantic",
      "status": "matched",
      "evidence": {
        "kind": "skill",
        "text": "Google Ads"
      },
      "confidence": 1,
      "requirement": {
        "text": "Google Ads sertifikası",
        "type": "skill",
        "concepts": [
          {
            "term": "Google Ads sertifikası",
            "synonyms": []
          }
        ],
        "importance": "nice"
      },
      "missingConcepts": []
    },
    {
      "method": null,
      "status": "missing",
      "evidence": null,
      "confidence": 0,
      "requirement": {
        "text": "E-posta pazarlama araçları deneyimi",
        "type": "experience",
        "concepts": [
          {
            "term": "E-posta pazarlama araçları",
            "synonyms": [
              "email marketing tools"
            ]
          }
        ],
        "importance": "nice"
      },
      "missingConcepts": [
        "E-posta pazarlama araçları"
      ]
    }
  ],
  "languageChecks": [],
  "missingKeywords": [
    "Meta Business Suite",
    "raporlama",
    "Excel pivot tablo",
    "formüller",
    "Analitik düşünme",
    "E-posta pazarlama araçları"
  ],
  "scoringRevision": 3
}
