"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Açık / koyu tema (DOG-143). Sınıf <html>'e veriliyor; varsayılan açık,
 * kullanıcı menüsünden değişiyor. Geçişte animasyonlar kapalı ki renkler
 * tek karede değişsin.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
