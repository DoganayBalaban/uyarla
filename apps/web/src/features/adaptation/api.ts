import { useQuery } from "@tanstack/react-query"
import type { CoverLetterRecord } from "@uyarla/core/cover/letter"
import { api } from "@/lib/api"
import type { AdaptationState, Draft, SectionKind, Verification } from "@/features/adaptation/types"
import { fileNameFromDisposition } from "@/features/adaptation/fileName"

/** Analizden uyarlama başlatır; aynı analizin uyarlaması varsa onu döndürür. */
export async function startAdaptation(analysisId: string): Promise<{ adaptationId: string }> {
  return (await api.post<{ adaptationId: string }>("/adapt", { analysisId })).data
}

export async function getAdaptation(id: string): Promise<AdaptationState> {
  return (await api.get<AdaptationState>(`/adapt/${encodeURIComponent(id)}`)).data
}

/** Bir maddeyi kabul ya da reddeder; yanıt güncel taslak ve skor. */
export async function decide(
  id: string,
  itemId: string,
  decision: "accepted" | "rejected",
): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { itemId, decision }))
    .data
}

/** Önerinin metnini elle düzenler (DOG-92); yeni hâl kullanıcının metni olur. */
export async function editItem(id: string, itemId: string, edit: string): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { itemId, edit })).data
}

/**
 * Yazarken canlı skor (DOG-92): düzenlemeyi kaydetmeden bu metinle skor ve
 * uydurma kontrolü.
 */
export async function previewEdit(
  id: string,
  itemId: string,
  edit: string,
  signal?: AbortSignal,
): Promise<{ scoreAfter: number | null; verification: Verification | null }> {
  return (
    await api.patch<{ scoreAfter: number | null; verification: Verification | null }>(
      `/adapt/${encodeURIComponent(id)}/decision`,
      { itemId, edit, preview: true },
      { signal },
    )
  ).data
}

/** Toplu karar (DOG-93): uyarısızları yeni hâline al ya da hepsini geri al. */
export async function decideAll(
  id: string,
  bulk: "accept_verified" | "reject_all",
): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { bulk })).data
}

/**
 * Belge stratejisi (DOG-93): "onePage" sıkı yerleşim ve gerekirse ilana en az
 * ilgili maddeleri çıkarır; "full" hepsini geri getirir.
 */
export async function setLayout(id: string, layout: "full" | "onePage"): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { layout })).data
}

/** Tek sayfa için çıkarılan bir maddeyi belgeye geri alır (DOG-93). */
export async function restoreBullet(id: string, bulletId: string): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { restore: bulletId }))
    .data
}

/** Madde düzenleyici işlemi (DOG-92): ekle, kaldır, taşı. */
export type BulletWhere = { experienceIndex: number } | { projectIndex: number }
export type BulletOp =
  | ({ op: "add"; text: string } & BulletWhere)
  | { op: "remove"; id: string }
  | ({ op: "move"; id: string; direction: "up" | "down" } & BulletWhere)
  /** Başka bir işe ya da projeye taşı; hedef `BulletWhere`. */
  | ({ op: "relocate"; id: string } & BulletWhere)

/** Bölüm işlemi (DOG-92): sırayı değiştir, kendi bölümünü ekle ya da sil. */
export type SectionOp =
  | { op: "move"; section: SectionKind; direction: "up" | "down" }
  | { op: "add"; heading: string; text: string }
  | { op: "remove"; id: string }
  | { op: "hide"; key: string }
  | { op: "restore"; key: string }
  | { op: "rename"; key: string; title: string }

export async function changeBullet(id: string, bullet: BulletOp): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { bullet })).data
}

export async function changeSection(id: string, section: SectionOp): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { section })).data
}

export async function requestCoverLetter(id: string): Promise<{ coverLetter: CoverLetterRecord }> {
  return (await api.post<{ coverLetter: CoverLetterRecord }>(`/adapt/${encodeURIComponent(id)}/cover-letter`)).data
}

/** Uyarlanmış CV ve sunucunun verdiği dosya adı (`Content-Disposition`, DOG-74). */
export async function downloadAdaptation(
  id: string,
  format: "pdf" | "docx",
): Promise<{ blob: Blob; fileName: string }> {
  const response = await api.get<Blob>(`/adapt/${encodeURIComponent(id)}/download`, {
    params: { format },
    responseType: "blob",
  })
  const disposition = response.headers?.["content-disposition"] as string | undefined
  return { blob: response.data, fileName: fileNameFromDisposition(disposition, `uyarla-cv.${format}`) }
}

export const adaptationQueryKey = (id: string) => ["adaptation", id] as const

/**
 * Bir sonraki yoklamaya kadar beklenecek süre; false yoklamayı durdurur.
 * Taslak yazılırken sık, yalnızca ön yazı sürerken daha seyrek soruluyor.
 * İstek başarısızsa duruyor: uyarlama yok ya da kullanıcının değil.
 */
export function adaptationPollDelay(
  data:
    | (Pick<AdaptationState, "status" | "coverLetter" | "formAnswers"> & { draft?: Pick<Draft, "contributions"> | null })
    | undefined,
  error: unknown,
): number | false {
  if (error) return false
  if (!data || data.status === "running") return 1500
  if (data.coverLetter?.status === "running") return 2000
  // Kullanıcının anlattığından madde yazılıyor (DOG-94).
  if (data.draft?.contributions?.some((c) => c.status === "running")) return 2000
  // Başvuru formu yanıtı yazılıyor (DOG-123).
  if (data.formAnswers?.some((a) => a.status === "running")) return 2000
  return false
}

/** Eksik bir gereksinim için anlatılan deneyimi maddeye çevirtir (DOG-94). */
export async function requestContribution(
  id: string,
  input: { requirementIndex: number; experienceIndex: number; answer: string },
): Promise<void> {
  // Uç ön yazı dosyasında: Vercel'in 12 fonksiyon sınırı (bkz. route.ts).
  await api.post(`/adapt/${encodeURIComponent(id)}/cover-letter`, { contribution: input })
}

/**
 * Uyarlamanın durumu ve taslağı. Uyarlama ekranı ve ön yazı bölümü aynı
 * önbelleği paylaşıyor; yoklama, iş sürdükçe kendiliğinden devam ediyor.
 */
export function useAdaptation(id: string) {
  return useQuery({
    queryKey: adaptationQueryKey(id),
    queryFn: () => getAdaptation(id),
    refetchInterval: (query) => adaptationPollDelay(query.state.data, query.state.error),
  })
}
