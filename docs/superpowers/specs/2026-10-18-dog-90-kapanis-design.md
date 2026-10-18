# DOG-90 kapanışı: kalıcı hariç tutma, neden, şart düzeltme, eski skorlar

**Tarih:** 18 Ekim 2026 · **Issue:** DOG-90 · **Durum:** Tasarım onaylandı (sohbette), uygulanıyor

## 1. Amaç

DOG-90'ın kalan dört parçasını bitirip issue'yu kapatmak. İlk iki adım (PR 117,
PR 136, K-67) analiz başına "ilanda yok" işaretlemeyi ve düzeltilmiş skoru
her yere taşıdı.

| Parça | Kullanıcı ne yapabiliyor |
|---|---|
| A. Kalıcı hariç tutma | Bir gereksinimi "tüm ilanlarda" hariç tutar; sonraki analizlerde otomatik işaretli gelir. |
| B. Neden | İşaretlerken nedenini seçer; işaretler değerlendirme setine aktarılabilir. |
| C. Şart düzeltme | Yanlış okunan deneyim yılını ya da eğitim şartını düzeltir; skor yeniden hesaplanır. |
| D. Eski skorlar | Tek seferlik betik, işaretli eski analizlerin pano skorunu düzeltir. |

## 2. Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Kalıcı hariç tutmanın birimi | Kavram (`term` ve eş anlamlıları, normalize). Bir gereksinim, **bütün** kavramları listedeyse otomatik hariç. | Gereksinim metni ilandan ilana değişiyor; kavram kanonik. Tek kavramı eşleşen çok kavramlı gereksinimi çıkarmak fazla geniş. |
| Kalıcı listenin etkisi | Yalnızca sonraki analizler. Eski analizler değişmiyor. | Kullanıcı kararı (seçenek "sadece sonraki analizler"). Eski skorları sessizce değiştirmemek. |
| Nedenler | `not_in_posting` (ilanda yok), `irrelevant` (ilgisiz), `found_in_cv` (CV'mde var, bulunamadı) | Jobscan'in "ilgisiz" ve "yanlış tespit" ayrımı. |
| `found_in_cv` | Hariç tutmuyor; yalnızca bildirim, ekranda ipucu | Kanıtı olmayanı skordan silmek uydurmanın skor tarafı (dürüstlük ilkesi). |
| Kalıcı seçenek | Yalnızca `not_in_posting` ve `irrelevant` | `found_in_cv` hariç tutmuyor. |
| C'nin kapsamı | İlanın şartı: deneyimde istenen en az yıl, eğitimde kabul edilen bölüm/derece terimleri. CV hakkında beyan alınmıyor. | Kullanıcı kararı. CV tarafı beyanı skoru doğrudan artırırdı. |
| C'nin hesabı | `PATCH /api/analysis/[id]` core `score()`'u embedding'le çalıştırıyor (senkron). | K-68 sonrası route core alt yollarını içe aktarabiliyor. Onaylanan tasarımdaki worker işi gereksiz; kullanıcı beklemiyor. |
| Web'deki skor kopyası | Kaldırılıyor; ekran ve route core `weightedScore`'u kullanıyor | K-68 ve `cosineSimilarity`'nin ayrı modüle taşınmasıyla skor modülü tarayıcıya güvenle giriyor. |
| İlk skor | `result.score` ilk skor olarak kalıyor; `Analysis.score` düzeltilmiş | K-67 ile aynı. |

## 3. Veri

**Yeni tablo** (canlı migration):

```prisma
model ExcludedConcept {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  key       String   // conceptKey(term): Türkçe küçük harf, boşluk sadeleştirilmiş
  term      String   // ekranda gösterilen hâli
  createdAt DateTime @default(now())
  @@unique([userId, key])
}
```

Hesap silme ve veri dışa aktarma bu tabloyu da kapsıyor.

**Analiz sonucu (JSON, migration yok):**
- `excluded: number[]` (var olan) skora katılmayan gereksinimler.
- `exclusions?: Record<string, { reason, scope: "analysis" | "always" | "profile" }>`: sıraya göre. `profile`: listeden otomatik geldi.
- `reports?: Array<{ index, reason: "found_in_cv", at }>`: hariç tutmayan bildirimler.
- `corrections?: Record<string, { minYears?: number; terms?: string[] }>`: sıraya göre şart düzeltmeleri. Düzeltme varsa `requirements` yeniden hesaplanmış sonuçlar; `result.score` ilk skor.

## 4. Akışlar

**İşaretleme** `PATCH /api/analysis/[id]`, `{ action: "exclude", requirementIndex, reason, always? }`:
- `not_in_posting` / `irrelevant`: `excluded`'a ekle, `exclusions[i]` yaz; `always` ise gereksinimin kavramlarını `ExcludedConcept`'e upsert et.
- `found_in_cv`: `reports`'a ekle; `excluded` değişmez.
- `{ action: "include", requirementIndex }`: işareti kaldırır (kalıcı listeye dokunmaz; liste hesap ayarlarından yönetilir).
- Eski gövde `{ requirementIndex, excluded }` geriye uyumlu: `not_in_posting` / `include` sayılır.

**Yeni analiz** (worker): skor hesaplandıktan sonra kullanıcının anahtarları okunur; `profileExclusions(posting, keys)` bütün kavramları listede olan gereksinimlerin sırasını döner. Bunlar `excluded` ve `exclusions[i] = { reason: "irrelevant", scope: "profile" }` olarak yazılır, `Analysis.score` = `weightedScore(..., excluded)`.

**Şart düzeltme** `{ action: "correct", requirementIndex, minYears? , terms? }`: `correctPosting(posting, corrections)` deneyimde `minYears`'ı, eğitimde kavramları değiştirir; route CV profili ve düzeltilmiş ilanla `score()`'u çalıştırır. `null` değer düzeltmeyi kaldırır.

**Hesap ayarları:** "Hariç tuttuğun kavramlar" listesi; `PATCH /api/account { action: "unexclude", key }`.

## 5. Betikler

- `scripts/exclusion-reports.ts`: işaret ve bildirimleri JSONL'e döker (ilan metni, gereksinim, kavramlar, neden). CV metni yok (KVKK).
- `scripts/backfill-excluded-scores.ts`: `excluded` dolu ama `Analysis.score = result.score` olan analizleri bulur; varsayılan rapor, `--apply` düzeltir.

## 6. Testler

- Core: `conceptKey`, `profileExclusions`, `correctPosting`, `minYears` ile süre kontrolü.
- Worker: kalıcı liste analizde uygulanıyor.
- Web: işaret/neden/düzeltme durum fonksiyonları, route gövde ayrıştırma, betiklerin saf kısımları; veritabanına dokunanlar entegrasyon testinde.
