import { LIBRARY_MAX, type LibraryResume } from "@/features/resumes/schema"

/** Kütüphane listesinin istemci tarafı kuralları; hesabım ve analiz formu ortak. */

export function resumeTitle(resume: Pick<LibraryResume, "label" | "fileName">): string {
  return resume.label ?? resume.fileName ?? "Kayıtlı CV"
}

/** Analiz formunda ön seçili CV: varsayılan, yoksa listenin ilki. */
export function initialResumeId(resumes: LibraryResume[]): string | null {
  return (resumes.find((r) => r.isDefault) ?? resumes[0])?.id ?? null
}

export function isLibraryFull(resumes: LibraryResume[]): boolean {
  return resumes.length >= LIBRARY_MAX
}

/**
 * Analiz formunun ön seçim kararı. `undefined`: dokunma; `null`: seçimi
 * temizle; metin: bu CV'yi seç.
 * - Kütüphanede artık olmayan seçim (başka sekmede kaldırılmış) her durumda
 *   düşürülüyor.
 * - Kullanıcı dosya yüklediyse ya da kendisi seçtiyse ön seçim yapılmıyor;
 *   yoksa "ikisi birden" hatasına düşen form oluşuyordu (kütüphane yüklemeden
 *   sonra yenilenince).
 */
export function preselectResumeId(input: {
  resumes: LibraryResume[]
  current: string | undefined
  hasFile: boolean
  picked: boolean
}): string | null | undefined {
  const { resumes, current } = input
  if (current !== undefined && !resumes.some((r) => r.id === current)) return initialResumeId(resumes)
  if (input.hasFile || input.picked || current !== undefined) return undefined
  return initialResumeId(resumes) ?? undefined
}
