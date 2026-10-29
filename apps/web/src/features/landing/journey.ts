/**
 * Tanıtım sayfasındaki başvuru yolculuğu (DOG-160, K-108). Adımlarda erişim
 * çipi yok (29 Ekim); ücretsiz/abonelik ayrımını fiyat tablosu veriyor.
 */

export type StepId = "bul" | "uyarla" | "basvur" | "takip" | "hazirlan" | "gorunur"

export type JourneyStep = {
  id: StepId
  number: string
  name: string
  title: string
  text: string
  bullets: string[]
}

export const JOURNEY: JourneyStep[] = [
  {
    id: "bul",
    number: "01",
    name: "Bul",
    title: "Doğru ilanı bul.",
    text: "Hedef rolünle hazır arama kurar; şehri ve becerilerini tek tıkla eklersin. Kariyer.net, LinkedIn, Jooble ve Careerjet'i doğru sorguyla açar.",
    bullets: ["Becerilerin öneri olarak gelir, istediğini eklersin", "Her sitenin kendi kuralına göre bağlantı", "İlanları biz toplamayız; site kendi sayfasında açılır"],
  },
  {
    id: "uyarla",
    number: "02",
    name: "Uyarla",
    title: "CV'ni o ilana göre uyarla.",
    text: "İlanı gereksinimlerine ayırır, kanıtını CV'nde arar ve maddelerini ilanın diliyle yeniden yazar.",
    bullets: [],
  },
  {
    id: "basvur",
    number: "03",
    name: "Başvur",
    title: "Ön yazı ve form yanıtları hazır.",
    text: "“Kendini tanıt”, “140 karakterde neden sen” gibi form sorularını gönderdiğin CV'den yanıtlar. Karakter sınırını kod denetler.",
    bullets: ["Sınırı aşan cevap kısaltılır", "Her cümle CV'ne dayanır", "Biz göndermeyiz; kopyalayıp sen yapıştırırsın"],
  },
  {
    id: "takip",
    number: "04",
    name: "Takip et",
    title: "Başvurularını tek panoda takip et.",
    text: "Her analiz bir kart. Zorunlu bir gereksinim CV'nde görünmüyorsa başvurmadan önce uyarır; başvurduktan sonra takip mesajı, mülakattan sonra teşekkür notu taslağı hazırlar.",
    bullets: ["Kaydedildi, Başvuruldu, Mülakat, Teklif", "Eksik zorunlu gereksinimde “önce uyarla” hatırlatması", "Alıcının adı uydurulmaz, [ad] olarak kalır"],
  },
  {
    id: "hazirlan",
    number: "05",
    name: "Hazırlan",
    title: "Mülakata kendi CV'nle hazırlan.",
    text: "Sorular ilandan, cevapların kanıtı CV'nden gelir. Yazılı pratikte cevabını STAR yapısına göre değerlendirir; CV'nde olmayan iddiayı işaretler.",
    bullets: ["Her soru CV'deki kanıtıyla", "STAR: durum, görev, eylem, sonuç", "Kâğıtta olmayan iddia odada da yok"],
  },
  {
    id: "gorunur",
    number: "06",
    name: "Görünür ol",
    title: "LinkedIn profilin de hazır.",
    text: "Profilini hedef rolüne göre denetler; başlık, hakkında ve deneyim için profilindeki bilgilere dayanan öneriler yazar.",
    bullets: ["Bölüm bölüm: Başlık, Hakkında, Deneyim, Beceriler", "Her öneri profilindeki bir satıra dayanır", "Chrome eklentisiyle profilini tek tıkla aktar"],
  },
]
