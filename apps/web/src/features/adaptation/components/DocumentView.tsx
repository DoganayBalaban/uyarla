"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Check, Plus } from "lucide-react"
import { cn } from "@/lib/cn"
import { DiffText } from "@/features/adaptation/components/DiffText"
import { documentSections, type DocumentLine } from "@/features/adaptation/documentView"
import { HighlightedText } from "@/features/adaptation/components/HighlightedText"
import { termCoverage, type PostingTerm } from "@/features/adaptation/postingTerms"
import type { DocumentOutline, Draft, SectionKind } from "@/features/adaptation/types"
import type { BulletOp, BulletWhere, SectionOp } from "@/features/adaptation/api"

type Mode = "diff" | "after" | "before"

/** Sunucudaki sınırla aynı (core/adapt/edit.ts); core istemci paketine çekilmesin. */
const EDIT_MAX_LENGTH = 1000

const MODES: { mode: Mode; label: string }[] = [
  { mode: "diff", label: "Farklar" },
  { mode: "after", label: "Sonra" },
  { mode: "before", label: "Önce" },
]

/**
 * CV'nin tamamı, deneyim bazında (DOG-93). "Değişiklikler" görünümü maddeleri
 * bağlamsız listeliyor ("Madde 3"); burada her madde kendi işinin altında.
 *
 * "Sonra" indirilecek belgenin aynısı: sunucu indirmenin kullandığı
 * applyAdaptation ile üretiyor. Karar bekleyen maddeler orada da eski hâliyle
 * duruyor, burada ayrıca işaretleniyor.
 */
export function DocumentView({
  document,
  draft,
  onRestore,
  onBullet,
  onSection,
  busy = false,
  terms = [],
}: {
  document: { before: DocumentOutline; after: DocumentOutline }
  /** İlan terimleri (DOG-92): vurgu ve belgede geçmeyen zorunlular. */
  terms?: readonly PostingTerm[]
  draft: Pick<Draft, "bullets" | "omitted" | "removed" | "userBullets" | "userSections">
  /** Tek sayfa için çıkarılan ya da kaldırılan maddeyi geri alır (DOG-93, DOG-92). */
  onRestore?: (bulletId: string) => void
  /** Madde ekle, kaldır, taşı (DOG-92); hata mesajı ya da null. */
  onBullet?: (op: BulletOp) => Promise<string | null>
  /** Bölüm sırası, bölüm ekle ya da sil (DOG-92). */
  onSection?: (op: SectionOp) => Promise<string | null>
  busy?: boolean
}) {
  const [mode, setMode] = useState<Mode>("diff")
  const [highlight, setHighlight] = useState(false)
  const s = documentSections(document, draft)
  // Kullanıcının yazdığı maddenin kontrolü (DOG-92): uyarı var, engel yok.
  const flaggedUser = new Set((draft.userBullets ?? []).filter((u) => u.verification.status === "flagged").map((u) => u.id))
  const editable = !!onBullet && mode !== "before"
  const flaggedSections = new Set((draft.userSections ?? []).filter((x) => x.verification.status === "flagged").map((x) => x.id))
  // Bölümler belgedeki sırayla (DOG-92); eski yanıtlarda varsayılan sıra.
  const order: SectionKind[] = (mode === "before" ? document.before.sectionOrder : document.after.sectionOrder) ?? [
    "experience",
    "projects",
    "education",
    "skills",
  ]
  const hiddenKeys = new Set(mode === "before" ? [] : (document.after.hiddenSections ?? []))
  const educationRows = (mode === "before" ? document.before.education : document.after.education) ?? []
  const present: SectionKind[] = order.filter(
    (k) =>
      !hiddenKeys.has(k) &&
      (k === "experience"
        ? s.experience.length > 0
        : k === "projects"
          ? s.projects.length > 0
          : k === "skills"
            ? s.skills.length > 0 || languages.length > 0 || certifications.length > 0
            : educationRows.length > 0),
  )
  const titleOf = (k: string) =>
    (mode === "before" ? document.before.sectionTitles : document.after.sectionTitles)?.[k] ?? SECTION_LABEL[k as SectionKind] ?? k
  const languages = (mode === "before" ? document.before.languages : document.after.languages) ?? []
  const certifications = (mode === "before" ? document.before.certifications : document.after.certifications) ?? []
  // Maddenin taşınabileceği yerler (DOG-92): görünen işler ve projeler.
  const targets: Array<{ label: string; where: BulletWhere }> = [
    ...(hiddenKeys.has("experience") ? [] : s.experience.map((j, i) => ({ label: [j.title, j.company].filter(Boolean).join(" · "), where: { experienceIndex: i } }))),
    ...(hiddenKeys.has("projects") ? [] : s.projects.map((p, i) => ({ label: `Proje: ${p.name}`, where: { projectIndex: i } }))),
  ]
  const header = (key: string, title: string, options: { user?: boolean } = {}) => (
    <SectionHeader
      sectionKey={key}
      title={title}
      hidden={hiddenKeys.has(key)}
      user={options.user ?? false}
      busy={busy}
      onSection={onSection && mode !== "before" ? onSection : undefined}
    />
  )
  const bulletList = (bullets: DocumentLine[], where: BulletWhere) => (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      {bullets.map((b, j) => (
        <BulletItem
          key={b.id ?? j}
          line={b}
          mode={mode}
          text={text}
          onRestore={onRestore}
          flagged={b.id !== null && flaggedUser.has(b.id)}
          controls={
            editable && b.id && !b.removed && !b.omitted ? (
              <BulletControls
                id={b.id}
                where={where}
                targets={targets}
                first={j === 0}
                last={j === bullets.length - 1}
                userWritten={b.userWritten}
                busy={busy}
                onBullet={onBullet!}
              />
            ) : null
          }
        />
      ))}
    </ul>
  )
  const shown = (t: string) => (highlight ? <HighlightedText text={t} terms={terms} /> : t)

  const text = (l: DocumentLine) =>
    mode === "diff" && l.changed ? (
      <DiffText original={l.before} rewritten={l.after} />
    ) : (
      <p className="m-0 leading-relaxed">{shown(mode === "before" ? l.before : l.after)}</p>
    )

  // Kapsama seçili hâlin metninden ("Farklar"da yeni hâl).
  const outline = mode === "before" ? document.before : document.after
  const lines = [
    outline.headline,
    outline.summary,
    ...outline.experience.flatMap((e) => [e.title, ...e.bullets]),
    ...(outline.projects ?? []).flatMap((p) => [p.name, ...p.bullets]),
    ...(outline.otherSections ?? []).flatMap((o) => o.lines),
    ...(outline.skills ?? []),
  ].filter((x): x is string => !!x)
  const coverage = terms.length ? termCoverage(lines, terms) : null
  const missingMust = coverage?.missing.filter((t) => t.must) ?? []

  const experienceBlock = s.experience.length > 0 && (
    <div key="experience">
      {header("experience", titleOf("experience"))}
      {!hiddenKeys.has("experience") && (
      <div className="space-y-5">
        {s.experience.map((job, i) => (
          <div key={i}>
            <p className="m-0 font-semibold">
              {job.title}
              {job.company && <span className="font-normal text-muted-foreground"> · {job.company}</span>}
            </p>
            {job.dates && <p className="m-0 text-xs text-muted-foreground">{job.dates}</p>}
            {bulletList(job.bullets, { experienceIndex: i })}
            {editable && <AddBullet where={{ experienceIndex: i }} busy={busy} onBullet={onBullet!} />}
          </div>
        ))}
      </div>
      )}
    </div>
  )
  const projectsBlock = s.projects.length > 0 && (
    <div key="projects">
      {header("projects", titleOf("projects"))}
      {!hiddenKeys.has("projects") && (
      <div className="space-y-5">
        {s.projects.map((p, i) => (
          <div key={i}>
            <p className="m-0 font-semibold">
              {p.name}
              {p.role && <span className="font-normal text-muted-foreground"> · {p.role}</span>}
            </p>
            {p.dates && <p className="m-0 text-xs text-muted-foreground">{p.dates}</p>}
            {p.bullets.length > 0 && bulletList(p.bullets, { projectIndex: i })}
            {editable && <AddBullet where={{ projectIndex: i }} busy={busy} onBullet={onBullet!} />}
          </div>
        ))}
      </div>
      )}
    </div>
  )
  const educationBlock = educationRows.length > 0 && (
    <div key="education">
      {header("education", titleOf("education"))}
      {!hiddenKeys.has("education") && (
        <div className="space-y-2">
          {educationRows.map((e, i) => (
            <div key={i}>
              <p className="m-0 font-semibold">
                {e.school}
                {e.detail && <span className="font-normal text-muted-foreground"> · {e.detail}</span>}
              </p>
              {e.dates && <p className="m-0 text-xs text-muted-foreground">{e.dates}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
  // Beceriler, ardından diller ve sertifikalar: belgede aynı yerde (document/model).
  const skillsBlock = (s.skills.length > 0 || languages.length > 0 || certifications.length > 0) && (
    <div key="skills" className="flex flex-col gap-6">
      {s.skills.length > 0 && (
    <div>
      {header("skills", titleOf("skills"))}
      {!hiddenKeys.has("skills") && (
      <ul className="flex flex-wrap gap-1.5">
        {(mode === "before" ? document.before.skills.map((name) => ({ name, added: false })) : s.skills).map((k) => (
          <li
            key={k.name}
            className={cn(
              "rounded-full border px-2.5 py-0.5",
              mode === "diff" && k.added ? "border-brand-green/40 bg-brand-green/15" : "border-border bg-card",
            )}
          >
            {shown(k.name)}
          </li>
        ))}
      </ul>
      )}
    </div>
      )}
      {languages.length > 0 && (
        <div>
          {header("languages", titleOf("languages"))}
          {!hiddenKeys.has("languages") && <p className="m-0 leading-relaxed">{shown(languages.join(", "))}</p>}
        </div>
      )}
      {certifications.length > 0 && (
        <div>
          {header("certifications", titleOf("certifications"))}
          {!hiddenKeys.has("certifications") &&
            certifications.map((c, i) => (
              <p key={i} className="m-0 leading-relaxed">
                {shown(c)}
              </p>
            ))}
        </div>
      )}
    </div>
  )

  return (
    <section className="rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg">Belge</h2>
        <div role="radiogroup" aria-label="Belgenin hangi hâli" className="inline-flex rounded-button bg-background p-1 text-sm">
          {MODES.map((m) => {
            const selected = mode === m.mode
            return (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-semibold transition",
                  selected ? "bg-card text-brand-blue shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "diff"
          ? "İndireceğin CV, değişen yerler işaretli."
          : mode === "after"
            ? "İndireceğin CV, seçtiğin hâllerle."
            : "Yüklediğin CV, uyarlamadan önce."}
      </p>
      {coverage && (
        <div className="mt-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} className="size-4 accent-brand-blue" />
            İlanın terimlerini vurgula
          </label>
          <p className="m-0 mt-1 text-muted-foreground">
            İlanın {coverage.found.length + coverage.missing.length} teriminden {coverage.found.length} tanesi bu hâlde geçiyor.
            {missingMust.length > 0 && (
              <>
                {" "}
                Geçmeyen zorunlular: <span className="text-foreground">{missingMust.map((t) => t.term).join(", ")}</span>. Deneyiminde
                varsa görünür kıl; yoksa eklemiyoruz.
              </>
            )}
          </p>
        </div>
      )}

      {onSection && mode !== "before" && present.length > 1 && (
        <SectionOrder order={present} busy={busy} onSection={onSection} />
      )}

      <div className="mt-5 flex flex-col gap-6 rounded-button border border-border bg-background/60 p-4 text-sm sm:p-6">
        {s.headline && <p className="m-0 font-semibold text-muted-foreground">{s.headline}</p>}

        {s.summary && (
          <div>
            <h3 className="m-0 mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">Özet</h3>
            {text(s.summary)}
          </div>
        )}

        {order.map((k) =>
          k === "experience" ? experienceBlock : k === "projects" ? projectsBlock : k === "skills" ? skillsBlock : educationBlock,
        )}

        {(mode === "before" ? (document.before.otherSections ?? []) : (document.after.otherSections ?? [])).map((o, i) => (
          <div key={i}>
            {o.key ? header(o.key, o.heading, { user: !!o.id }) : (
              <h3 className="m-0 mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">{o.heading}</h3>
            )}
            {o.key && hiddenKeys.has(o.key) ? null : (
            <>
            {o.id && mode !== "before" && (
              <p className={cn("m-0 mb-1 text-xs", flaggedSections.has(o.id) ? "font-medium text-brand-amber" : "text-muted-foreground")}>
                {flaggedSections.has(o.id)
                  ? "Senin bölümün; CV'nde olmayan bir sayı ya da ilan terimi var, kontrol et."
                  : "Senin bölümün."}
              </p>
            )}
            {o.lines.map((l, j) => (
              <p key={j} className="m-0 leading-relaxed">
                {shown(l)}
              </p>
            ))}
            </>
            )}
          </div>
        ))}
        {onSection && mode !== "before" && <AddSection busy={busy} onSection={onSection} />}
      </div>
    </section>
  )
}

function BulletItem({
  line,
  mode,
  text,
  onRestore,
  flagged = false,
  controls = null,
}: {
  line: DocumentLine
  mode: Mode
  text: (l: DocumentLine) => React.ReactNode
  onRestore?: (bulletId: string) => void
  flagged?: boolean
  controls?: React.ReactNode
}) {
  // Kullanıcının kaldırdığı madde (DOG-92): tek sayfa çıkarımı gibi.
  if (line.removed && mode !== "before") {
    return (
      <li className="text-muted-foreground">
        <p className="m-0 leading-relaxed line-through decoration-muted-foreground/60">{line.after}</p>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          Belgeden kaldırdın.
          {onRestore && line.id && (
            <button type="button" onClick={() => onRestore(line.id!)} className="font-semibold text-brand-blue underline-offset-2 hover:underline">
              Geri al
            </button>
          )}
        </span>
      </li>
    )
  }
  // Tek sayfa için çıkarılan madde (DOG-93): "Önce"de olduğu gibi, diğer
  // kiplerde üstü çizili ve geri alınabilir.
  if (line.omitted && mode !== "before") {
    return (
      <li className="text-muted-foreground">
        <p className="m-0 leading-relaxed line-through decoration-muted-foreground/60">{line.after}</p>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          Tek sayfa için çıkarıldı.
          {onRestore && line.id && (
            <button
              type="button"
              onClick={() => onRestore(line.id!)}
              className="font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Geri al
            </button>
          )}
        </span>
      </li>
    )
  }
  if (mode === "before" && !line.before) return null
  return (
    <li>
      {text(line)}
      {line.userWritten && mode !== "before" && (
        <span className={cn("mt-0.5 block text-xs", flagged ? "font-medium text-brand-amber" : "text-muted-foreground")}>
          {flagged
            ? "Senin maddenin; CV'nde olmayan bir sayı ya da ilan terimi var, kontrol et: mülakatta anlatabileceğin bir şey olmalı."
            : "Senin maddenin."}
        </span>
      )}
      {controls}
      {line.pending && mode !== "before" && (
        <span className="mt-0.5 block text-xs font-medium text-brand-blue">
          Karar bekliyor; yeni hâlini seçmezsen bu madde eski hâliyle kalır.
        </span>
      )}
    </li>
  )
}

/** Maddeyi taşı ya da kaldır (DOG-92). */
function BulletControls({
  id,
  where,
  targets,
  first,
  last,
  userWritten,
  busy,
  onBullet,
}: {
  id: string
  where: BulletWhere
  /** Taşınabileceği yerler; kendi yeri listede ama seçilemiyor. */
  targets: Array<{ label: string; where: BulletWhere }>
  first: boolean
  last: boolean
  userWritten: boolean
  busy: boolean
  onBullet: (op: BulletOp) => Promise<string | null>
}) {
  const small = "inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
      <button type="button" disabled={busy || first} onClick={() => void onBullet({ op: "move", id, direction: "up", ...where })} className={small} aria-label="Yukarı taşı">
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
      <button type="button" disabled={busy || last} onClick={() => void onBullet({ op: "move", id, direction: "down", ...where })} className={small} aria-label="Aşağı taşı">
        <ArrowDown className="size-3.5" aria-hidden />
      </button>
      <button type="button" disabled={busy} onClick={() => void onBullet({ op: "remove", id })} className={small}>
        {userWritten ? "Sil" : "Kaldır"}
      </button>
      {targets.length > 1 && (
        <select
          aria-label="Başka yere taşı"
          disabled={busy}
          value=""
          onChange={(e) => {
            const target = targets[Number(e.target.value)]
            if (target) void onBullet({ op: "relocate", id, ...target.where })
          }}
          className="w-auto max-w-44 rounded border border-border bg-card px-1 py-0.5 text-xs text-muted-foreground"
        >
          <option value="">Başka yere taşı…</option>
          {targets.map((t, k) => (
            <option key={k} value={k} disabled={JSON.stringify(t.where) === JSON.stringify(where)}>
              {t.label}
            </option>
          ))}
        </select>
      )}
    </span>
  )
}

/** İşe kullanıcının yazdığı bir madde ekler (DOG-92). */
function AddBullet({
  where,
  busy,
  onBullet,
}: {
  where: BulletWhere
  busy: boolean
  onBullet: (op: BulletOp) => Promise<string | null>
}) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (text === null) {
    return (
      <button
        type="button"
        onClick={() => setText("")}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue"
      >
        <Plus className="size-3.5" aria-hidden />
        Madde ekle
      </button>
    )
  }
  return (
    <form
      className="mt-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        const message = await onBullet({ op: "add", text, ...where })
        if (message) setError(message)
        else {
          setText(null)
          setError(null)
        }
      }}
    >
      <textarea
        autoFocus
        rows={2}
        maxLength={EDIT_MAX_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Yeni madde"
        placeholder={"experienceIndex" in where ? "Bu işte yaptığın ve CV'nde yazmayan bir şey" : "Bu projede yaptığın ve CV'nde yazmayan bir şey"}
        className="w-full rounded-button border border-border bg-card p-2 text-sm"
      />
      <p className="m-0 text-xs text-muted-foreground">
        CV&apos;nde olmayan bir sayı ya da ilan terimi yazarsan &quot;kontrol et&quot; uyarısı çıkar; mülakatta anlatabileceğin
        bir şey olmalı.
      </p>
      {error && (
        <p role="alert" className="m-0 mt-1 text-xs text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={busy || !text.trim()} className="rounded-button bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          Ekle
        </button>
        <button type="button" onClick={() => setText(null)} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Vazgeç
        </button>
      </div>
    </form>
  )
}

const SECTION_LABEL: Record<SectionKind | "languages" | "certifications", string> = {
  experience: "Deneyim",
  projects: "Projeler",
  education: "Eğitim",
  skills: "Beceriler",
  languages: "Diller",
  certifications: "Sertifikalar",
}

/** Bölüm sırası (DOG-92): indirilecek belgede bölümlerin sırası. */
function SectionOrder({
  order,
  busy,
  onSection,
}: {
  order: SectionKind[]
  busy: boolean
  onSection: (op: SectionOp) => Promise<string | null>
}) {
  const small = "text-muted-foreground hover:text-foreground disabled:opacity-30"
  return (
    <div className="mt-3 text-sm">
      <p className="m-0 text-muted-foreground">Bölüm sırası:</p>
      <ol className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
        {order.map((k, i) => (
          <li key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
            <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
            {SECTION_LABEL[k]}
            <button type="button" disabled={busy || i === 0} onClick={() => void onSection({ op: "move", section: k, direction: "up" })} className={small} aria-label={`${SECTION_LABEL[k]} yukarı`}>
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button type="button" disabled={busy || i === order.length - 1} onClick={() => void onSection({ op: "move", section: k, direction: "down" })} className={small} aria-label={`${SECTION_LABEL[k]} aşağı`}>
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Kullanıcının kendi bölümünü ekler (DOG-92): gönüllü çalışmalar, ödüller… */
function AddSection({ busy, onSection }: { busy: boolean; onSection: (op: SectionOp) => Promise<string | null> }) {
  const [open, setOpen] = useState(false)
  const [heading, setHeading] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 self-start text-xs font-semibold text-brand-blue">
        <Plus className="size-3.5" aria-hidden />
        Bölüm ekle
      </button>
    )
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!heading.trim() || !text.trim()) return
        const message = await onSection({ op: "add", heading, text })
        if (message) setError(message)
        else {
          setOpen(false)
          setHeading("")
          setText("")
          setError(null)
        }
      }}
    >
      <input
        autoFocus
        value={heading}
        maxLength={60}
        onChange={(e) => setHeading(e.target.value)}
        aria-label="Bölüm başlığı"
        placeholder="Başlık: Gönüllü çalışmalar, Ödüller…"
        className="w-full rounded-button border border-border bg-card p-2 text-sm"
      />
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Bölümün satırları"
        placeholder="Her satır ayrı bir madde"
        className="mt-2 w-full rounded-button border border-border bg-card p-2 text-sm"
      />
      <p className="m-0 text-xs text-muted-foreground">Belgede diğer bölümlerin sonunda yer alır. En fazla 12 satır.</p>
      {error && (
        <p role="alert" className="m-0 mt-1 text-xs text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={busy || !heading.trim() || !text.trim()} className="rounded-button bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          Ekle
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Vazgeç
        </button>
      </div>
    </form>
  )
}

/**
 * Bölüm başlığı (DOG-92): yeniden adlandır, belgeden kaldır, geri al.
 * Kullanıcının kendi bölümü kaldırılınca siliniyor.
 */
function SectionHeader({
  sectionKey,
  title,
  hidden,
  user,
  busy,
  onSection,
}: {
  sectionKey: string
  title: string
  hidden: boolean
  user: boolean
  busy: boolean
  onSection?: (op: SectionOp) => Promise<string | null>
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const small = "text-xs font-normal tracking-normal normal-case text-muted-foreground hover:text-foreground disabled:opacity-40"
  if (renaming !== null && onSection) {
    return (
      <form
        className="mb-2 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const message = await onSection({ op: "rename", key: sectionKey, title: renaming })
          if (message) setError(message)
          else {
            setRenaming(null)
            setError(null)
          }
        }}
      >
        <input
          autoFocus
          value={renaming}
          maxLength={60}
          onChange={(e) => setRenaming(e.target.value)}
          aria-label="Bölümün yeni adı"
          className="rounded-button border border-border bg-card px-2 py-1 text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-button bg-brand-blue px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
          Kaydet
        </button>
        <button type="button" onClick={() => setRenaming(null)} className="text-xs font-semibold text-muted-foreground">
          Vazgeç
        </button>
        <span className="w-full text-xs text-muted-foreground">Boş bırakırsan varsayılan ada döner.</span>
        {error && (
          <span role="alert" className="w-full text-xs text-brand-red dark:text-[#f87171]">
            {error}
          </span>
        )}
      </form>
    )
  }
  return (
    <h3
      className={cn(
        "m-0 mb-2 flex flex-wrap items-center gap-x-3 text-xs font-bold tracking-wider uppercase",
        hidden ? "text-muted-foreground/60 line-through" : "text-muted-foreground",
      )}
    >
      {title}
      {onSection && hidden && (
        <span className="no-underline">
          <span className="text-xs font-normal tracking-normal normal-case">Belgeden kaldırdın. </span>
          <button type="button" disabled={busy} onClick={() => void onSection({ op: "restore", key: sectionKey })} className="text-xs font-semibold tracking-normal text-brand-blue normal-case">
            Geri al
          </button>
        </span>
      )}
      {onSection && !hidden && (
        <>
          <button type="button" disabled={busy} onClick={() => setRenaming(title)} className={small}>
            Adını değiştir
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSection(user ? { op: "remove", id: sectionKey } : { op: "hide", key: sectionKey })}
            className={small}
          >
            {user ? "Sil" : "Kaldır"}
          </button>
        </>
      )}
    </h3>
  )
}
