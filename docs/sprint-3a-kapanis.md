# Sprint 3A Kapanış — Kimlik, Huni ve Sahiplik

**Tarih:** 26 Eylül 2026 · **Spec:** `docs/superpowers/specs/2026-09-26-sprint-3a-kimlik-design.md`

## Tamamlanma tanımı (spec §12)

| | Madde | Durum |
|---|---|---|
| 1 | Kullanıcı e-postasıyla giriş yapabiliyor (magic link) | ✅ canlı doğrulandı |
| 2 | Kayıtsız ziyaretçi skor alabiliyor | ✅ anonim oturum, skor 47 |
| 3 | Kayıt olunca CV, analiz ve ilan yeni hesaba geçiyor; anonim kullanıcı siliniyor | ✅ veritabanında doğrulandı |
| 4 | Anonim kullanıcı uyarlama başlatamıyor, kayıt çağrısı alıyor | ✅ 401 `kayit_gerekli` |
| 5 | Başkasının analizi veya uyarlaması 404 dönüyor | ✅ beş uçta, tümleşik testle |
| 6 | Hız limiti çalışıyor ve aşıldığında 429 dönüyor | ✅ `200 200 200 429` |
| 7 | Arayüzde oturum durumu ve çıkış görünüyor | ✅ |
| 8 | `RESEND_API_KEY` olmadan geliştirme yapılabiliyor | ✅ bağlantı konsola düşüyor |

Dokuz maddeden dokuzu tamam. Sprint 2'nin aksine eksik madde yok.

## Huninin uçtan uca kanıtı

```
1. Kayıtsız ziyaretçi analiz yaptı     → anonim oturum, skor 47
2. "Uyarla" denemesi                   → 401 "CV'ni uyarlamak için
                                          e-postanı bırakman yeterli."
3. Magic link ile kayıt                → huni@ornek.com · anonim: False
4. Aynı analizi uyarlama               → 200
5. Skor kayıttan sonra                 → 47 (korundu)

   yeni kullanıcıda: Resume 1 · Analysis 1 · JobPosting 1
   anonim kaydı    : silinmiş
```

## Güvenlik: sprintin asıl kazancı

Sprint başında **hiçbir kaynak korumalı değildi.** Kimlik bilen herkes
başkasının CV'sini indirebiliyordu ve BullMQ iş kimliği artan tam sayı
olduğu için `/api/analyze/7` tahmin edilebilirdi.

Şimdi:

| Uç | Sahibi | Başka kullanıcı | Oturumsuz |
|---|---|---|---|
| `GET /api/analyze/[id]` | 200 | 404 | 401 |
| `POST /api/adapt` | 200 | 404 | 401 |
| `GET /api/adapt/[id]` | 200 | 404 | 401 |
| `PATCH …/decision` | 200 | 404 | 401 |
| `GET …/download` | 200 | 404 | 401 |

404 seçildi, 403 değil: 403 kaynağın var olduğunu sızdırır.

## Ölçümle bulunan üç tuzak

**1. `nextCookies()` eklentisi gerekliydi ve en sonda olmak zorunda.**
Olmadan anonim oturum kuruluyor ama `Set-Cookie` isteği yapan tarafa
ulaşmıyor; her istek yeni anonim kullanıcı üretiyor ve hiçbiri kalıcı
olmuyor.

**2. `signInAnonymous` sonrası `getSession()` çağırmak işe yaramıyor.**
`getSession` **istek** başlıklarını okuyor, `nextCookies` çerezi **yanıta**
yazıyor. Yani yeni oturum ancak sonraki istekte görünüyor. İlk gönderim 401
veriyor, ikincisi çalışıyordu — "tekrar dene" ile kaybolan sinsi bir hata.
Çözüm: `signInAnonymous`'un kendi yanıtını kullanmak.

**3. Uyarlama ucunda bilgi sızıntısı.** İlk yazılan sırada varlık kontrolü
yetki kontrolünden öndeydi ve anonim kullanıcı geçersiz kimlikte 400,
geçerlide 401 alıyordu — yani yanıt kodundan "bu analiz var" bilgisini
okuyabiliyordu. Kayıt kontrolü kaynağı aramadan önceye alındı.

Üçü de yalnızca **canlı denemeyle** çıktı; birim testleri hiçbirini
yakalamadı.

## Plan düzeltmesi

Plan sahiplik alanlarını (`Analysis.userId`, `JobPosting.userId`) Görev 1'e
koymuştu. Uygulamada kusur çıktı: bu alanlar `NOT NULL` ve birinin değer
üretmesi gerekiyor — üretecek oturum ise Görev 2'den önce yok. Görev 1'e
koymak ağacı kırmızı bırakıyordu.

Alanlar anonim oturumla aynı göreve taşındı: **sütun ve onu dolduran kaynak
birlikte geliyor.** Görev 4 ve 5 yer değiştirdi.

## Yol boyunca Docker kilitlendi

Görev 2'nin canlı doğrulaması bir süre yapılamadı. Postgres konteyneri TCP
bağlantısı kabul ediyordu (`nc -z localhost 5432` başarılı) ama sorgulara
cevap vermiyordu — Docker'ın macOS port vekili, arkadaki Postgres cevap
vermese de bağlantı kabul ediyor.

**Ders:** "port açık" yanıltıcı bir sinyal. Asıl teşhis
`docker compose exec psql`'in de takılmasıydı — uygulamanın dışındaki bir
komutun takılması, sorunun uygulamada olmadığını söylüyor.

## Sayılar

```
362 birim testi (core 287 · worker 22 · web 53)
4 tümleşik test (devralma 3 · sahiplik 1)
typecheck temiz · next build uyarısız
6 göç
```

## Kapsam dışı bırakılanlar (spec §2 gereği)

- **Google ile giriş** — `socialProviders` bloğu yerinde ve boş; kimlik
  bilgileri `.env`'ye eklendiğinde açılıyor
- **Plan, kota, ödeme, pano** — Sprint 3B, K2'den sonra
- **Hesap silme** — birikmiş işler #14

## Yeni birikmiş işler

| # | İş | Ne zaman gerekli |
|---|---|---|
| 12 | Gerçek e-posta hiç denenmedi (yalnızca konsol modu) | K3'ten önce |
| 13 | Anonim kullanıcı kayıtları birikiyor | Trafik başladığında |
| 14 | Hesap silme akışı yok | Lansmandan önce |

## Sıradaki adımlar

1. **Resend hesabı aç ve gerçek e-postayı dene** (birikmiş iş #12).
2. **K2: beş kişiyle kullanılabilirlik testi** — Sprint 2'den devreden ve
   Sprint 3B'nin önkoşulu. Materyal: `docs/kullanilabilirlik-testi.md`.
3. **Skor vaadi kararı** (K-32) — Sprint 3B'nin ödeme duvarı buna bağlı.
4. Sprint 3B: plan, kota, iyzico, pano.
