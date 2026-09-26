/**
 * Giriş ekranının sağındaki görsel panel.
 *
 * Arkada ipeksi kurdeleler, önde CV'deki kavramların döndüğü bir yörünge ve
 * ortada skor halkası: ürünün ne yaptığını tek karede anlatıyor. Rakip
 * örneklerdeki kullanıcı yorumu kartı yerine slogan var — rehber §11 uydurma
 * yorumu yasaklıyor, gerçek yorum geldiğinde buraya konabilir.
 *
 * Tamamen dekoratif; ekran okuyucudan gizli.
 */

/** Yörüngedeki kavramlar: yarıçap (% kutu genişliği), açı (derece), durum. */
const KAVRAMLAR: { metin: string; r: number; aci: number; eksik?: boolean }[] = [
  { metin: "React", r: 25, aci: 200 },
  { metin: "TypeScript", r: 25, aci: 20 },
  { metin: "Jest", r: 25, aci: 110, eksik: true },
  { metin: "SQL", r: 37, aci: 250 },
  { metin: "Figma", r: 37, aci: 150, eksik: true },
  { metin: "REST API", r: 37, aci: 330 },
  { metin: "Takım çalışması", r: 48, aci: 60 },
  { metin: "CI/CD", r: 48, aci: 285, eksik: true },
]

const HALKALAR = [26, 50, 74, 96]

export function GirisGorseli() {
  return (
    <div
      aria-hidden="true"
      className="relative isolate h-full w-full overflow-hidden rounded-[28px] bg-gece"
    >
      {/* Zemin: mavinin iki tonu, köşede hafif mercan. */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(80%_60%_at_80%_10%,rgb(43_78_255/0.55),transparent_60%),radial-gradient(60%_50%_at_0%_100%,rgb(43_78_255/0.45),transparent_65%),radial-gradient(40%_30%_at_100%_100%,rgb(255_107_74/0.22),transparent_70%)]" />

      {/* Kurdeleler. Her biri dikeyde açık kenar → doygun orta → koyu alt
          geçişiyle ipek hacmi veriyor; uçlar maskeyle eriyor. */}
      <div className="absolute inset-[-30%] -z-10 [mask-image:linear-gradient(to_right,transparent,#000_20%,#000_80%,transparent)]">
        <div className="absolute left-[-10%] top-[14%] h-28 w-[130%] -rotate-30 rounded-full bg-[#8ea2ff]/50 blur-3xl motion-safe:animate-kurdele" />
        <div className="absolute left-[-10%] top-[30%] h-44 w-[130%] -rotate-30 rounded-[100%] bg-[linear-gradient(to_bottom,rgb(199_208_255/0.9),rgb(43_78_255)_30%,rgb(27_42_143)_75%,rgb(15_23_42/0.6))] blur-[2px] motion-safe:animate-kurdele motion-safe:[animation-duration:18s]" />
        <div className="absolute left-[-10%] top-[44%] h-1.5 w-[130%] -rotate-30 rounded-full bg-white/70 blur-[1px] motion-safe:animate-kurdele motion-safe:[animation-duration:11s]" />
        <div className="absolute left-[-10%] top-[50%] h-36 w-[130%] -rotate-30 rounded-[100%] bg-[linear-gradient(to_bottom,rgb(230_234_255/0.85),rgb(91_115_255)_28%,rgb(43_78_255)_55%,rgb(255_107_74/0.55)_85%,transparent)] blur-[2px] motion-safe:animate-kurdele motion-safe:[animation-duration:22s]" />
        <div className="absolute left-[-10%] top-[66%] h-24 w-[130%] -rotate-30 rounded-[100%] bg-[linear-gradient(to_bottom,rgb(199_208_255/0.6),rgb(43_78_255/0.8)_40%,rgb(15_23_42/0.4))] blur-[3px] motion-safe:animate-kurdele motion-safe:[animation-duration:16s]" />
        <div className="absolute left-[-10%] top-[80%] h-32 w-[130%] -rotate-30 rounded-full bg-mercan/25 blur-3xl motion-safe:animate-kurdele motion-safe:[animation-duration:20s]" />
      </div>

      {/* Kurdeleleri koyulaştıran perde: önde duran içerik okunaklı kalsın. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gece/20 via-gece/45 to-gece/75" />

      {/* Yörünge. */}
      <div className="absolute left-1/2 top-[42%] aspect-square w-[92%] max-w-[560px] -translate-x-1/2 -translate-y-1/2">
        {HALKALAR.map((b) => (
          <div
            key={b}
            className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            style={{ width: `${b}%` }}
          />
        ))}

        <div className="absolute inset-0 motion-safe:animate-yorunge">
          {KAVRAMLAR.map((k) => {
            const rad = (k.aci * Math.PI) / 180
            return (
              <div
                key={k.metin}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 + k.r * Math.cos(rad)}%`, top: `${50 + k.r * Math.sin(rad)}%` }}
              >
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md motion-safe:animate-yorunge-ters ${
                    k.eksik
                      ? "border-white/15 bg-white/5 text-white/60"
                      : "border-white/25 bg-white/15 text-white"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${k.eksik ? "bg-mercan" : "bg-[#4ade80]"}`}
                  />
                  {k.metin}
                </span>
              </div>
            )
          })}
        </div>

        {/* Merkez: skor halkası. */}
        <div className="absolute left-1/2 top-1/2 grid size-[22%] min-w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/10 shadow-[0_0_60px_rgb(43_78_255/0.6)] ring-1 ring-white/20 backdrop-blur-md">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#4ade80"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44 * 0.72} ${2 * Math.PI * 44}`}
            />
          </svg>
          <div className="text-center leading-none">
            <div className="font-baslik text-3xl font-extrabold tracking-tight text-white">72</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#4ade80]">
              Yüksek
            </div>
          </div>
        </div>
      </div>

      {/* Alt kart: slogan. */}
      <div className="absolute inset-x-6 bottom-6 sm:inset-x-10 sm:bottom-10 motion-safe:animate-yuzme">
        <div className="max-w-sm rounded-kart border border-white/20 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-xl">
          <p className="font-baslik text-xl font-extrabold tracking-tight">
            Aynı deneyim, doğru anlatım.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            CV&apos;ni her ilana göre uyarla. Olmayan hiçbir şey eklenmez, her değişikliği sen
            onaylarsın.
          </p>
        </div>
      </div>
    </div>
  )
}
