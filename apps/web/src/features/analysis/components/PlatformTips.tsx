import { ExternalLink } from "lucide-react"
import { PLATFORMS, type PlatformId } from "@/features/analysis/platforms"

/**
 * İlanın platformuna özel başvuru ipuçları (DOG-95). Her ipucunun kaynağı
 * yanında; kullanıcı kendisi de doğrulayabilsin.
 */
export function PlatformTips({ platform }: { platform: PlatformId | null | undefined }) {
  const info = platform ? PLATFORMS[platform] : null
  if (!info) return null
  return (
    <section aria-label={`${info.name} için ipuçları`} className="rounded-card border border-border bg-card p-5">
      <h2 className="m-0 text-base">Bu ilan {info.name} üzerinden</h2>
      <ul className="mt-3 space-y-2.5 pl-5 text-sm">
        {info.tips.map((tip, i) => (
          <li key={i}>
            {tip.text}{" "}
            <a
              href={tip.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs whitespace-nowrap text-muted"
            >
              Kaynak: {tip.source.label}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
