/**
 * Unvan ve teknoloji eş anlamlıları: varyant → kanonik biçim.
 *
 * Anahtarlar ve değerler normalizeText'ten geçmiş hâlde yazılır (küçük harf,
 * noktalama boşluğa dönmüş).
 *
 * Sözlük yalnızca **ek soymanın ulaşamayacağı** eşleşmeleri içerir: çapraz
 * dilli karşılıklar (developer ↔ geliştirici) ve yazım varyantları
 * (reactjs ↔ react). Ek soymayla zaten aynı köke inen kelimeler buraya
 * yazılmaz — iki mekanizmanın çakışması tutarsızlık üretir.
 *
 * Başlangıç hâlidir ve tahminle şişirilmez: her ekleme, değerlendirme
 * setinde (Görev 13) görülmüş gerçek bir kaçırmayı kapatmalı. Gereksiz
 * genişletmek yanlış pozitif riskini artırır.
 */
export const TITLE_SYNONYMS: Record<string, string> = {
  // --- Roller (çapraz dilli köprü) ---
  önyüz: "frontend",
  onyuz: "frontend",
  arayüz: "frontend",
  arkayüz: "backend",
  geliştirici: "gelistirici",
  developer: "gelistirici",
  mühendis: "muhendis",
  engineer: "muhendis",

  // --- Teknoloji yazım varyantları ---
  // "next.js" gibi noktalı yazımlar normalizeText'te "next js" olur;
  // burada yalnızca bitişik tek kelime varyantları eşlenir.
  reactjs: "react",
  nextjs: "next",
  nodejs: "node",
  vuejs: "vue",
  js: "javascript",
  ts: "typescript",
  postgres: "postgresql",
  k8s: "kubernetes",
}
