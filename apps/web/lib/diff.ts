export interface DiffPart {
  text: string
  kind: "same" | "added" | "removed"
}

/**
 * Kelime düzeyinde fark (marka rehberi §9.5: eklenen yeşil vurgu, çıkarılan
 * üstü çizili gri).
 *
 * Kütüphane eklenmiyor: en uzun ortak alt dizinin kelime düzeyi uygulaması
 * otuz satır ve maddeler kısa. Karakter düzeyinde fark Türkçe eklerde
 * okunaksız çıkıyor — "yaptım"ı "geliştirdim"e bağlarken ortak harfleri
 * işaretlemek gürültüden ibaret.
 */
export function diffWords(original: string, rewritten: string): DiffPart[] {
  const a = original.split(/\s+/).filter(Boolean)
  const b = rewritten.split(/\s+/).filter(Boolean)

  // En uzun ortak alt dizi tablosu.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const parcalar: DiffPart[] = []
  const ekle = (text: string, kind: DiffPart["kind"]) => {
    const son = parcalar[parcalar.length - 1]
    // Bitişik aynı türden parçalar birleşiyor; aksi hâlde her kelime ayrı
    // bir span olur ve vurgu parçalı görünür.
    if (son?.kind === kind) son.text += ` ${text}`
    else parcalar.push({ text, kind })
  }

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ekle(a[i]!, "same")
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ekle(a[i]!, "removed")
      i++
    } else {
      ekle(b[j]!, "added")
      j++
    }
  }
  while (i < a.length) ekle(a[i++]!, "removed")
  while (j < b.length) ekle(b[j++]!, "added")

  return parcalar
}
