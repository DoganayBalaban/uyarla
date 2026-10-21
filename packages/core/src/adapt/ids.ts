/**
 * Bir maddenin kararlı kimliği.
 *
 * Kimlik konumdan türetiliyor: taslak ile profil aynı çıkarımdan geliyor ve
 * sıraları değişmiyor. Rastgele kimlik üretmek, taslağı profile geri
 * bağlamak için ayrı bir eşleme tablosu gerektirirdi.
 */
export function bulletId(experienceIndex: number, bulletIndex: number): string {
  return `${experienceIndex}-${bulletIndex}`
}

/** Proje maddesinin kimliği (DOG-105); deneyim kimlikleriyle çakışmasın diye "p" önekli. */
export function projectBulletId(projectIndex: number, bulletIndex: number): string {
  return `p${projectIndex}-${bulletIndex}`
}
