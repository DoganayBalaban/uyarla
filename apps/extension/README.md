# uyarla tarayıcı eklentisi

Açık ilan sayfasını tek tıkla uyarla'ya gönderir (DOG-70). Kayıtlı ve
kütüphanesinde varsayılan CV'si olan kullanıcıda analiz kendiliğinden başlar.

## Kurulum (K2 katılımcıları)

1. `uyarla-eklenti-<sürüm>.zip` dosyasını bir klasöre aç.
2. Chrome'da `chrome://extensions` adresine git, sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle**ye bas ve açtığın klasörü seç.
4. Araç çubuğundaki yapboz simgesinden uyarla'yı sabitle.

Kullanım: bir ilan sayfasındayken uyarla simgesine tıkla. İlan bulunamazsa
ilan metnini seç, sağ tıkla → "Seçili metni uyarla ile ölç".

## Geliştirme

- `pnpm --filter @uyarla/extension dev`: `dist/` izlenir, uyarla adresi `http://localhost:3000`.
- `pnpm --filter @uyarla/extension build`: `dist/` ve zip, adres `https://uyarla.com.tr` (`UYARLA_URL=… pnpm build` ile değişir).
- `pnpm --filter @uyarla/extension icons`: simgeleri web'in `icon.svg`'sinden yeniden üretir.
- `pnpm --filter @uyarla/extension id`: eklenti kimliği (manifest'teki açık anahtardan).

## Sayfa ↔ eklenti doğrulaması (DOG-71)

uyarla'yı `#ilan=…` adresiyle her site açabilir. Kayıtlı kullanıcıda analizin
kendiliğinden başlaması için bağlantıyı eklentinin açtığı doğrulanıyor:

1. Eklenti uyarla'yı açarken tek kullanımlık bir jeton üretip
   `chrome.storage.session`'a yazıyor (10 dk), adrese `&jeton=…` ekliyor.
2. Sayfa göndermeden önce `chrome.runtime.sendMessage(kimlik, { type: "uyarla-jeton", token })`
   ile soruyor. Yalnızca `externally_connectable` adresleri (uyarla.com.tr,
   localhost:3000) sorabiliyor.
3. Eklenti jetonu bir kez doğrulayıp siliyor. Doğrulanamazsa form dolu
   bekliyor, analiz başlamıyor.

**Kimlik:** manifest'teki `key` açık anahtar; paketlenmemiş eklenti her
makinede aynı kimliği alıyor (`lggfjpmepigbmdfigppmfpppkhfahbka`). Özel anahtar
saklanmıyor: `.crx` paketlemiyoruz, mağaza kendi imzalıyor. Web,
`NEXT_PUBLIC_EXTENSION_IDS` ile bu kimliği tanıyor. **Mağaza yayınında** mağaza
yeni bir kimlik veriyor (yüklemede `key` alanı kaldırılmalı); o kimlik
`NEXT_PUBLIC_EXTENSION_IDS`'e virgülle eklenmeli.

## İzinler (mağaza incelemesi için gerekçeler)

| İzin | Neden |
|---|---|
| `activeTab` | Yalnızca simgeye tıklandığında o sekmenin ilanını okumak. |
| `scripting` | O sekmede ilan metnini almak için tek seferlik betik. |
| `contextMenus` | Seçili metin için "uyarla ile ölç" menüsü. |
| `notifications` | İlan bulunamadığında kullanıcıyı yönlendirmek. |
| `storage` | Açtığı uyarla sekmesini doğrulayan tek kullanımlık jetonu oturum boyunca tutmak (`chrome.storage.session`, diske yazılmaz). |

Sitelere kalıcı erişim (`host_permissions`) yok. Eklenti hiçbir sunucuya
istek atmaz ve kullanıcı verisi saklamaz (yalnızca kısa ömürlü doğrulama jetonu); ilan metni yalnızca kullanıcının açtığı uyarla
sekmesine, adresin `#` kısmında aktarılır.

## Mağaza açıklaması (yayın K2 sonrası)

**Kısa:** Açık ilan sayfasını tek tıkla uyarla'ya gönder; CV'nin bu ilana uyumunu gör.

**Uzun:** Kariyer.net, LinkedIn, yenibiris ya da başka bir sitede bir ilana
bakarken uyarla simgesine tıkla. İlan metni uyarla'ya aktarılır ve CV'nin bu
ilana ne kadar uyduğunu, hangi gereksinimlerin eksik kaldığını görürsün.
Ardından CV'ni bu ilana uyarlayabilirsin; olmayan deneyim eklenmez.

Gizlilik politikası: https://uyarla.com.tr/privacy
