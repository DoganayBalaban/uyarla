import { describe, it, expect, vi } from "vitest"
import { DELETION_ORDER as DELETION_ORDER, isInsideStorage as isInsideStorage, deletionOperations as deletionOperations } from "@/server/deleteAccount"

/** Hangi tabloya hangi `where` ile gidildiğini sırasıyla yakalayan sahte Prisma. */
function fakePrisma() {
  const callList: Array<{ tablo: string; where: unknown }> = []
  const make = (tablo: string) => ({
    deleteMany: vi.fn((args: { where: unknown }) => {
      callList.push({ tablo, ...args })
      return { count: 0 }
    }),
  })
  const client: Record<string, unknown> = {}
  for (const tablo of DELETION_ORDER) client[tablo] = make(tablo)
  return { callList, client }
}

describe("deletionOperations", () => {
  it("deletes eight tables in foreign-key order", () => {
    // Sıra bu dosyanın en kırılgan yeri: Adaptation, Analysis'ten önce
    // silinmezse yabancı anahtar işlemi düşürür ve hesap yarı silinmiş kalır.
    const { callList, client } = fakePrisma()
    deletionOperations(client as never, ["k1"])

    expect(callList.map((c) => c.tablo)).toEqual([
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

  it("every operation targets only the given users", () => {
    // Bu dosyanın en kritik iddiası: bir `where` koşulu düşerse BÜTÜN
    // kullanıcıların verisi silinir ve geri dönüşü yok.
    const { callList, client } = fakePrisma()
    deletionOperations(client as never, ["k1", "k2"])

    const ids = ["k1", "k2"]
    const expected: Record<string, unknown> = {
      adaptation: { analysis: { userId: { in: ids } } },
      analysis: { userId: { in: ids } },
      resumeVersion: { resume: { userId: { in: ids } } },
      resume: { userId: { in: ids } },
      jobPosting: { userId: { in: ids } },
      session: { userId: { in: ids } },
      account: { userId: { in: ids } },
      user: { id: { in: ids } },
    }

    expect(callList).toHaveLength(Object.keys(expected).length)
    for (const c of callList) expect(c.where).toEqual(expected[c.tablo])
  })

  it("produces no operation for an empty list", () => {
    // `{ in: [] }` Prisma'da hiçbir satırı tutmaz, ama bir sonraki elde
    // koşulun elden kaçması hâlinde tabloyu boşaltacak sorgular hiç
    // kurulmamış olsun: boş listede erken çıkıyoruz.
    const { callList, client } = fakePrisma()
    expect(deletionOperations(client as never, [])).toEqual([])
    expect(callList).toHaveLength(0)
  })

  it("throws for a list containing an empty id", () => {
    // Boş dize bir hata işareti; sessizce geçmek yerine duruyoruz.
    const { client } = fakePrisma()
    expect(() => deletionOperations(client as never, ["k1", ""])).toThrow(/kimlik/i)
  })

  it("deduplicates repeated ids", () => {
    const { callList, client } = fakePrisma()
    deletionOperations(client as never, ["k1", "k1"])
    expect(callList).toHaveLength(DELETION_ORDER.length)
    expect(callList[0]?.where).toEqual({ analysis: { userId: { in: ["k1"] } } })
  })
})

describe("isInsideStorage", () => {
  it("accepts a path under the storage directory", () => {
    expect(isInsideStorage("/veri/storage/abc.pdf", "/veri/storage")).toBe(true)
    expect(isInsideStorage("/veri/storage/alt/abc.pdf", "/veri/storage")).toBe(true)
  })

  it("rejects a path outside storage", () => {
    // `Resume.filePath` veritabanından geliyor; bozuk ya da kötü niyetli bir
    // satır `unlink` ile rastgele bir dosyayı silmeye yol açmasın.
    expect(isInsideStorage("/etc/passwd", "/veri/storage")).toBe(false)
    expect(isInsideStorage("/veri/storage/../gizli.pdf", "/veri/storage")).toBe(false)
  })

  it("does not mistake a prefix match for a directory boundary", () => {
    // "/veri/storage-yedek" dizesi "/veri/storage" ile başlıyor ama onun
    // altında değil; düz `startsWith` bu tuzağa düşer.
    expect(isInsideStorage("/veri/storage-yedek/abc.pdf", "/veri/storage")).toBe(false)
  })

  it("resolves a relative storage directory to an absolute path", () => {
    // STORAGE_DIR öntanımlı olarak "./storage"; karşılaştırma mutlak yolla
    // yapılmazsa hiçbir dosya silinemez.
    const absolute = `${process.cwd()}/storage/abc.pdf`
    expect(isInsideStorage(absolute, "./storage")).toBe(true)
  })

  it("does not treat the storage directory itself as a file", () => {
    expect(isInsideStorage("/veri/storage", "/veri/storage")).toBe(false)
  })
})
