import { redirect } from "next/navigation"

/**
 * Eski adres. Yalnızca yönlendirme için duruyor: geliştirme sırasında
 * dağıtılan magic link'lerin callbackURL'i buraya bakıyor.
 */
export default function TestRedirect() {
  redirect("/analyze")
}
