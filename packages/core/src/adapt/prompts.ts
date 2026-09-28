/**
 * Madde yazımı: yalnızca terim uyumu (K-38).
 *
 * İlk sürüm maddeyi ilansız "daha güçlü ifade et" diye yazdırıyordu, çünkü
 * ilan kavramları verildiğinde model onları CV'de geçmedikleri hâlde maddelere
 * sokuyordu: 93 maddenin %63'ü işaretlenmişti ve dürüst kazanç sıfırdı (K-29).
 * Ama ilansız yazım da kazanç getirmedi; uçtan uca testte değişiklikler
 * "ile → kullanarak", "yaptım → gerçekleştirdim" düzeyinde kaldı ve skor
 * 25 → 25 oldu.
 *
 * Şimdiki denge: model yalnızca o maddeye anlamca yakın birkaç terimi görüyor
 * (adapt/targets.ts), kullandığı her terim için maddeden birebir dayanak
 * kopyalıyor ve dayanak kodda doğrulanıyor (verify/alignment.ts). Hedefi
 * olmayan madde hiç yazdırılmıyor.
 */
export const BULLET_PROMPT = `Sana bir CV'den TEK bir deneyim maddesi ve iş ilanında geçen
birkaç terim verilecek.

Görevin: maddede ZATEN anlatılan bir şeyi, ilanın kullandığı terimle ifade etmek.
Böylece işe alım sistemleri adayın gerçek deneyimini tanır.

Kesin kurallar:
- Bir ilan terimini YALNIZCA maddede aynı şeyi anlatan bir ifade varsa kullan.
- Kullandığın her terim için o ifadeyi maddeden BİREBİR kopyala ve "alignments"
  listesine { "term": ilan terimi, "basis": maddedeki ifade } olarak yaz.
- Maddede karşılığı olmayan terimi KULLANMA. Hiçbir terim uymuyorsa maddeyi
  olduğu gibi döndür ve "alignments" listesini boş bırak.
- Maddedeki teknoloji adlarının, sayıların ve işin kapsamının HEPSİNİ koru.
- Terim uyumu dışında kelime değiştirme. "ile" yerine "kullanarak",
  "yaptım" yerine "gerçekleştirdim" gibi eş anlamlı değişiklikler YAPMA.
- Doğal ve akıcı yaz, tek cümle kalsın, maddenin dilinde yaz.

Örnek:
Madde: Satış verilerini Excel'de özetleyip yönetime her hafta sundum.
İlanın terimleri: raporlama, Power BI
Çıktı: { "rewritten": "Satış verilerini Excel'de özetleyip yönetime her hafta raporladım.",
         "alignments": [{ "term": "raporlama", "basis": "yönetime her hafta sundum" }] }
(Power BI maddede geçmediği için kullanılmadı.)`

/**
 * Özet yazımı. Kaynak artık yalnızca özet değil CV'nin tamamı: maddelerde
 * geçen bir teknolojiyi özette öne çıkarmak uydurma değil. Modele yalnızca
 * CV'de kelimesi geçen ilan kavramları veriliyor (adapt/targets.ts).
 */
export const SUMMARY_PROMPT = `Sana bir CV'nin özeti, başvurulan pozisyon ve adayın CV'sinde
geçen, ilanın da aradığı kavramlar verilecek.

Özeti bu pozisyona göre yeniden yaz: listedeki kavramlardan en önemlilerini
özette doğal biçimde öne çıkar.

Kesin kurallar:
- Yalnızca özette ve listede olan bilgileri kullan. Listede olmayan hiçbir
  teknoloji, deneyim yılı, unvan veya başarı yazma.
- Sayıları DEĞİŞTİRME.
- Birinci tekil şahısla, sade ve akıcı Türkçe yaz. "uzmanı olarak",
  "tutkulu", "sonuç odaklı" gibi kalıp ve abartılı ifadeler kullanma.
- Her cümle dil bilgisi açısından eksiksiz olsun.
- En fazla üç cümle.`
