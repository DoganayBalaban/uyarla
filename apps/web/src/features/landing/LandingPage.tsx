import Link from "next/link"
import { Photo as Photo } from "@/features/landing/components/Photo"
import { Icon as Icon, type IconName as IconName } from "@/features/landing/components/Icon"
import {
  FileChips as FileChips,
  RequirementList as RequirementList,
  HeroCheck as HeroCheck,
  HeroApp as HeroApp,
  BeforeAfter as BeforeAfter,
  WarningCard as WarningCard,
} from "@/features/landing/components/Mockups"
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

const STEPS: { number: string; icon: IconName; title: string; text: string }[] = [
  {
    number: "01",
    icon: "upload",
    title: "CV'ni yükle",
    text: "PDF veya DOCX. Kayıt olmana gerek yok.",
  },
  {
    number: "02",
    icon: "board",
    title: "İlanı yapıştır",
    text: "Başvurmak istediğin ilanın metnini olduğu gibi yapıştır.",
  },
  {
    number: "03",
    icon: "score",
    title: "Skorunu gör, uyarla",
    text: "Uyumunu ve eksik anahtar kelimeleri gör. İstersen tek tıkla uyarla.",
  },
]

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
    visual: <RequirementList />,
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
    visual: <BeforeAfter />,
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
    visual: <WarningCard />,
  },
]

const BENTO_ITEMS: { icon: IconName; title: string; text: string; comingSoon?: boolean; wide?: boolean }[] = [
  {
    icon: "score",
    title: "ATS uyum skoru",
    text: "Rakam, durum etiketi ve gereksinim bazında döküm.",
    wide: true,
  },
  { icon: "key", title: "Eksik anahtar kelimeler", text: "İlanın aradığı ama CV'nde olmayan kavramlar." },
  { icon: "pen", title: "Madde madde uyarlama", text: "Özet, deneyim ve beceriler ilana göre." },
  {
    icon: "shield",
    title: "Uydurma kontrolü",
    text: "Anlamı kayan ya da yeni olgu ekleyen maddeyi yakalar, gerekçesini söyler.",
    wide: true,
  },
  { icon: "doc", title: "PDF ve DOCX", text: "ATS'nin okuyabildiği sade şablon." },
  {
    icon: "mail",
    title: "Ön yazı",
    text: "İlana ve senin deneyimine özel ön yazı; uydurma kontrolünden geçer.",
  },
  {
    icon: "columns",
    title: "Başvuru panosu",
    text: "Her analiz bir kart: başvurdun mu, mülakat mı, teklif mi, tek yerde gör.",
    wide: true,
  },
  {
    icon: "globe",
    title: "İngilizce CV",
    text: "Türkçe CV'nden ilana özel İngilizce CV.",
    comingSoon: true,
    wide: true,
  },
]

const PERSONAS = [
  {
    id: "foto-persona-1",
    alt: "Kampüs kafesinde dizüstüyle çalışan yeni mezun",
    who: "Yeni mezun",
    quote: "Deneyimin az değil, doğru anlatılmamış.",
    photo: "Kampüste ya da kafede dizüstüyle çalışan yeni mezun, doğal ışık",
  },
  {
    id: "foto-persona-2",
    alt: "Evde mutfak masasında dizüstünün yanında not alan bir kadın",
    who: "Kariyer değiştiren",
    quote: "Eski işindeki becerileri yeni alanın diliyle anlat.",
    photo: "Evden çalışan, not alan 30'lu yaşlarda biri, sıcak tonlar",
  },
  {
    id: "foto-persona-3",
    alt: "Ortak çalışma alanında dizüstünde belge inceleyen deneyimli bir profesyonel",
    who: "Deneyimli profesyonel",
    quote: "Az ama isabetli başvuru. Her biri ilana özel.",
    photo: "Ofiste ya da ortak çalışma alanında deneyimli profesyonel, takım elbisesiz",
  },
  {
    id: "foto-persona-4",
    alt: "Pencere önünde dizüstünden görüntülü görüşme yapan genç bir profesyonel",
    who: "Yurt dışına başvuran",
    quote: "Türkçe CV'nden ilana özel İngilizce CV.",
    photo: "Pencere önünde video görüşmesi yapan genç profesyonel",
    comingSoon: true,
  },
]

const FAQ = [
  {
    s: "ATS nedir?",
    c: "Aday takip sistemi. Birçok şirket başvuruları önce bu yazılımla süzer; CV'nde ilanın aradığı kavramlar yoksa bir insan görmeden elenebilir. Uyarla, CV'nin bu ilana göre ne kadar okunur ve eşleşir olduğunu gösterir.",
  },
  {
    s: "Skor ücretsiz mi?",
    c: "Evet. CV'ni yükleyip ilanı yapıştırman yeter, kayıt gerekmez. Uyarlama için e-postanla giriş yapman isteniyor; işin kaybolmaz, yaptığın analiz hesabına taşınır.",
  },
  {
    s: "Deneyimimi abartıyor ya da uyduruyor mu?",
    c: "Hayır. Olmayan deneyim, beceri veya sertifika eklemez. Yeniden yazılan her madde kontrol edilir; anlamı kayan ya da yeni olgu içeren madde işaretlenir ve senin onayın olmadan kullanılmaz.",
  },
  {
    s: "Skorum mutlaka yükselir mi?",
    c: "Söz vermiyoruz. Skor, CV'nde gerçekten olan deneyimi ölçer. Yetkinliğin varsa ama iyi anlatılmamışsa uyarlama bunu görünür kılar; yoksa dürüst bir metin onu ekleyemez. Eksik kalan kelimeler sana neyi öğrenmen ya da vurgulaman gerektiğini söyler.",
  },
  {
    s: "Hangi dosya türlerini destekliyorsunuz?",
    c: "CV için PDF ve DOCX yükleyebilirsin. Uyarlanmış CV'ni PDF veya DOCX olarak indirirsin; PDF'in metni seçilebilir, yani ATS okuyabilir.",
  },
  {
    s: "İngilizce CV'm ya da ilanım varsa?",
    c: "Skorlama Türkçe ve İngilizce kavramları birbirine eşleyebiliyor. İngilizce CV'ni Türkçe bir ilanla karşılaştırabilirsin.",
  },
  {
    s: "CV'm güvende mi?",
    c: "CV'n izinsiz kimseyle paylaşılmaz ve yalnızca sen görebilirsin. Başka bir kullanıcı senin analizine ya da uyarlamana erişemez.",
  },
]

export function LandingPage() {
  return (
    <div className={s.sayfa}>
      <main>
        {/* ——— Hero ——— */}
        <section className={s.hero}>
          <div className={`${s.kap} ${s.heroMetin}`}>
            <h1 className={s.heroBaslik}>Her ilana, doğru CV.</h1>
            <p className={s.heroAlt}>
              İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve tek tıkla ilana özel hâle getir.
              Deneyimini uydurmadan.
            </p>
            <div className={s.heroEylem}>
              <Link href="/analyze" className={`${s.btnBirincil} ${s.btnBuyuk}`}>
                Ücretsiz skorumu gör
              </Link>
              <a href="#nasil" className={`${s.btnIkincil} ${s.btnBuyuk}`}>
                Nasıl çalışır?
              </a>
            </div>
            <ul className={s.guven}>
              <li>
                <Icon name="check" size={16} /> Kayıt gerekmez
              </li>
              <li>
                <Icon name="check" size={16} /> CV'n izinsiz paylaşılmaz
              </li>
              <li>
                <Icon name="check" size={16} /> Her değişikliği sen onaylarsın
              </li>
            </ul>
          </div>

          {/* Ürünün kendisi: analiz ekranı ve kenarından taşan uydurma kontrolü. */}
          <div className={`${s.kap} ${s.heroSahne}`} aria-hidden="true">
            <div className={s.heroSahneZemin} />
            <HeroApp />
            <div className={s.heroKontrolYer}>
              <HeroCheck />
            </div>
          </div>
        </section>

        {/* ——— Sorun ——— */}
        <section className={s.sorun}>
          <div className={s.kap}>
            <p className={s.sorunMetin}>
              Aynı CV ile onlarca ilana başvurup dönüş alamıyorsan sorun çoğu zaman deneyiminde
              değil, <strong>anlatımında.</strong> Her ilan farklı bir CV ister.
            </p>
          </div>
        </section>

        {/* ——— Nasıl çalışır ——— */}
        <section id="nasil" className={s.bolum}>
          <div className={s.kap}>
            <div className={s.bolumBaslik}>
              <span className={s.bolumEtiket}>Nasıl çalışır</span>
              <h2 className={s.h2}>Üç adım. Kayıt yok, kurulum yok.</h2>
              <p className={s.bolumAlt}>Skorunu görmek tamamen ücretsiz.</p>
            </div>
            <ol className={s.adimlar}>
              {STEPS.map((a, i) => (
                <li key={a.number} className={s.adim}>
                  <div className={s.adimUst}>
                    <span className={s.adimIkon}>
                      <Icon name={a.icon} size={22} />
                    </span>
                    <span className={s.adimNo}>{a.number}</span>
                  </div>
                  <h3 className={s.h3}>{a.title}</h3>
                  <p className={s.adimMetin}>{a.text}</p>
                  {i < STEPS.length - 1 && <span className={s.adimCizgi} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ——— Özellik blokları ——— */}
        <section id="ozellikler" className={`${s.bolum} ${s.bolumZemin}`}>
          <div className={s.kap}>
            {FEATURES.map((o, i) => (
              <div key={o.label} className={`${s.ozellik} ${i % 2 === 1 ? s.ozellikTers : ""}`}>
                <div className={s.ozellikMetin}>
                  <span className={s.bolumEtiket}>{o.label}</span>
                  <h2 className={s.h2}>{o.title}</h2>
                  <p className={s.bolumAlt}>{o.text}</p>
                  <ul className={s.tikListe}>
                    {o.bullets.map((m) => (
                      <li key={m}>
                        <span className={s.tik}>
                          <Icon name="check" size={14} />
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={s.ozellikGorsel}>{o.visual}</div>
              </div>
            ))}

            <div className={`${s.ozellik} ${s.ozellikTers}`}>
              <div className={s.ozellikMetin}>
                <span className={s.bolumEtiket}>Çıktı</span>
                <h2 className={s.h2}>Başvurmaya hazır, ATS'nin okuyabildiği CV.</h2>
                <p className={s.bolumAlt}>
                  Uyarlanmış CV'ni sade, tek sütunlu bir şablonla PDF veya DOCX olarak indir. Süs yok,
                  tablo yok; hem insan hem yazılım rahat okur.
                </p>
                <FileChips />
              </div>
              <div className={s.ozellikGorsel}>
                <Photo
                  id="foto-cikti"
                  file="cikti.png"
                  ratio="5 / 4"
                  description="Masada basılı CV ya da ekranda açık PDF; elde kahve, sade kompozisyon"
                  alt="Kafe masasında basılı bir CV, açık dizüstü ve bir fincan Türk kahvesi"
                  sizes="(max-width: 900px) 92vw, 560px"
                  className={s.ciktiFoto}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ——— Bento ——— */}
        <section className={s.bolum}>
          <div className={s.kap}>
            <div className={s.bolumBaslik}>
              <span className={s.bolumEtiket}>Hepsi tek yerde</span>
              <h2 className={s.h2}>Başvur, uyarla, takip et.</h2>
              <p className={s.bolumAlt}>Bugün skor ve uyarlama hazır. Sıradakiler yolda.</p>
            </div>
            <div className={s.bento}>
              {BENTO_ITEMS.map((b) => (
                <div key={b.title} className={`${s.bentoKart} ${b.wide ? s.bentoGenis : ""}`}>
                  <div className={s.bentoUst}>
                    <span className={s.bentoIkon}>
                      <Icon name={b.icon} size={22} />
                    </span>
                    {b.comingSoon && <span className={s.yakinda}>Yakında</span>}
                  </div>
                  <h3 className={s.h3}>{b.title}</h3>
                  <p className={s.bentoMetin}>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Dürüstlük ——— */}
        <section id="durustluk" className={s.durustluk}>
          <div className={s.durustlukZemin} aria-hidden="true" />
          <div className={s.kap}>
            <div className={s.durustlukIc}>
              <div>
                <span className={`${s.bolumEtiket} ${s.bolumEtiketKoyu}`}>Uydurmama ilkesi</span>
                <h2 className={`${s.h2} ${s.durustlukBaslik}`}>
                  Aynı deneyim,
                  <br />
                  doğru anlatım.
                </h2>
                <p className={s.durustlukAlt}>
                  Genel sohbet botları her şeyi yazar. Şablon siteleri güzel görünen CV vaat eder.
                  Uyarla ikisinin arasında durur: yalnızca senin gerçekten yaptığını, işverenin
                  diliyle anlatır.
                </p>
              </div>
              <div className={s.ilkeler}>
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
                  <div key={i.b} className={s.ilke}>
                    <span className={s.ilkeIkon}>
                      <Icon name={i.icon} size={20} />
                    </span>
                    <div>
                      <h3 className={s.ilkeBaslik}>{i.b}</h3>
                      <p className={s.ilkeMetin}>{i.m}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ——— Personalar ——— */}
        <section className={s.bolum}>
          <div className={s.kap}>
            <div className={s.bolumBaslik}>
              <span className={s.bolumEtiket}>Kimler için</span>
              <h2 className={s.h2}>İlk işine de, bir sonraki adımına da.</h2>
            </div>
            <div className={s.personalar}>
              {PERSONAS.map((p) => (
                <figure key={p.id} className={s.persona}>
                  {p.comingSoon && <span className={`${s.yakinda} ${s.personaRozet}`}>Yakında</span>}
                  <Photo
                    id={p.id}
                    file={`${p.id.replace("foto-", "")}.png`}
                    ratio="3 / 4"
                    description={p.photo}
                    alt={p.alt}
                    sizes="(max-width: 640px) 92vw, (max-width: 1100px) 45vw, 280px"
                    className={s.personaFoto}
                  />
                  <figcaption className={s.personaAlt}>
                    <span className={s.personaKim}>{p.who}</span>
                    <span className={s.personaSoz}>“{p.quote}”</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ——— SSS ——— */}
        <section id="sss" className={`${s.bolum} ${s.bolumZemin}`}>
          <div className={`${s.kap} ${s.sssIc}`}>
            <div className={s.sssBaslik}>
              <span className={s.bolumEtiket}>SSS</span>
              <h2 className={s.h2}>Aklına takılanlar</h2>
              <p className={s.bolumAlt}>
                Skor, uyarlama ve CV'nin güvenliği hakkında kısa ve net cevaplar.
              </p>
            </div>
            <div className={s.sss}>
              {FAQ.map((q) => (
                <details key={q.s} className={s.sssMadde}>
                  <summary>
                    {q.s}
                    <span className={s.sssArti} aria-hidden="true">
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
        <section className={s.sonCagri}>
          <div className={s.kap}>
            <div className={s.sonCagriKart}>
              <div className={s.sonCagriDesen} aria-hidden="true" />
              <div className={s.sonCagriMetin}>
                <h2 className={s.sonCagriBaslik}>Tek CV ile yetinme.</h2>
                <p>İlanı yapıştır, CV'nin ne kadar uyduğunu hemen gör. Kayıt gerekmez.</p>
                <Link href="/analyze" className={`${s.btnBeyaz} ${s.btnBuyuk}`}>
                  Ücretsiz skorumu gör
                  <Icon name="ok" size={18} />
                </Link>
              </div>
              <Photo
                id="foto-son-cagri"
                file="son-cagri.png"
                ratio="1 / 1"
                description="Telefonda mülakat daveti e-postasını okuyup gülümseyen biri"
                alt="Telefonunda güzel bir haber okuyup gülümseyen genç biri"
                sizes="(max-width: 900px) 80vw, 360px"
                className={s.sonCagriFoto}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className={s.altbilgi}>
        <div className={`${s.kap} ${s.altbilgiIc}`}>
          <div>
            <Link href="/" className={s.logo}>
              <span className={s.logoSembol} aria-hidden="true">
                <span />
                <span />
              </span>
              uyarla
            </Link>
            <p className={s.altbilgiSlogan}>Her ilana, doğru CV.</p>
          </div>
          <nav className={s.altbilgiLinkler} aria-label="Alt menü">
            <div>
              <p className={s.altbilgiBaslik}>Ürün</p>
              <a href="#nasil">Nasıl çalışır</a>
              <a href="#ozellikler">Özellikler</a>
              <Link href="/analyze">Ücretsiz skor</Link>
            </div>
            <div>
              <p className={s.altbilgiBaslik}>Hesap</p>
              <Link href="/login">Giriş yap</Link>
              <a href="#sss">SSS</a>
            </div>
            <div>
              <p className={s.altbilgiBaslik}>Yasal</p>
              <Link href="/privacy">KVKK aydınlatma metni</Link>
              <Link href="/terms">Kullanım koşulları</Link>
            </div>
          </nav>
        </div>
        <div className={`${s.kap} ${s.altbilgiAlt}`}>
          <span>© 2026 uyarla</span>
          <span>Türkiye'de, iş arayanlar için yapıldı.</span>
        </div>
      </footer>
    </div>
  )
}
