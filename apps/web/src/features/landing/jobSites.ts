/**
 * Ana sayfadaki ilan siteleri şeridi (DOG-83). Logo değil, ad: başka
 * şirketlerin logolarını kullanmak marka izni istiyor (LinkedIn'in kuralları
 * sıkı). Şerit yalnızca "ilan buradan gelebilir" diyor; ortaklık ya da işe
 * giriş ima etmiyor (marka rehberi §11, Polar itirazı). "Bağlantılı değildir"
 * notu 18 Ekim 2026'da kaldırıldı: başlık zaten yalnız ilanın kaynağını söylüyor.
 */
export const JOB_SITES: { name: string }[] = [
  { name: "LinkedIn" },
  { name: "Kariyer.net" },
  { name: "Indeed" },
  { name: "Yenibiris" },
  { name: "Secretcv" },
  { name: "Eleman.net" },
]

export const JOB_SITES_TITLE = "İlanı hangi siteden bulursan bul: metni yapıştır ya da eklentiyle tek tıkla aktar"
