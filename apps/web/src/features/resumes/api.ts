import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LibraryResume } from "@/features/resumes/schema"
import type { z } from "zod"
import type { resumePatchSchema } from "@/features/resumes/schema"

export type ResumePatchInput = z.input<typeof resumePatchSchema>

export const resumesQueryKey = ["resumes"] as const

export async function getLibrary(): Promise<LibraryResume[]> {
  return (await api.get<{ resumes: LibraryResume[] }>("/resumes")).data.resumes
}

/** Yalnızca kayıtlı kullanıcıda açılıyor; anonim oturumda uç 401 döner. */
export function useLibrary(enabled: boolean) {
  return useQuery({ queryKey: resumesQueryKey, queryFn: getLibrary, enabled })
}

function useInvalidatingMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumesQueryKey }),
  })
}

export function useUploadResume() {
  return useInvalidatingMutation(async ({ file, label }: { file: File; label: string }) => {
    const body = new FormData()
    body.append("cv", file)
    if (label.trim()) body.append("label", label)
    await api.post("/resumes", body)
  })
}

export function useUpdateResume() {
  return useInvalidatingMutation(async ({ id, patch }: { id: string; patch: ResumePatchInput }) => {
    await api.patch(`/resumes/${encodeURIComponent(id)}`, patch)
  })
}

export function useRemoveResume() {
  return useInvalidatingMutation(async (id: string) => {
    await api.delete(`/resumes/${encodeURIComponent(id)}`)
  })
}
