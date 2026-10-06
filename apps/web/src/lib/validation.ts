import type { z } from "zod"

/** Şemanın ilk hatası: kullanıcı mesajı ve API kodu. */
export function firstIssue(error: z.ZodError): { message: string; code: string } {
  const first = error.issues[0]
  const params = (first as { params?: { code?: unknown } } | undefined)?.params
  return {
    message: first?.message ?? "Gönderdiğin bilgiler eksik görünüyor.",
    code: typeof params?.code === "string" ? params.code : "invalid_input",
  }
}
