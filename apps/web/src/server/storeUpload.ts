import type { FileStore } from "@uyarla/core/storage/fileStore"

/**
 * Yüklenen CV'yi depoya yazar ve kaydını oluşturur; kayıt düşerse dosyayı
 * siler (DOG-65).
 *
 * Dosya önce yazılıyor çünkü kayıt dosyanın yolunu taşıyor. Arada veritabanı
 * hatası olursa depoda kimseye ait olmayan bir CV kalıyordu: kişisel veri,
 * hiçbir silme akışının ulaşamadığı bir yerde.
 */
export async function storeUploadedResume<T>(
  store: Pick<FileStore, "save" | "delete">,
  buffer: Buffer,
  fileName: string,
  createRecord: (filePath: string) => Promise<T>,
): Promise<T> {
  const filePath = await store.save(buffer, fileName)
  try {
    return await createRecord(filePath)
  } catch (error) {
    // Temizlik de düşerse asıl hata gizlenmemeli; teşhisi o taşıyor.
    await store.delete(filePath).catch((cleanupError: unknown) => {
      console.error("[upload] yetim dosya silinemedi:", filePath, cleanupError)
    })
    throw error
  }
}
