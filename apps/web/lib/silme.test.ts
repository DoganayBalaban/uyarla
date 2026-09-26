import { describe, it, expect, vi } from "vitest"
import { SILME_SIRASI, depoIcindeMi, silmeIslemleri } from "./silme"

/** Hangi tabloya hangi `where` ile gidildiğini sırasıyla yakalayan sahte Prisma. */
function sahtePrisma() {
  const cagrilar: Array<{ tablo: string; where: unknown }> = []
  const yap = (tablo: string) => ({
    deleteMany: vi.fn((args: { where: unknown }) => {
      cagrilar.push({ tablo, ...args })
      return { count: 0 }
    }),
  })
  const client: Record<string, unknown> = {}
  for (const tablo of SILME_SIRASI) client[tablo] = yap(tablo)
  return { cagrilar, client }
}

describe("silmeIslemleri", () => {
  it("sekiz tabloyu yabancı anahtar sırasıyla siler", () => {
    // Sıra bu dosyanın en kırılgan yeri: Adaptation, Analysis'ten önce
    // silinmezse yabancı anahtar işlemi düşürür ve hesap yarı silinmiş kalır.
    const { cagrilar, client } = sahtePrisma()
    silmeIslemleri(client as never, ["k1"])

    expect(cagrilar.map((c) => c.tablo)).toEqual([
      "adaptation",
      "analysis",
      "resumeVersion",
      "resume",
      "jobPosting",
      "session",
      "account",
      "user",
    ])
  })

  it("her işlem yalnızca verilen kullanıcıları hedefler", () => {
    // Bu dosyanın en kritik iddiası: bir `where` koşulu düşerse BÜTÜN
    // kullanıcıların verisi silinir ve geri dönüşü yok.
    const { cagrilar, client } = sahtePrisma()
    silmeIslemleri(client as never, ["k1", "k2"])

    const idler = ["k1", "k2"]
    const beklenen: Record<string, unknown> = {
      adaptation: { analysis: { userId: { in: idler } } },
      analysis: { userId: { in: idler } },
      resumeVersion: { resume: { userId: { in: idler } } },
      resume: { userId: { in: idler } },
      jobPosting: { userId: { in: idler } },
      session: { userId: { in: idler } },
      account: { userId: { in: idler } },
      user: { id: { in: idler } },
    }

    expect(cagrilar).toHaveLength(Object.keys(beklenen).length)
    for (const c of cagrilar) expect(c.where).toEqual(beklenen[c.tablo])
  })

  it("boş listede hiçbir işlem üretmez", () => {
    // `{ in: [] }` Prisma'da hiçbir satırı tutmaz, ama bir sonraki elde
    // koşulun elden kaçması hâlinde tabloyu boşaltacak sorgular hiç
    // kurulmamış olsun: boş listede erken çıkıyoruz.
    const { cagrilar, client } = sahtePrisma()
    expect(silmeIslemleri(client as never, [])).toEqual([])
    expect(cagrilar).toHaveLength(0)
  })

  it("boş kimlik taşıyan listede hata fırlatır", () => {
    // Boş dize bir hata işareti; sessizce geçmek yerine duruyoruz.
    const { client } = sahtePrisma()
    expect(() => silmeIslemleri(client as never, ["k1", ""])).toThrow(/kimlik/i)
  })

  it("yinelenen kimlikleri teke indirir", () => {
    const { cagrilar, client } = sahtePrisma()
    silmeIslemleri(client as never, ["k1", "k1"])
    expect(cagrilar).toHaveLength(SILME_SIRASI.length)
    expect(cagrilar[0]?.where).toEqual({ analysis: { userId: { in: ["k1"] } } })
  })
})

describe("depoIcindeMi", () => {
  it("depo dizini altındaki yolu kabul eder", () => {
    expect(depoIcindeMi("/veri/storage/abc.pdf", "/veri/storage")).toBe(true)
    expect(depoIcindeMi("/veri/storage/alt/abc.pdf", "/veri/storage")).toBe(true)
  })

  it("depo dışındaki yolu reddeder", () => {
    // `Resume.filePath` veritabanından geliyor; bozuk ya da kötü niyetli bir
    // satır `unlink` ile rastgele bir dosyayı silmeye yol açmasın.
    expect(depoIcindeMi("/etc/passwd", "/veri/storage")).toBe(false)
    expect(depoIcindeMi("/veri/storage/../gizli.pdf", "/veri/storage")).toBe(false)
  })

  it("ön ek benzerliğini dizin sınırı sanmaz", () => {
    // "/veri/storage-yedek" dizesi "/veri/storage" ile başlıyor ama onun
    // altında değil; düz `startsWith` bu tuzağa düşer.
    expect(depoIcindeMi("/veri/storage-yedek/abc.pdf", "/veri/storage")).toBe(false)
  })

  it("göreli depo dizinini mutlak yola çevirir", () => {
    // STORAGE_DIR öntanımlı olarak "./storage"; karşılaştırma mutlak yolla
    // yapılmazsa hiçbir dosya silinemez.
    const mutlak = `${process.cwd()}/storage/abc.pdf`
    expect(depoIcindeMi(mutlak, "./storage")).toBe(true)
  })

  it("depo dizininin kendisini dosya saymaz", () => {
    expect(depoIcindeMi("/veri/storage", "/veri/storage")).toBe(false)
  })
})
