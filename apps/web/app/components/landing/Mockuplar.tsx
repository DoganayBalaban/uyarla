import { Ikon } from "./Ikon"
import s from "./landing.module.css"

/**
 * Tanıtım sayfasındaki ürün görselleri. Marka rehberi §9.4: pazarlamada en
 * güçlü görsel ürünün kendisi. Ekran görüntüsü yerine HTML çiziliyor ki koyu
 * temaya uysun ve metinler güncel kalsın.
 *
 * İçerik örnektir ama uydurma ilkesine uyar: "sonra" metni "önce"de olmayan
 * bir olgu eklemiyor, skor artışı vaat edilmiyor (K-32).
 */

/** Skor halkası; durum hem renkle hem etiketle (rehber §9.2, §9.5). */
export function SkorHalkasi({ skor = 47, boyut = 112 }: { skor?: number; boyut?: number }) {
  const r = 44
  const cevre = 2 * Math.PI * r
  const durum = skor >= 70 ? "Yüksek" : skor >= 40 ? "Orta" : "Düşük"
  const renk = skor >= 70 ? "var(--yesil)" : skor >= 40 ? "var(--kehribar)" : "var(--kirmizi)"
  return (
    <div className={s.halka} style={{ width: boyut, height: boyut, fontSize: (boyut / 112) * 16 }}>
      <svg viewBox="0 0 100 100" width={boyut} height={boyut} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--cizgi)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={renk}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(cevre * skor) / 100} ${cevre}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className={s.halkaIc}>
        <span className={s.halkaRakam}>{skor}</span>
        <span className={s.halkaDurum} style={{ color: renk }}>
          {durum}
        </span>
      </div>
    </div>
  )
}

export function SkorKarti() {
  return (
    <div className={`${s.mock} ${s.skorKarti}`}>
      <div className={s.mockBaslik}>
        <span className={s.mockNokta} />
        <span className={s.mockNokta} />
        <span className={s.mockNokta} />
        <span className={s.mockAdres}>ATS uyum skoru</span>
      </div>
      <div className={s.skorKartiGovde}>
        <SkorHalkasi />
        <div>
          <p className={s.mockKucuk}>Kıdemli Frontend Geliştirici</p>
          <p className={s.skorKartiCumle}>Bu ilana uyumun %47.</p>
          <p className={s.mockKucuk}>4 eksik anahtar kelime var. Çoğu anlatımla ilgili.</p>
        </div>
      </div>
    </div>
  )
}

export function AnahtarKelimeKarti() {
  const eslesen = ["React", "TypeScript", "REST API", "Git"]
  const eksik = ["Jest", "Erişilebilirlik", "CI/CD", "Figma"]
  return (
    <div className={`${s.mock} ${s.kelimeKarti}`}>
      <p className={s.mockEtiket}>Eksik anahtar kelimeler</p>
      <div className={s.cipler}>
        {eksik.map((k) => (
          <span key={k} className={`${s.cip} ${s.cipEksik}`}>
            <Ikon ad="x" boyut={12} /> {k}
          </span>
        ))}
      </div>
      <p className={s.mockEtiket}>Eşleşenler</p>
      <div className={s.cipler}>
        {eslesen.map((k) => (
          <span key={k} className={`${s.cip} ${s.cipEslesen}`}>
            <Ikon ad="check" boyut={12} /> {k}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Gereksinim listesi: her eşleşme CV'deki kanıtıyla birlikte. */
export function GereksinimListesi() {
  const satirlar: { metin: string; durum: "eslesti" | "eksik"; kanit?: string; onem: string }[] = [
    { metin: "React ile arayüz geliştirme", durum: "eslesti", kanit: "“…React kullandım” · Deneyim", onem: "Zorunlu" },
    { metin: "TypeScript", durum: "eslesti", kanit: "Beceriler bölümü", onem: "Zorunlu" },
    { metin: "Birim testi (Jest, Testing Library)", durum: "eksik", onem: "Zorunlu" },
    { metin: "Web erişilebilirliği (WCAG)", durum: "eksik", onem: "Tercihen" },
    { metin: "Ekiple kod incelemesi", durum: "eslesti", kanit: "“Haftalık kod incelemelerine katıldım” · Deneyim", onem: "Tercihen" },
  ]
  return (
    <div className={`${s.mock} ${s.mockGenis}`}>
      <div className={s.mockUst}>
        <div>
          <p className={s.mockEtiket}>İlan gereksinimleri</p>
          <p className={s.mockBaslikMetin}>5 gereksinimden 3'ü karşılanıyor</p>
        </div>
        <SkorHalkasi boyut={72} />
      </div>
      <ul className={s.gereksinimler}>
        {satirlar.map((g) => (
          <li key={g.metin}>
            <span className={g.durum === "eslesti" ? s.durumEslesti : s.durumEksik}>
              <Ikon ad={g.durum === "eslesti" ? "check" : "x"} boyut={14} />
            </span>
            <div>
              <p className={s.gereksinimMetin}>
                {g.metin} <span className={s.onem}>{g.onem}</span>
              </p>
              <p className={s.mockKucuk}>{g.kanit ?? "CV'nde karşılığı bulunamadı"}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Önce/sonra: eklenen yeşil vurgulu, çıkarılan üstü çizili gri (rehber §9.5). */
export function OnceSonra() {
  return (
    <div className={`${s.mock} ${s.mockGenis}`}>
      <p className={s.mockEtiket}>Deneyim · Acme Yazılım · 2. madde</p>
      <div className={s.onceSonra}>
        <div className={s.onceSonraBlok}>
          <span className={s.onceSonraRozet}>Önce</span>
          <p>Müşteri paneli projesinde görev aldım, React kullandım.</p>
        </div>
        <div className={s.onceSonraOk}>
          <Ikon ad="ok" boyut={18} />
        </div>
        <div className={`${s.onceSonraBlok} ${s.onceSonraYeni}`}>
          <span className={`${s.onceSonraRozet} ${s.onceSonraRozetYeni}`}>Sonra</span>
          <p>
            <span className="rounded bg-yesil/20 px-0.5">React ve TypeScript ile</span> müşteri{" "}
            <span className="text-gri line-through">paneli projesinde görev aldım, React kullandım.</span>{" "}
            <span className="rounded bg-yesil/20 px-0.5">panelini geliştirdim.</span>
          </p>
        </div>
      </div>
      <div className={s.kaynak}>
        <Ikon ad="goz" boyut={14} />
        Kaynak: Senin yazdığın madde ve Beceriler bölümün. Yeni olgu eklenmedi.
      </div>
    </div>
  )
}

/** Uydurma kontrolünün yakaladığı madde: karar verilmeden indirme kapalı. */
export function UyariKarti() {
  return (
    <div className={`${s.mock} ${s.mockGenis}`}>
      <span className="mb-1.5 inline-block rounded-full bg-kehribar/20 px-2 py-0.5 text-xs font-bold text-kehribar">Kontrol et</span>
      <p className={s.uyariMetin}>
        <span className="text-gri line-through">Stajyerlerin uyumuna destek oldum.</span>{" "}
        <span className="rounded bg-yesil/20 px-0.5">4 kişilik ekibe liderlik ettim.</span>
      </p>
      <p className="mt-1.5 text-sm text-kehribar">
        Orijinal maddede “liderlik” ve “4 kişi” geçmiyor. Bu ifade deneyimini abartıyor olabilir.
      </p>
      <div className={s.uyariButonlar}>
        <span className={s.sahteIkincil}>Eski hâli kalsın</span>
        <span className={s.sahteBirincil}>Yeni hâlini kullan</span>
      </div>
      <div className={s.kilitSatiri}>
        <Ikon ad="kilit" boyut={14} />
        İşaretli maddelere karar verene kadar indirme kapalı.
      </div>
    </div>
  )
}

export function DosyaCipleri() {
  return (
    <div className={s.dosyalar}>
      <div className={s.dosya}>
        <span className={`${s.dosyaTur} ${s.dosyaPdf}`}>PDF</span>
        <div>
          <p className={s.dosyaAd}>Ayse_Yilmaz_Frontend.pdf</p>
          <p className={s.mockKucuk}>Metni seçilebilir · ATS okur</p>
        </div>
      </div>
      <div className={s.dosya}>
        <span className={`${s.dosyaTur} ${s.dosyaDocx}`}>DOCX</span>
        <div>
          <p className={s.dosyaAd}>Ayse_Yilmaz_Frontend.docx</p>
          <p className={s.mockKucuk}>Word'de düzenlemeye devam et</p>
        </div>
      </div>
    </div>
  )
}
