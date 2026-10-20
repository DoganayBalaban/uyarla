/**
 * Örnek ilanlar (DOG-101): elinde ilan olmayan ziyaretçi ilk analizi
 * bunlardan biriyle deneyebiliyor. Kurgusal; gerçek bir şirkete ait değil,
 * başlıkta "örnek ilan" yazıyor ki panoda gerçek başvuruyla karışmasın.
 *
 * Huni raporu düzenlenmeden gönderilen örnekleri metinden tanıyor
 * (`isSamplePosting`); ayrı bir alan ya da göç yok.
 */
export interface SamplePosting {
  id: string
  label: string
  text: string
}

export const SAMPLE_POSTINGS: SamplePosting[] = [
  {
    id: "frontend",
    label: "Frontend geliştirici",
    text: `Frontend Geliştirici (örnek ilan)

İstanbul · Hibrit · Tam zamanlı

E-ticaret platformumuzun müşteri tarafını geliştirecek bir ekip arkadaşı arıyoruz. Ürün ve tasarım ekipleriyle birlikte çalışarak yeni özellikleri uçtan uca hayata geçireceksin.

Sorumluluklar
• React ve TypeScript ile yeni sayfalar ve bileşenler geliştirmek
• REST API'lerle entegrasyon yapmak
• Sayfa performansını ölçmek ve iyileştirmek
• Kod incelemelerine katılmak, birim testleri yazmak

Aranan nitelikler
• Bilgisayar mühendisliği ya da ilgili bölümlerden lisans mezunu
• React ile en az 3 yıl deneyim
• TypeScript, HTML ve CSS bilgisi
• Git ile ekip içinde çalışma deneyimi
• Jest ya da benzeri bir test aracıyla birim testi yazmış olmak
• İyi derecede İngilizce

Tercih sebebi
• Next.js deneyimi
• Erişilebilirlik (WCAG) bilgisi`,
  },
  {
    id: "marketing",
    label: "Dijital pazarlama uzmanı",
    text: `Dijital Pazarlama Uzmanı (örnek ilan)

Ankara · Ofisten · Tam zamanlı

Tüketici ürünleri markamızın dijital kanallardaki büyümesinden sorumlu olacak bir uzman arıyoruz.

Sorumluluklar
• Google Ads ve Meta reklam kampanyalarını planlamak, yürütmek ve bütçesini yönetmek
• Kampanya sonuçlarını Google Analytics ile raporlamak
• Sosyal medya içerik takvimini hazırlamak
• SEO çalışmalarını ajansla birlikte takip etmek
• A/B testleriyle açılış sayfalarını iyileştirmek

Aranan nitelikler
• İşletme, iletişim ya da ilgili bölümlerden lisans mezunu
• Dijital pazarlamada en az 2 yıl deneyim
• Google Ads ve Meta Business Suite kullanımı
• Google Analytics 4 ile raporlama
• Excel'de pivot tablo ve temel formüller
• Analitik düşünme ve raporlama becerisi

Tercih sebebi
• Google Ads sertifikası
• E-posta pazarlama araçları deneyimi`,
  },
  {
    id: "accounting",
    label: "Muhasebe uzmanı",
    text: `Muhasebe Uzmanı (örnek ilan)

İzmir · Ofisten · Tam zamanlı

Üretim şirketimizin finans ekibinde genel muhasebe süreçlerini yürütecek bir uzman arıyoruz.

Sorumluluklar
• Günlük muhasebe kayıtlarını tutmak
• Banka ve cari hesap mutabakatlarını yapmak
• KDV, muhtasar ve SGK beyannamelerini hazırlamak
• Ay sonu kapanış işlemlerine destek olmak
• Bağımsız denetim süreçlerinde belge hazırlamak

Aranan nitelikler
• İktisat, işletme ya da muhasebe bölümlerinden lisans mezunu
• Genel muhasebede en az 3 yıl deneyim
• Türk vergi mevzuatı bilgisi
• Logo ya da Mikro muhasebe programı kullanımı
• İleri düzey Excel
• Dikkatli ve düzenli çalışma

Tercih sebebi
• SMMM stajını tamamlamış olmak
• SAP deneyimi`,
  },
]

const normalize = (text: string) => text.replace(/\s+/g, " ").trim()
const SAMPLE_TEXTS = new Set(SAMPLE_POSTINGS.map((s) => normalize(s.text)))

/** Metin düzenlenmeden gönderilmiş bir örnek ilan mı (huni sayımı için). */
export function isSamplePosting(text: string): boolean {
  return SAMPLE_TEXTS.has(normalize(text))
}
