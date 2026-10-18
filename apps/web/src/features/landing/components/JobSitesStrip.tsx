import { JOB_SITES, JOB_SITES_TITLE } from "@/features/landing/jobSites"
import s from "@/features/landing/landing.module.css"

/** Hero'nun altında ilan siteleri (DOG-83): gri, tıklanamaz adlar. */
export function JobSitesStrip() {
  return (
    <section aria-label="İlan siteleri" className="py-8">
      <div className={s.container}>
        <p className="text-center text-sm text-muted">{JOB_SITES_TITLE}</p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {JOB_SITES.map((site) => (
            <li key={site.name} className="text-xl font-bold tracking-tight text-foreground/35 select-none sm:text-2xl">
              {site.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
