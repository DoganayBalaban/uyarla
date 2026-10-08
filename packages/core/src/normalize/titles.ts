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
  // eval:cover: "Generative AI" yazan CV'nin Türkçe ön yazısı "üretken yapay
  // zekâ" dediğinde uydurma uyarısı alıyordu (DOG-32).
  üretken: "generative",

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

/**
 * Çok kelimeli çapraz dilli karşılıklar: kelime dizisi → tek kanonik kök.
 *
 * `TITLE_SYNONYMS` kelime kelime eşliyor; "yapay zeka" ↔ "AI" gibi iki
 * kelimenin bir kelimeye karşılık geldiği çiftler oraya sığmıyor. Aynı kural
 * geçerli: her ekleme ölçülmüş bir kaçırmayı ya da yanlış uyarıyı kapatmalı.
 */
export const PHRASE_SYNONYMS: Record<string, string> = {
  // eval:cover (8 Ekim 2026): İngilizce CV + Türkçe ilan ön yazılarında en
  // sık iki uydurma uyarısı "yapay zekâ" (19) ve "üretken yapay zekâ" (17);
  // CV'de "AI Engineer" ve "Generative AI" yazıyordu (DOG-32).
  "yapay zeka": "ai",
  "artificial intelligence": "ai",
  // 26 Eylül uçtan uca testi: "authentication" maddesinin sadık çevirisi
  // "kimlik doğrulama" uydurma sayılmıştı (birikmiş işler #11).
  "kimlik doğrulama": "authentication",
}
