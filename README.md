# MEB AI Platform — Phase 1: Foundation

MEB müfredatına bağlı, Türkçe, AI destekli öğrenme platformu. Bu repo **Phase 1**'i içerir:
kimlik doğrulama, veritabanı mimarisi, müfredat veri modeli ve temel UI iskeleti.

## ⚠️ Bu paket hakkında dürüst bir not

Bu kod, internet erişimi olmayan bir ortamda yazıldı — yani `npm install`, `build`,
`lint` ve testler **burada hiç çalıştırılmadı**. Dosya yapısı, Prisma şeması, API
route'ları ve sayfalar elle, dikkatli şekilde yazıldı ve standart Next.js 14 App
Router + NextAuth + Prisma kalıplarını izliyor — ama "gerçekten build oldu" garantisi
veremem. Kendi makinende aşağıdaki adımları çalıştırıp çıkan hataları bana
gönderirsen (ya da burada yeni bir sohbette paylaşırsan) düzeltmeye devam ederim.

## Teknoloji Yığını

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS
- **Veritabanı:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth (Credentials provider, bcrypt ile şifre hashleme)
- **Doğrulama:** Zod

## Kurulum

```bash
npm install
cp .env.example .env
# .env içindeki DATABASE_URL ve NEXTAUTH_SECRET değerlerini doldur

npx prisma migrate dev --name init
npm run prisma:seed   # örnek 1 sınıf / 1 ders verisi ekler

npm run dev
```

## Test / Doğrulama Komutları

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

## Veritabanı Mimarisi (Phase 1)

```
CurriculumVersion (2025-2026, 2026-2027, ...)
 └── Grade (5. Sınıf ... 12. Sınıf)
      └── Subject (Matematik, Fizik, ...)
           └── Unit (Fonksiyonlar, ...)
                └── Topic (Fonksiyon Kavramı, ...)
                     └── Subtopic
                          └── LearningOutcome (kod: TR-MEB-10-MAT-001)

User ── Profile (isim, sınıf, hedef, günlük çalışma süresi)
User ── Account / Session (NextAuth)
```

Müfredat verisi **frontend'e hard-code edilmez**, tamamen bu ilişkisel modelden
gelir. Yeni bir eğitim yılı için yeni bir `CurriculumVersion` oluşturulur ve eski
veri bozulmadan sistem çalışmaya devam eder (madde 11).

## Müfredat Veri Import Pipeline'ı (Phase 2)

Gerçek MEB müfredatı elle veritabanına yazılmaz veya AI'ya "tahmin ettirilmez".
Bunun yerine `data/curriculum/<versiyon>/*.json` altında **doğrulanmış** dataset
dosyaları tutulur ve bir script ile içeri aktarılır.

Format: her dosya tek bir (sınıf, ders) çiftini temsil eder ve
`src/lib/curriculum/schema.ts` içindeki Zod şemasına uymak zorundadır — kazanım
kodları `TR-MEB-<sınıf>-<DERS>-<no>` formatında olmalı ve dosya içinde tekrar
etmemelidir.

```bash
# Sadece doğrula, hiçbir şey yazma
npm run curriculum:import -- 2025-2026 --dry-run

# Doğrula ve veritabanına yaz
npm run curriculum:import -- 2025-2026

# Doğrula, yaz, ve bu versiyonu aktif versiyon yap
npm run curriculum:import -- 2025-2026 --activate
```

Script **tek bir dosyada bile hata varsa tüm importu durdurur** — kısmi veya
bozuk müfredat verisi asla veritabanına yazılmaz. Import idempotent'tir: aynı
komut tekrar çalıştırıldığında var olan kayıtlar güncellenir, yinelenmez.

`data/curriculum/2025-2026/10-matematik.json` örnek/placeholder bir dataset'tir
(sadece 1 ünite, 1 konu). **Gerçek MEB müfredatı bu formatta, editör/insan
doğrulaması geçmiş dataset dosyaları olarak eklenmelidir** — bu repo gerçek
müfredat içeriği üretmez, sadece onu almak için borulama sağlar.

## AI Öğretmen + RAG (Phase 3)

**RAG akışı (madde 13):**

```
Kullanıcı sorusu + topicId
  → retrieveCurriculumContext() — sadece DB'de kayıtlı kazanımları çeker
  → buildSystemPrompt() — "sadece bu bağlamı kullan" kuralları gömülü prompt
  → AnthropicProvider.complete() — claude-sonnet-4-6
  → validateAIResponse() — kaynak kodu + basit aritmetik doğrulama
  → (sorun varsa) 1 kez düzeltme denemesi
  → kullanıcıya cevap + kaynaklar + hasUnresolvedIssues bayrağı
```

**Halüsinasyon koruması (madde 15) nasıl uygulandı:**
- Sistem promptu, bağlam dışı bilgiyi "müfredat bilgisi" gibi sunmayı yasaklıyor.
- `validateCitations()` — cevapta geçen her `TR-MEB-...` kodunun gerçekten
  retrieval'dan gelen bağlamda olduğunu kontrol eder; uydurma kod varsa yakalar.
- `validateArithmetic()` — cevaptaki basit sayısal eşitlikleri (`mathjs` ile)
  yeniden hesaplayıp AI'nın sonucuyla karşılaştırır. **Kapsam sınırlı**: sadece
  somut sayısal ifadeleri (`2 + 5 = 8` gibi) yakalar, sembolik denklemleri
  (`2x + 5 = 15`) değil — bu, gerçek bir CAS (computer algebra system)
  entegrasyonu gerektirir ve Phase 4'e (soru motoru) bırakıldı.
- Doğrulama başarısız olursa cevap kullanıcıya gitmeden önce 1 kez düzeltme
  denemesi yapılır; hâlâ sorunluysa `hasUnresolvedIssues: true` ile birlikte
  gönderilir ve arayüzde uyarı gösterilir — **sessizce gizlenmez**.
- Vector search / gömülü uzun kaynaklar (madde 13'teki "eğitim kaynakları için
  vector search") bu fazda YOK — şu an sadece yapısal müfredat verisi (kazanım
  metinleri) retrieval kaynağı. `resources` tablosu ve pgvector entegrasyonu
  Phase 4/5'e bırakıldı; kısa kazanım metinleri için vector search zaten gerekli
  değil, uzun ders notları/kaynaklar eklendiğinde gerekecek.

**Denenmedi:** Gerçek bir `ANTHROPIC_API_KEY` ile uçtan uca hiç çalıştırılmadı.
`@anthropic-ai/sdk`'nin bu sürümdeki tam API yüzeyini (mesaj tipi isimleri vb.)
doğrulayamadım — kendi ortamında `npm run typecheck` çalıştırıp SDK tip
hatası çıkarsa bana bildir.

## AI Sohbet Ekranı

`/panel/ai-ogretmen?konu=<topicId>` — sol tarafta konu listesi, sağda sohbet.
Hızlı aksiyon butonları (Basit Anlat, Detaylı Anlat, Örnek Ver, Bana Soru Sor,
Mini Test Oluştur) mesaj olarak gönderiliyor; şu an hepsi aynı genel prompt'u
kullanıyor — madde 5'teki farklı davranışlar (örn. "Mini Test Oluştur"ın gerçek
bir quiz UI'ı üretmesi) Phase 4'te soru motoruyla birlikte gelecek.

## Bilinen Sınırlamalar (Phase 1 sonu itibarıyla)

- Sadece Credentials auth var; "şifremi unuttum" akışı yok.
- Admin paneli yok (madde 12, Phase 6).
- Soru motoru, sınav modu, gamification, notlar, dosya yükleme yok (Phase 2, 4, 5).
- `data/curriculum/` altındaki import pipeline'ı kuruldu (Phase 2) ama içindeki
  dataset hâlâ sadece 1 örnek konu — gerçek MEB müfredatı henüz eklenmedi.
- Import script'i CLI'dan çalışıyor; admin panelinden dataset yükleme (Phase 6)
  henüz yok.
- AI cevap doğrulaması sadece kaynak kodu + basit aritmetik kontrolü yapıyor;
  fizik/kimya formülleri veya sembolik matematik için deterministik doğrulama
  yok (Phase 4'te soru motoruyla birlikte genişletilmeli).
- `.env`'de gerçek bir `ANTHROPIC_API_KEY` olmadan `/panel/ai-ogretmen` 503
  hatası döner — bu beklenen davranış (madde 29).

## Sonraki Fazlar

| Faz | İçerik | Durum |
|---|---|---|
| 1 | Auth, DB, temel UI | Kod yazıldı, doğrulanmadı |
| 2 | Müfredat import pipeline | Kod yazıldı, doğrulanmadı |
| 3 | AI Öğretmen, RAG, kaynak gösterme, temel halüsinasyon koruması | Kod yazıldı, doğrulanmadı |
| 4 | Soru motoru, sınav modu, CAS tabanlı matematik doğrulama | Yapılmadı |
| 5 | Kişiselleştirme, çalışma planları, öneriler | Yapılmadı |
| 6 | Admin paneli, moderasyon, hatalı cevap raporu | Yapılmadı |
| 7 | Test suite, güvenlik sertleştirme, deployment | Yapılmadı |

Her faz ayrı bir sohbette, önceki fazın çalıştığı doğrulandıktan sonra ele alınmalı —
bu tek pakette hepsini üretmek "çalışıyor gibi görünen kod" riskini artırır. Bu paket
şu anda 3 faz üst üste doğrulanmadan yazıldığı için bu risk normalden yüksek —
bir sonraki adım olarak Phase 1-3'ün gerçekten build olup olmadığını kontrol
etmen önemle öneriliyor.
