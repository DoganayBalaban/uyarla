"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowDown, ArrowUp, Ellipsis, GripVertical, MoveRight, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/cn"
import { DiffText } from "@/features/adaptation/components/DiffText"
import { documentSections, sectionMoves, type DocumentLine } from "@/features/adaptation/documentView"
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
            {editable && (
              <AddBullet
                where={{ experienceIndex: i }}
                place={[job.title, job.company].filter(Boolean).join(" · ")}
                busy={busy}
                onBullet={onBullet!}
              />
            )}
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
            {editable && <AddBullet where={{ projectIndex: i }} place={`Proje: ${p.name}`} busy={busy} onBullet={onBullet!} />}
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
    <section className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">Belge</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          aria-label="Belgenin hangi hâli"
        >
          {MODES.map((m) => (
            <ToggleGroupItem key={m.mode} value={m.mode} className="px-3">
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
          <Label className="inline-flex items-center gap-2 font-normal">
            <Checkbox checked={highlight} onCheckedChange={(v) => setHighlight(v === true)} />
            İlanın terimlerini vurgula
          </Label>
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

      <div className="mt-5 flex flex-col gap-6 rounded-lg border bg-background p-4 text-sm shadow-inner sm:p-6">
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
  const reducedMotion = useReducedMotion() ?? false
  // Kullanıcının kaldırdığı madde (DOG-92) ve tek sayfa için çıkarılan madde
  // (DOG-93): "Önce"de olduğu gibi, diğer kiplerde üstü çizili ve geri alınabilir.
  const out = mode !== "before" && (line.removed ? "Belgeden kaldırdın." : line.omitted ? "Tek sayfa için çıkarıldı." : null)
  if (out) {
    return (
      <li className="text-muted-foreground">
        <p className="m-0 leading-relaxed line-through decoration-muted-foreground/60">{line.after}</p>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          {out}
          {onRestore && line.id && (
            <Button type="button" variant="link" size="sm" onClick={() => onRestore(line.id!)} className="h-auto px-0 text-xs">
              Geri al
            </Button>
          )}
        </span>
      </li>
    )
  }
  if (mode === "before" && !line.before) return null
  return (
    // Taşınan madde yerine kayarak gidiyor (DOG-147).
    <motion.li layout={reducedMotion ? false : "position"} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{text(line)}</div>
        {controls}
      </div>
      {line.userWritten && mode !== "before" && (
        <span className={cn("mt-0.5 block text-xs", flagged ? "font-medium text-brand-amber" : "text-muted-foreground")}>
          {flagged
            ? "Senin maddenin; CV'nde olmayan bir sayı ya da ilan terimi var, kontrol et: mülakatta anlatabileceğin bir şey olmalı."
            : "Senin maddenin."}
        </span>
      )}
      {line.pending && mode !== "before" && (
        <span className="mt-0.5 block text-xs font-medium text-primary">
          Karar bekliyor; yeni hâlini seçmezsen bu madde eski hâliyle kalır.
        </span>
      )}
    </motion.li>
  )
}

/** Maddeyi taşı ya da kaldır (DOG-92); satırın menüsünde (DOG-147). */
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={busy} className="-my-0.5 size-6 shrink-0 text-muted-foreground" aria-label="Madde işlemleri">
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={first} onSelect={() => void onBullet({ op: "move", id, direction: "up", ...where })}>
          <ArrowUp aria-hidden /> Yukarı taşı
        </DropdownMenuItem>
        <DropdownMenuItem disabled={last} onSelect={() => void onBullet({ op: "move", id, direction: "down", ...where })}>
          <ArrowDown aria-hidden /> Aşağı taşı
        </DropdownMenuItem>
        {targets.length > 1 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MoveRight aria-hidden /> Başka yere taşı
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-w-72">
              {targets.map((t, k) => (
                <DropdownMenuItem
                  key={k}
                  disabled={JSON.stringify(t.where) === JSON.stringify(where)}
                  onSelect={() => void onBullet({ op: "relocate", id, ...t.where })}
                >
                  <span className="truncate">{t.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void onBullet({ op: "remove", id })}>
          <Trash2 aria-hidden /> {userWritten ? "Sil" : "Belgeden kaldır"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** İşe kullanıcının yazdığı bir madde ekler (DOG-92); diyalogda (DOG-147). */
function AddBullet({
  where,
  place,
  busy,
  onBullet,
}: {
  where: BulletWhere
  /** Diyalog başlığında: hangi işe ya da projeye. */
  place: string
  busy: boolean
  onBullet: (op: BulletOp) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setText("")
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0 text-xs">
          <Plus aria-hidden />
          Madde ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Madde ekle</DialogTitle>
          <DialogDescription>{place}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            const message = await onBullet({ op: "add", text, ...where })
            if (message) setError(message)
            else setOpen(false)
          }}
        >
          <Textarea
            autoFocus
            rows={3}
            maxLength={EDIT_MAX_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Yeni madde"
            placeholder={"experienceIndex" in where ? "Bu işte yaptığın ve CV'nde yazmayan bir şey" : "Bu projede yaptığın ve CV'nde yazmayan bir şey"}
          />
          <p className="m-0 text-xs text-muted-foreground">
            CV&apos;nde olmayan bir sayı ya da ilan terimi yazarsan &quot;kontrol et&quot; uyarısı çıkar; mülakatta anlatabileceğin
            bir şey olmalı.
          </p>
          {error && (
            <p role="alert" className="m-0 text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={busy || !text.trim()}>
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

/**
 * Bölüm sırası (DOG-92): indirilecek belgede bölümlerin sırası. Sürükle-bırak
 * ya da oklar (DOG-147); sunucu tek adımlık taşımayı biliyor, sürükleme
 * adımlara bölünüyor (sectionMoves).
 */
function SectionOrder({
  order,
  busy,
  onSection,
}: {
  order: SectionKind[]
  busy: boolean
  onSection: (op: SectionOp) => Promise<string | null>
}) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  async function drop(to: number) {
    const from = dragging
    setDragging(null)
    setOver(null)
    if (from === null) return
    for (const op of sectionMoves(order, from, to)) {
      if (await onSection(op)) break
    }
  }
  return (
    <div className="mt-4 text-sm">
      <p className="m-0 text-muted-foreground">Bölüm sırası · sürükleyerek ya da oklarla değiştir</p>
      <ol className="m-0 mt-1.5 flex list-none flex-wrap gap-2 p-0">
        {order.map((k, i) => (
          <li
            key={k}
            draggable={!busy}
            onDragStart={(e) => {
              setDragging(i)
              e.dataTransfer.effectAllowed = "move"
            }}
            onDragOver={(e) => {
              if (dragging === null) return
              e.preventDefault()
              setOver(i)
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              void drop(i)
            }}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            className={cn(
              "inline-flex cursor-grab items-center gap-1 rounded-full border bg-card py-1 pr-1.5 pl-2 text-xs transition-colors active:cursor-grabbing",
              dragging === i && "opacity-50",
              over === i && dragging !== i && "border-primary bg-primary/5",
            )}
          >
            <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
            {SECTION_LABEL[k]}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy || i === 0}
              onClick={() => void onSection({ op: "move", section: k, direction: "up" })}
              className="size-5 text-muted-foreground"
              aria-label={`${SECTION_LABEL[k]} yukarı`}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy || i === order.length - 1}
              onClick={() => void onSection({ op: "move", section: k, direction: "down" })}
              className="size-5 text-muted-foreground"
              aria-label={`${SECTION_LABEL[k]} aşağı`}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Kullanıcının kendi bölümünü ekler (DOG-92): gönüllü çalışmalar, ödüller… Diyalogda (DOG-147). */
function AddSection({ busy, onSection }: { busy: boolean; onSection: (op: SectionOp) => Promise<string | null> }) {
  const [open, setOpen] = useState(false)
  const [heading, setHeading] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setHeading("")
          setText("")
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start border-dashed">
          <Plus aria-hidden />
          Bölüm ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bölüm ekle</DialogTitle>
          <DialogDescription>Belgede diğer bölümlerin sonunda yer alır. En fazla 12 satır.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!heading.trim() || !text.trim()) return
            const message = await onSection({ op: "add", heading, text })
            if (message) setError(message)
            else setOpen(false)
          }}
        >
          <Input
            autoFocus
            value={heading}
            maxLength={60}
            onChange={(e) => setHeading(e.target.value)}
            aria-label="Bölüm başlığı"
            placeholder="Başlık: Gönüllü çalışmalar, Ödüller…"
          />
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Bölümün satırları"
            placeholder="Her satır ayrı bir madde"
          />
          {error && (
            <p role="alert" className="m-0 text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={busy || !heading.trim() || !text.trim()}>
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Bölüm başlığı (DOG-92): yeniden adlandır, belgeden kaldır, geri al.
 * Kullanıcının kendi bölümü kaldırılınca siliniyor. İşlemler başlığın
 * menüsünde (DOG-147); ad değiştirme başlığın yerinde.
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
        <Input
          autoFocus
          value={renaming}
          maxLength={60}
          onChange={(e) => setRenaming(e.target.value)}
          aria-label="Bölümün yeni adı"
          className="h-8 w-auto max-w-64"
        />
        <Button type="submit" size="sm" disabled={busy}>
          Kaydet
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(null)}>
          Vazgeç
        </Button>
        <span className="w-full text-xs text-muted-foreground">Boş bırakırsan varsayılan ada döner.</span>
        {error && (
          <span role="alert" className="w-full text-xs text-destructive">
            {error}
          </span>
        )}
      </form>
    )
  }
  return (
    <h3
      className={cn(
        "m-0 mb-2 flex flex-wrap items-center gap-x-2 text-xs font-bold tracking-wider uppercase",
        hidden ? "text-muted-foreground/60" : "text-muted-foreground",
      )}
    >
      <span className={cn(hidden && "line-through")}>{title}</span>
      {onSection && hidden && (
        <span className="text-xs font-normal tracking-normal normal-case">
          Belgeden kaldırdın.{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={busy}
            onClick={() => void onSection({ op: "restore", key: sectionKey })}
            className="h-auto px-0 text-xs"
          >
            Geri al
          </Button>
        </span>
      )}
      {onSection && !hidden && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" disabled={busy} className="size-6 text-muted-foreground" aria-label={`${title} bölümünün işlemleri`}>
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={() => setRenaming(title)}>
              <Pencil aria-hidden /> Adını değiştir
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void onSection(user ? { op: "remove", id: sectionKey } : { op: "hide", key: sectionKey })}
            >
              <Trash2 aria-hidden /> {user ? "Sil" : "Belgeden kaldır"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </h3>
  )
}
