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

  // --- Bölüm ve alan adları (çapraz dilli köprü) ---
  // Değerlendirme setindeki dört kaçırmanın üçü buradan geliyordu: ilan
  // "Yazılım Mühendisliği" derken CV "B.Sc. Software Engineering" yazıyor ve
  // iki taraf buluşamıyordu. Ek soyma bu köprüyü kuramaz; sözlük gerekiyor.
  yazılım: "yazilim",
  yazılımı: "yazilim",
  software: "yazilim",
  bilgisayar: "bilgisayar",
  computer: "bilgisayar",
  mühendislik: "muhendis",
  mühendisliği: "muhendis",
  mühendisi: "muhendis",
  engineering: "muhendis",
  bilim: "bilim",
  bilimleri: "bilim",
  bilimi: "bilim",
  science: "bilim",
  sciences: "bilim",
  veri: "veri",
  data: "veri",
  makine: "makine",
  machine: "makine",
  öğrenmesi: "ogrenme",
  öğrenme: "ogrenme",
  learning: "ogrenme",
  ajan: "agent",
  ajanı: "agent",
  agent: "agent",
  agents: "agent",
  agentic: "agent",
  mimarisi: "mimari",
  mimarileri: "mimari",
  architecture: "mimari",
  architectures: "mimari",

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
