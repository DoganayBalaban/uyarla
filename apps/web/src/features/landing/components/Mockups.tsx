import { Icon } from "@/features/landing/components/Icon"
import s from "@/features/landing/landing.module.css"

/**
 * Tanıtım sayfasındaki ürün görselleri. Marka rehberi §9.4: pazarlamada en
 * güçlü görsel ürünün kendisi. Ekran görüntüsü yerine HTML çiziliyor ki koyu
 * temaya uysun ve metinler güncel kalsın.
 *
 * İçerik örnektir ama uydurma ilkesine uyar: "sonra" metni "önce"de olmayan
 * bir olgu eklemiyor, skor artışı vaat edilmiyor (K-32).
 */

/** Skor halkası; durum hem renkle hem etiketle (rehber §9.2, §9.5). */
export function ScoreRing({ score = 47, sizePx = 112 }: { score?: number; sizePx?: number }) {
  const r = 44
  const circumference = 2 * Math.PI * r
  const state = score >= 70 ? "Yüksek" : score >= 40 ? "Orta" : "Düşük"
  const textClass = score >= 70 ? "var(--brand-green)" : score >= 40 ? "var(--brand-amber)" : "var(--brand-red)"
  return (
    <div className={s.ring} style={{ width: sizePx, height: sizePx, fontSize: (sizePx / 112) * 16 }}>
      <svg viewBox="0 0 100 100" width={sizePx} height={sizePx} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={textClass}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * score) / 100} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className={s.ringInner}>
        <span className={s.ringNumber}>{score}</span>
        <span className={s.ringStatus} style={{ color: textClass }}>
          {state}
        </span>
      </div>
    </div>
  )
}

/**
 * Hero'daki uygulama penceresi: analiz ekranının sadeleştirilmiş hâli.
 * Gerçek uygulamanın düzenini izliyor (yan menü değil üst çubuk; zemin buz,
 * kartlar beyaz) ki tanıtım sayfası ürünün kendisini göstersin.
 */
export function HeroApp() {
  const requirementList: { text: string; matched: boolean }[] = [
    { text: "React ile arayüz geliştirme", matched: true },
    { text: "TypeScript", matched: true },
    { text: "Birim testi (Jest)", matched: false },
    { text: "Web erişilebilirliği", matched: false },
    { text: "Ekiple kod incelemesi", matched: true },
  ]
  const missing = ["Jest", "Erişilebilirlik", "CI/CD", "Figma"]
  const matchedList = ["React", "TypeScript", "REST API", "Git"]
  return (
    <div className={s.appWindow}>
      <div className={s.appWindowTop}>
        <span className={s.appWindowLogo}>
          <span className={s.logoMark} aria-hidden="true">
            <span />
            <span />
          </span>
          uyarla
        </span>
        <span className={`${s.appWindowLink} ${s.appWindowLinkActive}`}>
          <Icon name="score" size={15} /> Yeni analiz
        </span>
        <span className={s.appWindowLink}>
          <Icon name="columns" size={15} /> Başvuru panosu
        </span>
      </div>

      <div className={s.appWindowBody}>
        <p className={s.appWindowTitle}>Kıdemli Frontend Geliştirici</p>
        <p className={s.mockSmall}>Acme Yazılım</p>

        <div className={s.appWindowGrid}>
          <div className={`${s.appWindowCard} ${s.appWindowScore}`}>
            <ScoreRing sizePx={96} />
            <div>
              <p className={s.scoreSentence}>Bu ilana uyumun %47.</p>
              <p className={s.mockSmall}>4 eksik anahtar kelime var. Çoğu anlatımla ilgili.</p>
            </div>
            <span className={s.fakePrimary}>Bu ilana uyarla</span>
          </div>

          <div className={s.appWindowCard}>
            <p className={s.appWindowCardTitle}>5 gereksinimden 3'ü karşılanıyor</p>
            <ul className={s.appWindowList}>
              {requirementList.map((g) => (
                <li key={g.text}>
                  <span className={g.matched ? s.statusMatched : s.statusMissing}>
                    <Icon name={g.matched ? "check" : "x"} size={12} />
                  </span>
                  {g.text}
                </li>
              ))}
            </ul>
          </div>

          <div className={s.appWindowCard}>
            <p className={s.appWindowCardTitle}>Eksik anahtar kelimeler</p>
            <div className={s.chips}>
              {missing.map((k) => (
                <span key={k} className={`${s.chip} ${s.chipMissing}`}>
                  <Icon name="x" size={12} /> {k}
                </span>
              ))}
            </div>
            <p className={s.appWindowCardTitle}>Eşleşenler</p>
            <div className={s.chips}>
              {matchedList.map((k) => (
                <span key={k} className={`${s.chip} ${s.chipMatched}`}>
                  <Icon name="check" size={12} /> {k}
                </span>
              ))}
            </div>
          </div>

          <div className={`${s.appWindowCard} ${s.appWindowWide}`}>
            <p className={s.appWindowCardTitle}>Deneyim, Acme Yazılım, 2. madde</p>
            <div className={s.appWindowBeforeAfter}>
              <div className={s.beforeAfterBlock}>
                <span className={s.beforeAfterBadge}>Önce</span>
                <p>Müşteri paneli projesinde görev aldım, React kullandım.</p>
              </div>
              <div className={`${s.beforeAfterBlock} ${s.beforeAfterNew}`}>
                <span className={`${s.beforeAfterBadge} ${s.beforeAfterBadgeNew}`}>Sonra</span>
                <p>
                  <span className="rounded bg-brand-green/20 px-0.5">React ve TypeScript ile</span> müşteri{" "}
                  <span className="rounded bg-brand-green/20 px-0.5">panelini geliştirdim.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Hero'da pencerenin kenarından taşan kart: uydurma kontrolünün yakaladığı madde. */
export function HeroCheck() {
  return (
    <div className={`${s.mock} ${s.heroCheck}`}>
      <span className="inline-block rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">
        Kontrol et
      </span>
      <p className={s.warningText}>
        <span className="text-muted line-through">Stajyerlerin uyumuna destek oldum.</span>{" "}
        <span className="rounded bg-brand-green/20 px-0.5">4 kişilik ekibe liderlik ettim.</span>
      </p>
      <p className="mt-1.5 text-sm text-brand-amber">
        Orijinal maddede “liderlik” ve “4 kişi” geçmiyor. Bu ifade deneyimini abartıyor olabilir.
      </p>
      <div className={s.warningButtons}>
        <span className={s.fakeSecondary}>Eski hâli kalsın</span>
        <span className={s.fakePrimary}>Yeni hâlini kullan</span>
      </div>
    </div>
  )
}

/** Gereksinim listesi: her eşleşme CV'deki kanıtıyla birlikte. */
export function RequirementList() {
  const rows: { text: string; state: "matched" | "missing"; evidence?: string; importance: string }[] = [
    { text: "React ile arayüz geliştirme", state: "matched", evidence: "“…React kullandım” · Deneyim", importance: "Zorunlu" },
    { text: "TypeScript", state: "matched", evidence: "Beceriler bölümü", importance: "Zorunlu" },
    { text: "Birim testi (Jest, Testing Library)", state: "missing", importance: "Zorunlu" },
    { text: "Web erişilebilirliği (WCAG)", state: "missing", importance: "Tercihen" },
    { text: "Ekiple kod incelemesi", state: "matched", evidence: "“Haftalık kod incelemelerine katıldım” · Deneyim", importance: "Tercihen" },
  ]
  return (
    <div className={`${s.mock} ${s.mockWide}`}>
      <div className={s.mockTop}>
        <div>
          <p className={s.mockLabel}>İlan gereksinimleri</p>
          <p className={s.mockTitle}>5 gereksinimden 3'ü karşılanıyor</p>
        </div>
        <ScoreRing sizePx={72} />
      </div>
      <ul className={s.requirements}>
        {rows.map((g) => (
          <li key={g.text}>
            <span className={g.state === "matched" ? s.statusMatched : s.statusMissing}>
              <Icon name={g.state === "matched" ? "check" : "x"} size={14} />
            </span>
            <div>
              <p className={s.requirementText}>
                {g.text} <span className={s.importance}>{g.importance}</span>
              </p>
              <p className={s.mockSmall}>{g.evidence ?? "CV'nde karşılığı bulunamadı"}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Önce/sonra: eklenen yeşil vurgulu, çıkarılan üstü çizili gri (rehber §9.5). */
export function BeforeAfter() {
  return (
    <div className={`${s.mock} ${s.mockWide}`}>
      <p className={s.mockLabel}>Deneyim · Acme Yazılım · 2. madde</p>
      <div className={s.beforeAfter}>
        <div className={s.beforeAfterBlock}>
          <span className={s.beforeAfterBadge}>Önce</span>
          <p>Müşteri paneli projesinde görev aldım, React kullandım.</p>
        </div>
        <div className={s.beforeAfterArrow}>
          <Icon name="ok" size={18} />
        </div>
        <div className={`${s.beforeAfterBlock} ${s.beforeAfterNew}`}>
          <span className={`${s.beforeAfterBadge} ${s.beforeAfterBadgeNew}`}>Sonra</span>
          <p>
            <span className="rounded bg-brand-green/20 px-0.5">React ve TypeScript ile</span> müşteri{" "}
            <span className="text-muted line-through">paneli projesinde görev aldım, React kullandım.</span>{" "}
            <span className="rounded bg-brand-green/20 px-0.5">panelini geliştirdim.</span>
          </p>
        </div>
      </div>
      <div className={s.source}>
        <Icon name="eye" size={14} />
        Kaynak: Senin yazdığın madde ve Beceriler bölümün. Yeni olgu eklenmedi.
      </div>
    </div>
  )
}

/** Uydurma kontrolünün yakaladığı madde: karar verilmeden indirme kapalı. */
export function WarningCard() {
  return (
    <div className={`${s.mock} ${s.mockWide}`}>
      <span className="mb-1.5 inline-block rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">Kontrol et</span>
      <p className={s.warningText}>
        <span className="text-muted line-through">Stajyerlerin uyumuna destek oldum.</span>{" "}
        <span className="rounded bg-brand-green/20 px-0.5">4 kişilik ekibe liderlik ettim.</span>
      </p>
      <p className="mt-1.5 text-sm text-brand-amber">
        Orijinal maddede “liderlik” ve “4 kişi” geçmiyor. Bu ifade deneyimini abartıyor olabilir.
      </p>
      <div className={s.warningButtons}>
        <span className={s.fakeSecondary}>Eski hâli kalsın</span>
        <span className={s.fakePrimary}>Yeni hâlini kullan</span>
      </div>
      <div className={s.lockLine}>
        <Icon name="lock" size={14} />
        İşaretli maddelere karar verene kadar indirme kapalı.
      </div>
    </div>
  )
}

export function FileChips() {
  return (
    <div className={s.files}>
      <div className={s.file}>
        <span className={`${s.fileType} ${s.filePdf}`}>PDF</span>
        <div>
          <p className={s.fileName}>Ayse_Yilmaz_Frontend.pdf</p>
          <p className={s.mockSmall}>Metni seçilebilir · ATS okur</p>
        </div>
      </div>
      <div className={s.file}>
        <span className={`${s.fileType} ${s.fileDocx}`}>DOCX</span>
        <div>
          <p className={s.fileName}>Ayse_Yilmaz_Frontend.docx</p>
          <p className={s.mockSmall}>Word'de düzenlemeye devam et</p>
        </div>
      </div>
    </div>
  )
}
