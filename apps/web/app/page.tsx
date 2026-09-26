import { FotoYeri } from "./components/landing/FotoYeri"
import { Gezinme } from "./components/landing/Gezinme"
import { Ikon, type IkonAdi } from "./components/landing/Ikon"
import {
  AnahtarKelimeKarti,
  DosyaCipleri,
  GereksinimListesi,
  OnceSonra,
  SkorKarti,
  UyariKarti,
} from "./components/landing/Mockuplar"
import s from "./components/landing/landing.module.css"

/**
 * Tanıtım sayfası.
 *
 * Metinler marka rehberi §6–§7 ve §10.1'den. §11 bağlayıcı: garanti yok,
 * kanıtsız sayı yok, uydurma kullanıcı yorumu yok. Bu yüzden rakiplerde
 * gördüğümüz "şu şirketlerde işe girdiler" logo şeridi ve yorum bölümü
 * gerçek veri gelene kadar konmadı. Henüz yapılmamış özellikler "Yakında"
 * rozetiyle gösteriliyor.
 */

const ADIMLAR: { no: string; ikon: IkonAdi; baslik: string; metin: string }[] = [
  {
    no: "01",
    ikon: "yukle",
    baslik: "CV'ni yükle",
    metin: "PDF veya DOCX. Kayıt olmana gerek yok.",
  },
  {
    no: "02",
    ikon: "pano",
    baslik: "İlanı yapıştır",
    metin: "Başvurmak istediğin ilanın metnini olduğu gibi yapıştır.",
  },
  {
    no: "03",
    ikon: "skor",
    baslik: "Skorunu gör, uyarla",
    metin: "Uyumunu ve eksik anahtar kelimeleri gör. İstersen tek tıkla uyarla.",
  },
]

const OZELLIKLER: {
  etiket: string
  baslik: string
  metin: string
  maddeler: string[]
  gorsel: React.ReactNode
}[] = [
  {
    etiket: "ATS uyum skoru",
    baslik: "CV'nin ilana ne kadar uyduğunu gör.",
    metin:
      "Uyarla ilanı gereksinimlerine ayırır ve her birini CV'nde arar. Eşleşen her gereksinimin yanında kanıtı durur, eksik olanlar açıkça listelenir.",
    maddeler: [
      "Zorunlu ve tercih edilen gereksinimler ayrı",
      "Eş anlamlıları ve Türkçe–İngilizce karşılıkları tanır",
      "“CV'ni geliştir” yerine “şu 4 kelime eksik”",
    ],
    gorsel: <GereksinimListesi />,
  },
  {
    etiket: "Uyarlama",
    baslik: "Aynı deneyim, ilanın diliyle.",
    metin:
      "Özetini, deneyim maddelerini ve beceri sıralamanı ilana göre yeniden yazar. Her değişikliği önce/sonra hâliyle görürsün.",
    maddeler: [
      "Eklenen yeşil, çıkarılan üstü çizili",
      "Her maddenin kaynağı gösterilir",
      "Beğenmediğini eski hâline döndür",
    ],
    gorsel: <OnceSonra />,
  },
  {
    etiket: "Uydurma kontrolü",
    baslik: "Olmayan bir deneyimi asla eklemez.",
    metin:
      "Yeniden yazılan her madde üç kontrolden geçer. Anlamı kayan, yeni olgu ekleyen ya da ilandan kelime taşıyan madde işaretlenir ve kararı sana bırakılır.",
    maddeler: [
      "İşaretli maddede gerekçe yazılı",
      "Son kararı sen verirsin",
      "Karar vermeden indirme açılmaz",
    ],
    gorsel: <UyariKarti />,
  },
]

const BENTO: { ikon: IkonAdi; baslik: string; metin: string; yakinda?: boolean; genis?: boolean }[] = [
  {
    ikon: "skor",
    baslik: "ATS uyum skoru",
    metin: "Rakam, durum etiketi ve gereksinim bazında döküm.",
    genis: true,
  },
  { ikon: "anahtar", baslik: "Eksik anahtar kelimeler", metin: "İlanın aradığı ama CV'nde olmayan kavramlar." },
  { ikon: "kalem", baslik: "Madde madde uyarlama", metin: "Özet, deneyim ve beceriler ilana göre." },
  {
    ikon: "kalkan",
    baslik: "Uydurma kontrolü",
    metin: "Anlamı kayan ya da yeni olgu ekleyen maddeyi yakalar, gerekçesini söyler.",
    genis: true,
  },
  { ikon: "belge", baslik: "PDF ve DOCX", metin: "ATS'nin okuyabildiği sade şablon." },
  {
    ikon: "mektup",
    baslik: "Ön yazı",
    metin: "İlana ve senin deneyimine özel ön yazı.",
    yakinda: true,
  },
  {
    ikon: "kolonlar",
    baslik: "Başvuru panosu",
    metin: "Hangi ilana hangi CV sürümüyle başvurduğunu tek yerde gör.",
    yakinda: true,
    genis: true,
  },
  {
    ikon: "dunya",
    baslik: "İngilizce CV",
    metin: "Türkçe CV'nden ilana özel İngilizce CV.",
    yakinda: true,
    genis: true,
  },
]

const PERSONALAR = [
  {
    id: "foto-persona-1",
    kim: "Yeni mezun",
    soz: "Deneyimin az değil, doğru anlatılmamış.",
    foto: "Kampüste ya da kafede dizüstüyle çalışan yeni mezun, doğal ışık",
  },
  {
    id: "foto-persona-2",
    kim: "Kariyer değiştiren",
    soz: "Eski işindeki becerileri yeni alanın diliyle anlat.",
    foto: "Evden çalışan, not alan 30'lu yaşlarda biri, sıcak tonlar",
  },
  {
    id: "foto-persona-3",
    kim: "Deneyimli profesyonel",
    soz: "Az ama isabetli başvuru. Her biri ilana özel.",
    foto: "Ofiste ya da ortak çalışma alanında deneyimli profesyonel, takım elbisesiz",
  },
  {
    id: "foto-persona-4",
    kim: "Yurt dışına başvuran",
    soz: "Türkçe CV'nden ilana özel İngilizce CV.",
    foto: "Pencere önünde video görüşmesi yapan genç profesyonel",
    yakinda: true,
  },
]

const SSS = [
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

export default function Home() {
  return (
    <div className={s.sayfa}>
      <Gezinme />

      <main>
        {/* ——— Hero ——— */}
        <section className={s.hero}>
          <div className={s.heroZemin} aria-hidden="true" />
          <div className={`${s.kap} ${s.heroIc}`}>
            <div className={s.heroMetin}>
              <span className={s.ustEtiket}>
                <span className={s.ustEtiketNokta} />
                Türkçe öncelikli ATS uyum skoru
              </span>
              <h1 className={s.heroBaslik}>
                Her ilana, <span className={s.vurgu}>doğru CV.</span>
              </h1>
              <p className={s.heroAlt}>
                İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve tek tıkla ilana özel hâle getir.
                Deneyimini uydurmadan.
              </p>
              <div className={s.heroEylem}>
                <a href="/analyze" className={`${s.btnBirincil} ${s.btnBuyuk}`}>
                  Ücretsiz skorumu gör
                  <Ikon ad="ok" boyut={18} />
                </a>
                <a href="#nasil" className={`${s.btnIkincil} ${s.btnBuyuk}`}>
                  Nasıl çalışır?
                </a>
              </div>
              <ul className={s.guven}>
                <li>
                  <Ikon ad="check" boyut={16} /> Kayıt gerekmez
                </li>
                <li>
                  <Ikon ad="check" boyut={16} /> CV'n izinsiz paylaşılmaz
                </li>
                <li>
                  <Ikon ad="check" boyut={16} /> Her değişikliği sen onaylarsın
                </li>
              </ul>
            </div>

            <div className={s.heroGorsel}>
              <FotoYeri
                id="foto-hero"
                oran="4 / 5"
                aciklama="Doğal ışıkta dizüstünde CV'sine bakan genç profesyonel, Türkiye'den tanıdık bir mekân"
                className={s.heroFoto}
              />
              <div className={s.heroKartUst}>
                <SkorKarti />
              </div>
              <div className={s.heroKartAlt}>
                <AnahtarKelimeKarti />
              </div>
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
              {ADIMLAR.map((a, i) => (
                <li key={a.no} className={s.adim}>
                  <div className={s.adimUst}>
                    <span className={s.adimIkon}>
                      <Ikon ad={a.ikon} boyut={22} />
                    </span>
                    <span className={s.adimNo}>{a.no}</span>
                  </div>
                  <h3 className={s.h3}>{a.baslik}</h3>
                  <p className={s.adimMetin}>{a.metin}</p>
                  {i < ADIMLAR.length - 1 && <span className={s.adimCizgi} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ——— Özellik blokları ——— */}
        <section id="ozellikler" className={`${s.bolum} ${s.bolumZemin}`}>
          <div className={s.kap}>
            {OZELLIKLER.map((o, i) => (
              <div key={o.etiket} className={`${s.ozellik} ${i % 2 === 1 ? s.ozellikTers : ""}`}>
                <div className={s.ozellikMetin}>
                  <span className={s.bolumEtiket}>{o.etiket}</span>
                  <h2 className={s.h2}>{o.baslik}</h2>
                  <p className={s.bolumAlt}>{o.metin}</p>
                  <ul className={s.tikListe}>
                    {o.maddeler.map((m) => (
                      <li key={m}>
                        <span className={s.tik}>
                          <Ikon ad="check" boyut={14} />
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={s.ozellikGorsel}>{o.gorsel}</div>
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
                <DosyaCipleri />
              </div>
              <div className={s.ozellikGorsel}>
                <FotoYeri
                  id="foto-cikti"
                  oran="5 / 4"
                  aciklama="Masada basılı CV ya da ekranda açık PDF; elde kahve, sade kompozisyon"
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
              {BENTO.map((b) => (
                <div key={b.baslik} className={`${s.bentoKart} ${b.genis ? s.bentoGenis : ""}`}>
                  <div className={s.bentoUst}>
                    <span className={s.bentoIkon}>
                      <Ikon ad={b.ikon} boyut={22} />
                    </span>
                    {b.yakinda && <span className={s.yakinda}>Yakında</span>}
                  </div>
                  <h3 className={s.h3}>{b.baslik}</h3>
                  <p className={s.bentoMetin}>{b.metin}</p>
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
                    ikon: "kalkan" as const,
                    b: "Olmayanı eklemeyiz",
                    m: "Deneyim, beceri veya sertifika uydurmayız. Abartıyı yakalayıp gösteririz.",
                  },
                  {
                    ikon: "goz" as const,
                    b: "Her değişikliği gösteririz",
                    m: "Neyin değiştiğini ve neye dayandığını madde madde görürsün.",
                  },
                  {
                    ikon: "check" as const,
                    b: "Son söz senin",
                    m: "Metinler yapay zekâyla yeniden yazılır; hiçbiri onayın olmadan CV'ne girmez.",
                  },
                ].map((i) => (
                  <div key={i.b} className={s.ilke}>
                    <span className={s.ilkeIkon}>
                      <Ikon ad={i.ikon} boyut={20} />
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
              {PERSONALAR.map((p) => (
                <figure key={p.id} className={s.persona}>
                  {p.yakinda && <span className={`${s.yakinda} ${s.personaRozet}`}>Yakında</span>}
                  <FotoYeri id={p.id} oran="3 / 4" aciklama={p.foto} className={s.personaFoto} />
                  <figcaption className={s.personaAlt}>
                    <span className={s.personaKim}>{p.kim}</span>
                    <span className={s.personaSoz}>“{p.soz}”</span>
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
              {SSS.map((q) => (
                <details key={q.s} className={s.sssMadde}>
                  <summary>
                    {q.s}
                    <span className={s.sssArti} aria-hidden="true">
                      <Ikon ad="arti" boyut={18} />
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
                <a href="/analyze" className={`${s.btnBeyaz} ${s.btnBuyuk}`}>
                  Ücretsiz skorumu gör
                  <Ikon ad="ok" boyut={18} />
                </a>
              </div>
              <FotoYeri
                id="foto-son-cagri"
                oran="1 / 1"
                aciklama="Telefonda mülakat daveti e-postasını okuyup gülümseyen biri"
                className={s.sonCagriFoto}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className={s.altbilgi}>
        <div className={`${s.kap} ${s.altbilgiIc}`}>
          <div>
            <a href="/" className={s.logo}>
              <span className={s.logoSembol} aria-hidden="true">
                <span />
                <span />
              </span>
              uyarla
            </a>
            <p className={s.altbilgiSlogan}>Her ilana, doğru CV.</p>
          </div>
          <nav className={s.altbilgiLinkler} aria-label="Alt menü">
            <div>
              <p className={s.altbilgiBaslik}>Ürün</p>
              <a href="#nasil">Nasıl çalışır</a>
              <a href="#ozellikler">Özellikler</a>
              <a href="/analyze">Ücretsiz skor</a>
            </div>
            <div>
              <p className={s.altbilgiBaslik}>Hesap</p>
              <a href="/login">Giriş yap</a>
              <a href="#sss">SSS</a>
            </div>
            <div>
              <p className={s.altbilgiBaslik}>Yasal</p>
              {/* Sayfalar henüz yok; KVKK metni yayından önce eklenecek (rehber §11). */}
              <a href="#">KVKK aydınlatma metni</a>
              <a href="#">Kullanım koşulları</a>
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
