# uyarla tarayıcı eklentisi

Açık ilan sayfasını tek tıkla uyarla'ya gönderir (DOG-70). Kayıtlı ve
kütüphanesinde varsayılan CV'si olan kullanıcıda analiz kendiliğinden başlar.

0.4.0 (DOG-169):
- **Sayfa düğmesi:** İş sitelerinde (LinkedIn, Kariyer.net, Yenibiris, Secretcv,
  Eleman.net, Indeed TR, Greenhouse, Lever, Workday) ilan açıkken sitenin
  başvuru düğmesinin yanında "CV'mi bu ilana uyarla" çıkar. Kendi LinkedIn
  profilinde ise "Profilimi uyarla ile denetle" çıkar.
- **Yedek yerleşim:** Başvuru düğmesi bulunamazsa düğme sağ altta yüzer.
- **Simge menüsü:** Simge bir menü açar:
  - sayfadaki ilan ya da profil için ana eylem;
  - uyarla kısayolları;
  - "İlan sayfalarında düğme göster" ayarı.

Tasarım: `docs/superpowers/specs/2026-10-30-eklenti-sayfa-dugmesi-design.md`.

## Kurulum (K2 katılımcıları)

1. `uyarla-eklenti-<sürüm>.zip` dosyasını bir klasöre aç.
2. Chrome'da `chrome://extensions` adresine git, sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle**ye bas ve açtığın klasörü seç.
4. Araç çubuğundaki yapboz simgesinden uyarla'yı sabitle.

Kullanım:
- İş sitelerinde ilanın yanındaki "CV'mi bu ilana uyarla" düğmesine bas.
- Başka sitelerde uyarla simgesine tıkla ve menüden "CV'mi bu ilana uyarla"yı seç.
- İlan bulunamazsa ilan metnini seç, sağ tıkla → "Seçili metni uyarla ile ölç".

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
| `activeTab` | Simge menüsü açıldığında ve sağ tık menüsünde yalnızca o sekmenin ilanını okumak. |
| `scripting` | O sekmede ilan metnini almak için tek seferlik betik (menü ve sağ tık). |
| `contextMenus` | Seçili metin için "uyarla ile ölç" menüsü. |
| `notifications` | İlan ya da profil okunamadığında kullanıcıyı yönlendirmek. |
| `storage` | Açtığı uyarla sekmesini doğrulayan tek kullanımlık jetonu oturum boyunca tutmak (`chrome.storage.session`, diske yazılmaz) ve "düğme göster" ayarı (`chrome.storage.local`). |
| İş sitelerinde sayfa betiği (`content_scripts`) | Yalnızca listedeki iş sitelerinde, açık sayfanın ilan (ya da kişinin kendi LinkedIn profili) olup olmadığına bakıp düğmeyi göstermek. Kullanıcı basmadan hiçbir şey göndermez; sayfa içeriği hiçbir yere kaydedilmez. |

Bunlar dışındaki sitelere kalıcı erişim yok. Eklenti hiçbir sunucuya istek
atmaz ve kullanıcı verisi saklamaz (yalnızca kısa ömürlü doğrulama jetonu ve
düğme ayarı). İlan metni yalnızca kullanıcının açtığı uyarla sekmesine,
adresin `#` kısmında aktarılır. Site listesi `src/sites.ts`; manifest'le
aynı olduğunu bir test denetliyor.

## Mağaza açıklaması (yayın K2 sonrası)

**Kısa:** Açık ilan sayfasını tek tıkla uyarla'ya gönder; CV'nin bu ilana uyumunu gör.

**Uzun:** LinkedIn, Kariyer.net ve diğer iş sitelerinde ilan açıkken başvuru
düğmesinin yanında "CV'mi bu ilana uyarla" düğmesi çıkar. Başka bir sitedeysen
araç çubuğundaki uyarla simgesinden aynısını yaparsın. İlan metni uyarla'ya
aktarılır ve CV'nin bu ilana ne kadar uyduğunu, hangi gereksinimlerin eksik
kaldığını görürsün. Kendi LinkedIn profilini de tek tıkla denetime
gönderebilirsin. Sen basmadan hiçbir şey gönderilmez.
Ardından CV'ni bu ilana uyarlayabilirsin; olmayan deneyim eklenmez.

Gizlilik politikası: https://uyarla.com.tr/privacy
