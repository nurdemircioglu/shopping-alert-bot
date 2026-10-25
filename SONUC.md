# Trendyol Koton mağaza kupon okuma — fizibilite testi

Tarih: 2026-10-25 · Makine: Mac (Berkays-MacBook-Pro) · Hedef: https://www.trendyol.com/magaza/koton-m-637?sst=0

## Sonuç: OKUNABİLİYOR, ama yalnızca gerçek tarayıcıyla

| Yöntem | Sonuç |
|---|---|
| Düz fetch (`test.js`) | **Engellendi.** HTTP 403, Cloudflare "Sorry, you have been blocked" |
| Playwright, görünür (headful) Chromium (`node browser-test.js --headful`) | **Çalıştı.** HTTP 200, engel/captcha yok, 2 kez denendi, ikisinde de sorunsuz |
| Playwright headless | Denenmedi |

Bu IP engelli değil. Cloudflare istemci parmak izine göre engelliyor.

## Okunan İndirim Kodları (25.10.2026 ~09:17 TR saati)

| İndirim | Kod | Alt Limit | Kalan | Ekrandaki geri sayım | Bitiş (TR saati) |
|---|---|---|---|---|---|
| 250 TL | **KOTON250** | 1200 TL | 4327 / 5000 adet | 1:13:42 | 2026-10-26 23:00 |
| 300 TL | **KOTON300** | 1500 TL | 2767 / 5000 adet | 0:13:42 | 2026-10-25 23:00 |

Geri sayım biçimi `gün:saat:dakika` şeklinde. `1:13:42` = 1 gün 13 saat 42 dakika.

İlk açılışta bir "Takip Et" pop-up'ı çıkıyor. Bu pop-up ayrı bir kupon gösteriyor: 750 TL'ye 50 TL, 25.10 14:11'de bitiyor.
Script pop-up'ı kapatıp kartları öyle okuyor.

## Veri kaynağı

- **İndirim Kodları için ayrı bir JSON endpoint'i yok.**
- Veriler mağaza sayfasının kendi HTML'inde (SSR), gömülü state içinde geliyor: `promotions.codePromotions[]`.
- Bu yüzden düz HTTP ile alınamıyor (403). Sayfanın gerçek tarayıcıda açılması gerekiyor.

Her kod için gelen alanlar (örnek, kısaltılmış):

```json
{
  "id": 30982140,
  "name": "1.200 TL'ye 250 TL İndirim Kodu",
  "startDate": "2026-10-22T23:00:00.000",
  "endDate": "2026-10-26T23:00:00.000",
  "status": "INUSE",
  "codes": { "items": [ { "code": "KOTON250", "maxUsageCount": 5000,
                          "currentUsageCount": 673, "remainingUsageCount": "4327" } ] },
  "maxOrderCountPerUser": "1",
  "selectionConditionOverValue": 1200,
  "awardType": "AMOUNT",
  "awardValue": 250,
  "remainingTime": 135749614
}
```

Alan karşılıkları:
- Kod: `codes.items[0].code`
- Alt limit: `selectionConditionOverValue`
- İndirim: `awardValue` (`awardType`)
- Kalan adet: `remainingUsageCount`
- Bitiş: `endDate` (TR saati) veya `remainingTime` (ms)

Bu yol, kart metnini ayrıştırmaktan daha sağlam.

Takip pop-up kuponu için ayrı endpoint'ler (bunlar İndirim Kodları değil):
- `apigw.trendyol.com/discovery-sellerstore-gateway-service/api/coupon/getAvailableCoupons?sellerId=637&...`
- `apigw.trendyol.com/discovery-sellerstore-gateway-service/api/follow/?sellerId=637&checkCoupon=true&...`

## Engel / captcha

- Düz HTTP: Cloudflare kesin engeli (Ray ID a4ff127db980d2a9). Çözülecek bir captcha yok.
- Gerçek tarayıcı: Engel veya captcha görülmedi.
- Toplam istek: 1 düz fetch + 2 tarayıcı sayfa açılışı (+ `npm run check` içindeki 1 fetch).

## Çoklu mağaza testi (`magazalar-test.js --headful`, 25.10.2026 ~09:27)

- 7 mağazanın 7'si de HTTP 200 döndü. Engel veya captcha yok. Sayfa açılışları arasında 10-15 sn beklendi.
- Tüm mağazalarda veri aynı yerde, aynı yapıda geliyor:
  - Gömülü state: `window["__ss-home-page__PROPS"]`
  - İndirim kodları: `promotions.codePromotions[]`
  - Kampanyalar: `promotions.promotionWithProducts[]`
  - Kuponlar: `coupon.collectable[]`

| Mağaza | İndirim kodları | Kuponlar | Kampanyalar |
|---|---|---|---|
| Koton | KOTON250 (250 TL / 1200 TL alt limit, 4326 kaldı, 26.10 23:00)<br>KOTON300 (300 TL / 1500 TL alt limit, 2764 kaldı, 25.10 23:00) | — | 2 Adet ve Üzeri %50 İndirim<br>Trendyol Plus'a Özel Fiyat |
| Mango | — | — | — |
| H&M | — | — | — |
| Stradivarius | — | — | — |
| Pull&Bear | — | — | 3 Adet ve Üzeri %10 İndirim (28.11'e kadar)<br>2 Adet ve Üzeri %5 İndirim |
| Bershka | — | — | 2 Adet ve Üzeri %5 İndirim<br>3 Adet ve Üzeri %10 İndirim |
| Züber | — | 75 TL (750 TL alt limit)<br>200 TL (1500 TL alt limit)<br>300 TL (2000 TL alt limit)<br>"Son 2 gün", 27.10 00:00 | Trendyol Plus'a Özel Fiyat |

Notlar:
- Mango, H&M ve Stradivarius'ta o anda kod, kupon veya kampanya yoktu.
  Bu mağazalarda ekrandaki "Kampanyalar" metni aslında sayfa altbilgisindeki bağlantıydı.
  Script artık metin yerine state verisini kullanıyor.
- Kuponlar, indirim kodlarından farklı. Kuponların bir kodu yok, "Kazan" butonuyla hesaba toplanıyorlar (`couponType: COLLECTABLE`).
- Kampanya ve kuponların tam listesi `magazalar-sonuc.json` ve `magazalar/*-state.json` dosyalarında.

## Öneriler

- Sık ve düzenli çekim yapılırsa Cloudflare tarayıcıyı da engelleyebilir. Seyrek kontrol (ör. saatte bir) ve tek sayfa açılışı önerilir.
- Ayrıştırmayı DOM metni yerine sayfadaki `promotions.codePromotions` JSON'una geçirmek daha sağlam olur.
- Headless modu test edilmedi. Sunucuda çalıştırılacaksa ayrıca denenmeli.

## Dosyalar

- `test.js`: düz fetch denemesi
- `browser-test.js`: çalışan tarayıcı scripti (tek mağaza)
- `magazalar-test.js`: çok mağazalı toplayıcı
- `magazalar-sonuc.json`, `magazalar/`: çok mağazalı test çıktıları
- `kuponlar.json`: okunan kartlar
- `kupon-endpointleri.json`: eşleşen ağ yanıtları
- `kupon-bolumu.html`, `sayfa-tam.html`: sayfa HTML'leri
- `sayfa.png`: ekran görüntüsü
- `fetch-sonuc.html`: Cloudflare engel sayfası
- `package.json`: playwright yalnızca bu klasörde
