import type { LinkedInProfileData } from "./profileData.js"

/** Testlerin ortak kurgusal profili (eval cv-d-pazarlama); gerçek kişi değil. */
export const deniz = (over: Partial<LinkedInProfileData> = {}): LinkedInProfileData => ({
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık performans pazarlaması deneyimim var.",
  experience: [
    {
      title: "Performance Marketing Specialist",
      company: "Moda Sepeti",
      dateRange: "Mar 2023 - Present · 2 yrs 8 mos",
      location: "İstanbul, Türkiye",
      description: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panoları hazırladım.",
    },
  ],
  education: [{ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: null }],
  certifications: [{ name: "Google Ads Search Certification", issuer: "Google", date: "Oca 2024" }],
  skills: ["Google Ads", "Looker Studio"],
  languages: ["İngilizce"],
  truncated: {},
  ...over,
})
