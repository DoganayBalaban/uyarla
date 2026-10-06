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
