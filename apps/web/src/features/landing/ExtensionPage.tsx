import Link from "next/link"
import { Icon } from "@/features/landing/components/Icon"
import { ExtensionDemo } from "@/features/landing/demos/ExtensionDemo"
import { EXTENSION_MENU_TITLE, EXTENSION_PAGE_BUTTON, EXTENSION_PROFILE_BUTTON, storeHref } from "@/features/landing/extension"
import s from "@/features/landing/landing.module.css"

/**
 * Chrome eklentisinin sayfası (DOG-163). Metinler eklentinin gerçek
 * davranışından (0.4.0, DOG-169): iş sitelerinde ilanın yanında düğme,
 * simgede menü, ilan metni bağlantının # kısmında, tek kullanımlık jeton,
 * yalnızca kendi profil.
 */

const WAYS = [
  {
    icon: "board" as const,
    title: "İlanın yanındaki düğmeye bas",
    text: `LinkedIn, Kariyer.net ve diğer iş sitelerinde ilan açıkken başvuru düğmesinin yanında “${EXTENSION_PAGE_BUTTON}” çıkar. Bas; ilan metni ve bağlantısı uyarla'da dolu açılır, kayıtlıysan ve varsayılan CV'n seçiliyse analiz kendiliğinden başlar.`,
  },
  {
    icon: "pen" as const,
    title: "Başka bir sitede simgeyi aç",
    text: `Araç çubuğundaki uyarla simgesi bir menü açar: sayfadaki ilanı bulursa adını gösterir, tek tıkla gönderir. Bulamazsa ilan metnini seç, sağ tıkla ve “${EXTENSION_MENU_TITLE}” de.`,
  },
  {
    icon: "eye" as const,
    title: "LinkedIn profilini denetlet",
    text: `Kendi LinkedIn profil sayfanda “${EXTENSION_PROFILE_BUTTON}” düğmesine bas; profilin uyarla'nın LinkedIn denetimine gider. PDF indirmene gerek kalmaz.`,
  },
]

const PRIVACY = [
  "Düğme yalnızca görünür; ilan ya da profil ancak sen bastığında gönderilir.",
  "İş sitelerinde (LinkedIn, Kariyer.net ve diğerleri) düğmeyi göstermek için açık sayfanın ilan olup olmadığına bakar; başka sitelerde yalnızca simgeye bastığında o sekmeyi okur.",
  "İlan metni uyarla'ya bağlantının # kısmında gelir; analiz başlayana kadar sunucumuza gitmez.",
  "Analizi kendiliğinden başlatan tek kullanımlık bir jeton var: bağlantıyı yenilersen ya da başkasına gönderirsen analiz kendiliğinden başlamaz.",
  "Yalnızca kendi LinkedIn profilini gönderir; başkasının profilini okumaz.",
]

const STEPS = [
  "“Chrome'a ekle”ye bas ve Chrome Web Mağazası'nda onayla.",
  "Araç çubuğundaki yapboz simgesinden uyarla'yı sabitle.",
  `Bir ilan sayfasını aç; başvuru düğmesinin yanındaki “${EXTENSION_PAGE_BUTTON}”e bas.`,
]

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className={s.tickList}>
      {items.map((m) => (
        <li key={m}>
          <span className={s.tick}>
            <Icon name="check" size={14} />
          </span>
          {m}
        </li>
      ))}
    </ul>
  )
}

export function ExtensionPage() {
  return (
    <div className={s.page}>
      <main>
        <section className={s.section}>
          <div className={s.container}>
            <div className={`${s.feature} ${s.journeyFeature}`}>
              <div className={s.featureText}>
                <span className={s.sectionLabel}>Chrome eklentisi</span>
                <h1 className={s.h2}>İlanı bulduğun yerde ölç.</h1>
                <p className={s.sectionLead}>
                  İlan sayfasından tek tıkla uyarla&apos;ya gönder: metin dolu gelir, skorun hesaplanır. Kopyala yapıştır yok.
                </p>
                <ul className={s.accessChips} aria-label="Erişim">
                  <li className={s.accessChip}>Ücretsiz</li>
                  <li className={s.accessChip}>Kayıt gerekmez</li>
                </ul>
                <div className={s.extensionActions}>
                  <a href={storeHref()} className={s.buttonPrimary}>
                    Chrome&apos;a ekle
                  </a>
                  <Link href="/analyze" className={s.buttonSecondary}>
                    Eklentisiz dene
                  </Link>
                </div>
              </div>
              <div className={s.featureVisual}>
                <ExtensionDemo />
              </div>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.sectionTinted}`}>
          <div className={s.container}>
            <div className={s.sectionHeader}>
              <span className={s.sectionLabel}>Nasıl çalışır</span>
              <h2 className={s.h2}>Üç yolla çalışır.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {WAYS.map((w) => (
                <div key={w.title} className="rounded-xl border bg-card p-5 shadow-xs">
                  <span className={s.principleIcon}>
                    <Icon name={w.icon} size={20} />
                  </span>
                  <h3 className="mt-3 mb-1 text-lg font-semibold">{w.title}</h3>
                  <p className="m-0 text-sm text-muted-foreground">{w.text}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
              Kariyer.net, LinkedIn ve Yenibiriş ilan sayfaları için ayrı kuralları var. Diğer sitelerde ilanın yapılandırılmış
              verisini ya da sayfanın ana metnini okur; bulamazsa seçili metin yolunu söyler.
            </p>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.container}>
            <div className={s.feature}>
              <div className={s.featureText}>
                <span className={s.sectionLabel}>Gizlilik</span>
                <h2 className={s.h2}>Sen basmadan hiçbir şey göndermez.</h2>
                <Ticks items={PRIVACY} />
              </div>
              <div className={s.featureText}>
                <span className={s.sectionLabel}>Kurulum</span>
                <h2 className={s.h2}>Bir dakikada hazır.</h2>
                <ol className="m-0 mt-4 list-decimal space-y-2 pl-5">
                  {STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className={s.extensionActions}>
                  <a href={storeHref()} className={s.buttonPrimary}>
                    Chrome&apos;a ekle
                  </a>
                  <Link href="/" className={s.buttonSecondary}>
                    uyarla&apos;yı tanı
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
