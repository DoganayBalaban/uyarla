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

Bölümdeki HER satır için bir kayıt döndür. Hiçbir satırı atlama, sırayı koru.
Bölüm birden çok alt başlık içerebilir ("Core Skills", "Technical Skills",
"Araçlar" gibi); hepsinin altındaki satırları da kaydet.

Her satır "Etiket: içerik" biçimindedir:
- "label" alanına iki nokta üst üsteden ÖNCEKİ kısmı yaz.
- İçerik kısa terimlerin virgüllü listesiyse, terimleri "items" dizisine
  ayrı ayrı yaz.
- İçerik bir cümle veya açıklamaysa "items" dizisini BOŞ bırak.

Örnek: "Programming Languages: Java, SQL"
   ->  { "label": "Programming Languages", "items": ["Java", "SQL"] }
Örnek: "Manual Testing: Performing functional and regression testing"
   ->  { "label": "Manual Testing", "items": [] }

Kategori adı kendi satırında, terimler de bir ALT satırda olabilir:
  Backend
  Python, FastAPI, PostgreSQL
Bu durumda ikisini TEK kayıtta birleştir:
  { "label": "Backend", "items": ["Python", "FastAPI", "PostgreSQL"] }
Kategori adını ayrı bir terim olarak yazma.

Yalnız başına duran bölüm başlıkları için kayıt aç, "items" boş kalsın.
Bilinen dilleri ve sertifikaları ayrı dizilere koy.
CV'de olmayan hiçbir şey ekleme.`

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
