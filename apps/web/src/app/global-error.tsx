"use client"

/**
 * Kök yerleşimin kendisi patlarsa: globals.css ve fontlar yüklenmemiş
 * olabilir, o yüzden stiller satır içi ve bağımsız.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
          color: "#0f172a",
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
              background: "#2b4eff",
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
