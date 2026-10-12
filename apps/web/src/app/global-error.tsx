"use client"

import { reportClientError } from "@/lib/clientErrors"
import { useEffect } from "react"

/**
 * Kök yerleşimin kendisi patlarsa: globals.css ve fontlar yüklenmemiş
 * olabilir, o yüzden stiller satır içi ve bağımsız.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Kök yerleşim hatası Next'in sunucu kancasına düşmüyor; elle bildiriliyor (DOG-62).
  useEffect(() => {
    reportClientError(error)
  }, [error])
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f5f7ff",
          color: "#111114",
          padding: "0 16px",
        }}
      >
        <main role="alert" style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Bir şeyler ters gitti.</h1>
          <p style={{ margin: "0 0 24px", color: "#475569" }}>
            Sayfa yüklenemedi. Tekrar denemek çoğu zaman yetiyor.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#2f4be0",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  )
}
