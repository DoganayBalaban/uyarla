export const SEGMENT_PROMPT = `Sana bir özgeçmişin (CV) ham metni verilecek.
Metni dört bölüme ayır:
- summaryBlock: kişisel özet, hakkında, profil bölümü
- experienceBlock: iş deneyimi bölümü
- educationBlock: eğitim bölümü
- skillsBlock: beceriler, diller, sertifikalar

Bu bir KESME işidir, bir seçme işi değil. Her bölümün başladığı yerden
bittiği yere kadar olan TÜM satırları, olduğu gibi kopyala.

Özellikle dikkat: bir bölümdeki başlık satırları da o bölüme aittir.
İş deneyiminde kurum adı, unvan ve tarihlerin yazdığı satırlar
("Acme Teknoloji · Yazılım Geliştirici · Ocak 2022 – halen" gibi) bölümün
parçasıdır; yalnızca altlarındaki maddeleri değil, o satırları da kopyala.
Eğitimde okul ve yıl satırları için de aynısı geçerli.

Hiçbir metni değiştirme, özetleme, kısaltma veya yeniden yazma.
Bir bölüm CV'de yoksa o alana boş metin yaz.`

export const EXPERIENCE_PROMPT = `Sana bir CV'nin iş deneyimi bölümü verilecek.
Her iş deneyimi için kurum, unvan, başlangıç ve bitiş tarihini çıkar.
Her deneyimin altındaki maddeleri bullets dizisine koy.

sourceRef alanına, o maddenin ham metindeki BİREBİR kopyasını yaz.
Metni değiştirme, kısaltma veya düzeltme. Bir kelimesini bile değiştirme.

Tarihler metinde nasıl yazıldıysa öyle kalsın ("2022-01", "Ocak 2022", "2022").
Devam eden işler için endDate alanına "halen" yaz.
CV'de olmayan hiçbir bilgi ekleme.`

export const EDUCATION_PROMPT = `Sana bir CV'nin eğitim bölümü verilecek.
Her eğitim kaydı için okul, derece, bölüm ve bitiş yılını çıkar.
Bilgi yoksa null yaz. CV'de olmayan hiçbir bilgi ekleme.`

export const SKILLS_PROMPT = `Sana bir CV'nin beceriler bölümü verilecek.
Becerileri, bilinen dilleri ve sertifikaları ayrı dizilere ayır.
Her beceriyi metinde yazıldığı gibi yaz. CV'de olmayan hiçbir beceri ekleme.`

export const JOB_PROMPT = `Sana bir iş ilanının metni verilecek.
Pozisyon adını, şirketi, kıdem seviyesini ve ilanın dilini belirle.

İlandaki HER gereksinimi ayrı bir madde olarak çıkar:
- text: gereksinimin ilandaki hâli
- type: skill (teknik beceri), experience (deneyim), education (eğitim), soft (kişisel özellik)
- importance: "aranan", "şart", "zorunlu", "olmalı" gibi ifadeler must; "tercihen",
  "artı olur", "avantaj", "nice to have" gibi ifadeler nice

Gereksinimler birden çok başlık altında olabilir ("Aradığımız nitelikler",
"Gereksinimler", "Tercihen", "Artı olur"). Tüm başlıkların altındaki maddeleri
çıkar, hiçbir bölümü atlama.

Şirket adı ilanda yoksa null yaz. Kıdem belirtilmemişse null yaz.
İlanda olmayan hiçbir gereksinim ekleme.`

export const KEYWORDS_PROMPT = `Sana bir iş ilanındaki gereksinimlerin
numaralı listesi verilecek. Her gereksinim için, o gereksinimi bir CV'de
ararken kullanılacak anahtar kelimeleri üret.

Sırayı ve sayıyı koru: kaç gereksinim verildiyse o kadar liste döndür.

Anahtar kelimeler kısa terim olmalı, cümle değil. Eş anlamlılarını ve yaygın
yazım varyantlarını da ekle; Türkçe bir terimin İngilizce karşılığını, İngilizce
bir terimin Türkçe karşılığını da yaz.

Örnek: "En az 3 yıl React deneyimi" -> ["react", "react.js", "reactjs"]
Örnek: "Git ile versiyon kontrolü" -> ["git", "versiyon kontrol", "version control"]
Örnek: "Takım çalışmasına yatkın" -> ["takım çalışması", "teamwork", "collaboration"]`
