import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { UyarlaLogo } from "@/components/brand/UyarlaMark"
import { Photo } from "@/features/landing/components/Photo"
import { Icon, type IconName } from "@/features/landing/components/Icon"
import { FileChips } from "@/features/landing/components/Mockups"
import { HeroDemo } from "@/features/landing/demos/HeroDemo"
import { RequirementDemo } from "@/features/landing/demos/RequirementDemo"
import { AdaptDemo } from "@/features/landing/demos/AdaptDemo"
import { CheckDemo } from "@/features/landing/demos/CheckDemo"
import { LANDING_FAQ } from "@/features/landing/faq"
import { Pricing } from "@/features/landing/components/Pricing"
import { JobSitesStrip } from "@/features/landing/components/JobSitesStrip"
import type { PlanOffer } from "@/features/billing/plans"
import { JOURNEY, accessChips, type StepId } from "@/features/landing/journey"
import { JourneyRail } from "@/features/landing/components/JourneyRail"
import s from "@/features/landing/landing.module.css"

/**
 * Tanıtım sayfası.
 *
 * Metinler marka rehberi §6–§7 ve §10.1'den. §11 bağlayıcı: garanti yok,
 * kanıtsız sayı yok, uydurma kullanıcı yorumu yok. Bu yüzden rakiplerde
 * gördüğümüz "şu şirketlerde işe girdiler" logo şeridi ve yorum bölümü
 * gerçek veri gelene kadar konmadı. Henüz yapılmamış özellikler "Yakında"
 * rozetiyle gösteriliyor.
 */

const FEATURES: {
  label: string
  title: string
  text: string
  bullets: string[]
  visual: React.ReactNode
}[] = [
  {
    label: "ATS uyum skoru",
    title: "CV'nin ilana ne kadar uyduğunu gör.",
    text:
      "Uyarla ilanı gereksinimlerine ayırır ve her birini CV'nde arar. Eşleşen her gereksinimin yanında kanıtı durur, eksik olanlar açıkça listelenir.",
    bullets: [
      "Zorunlu ve tercih edilen gereksinimler ayrı",
      "Eş anlamlıları ve Türkçe–İngilizce karşılıkları tanır",
      "“CV'ni geliştir” yerine “şu 4 kelime eksik”",
    ],
    visual: <RequirementDemo />,
  },
  {
    label: "Uyarlama",
    title: "Aynı deneyim, ilanın diliyle.",
    text:
      "Özetini, deneyim maddelerini ve beceri sıralamanı ilana göre yeniden yazar. Her değişikliği önce/sonra hâliyle görürsün.",
    bullets: [
      "Eklenen yeşil, çıkarılan üstü çizili",
      "Her maddenin kaynağı gösterilir",
      "Beğenmediğini eski hâline döndür",
    ],
    visual: <AdaptDemo />,
  },
  {
    label: "Uydurma kontrolü",
    title: "Olmayan bir deneyimi asla eklemez.",
    text:
      "Yeniden yazılan her madde üç kontrolden geçer. Anlamı kayan, yeni olgu ekleyen ya da ilandan kelime taşıyan madde işaretlenir ve kararı sana bırakılır.",
    bullets: [
      "İşaretli maddede gerekçe yazılı",
      "Son kararı sen verirsin",
      "Karar vermeden indirme açılmaz",
    ],
    visual: <CheckDemo />,
  },
]

const PERSONAS = [
  {
    id: "photo-persona-1",
    alt: "Kampüs kafesinde dizüstüyle çalışan yeni mezun",
    who: "Yeni mezun",
    quote: "Deneyimin az değil, doğru anlatılmamış.",
    photo: "Kampüste ya da kafede dizüstüyle çalışan yeni mezun, doğal ışık",
  },
  {
    id: "photo-persona-2",
    alt: "Evde mutfak masasında dizüstünün yanında not alan bir kadın",
    who: "Kariyer değiştiren",
    quote: "Eski işindeki becerileri yeni alanın diliyle anlat.",
    photo: "Evden çalışan, not alan 30'lu yaşlarda biri, sıcak tonlar",
  },
  {
    id: "photo-persona-3",
    alt: "Ortak çalışma alanında dizüstünde belge inceleyen deneyimli bir profesyonel",
    who: "Deneyimli profesyonel",
    quote: "Az ama isabetli başvuru. Her biri ilana özel.",
    photo: "Ofiste ya da ortak çalışma alanında deneyimli profesyonel, takım elbisesiz",
  },
  {
    id: "photo-persona-4",
    alt: "Pencere önünde dizüstünden görüntülü görüşme yapan genç bir profesyonel",
    who: "Yurt dışına başvuran",
    quote: "Türkçe CV'nden ilana özel İngilizce CV.",
    photo: "Pencere önünde video görüşmesi yapan genç profesyonel",
    comingSoon: true,
  },
]


/** Her adımın sahnesi; sahnesi gelmemiş adım yalnızca metinle (PR 2–4 dolduruyor). */
const STEP_VISUAL: Partial<Record<StepId, React.ReactNode>> = {}

function AccessChips({ step }: { step: (typeof JOURNEY)[number] }) {
  return (
    <ul className={s.accessChips} aria-label="Erişim">
      {accessChips(step).map((c) => (
        <li key={c.short} className={`${s.accessChip} ${c.paid ? s.accessChipPaid : ""}`}>
          {c.short} · {c.access}
        </li>
      ))}
    </ul>
  )
}

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

export function LandingPage({ plans = [] }: { plans?: PlanOffer[] }) {
  return (
    <div className={s.page}>
      <main>
        {/* ——— Hero ——— */}
        <section className={s.hero}>
          <div className={`${s.container} ${s.heroText}`}>
            <Link href="/login" className={s.heroBadge}>
              <span className={s.heroBadgeTag}>Yeni</span>
              CV kütüphanesi<span className={s.heroBadgeMore}>: CV&apos;ni bir kez yükle, her ilanda seç</span>
              <ArrowRight size={14} aria-hidden />
            </Link>
            <h1 className={s.heroTitle}>Her ilana, doğru CV.</h1>
            <p className={s.heroLead}>
              İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve tek tıkla ilana özel hâle getir.
              Deneyimini uydurmadan.
            </p>
            <div className={s.heroActions}>
              <Link href="/analyze" className={`${s.buttonPrimary} ${s.buttonLarge}`}>
                Ücretsiz skorumu gör
              </Link>
              <a href="#yolculuk" className={`${s.buttonSecondary} ${s.buttonLarge}`}>
                Nasıl çalışır?
              </a>
            </div>
            <ul className={s.trust}>
              <li>
                <Icon name="check" size={16} /> Kayıt gerekmez
              </li>
              <li>
                <Icon name="check" size={16} /> CV'n satılmaz, eğitimde kullanılmaz
              </li>
              <li>
                <Icon name="check" size={16} /> Her değişikliği sen onaylarsın
              </li>
            </ul>
          </div>

          {/* Ürünün kendisi, oynarken: yükle → yapıştır → skor → uyarla döngüsü.
              Video dosyası değil, ürün ekranlarının Motion'la oynayan kopyası. */}
          <div className={`${s.container} ${s.heroShot}`}>
            <div className={s.heroGlow} aria-hidden="true" />
            <HeroDemo />
          </div>
        </section>

        {/* ——— İlan siteleri (DOG-83) ——— */}
        <JobSitesStrip />

        {/* ——— Sorun ——— */}
        <section className={s.problem}>
          <div className={s.container}>
            <p className={s.problemText}>
              Aynı CV ile onlarca ilana başvurup dönüş alamıyorsan sorun çoğu zaman deneyiminde
              değil, <strong>anlatımında.</strong> Her ilan farklı bir CV ister.
            </p>
          </div>
        </section>

        {/* ——— Başvuru yolculuğu (DOG-160) ——— */}
        <JourneyRail steps={JOURNEY} />
        {JOURNEY.map((step, i) => (
          <section key={step.id} id={step.id} className={`${s.section} ${s.journeySection} ${i % 2 === 1 ? s.sectionTinted : ""}`}>
            <div className={s.container}>
              {step.id === "uyarla" ? (
                <>
                  <div className={s.sectionHeader}>
                    <span className={s.sectionLabel}>
                      {step.number} · {step.name}
                    </span>
                    <h2 className={s.h2}>{step.title}</h2>
                    <p className={s.sectionLead}>{step.text}</p>
                    <AccessChips step={step} />
                  </div>
                  {FEATURES.map((o, j) => (
                    <div key={o.label} className={`${s.feature} ${j % 2 === 1 ? s.featureReversed : ""}`}>
                      <div className={s.featureText}>
                        <span className={s.sectionLabel}>{o.label}</span>
                        <h3 className={s.h2}>{o.title}</h3>
                        <p className={s.sectionLead}>{o.text}</p>
                        <Ticks items={o.bullets} />
                      </div>
                      <div className={s.featureVisual}>{o.visual}</div>
                    </div>
                  ))}
                  <div className={`${s.feature} ${s.featureReversed}`}>
                    <div className={s.featureText}>
                      <span className={s.sectionLabel}>Çıktı</span>
                      <h3 className={s.h2}>Başvurmaya hazır, ATS'nin okuyabildiği CV.</h3>
                      <p className={s.sectionLead}>
                        Uyarlanmış CV'ni sade, tek sütunlu bir şablonla PDF veya DOCX olarak indir. Süs yok,
                        tablo yok; hem insan hem yazılım rahat okur.
                      </p>
                      <FileChips />
                    </div>
                    <div className={s.featureVisual}>
                      <Photo
                        id="photo-output"
                        file="output.png"
                        ratio="5 / 4"
                        description="Masada basılı CV ya da ekranda açık PDF; elde kahve, sade kompozisyon"
                        alt="Kafe masasında basılı bir CV, açık dizüstü ve bir fincan Türk kahvesi"
                        sizes="(max-width: 900px) 92vw, 560px"
                        className={s.outputPhoto}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className={`${s.feature} ${i % 2 === 1 ? s.featureReversed : ""}`}>
                  <div className={s.featureText}>
                    <span className={s.sectionLabel}>
                      {step.number} · {step.name}
                    </span>
                    <h2 className={s.h2}>{step.title}</h2>
                    <p className={s.sectionLead}>{step.text}</p>
                    <Ticks items={step.bullets} />
                    <AccessChips step={step} />
                  </div>
                  {STEP_VISUAL[step.id] && <div className={s.featureVisual}>{STEP_VISUAL[step.id]}</div>}
                </div>
              )}
            </div>
          </section>
        ))}

        {/* ——— Dürüstlük ——— */}
        <section id="durustluk" className={s.honesty}>
          <div className={s.honestyBackdrop} aria-hidden="true" />
          <div className={s.container}>
            <div className={s.honestyInner}>
              <div>
                <span className={`${s.sectionLabel} ${s.sectionLabelDark}`}>Uydurmama ilkesi</span>
                <h2 className={`${s.h2} ${s.honestyTitle}`}>
                  Aynı deneyim,
                  <br />
                  doğru anlatım.
                </h2>
                <p className={s.honestyLead}>
                  Genel sohbet botları her şeyi yazar. Şablon siteleri güzel görünen CV vaat eder.
                  Uyarla ikisinin arasında durur: yalnızca senin gerçekten yaptığını, işverenin
                  diliyle anlatır.
                </p>
              </div>
              <div className={s.principles}>
                {[
                  {
                    icon: "shield" as const,
                    b: "Olmayanı eklemeyiz",
                    m: "Deneyim, beceri veya sertifika uydurmayız. Abartıyı yakalayıp gösteririz.",
                  },
                  {
                    icon: "eye" as const,
                    b: "Her değişikliği gösteririz",
                    m: "Neyin değiştiğini ve neye dayandığını madde madde görürsün.",
                  },
                  {
                    icon: "check" as const,
                    b: "Son söz senin",
                    m: "Metinler yapay zekâyla yeniden yazılır; hiçbiri onayın olmadan CV'ne girmez.",
                  },
                ].map((i) => (
                  <div key={i.b} className={s.principle}>
                    <span className={s.principleIcon}>
                      <Icon name={i.icon} size={20} />
                    </span>
                    <div>
                      <h3 className={s.principleTitle}>{i.b}</h3>
                      <p className={s.principleText}>{i.m}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ——— Personalar ——— */}
        <section className={s.section}>
          <div className={s.container}>
            <div className={s.sectionHeader}>
              <span className={s.sectionLabel}>Kimler için</span>
              <h2 className={s.h2}>İlk işine de, bir sonraki adımına da.</h2>
            </div>
            <div className={s.personas}>
              {PERSONAS.map((p) => (
                <figure key={p.id} className={s.persona}>
                  {p.comingSoon && <span className={`${s.comingSoon} ${s.personaBadge}`}>Yakında</span>}
                  <Photo
                    id={p.id}
                    file={`${p.id.replace("photo-", "")}.png`}
                    ratio="3 / 4"
                    description={p.photo}
                    alt={p.alt}
                    sizes="(max-width: 640px) 92vw, (max-width: 1100px) 45vw, 280px"
                    className={s.personaPhoto}
                  />
                  <figcaption className={s.personaCaption}>
                    <span className={s.personaWho}>{p.who}</span>
                    <span className={s.personaQuote}>“{p.quote}”</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Fiyat (DOG-84) ——— */}
        <Pricing plans={plans} />

        {/* ——— SSS ——— */}
        <section id="sss" className={`${s.section} ${s.sectionTinted}`}>
          <div className={`${s.container} ${s.faqInner}`}>
            <div className={s.faqHeader}>
              <span className={s.sectionLabel}>SSS</span>
              <h2 className={s.h2}>Aklına takılanlar</h2>
              <p className={s.sectionLead}>
                Skor, uyarlama ve CV'nin güvenliği hakkında kısa ve net cevaplar.
              </p>
            </div>
            <div className={s.faq}>
              {LANDING_FAQ.map((q) => (
                <details key={q.s} className={s.faqItem}>
                  <summary>
                    {q.s}
                    <span className={s.faqPlus} aria-hidden="true">
                      <Icon name="plus" size={18} />
                    </span>
                  </summary>
                  <p>{q.c}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Son çağrı ——— */}
        <section className={s.finalCta}>
          <div className={s.container}>
            <div className={s.finalCtaCard}>
              <div className={s.finalCtaPattern} aria-hidden="true" />
              <div className={s.finalCtaText}>
                <h2 className={s.finalCtaTitle}>Tek CV ile yetinme.</h2>
                <p>İlanı yapıştır, CV'nin ne kadar uyduğunu hemen gör. Kayıt gerekmez.</p>
                <Link href="/analyze" className={`${s.buttonWhite} ${s.buttonLarge}`}>
                  Ücretsiz skorumu gör
                  <Icon name="ok" size={18} />
                </Link>
              </div>
              <Photo
                id="photo-final-cta"
                file="final-cta.png"
                ratio="1 / 1"
                description="Telefonda mülakat daveti e-postasını okuyup gülümseyen biri"
                alt="Telefonunda güzel bir haber okuyup gülümseyen genç biri"
                sizes="(max-width: 900px) 80vw, 360px"
                className={s.finalCtaPhoto}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.container} ${s.footerInner}`}>
          <div>
            <Link href="/" className={s.logo} aria-label="uyarla ana sayfa">
              <UyarlaLogo className={s.logoImage} />
            </Link>
            <p className={s.footerSlogan}>Her ilana, doğru CV.</p>
          </div>
          <nav className={s.footerLinks} aria-label="Alt menü">
            <div>
              <p className={s.footerHeading}>Ürün</p>
              <a href="#yolculuk">Nasıl çalışır</a>
              <a href="#bul">Özellikler</a>
              <a href="#fiyat">Fiyat</a>
              <Link href="/analyze">Ücretsiz skor</Link>
            </div>
            <div>
              <p className={s.footerHeading}>Hesap</p>
              <Link href="/login">Giriş yap</Link>
              <a href="#sss">SSS</a>
            </div>
            <div>
              <p className={s.footerHeading}>Yasal</p>
              <Link href="/privacy">KVKK aydınlatma metni</Link>
              <Link href="/terms">Kullanım koşulları</Link>
              <Link href="/refund">İade ve cayma</Link>
            </div>
          </nav>
        </div>
        <div className={`${s.container} ${s.footerBottom}`}>
          <span>© 2026 uyarla</span>
          <span>Türkiye'de, iş arayanlar için yapıldı.</span>
        </div>
      </footer>
    </div>
  )
}
