"use client"

import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeQueryClient } from "@/lib/queryClient"

/** Sayfalar arası geçişte önbellek korunuyor: istemci bir kez kuruluyor. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
