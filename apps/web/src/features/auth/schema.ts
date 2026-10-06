import { z } from "zod"

/**
 * Giriş formu. E-posta bağlantısını Better Auth gönderiyor ve adresi kendisi
 * de doğruluyor; bu şema kullanıcıya isteği göndermeden, Türkçe mesajla
 * söylemek için.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-posta adresini yazar mısın?")
    .pipe(z.email("Bu e-posta adresi eksik görünüyor. Bir kontrol eder misin?")),
})

export type LoginFormValues = z.input<typeof loginSchema>
