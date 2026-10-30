import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { AuditStart } from "@/features/linkedin/components/AuditStart"

const render = (el: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>)
const base = { busy: false, error: null, onStart: () => {}, onTargetRoleSave: async () => {} }

describe("AuditStart", () => {
  it("shows the target role and the PDF option; the extension card only when known", () => {
    const html = render(<AuditStart {...base} targetRole="Dijital Pazarlama Uzmanı" extension={null} />)
    expect(html).toContain("Dijital Pazarlama Uzmanı")
    expect(html).toContain("PDF yükle")
    expect(html).not.toContain("Eklentiyle tek tıkla")
  })

  it("recommends the extension and says how to install it when it is missing", () => {
    const html = render(<AuditStart {...base} targetRole={null} extension={{ installed: false }} />)
    expect(html).toContain("Eklentiyle tek tıkla")
    expect(html).toContain("Önerilen")
    expect(html).toContain("Eklentiyi kur")
    expect(html).toContain("Hedef rolünü yaz")
  })

  it("opens the user's own profile when the extension is installed", () => {
    const html = render(<AuditStart {...base} targetRole={null} extension={{ installed: true }} />)
    expect(html).toContain('href="https://www.linkedin.com/in/me/"')
  })

  it("takes the LinkedIn PDF right here instead of sending the user to the CV library (DOG-166)", () => {
    const html = render(<AuditStart {...base} targetRole="Pazarlama" extension={null} />)
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="application\/pdf,.pdf"/)
    expect(html).toContain("CV kütüphanene eklenmez")
    expect(html).not.toContain("/cvs?ekle=1")
  })
})
