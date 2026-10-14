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
- `pnpm --filter @uyarla/extension build`: `dist/` ve zip, adres `https://uyarla.vercel.app` (`UYARLA_URL=… pnpm build` ile değişir).
- `pnpm --filter @uyarla/extension icons`: simgeleri web'in `icon.svg`'sinden yeniden üretir.

## İzinler (mağaza incelemesi için gerekçeler)

| İzin | Neden |
|---|---|
| `activeTab` | Yalnızca simgeye tıklandığında o sekmenin ilanını okumak. |
| `scripting` | O sekmede ilan metnini almak için tek seferlik betik. |
| `contextMenus` | Seçili metin için "uyarla ile ölç" menüsü. |
| `notifications` | İlan bulunamadığında kullanıcıyı yönlendirmek. |

Sitelere kalıcı erişim (`host_permissions`) yok. Eklenti hiçbir sunucuya
istek atmaz ve veri saklamaz; ilan metni yalnızca kullanıcının açtığı uyarla
sekmesine, adresin `#` kısmında aktarılır.

## Mağaza açıklaması (yayın K2 sonrası)

**Kısa:** Açık ilan sayfasını tek tıkla uyarla'ya gönder; CV'nin bu ilana uyumunu gör.

**Uzun:** Kariyer.net, LinkedIn, yenibiris ya da başka bir sitede bir ilana
bakarken uyarla simgesine tıkla. İlan metni uyarla'ya aktarılır ve CV'nin bu
ilana ne kadar uyduğunu, hangi gereksinimlerin eksik kaldığını görürsün.
Ardından CV'ni bu ilana uyarlayabilirsin; olmayan deneyim eklenmez.

Gizlilik politikası: https://uyarla.vercel.app/privacy
