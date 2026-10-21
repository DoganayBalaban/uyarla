import { startClientErrorTracking } from "@/lib/clientErrors"
import { recoverFromStaleChunk } from "@/lib/staleChunk"

// Tarayıcı tarafı hata izleme; SDK tembel yükleniyor (bkz. lib/clientErrors.ts).
startClientErrorTracking()

// Dağıtımdan sonra bayat parça (DOG-140): gezinme sırasındaki parça hatası
// hata sınırına düşmeden yakalanmamış söz olarak gelebiliyor.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (recoverFromStaleChunk(event.reason)) event.preventDefault()
  })
}
