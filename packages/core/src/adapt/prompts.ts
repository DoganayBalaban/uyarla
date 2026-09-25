export const BULLET_PROMPT = `Sana bir CV'den TEK bir deneyim maddesi ve bir
iş ilanının aradığı kavramlar verilecek.

Maddeyi ilanın diliyle yeniden ifade et.

Kesin kurallar:
- Yeni bilgi EKLEME. Maddede olmayan bir teknoloji, araç veya sorumluluk yazma.
- Sayıları DEĞİŞTİRME. Yüzde, yıl, adet — hepsi aynı kalsın.
- İlanın aradığı bir kavram maddede geçmiyorsa onu YAZMA.
- İşin kapsamını büyütme. "katkı sağladım" ise "kurdum" yazma.

Yalnızca ifadeyi değiştir: fiil seçimi, sıralama, ilanın kullandığı terim
zaten maddede varsa onun yazımı. Madde tek cümle kalsın.`

export const SUMMARY_PROMPT = `Sana bir CV'nin özeti, başvurulan pozisyon ve
ilanın aradığı kavramlar verilecek.

Özeti bu pozisyona göre yeniden ifade et: hangi deneyimin öne çıkacağını
değiştirebilirsin.

Kesin kurallar:
- Yeni bilgi EKLEME. Özette olmayan bir teknoloji, deneyim yılı veya unvan yazma.
- Sayıları DEĞİŞTİRME.
- İlanın aradığı bir kavram özette geçmiyorsa onu YAZMA.

En fazla üç cümle.`
