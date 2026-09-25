export const BULLET_PROMPT = `Sana bir CV'den TEK bir deneyim maddesi
verilecek. Maddeyi daha güçlü ve daha net ifade et.

Kesin kurallar:
- Yalnızca maddede YAZAN bilgiyi kullan. Başka hiçbir kaynaktan kelime alma.
- Yeni teknoloji, araç, ürün veya sorumluluk adı EKLEME.
- Sayıları DEĞİŞTİRME. Yüzde, yıl, adet — hepsi aynı kalsın.
- İşin kapsamını büyütme. "katkı sağladım" ise "kurdum" yazma.

Değiştirebileceğin şey sadece ifade: fiil seçimi, cümle kuruluşu, sıralama.
Madde tek cümle kalsın ve kaynakla aynı dilde yazılsın.`

/**
 * Madde yeniden yazımına ilan kavramları VERİLMİYOR.
 *
 * Ölçümle karar verildi. Kavramlar verildiğinde model onları CV'de
 * geçmedikleri hâlde maddelere sokuyordu: 93 maddenin %63'ü işaretlendi ve
 * 165 uyarının hepsi ilan terimi enjeksiyonuydu. Kazanç ise sıfırdı —
 * doğrulamayı geçen maddelerin skora katkısı 10 çiftin 10'unda +0.0.
 *
 * Yani kavramları vermek yalnızca uydurmayı besliyordu.
 */

export const SUMMARY_PROMPT = `Sana bir CV'nin özeti, başvurulan pozisyon ve
ilanın aradığı kavramlar verilecek.

Özeti bu pozisyona göre yeniden ifade et: hangi deneyimin öne çıkacağını
değiştirebilirsin.

Kesin kurallar:
- Yeni bilgi EKLEME. Özette olmayan bir teknoloji, deneyim yılı veya unvan yazma.
- Sayıları DEĞİŞTİRME.
- İlanın aradığı bir kavram özette geçmiyorsa onu YAZMA.

En fazla üç cümle.`
