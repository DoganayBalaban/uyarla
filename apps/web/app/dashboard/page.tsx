import { prisma } from "@uyarla/db"
import { ArrowRight, CircleCheck, FilePen, Inbox, ListChecks, Plus } from "lucide-react"
import { redirect } from "next/navigation"
import { sonucAdresi } from "@/lib/aktifAnaliz"
import { getSession } from "@/lib/authz"
import { cn } from "@/lib/cn"
import { type Bekleyen, type BekleyenTuru, ozetle } from "@/lib/dashboard"
import { girisAdresi } from "@/lib/donus"
import { ASAMALAR, ASAMA_ETIKETI, ASAMA_RENGI, type Asama, PANO_SECIMI, panoKarti } from "@/lib/pano"
import { skorDurumu } from "@/lib/skor"
import { SayfaBasligi, SayfaKabi } from "../components/Sayfa"

export const metadata = { title: "Genel bakış · uyarla" }

/**
 * Kayıtlı kullanıcının ana ekranı. Tanıtım sayfası kayıtlı kullanıcıyı buraya
 * yönlendiriyor; logo da buraya götürüyor.
 *
 * Soru şu: "Şimdi ne yapmalıyım?" Önce seni bekleyen işler, sonra son
 * analizlerin, yanda başvuruların nerede durduğu. Sayılar yalnızca
 * kullanıcının kendi verisinden (rehber §11).
 */
export default async function DashboardPage() {
  const oturum = await getSession()
  // Anonim oturumun panosu yok; işleri kayıt olunca hesaba taşınıyor.
  if (!oturum || oturum.user.isAnonymous) redirect(girisAdresi("/dashboard"))

  const [kullanici, satirlar] = await Promise.all([
    prisma.user.findUnique({ where: { id: oturum.user.id }, select: { name: true } }),
    prisma.analysis.findMany({
      where: { userId: oturum.user.id, status: "done" },
      orderBy: { createdAt: "desc" },
      select: PANO_SECIMI,
    }),
  ])
  const ozet = ozetle(satirlar.map(panoKarti))

  // Ad yoksa ya da e-postanın kendisiyse selamda kullanılmıyor.
  const ad = kullanici?.name?.trim()
  const selam = ad && !ad.includes("@") ? `Merhaba, ${ad.split(" ")[0]}.` : "Merhaba."

  const yeniAnaliz = (
    <a
      href="/analyze"
      className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white no-underline shadow-sm shadow-mavi/30 transition hover:bg-mavi/90"
    >
      <Plus className="size-4" aria-hidden />
      Yeni analiz
    </a>
  )

  if (ozet.toplam === 0) {
    return (
      <SayfaKabi genislik="genis">
        <SayfaBasligi baslik={selam} aciklama="Burası senin ana ekranın. İlk analizinden sonra dolmaya başlar." />
        <div className="rounded-kart border border-dashed border-cizgi bg-kart p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="m-0 mt-4 font-baslik text-xl font-extrabold">Henüz analiz yok.</p>
          <p className="mt-2 text-gri">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <a
            href="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
          >
            İlk analizini yap
          </a>
        </div>
      </SayfaKabi>
    )
  }

  return (
    <SayfaKabi genislik="genis">
      <SayfaBasligi
        baslik={selam}
        aciklama={
          ozet.bekleyenler.length > 0 ? "Kaldığın yerden devam et." : "Bekleyen bir işin yok. Yeni bir ilana bakalım mı?"
        }
        eylem={yeniAnaliz}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {ozet.bekleyenler.length > 0 && <Bekleyenler liste={ozet.bekleyenler} />}
          <SonAnalizler kartlar={ozet.sonAnalizler} toplam={ozet.toplam} />
        </div>
        <Basvurular sayilar={ozet.asamaSayilari} toplam={ozet.toplam} />
      </div>
    </SayfaKabi>
  )
}

const BEKLEYEN_METNI: Record<BekleyenTuru, { metin: string; eylem: string; Ikon: typeof ListChecks }> = {
  karar: { metin: "Kararını bekleyen maddeler var", eylem: "Karar ver", Ikon: ListChecks },
  hazir: { metin: "CV'n hazır, henüz başvurmadın", eylem: "CV'ni gör", Ikon: CircleCheck },
  uyarla: { metin: "Skorunu aldın, CV'ni uyarlamadın", eylem: "Uyarla", Ikon: FilePen },
}

function Bekleyenler({ liste }: { liste: Bekleyen[] }) {
  return (
    <section aria-labelledby="bekleyenler" className="rounded-kart border border-cizgi bg-kart">
      <h2 id="bekleyenler" className="m-0 px-5 pt-4 pb-3 text-base font-bold">
        Seni bekleyenler
      </h2>
      <ul className="m-0 list-none divide-y divide-cizgi border-t border-cizgi p-0">
        {liste.map((b) => {
          const { metin, eylem, Ikon } = BEKLEYEN_METNI[b.tur]
          return (
            <li key={b.analysisId}>
              <a
                href={b.adres}
                className="group flex items-center gap-4 px-5 py-3.5 text-metin no-underline transition-colors hover:bg-zemin"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-buton",
                    b.tur === "karar" ? "bg-kehribar/15 text-kehribar" : "bg-mavi/10 text-mavi",
                  )}
                >
                  <Ikon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.pozisyon}</span>
                  <span className="block text-sm text-gri">{metin}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-mavi sm:inline-flex">
                  {eylem}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const TARIH = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

function SonAnalizler({ kartlar, toplam }: { kartlar: ReturnType<typeof ozetle>["sonAnalizler"]; toplam: number }) {
  return (
    <section aria-labelledby="son-analizler" className="rounded-kart border border-cizgi bg-kart">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-3">
        <h2 id="son-analizler" className="m-0 text-base font-bold">
          Son analizler
        </h2>
        {toplam > kartlar.length && (
          <a href="/applications" className="text-sm font-semibold text-mavi no-underline hover:underline">
            Tümü ({toplam})
          </a>
        )}
      </div>
      <ul className="m-0 list-none divide-y divide-cizgi border-t border-cizgi p-0">
        {kartlar.map((k) => {
          const durum = k.skor === null ? null : skorDurumu(k.skor)
          return (
            <li key={k.analysisId}>
              <a
                href={sonucAdresi(k.analysisId)}
                className="flex items-center gap-4 px-5 py-3.5 text-metin no-underline transition-colors hover:bg-zemin"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{k.pozisyon}</span>
                  <span className="block text-sm text-gri">
                    {TARIH.format(new Date(k.olusturulma))} · {ASAMA_ETIKETI[k.asama]}
                  </span>
                </span>
                {durum && k.skor !== null && (
                  <span
                    className={cn("shrink-0 rounded-buton px-2.5 py-1 text-right", durum.zemin)}
                    title={durum.etiket}
                  >
                    <span className={cn("block font-baslik text-lg leading-none font-extrabold tabular-nums", durum.renk)}>
                      {k.skor}
                    </span>
                    <span className={cn("block text-[0.6875rem] font-semibold", durum.renk)}>{durum.etiket}</span>
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Basvurular({ sayilar, toplam }: { sayilar: Record<Asama, number>; toplam: number }) {
  return (
    <section aria-labelledby="basvurular" className="rounded-kart border border-cizgi bg-kart p-5">
      <h2 id="basvurular" className="m-0 text-base font-bold">
        Başvuruların
      </h2>
      <p className="m-0 mt-1 text-sm text-gri">{toplam} ilan, aşamalarına göre.</p>

      {/* Dağılım çubuğu: her aşama payı kadar. Sayılar aşağıdaki listede
          yazılı; çubuk yalnızca göz için, ekran okuyucudan gizli. */}
      <div aria-hidden className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zemin">
        {ASAMALAR.filter((a) => sayilar[a] > 0).map((a) => (
          <span key={a} className={ASAMA_RENGI[a]} style={{ flexGrow: sayilar[a] }} />
        ))}
      </div>

      <dl className="m-0 mt-4 space-y-2">
        {ASAMALAR.map((a) => (
          <div key={a} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={cn("size-2.5 rounded-full", ASAMA_RENGI[a])} />
            <dt className="flex-1 text-gri">{ASAMA_ETIKETI[a]}</dt>
            <dd className="m-0 font-semibold tabular-nums">{sayilar[a]}</dd>
          </div>
        ))}
      </dl>

      <a
        href="/applications"
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-mavi no-underline hover:underline"
      >
        Panoya git
        <ArrowRight className="size-4" aria-hidden />
      </a>
    </section>
  )
}
