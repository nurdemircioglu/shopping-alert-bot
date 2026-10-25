# Shopping Alert bot

Trendyol mağazalarını 15 dakikada bir gezer; indirim kodlarını, kuponları ve kampanyaları toplar.
Yeni bir fırsat çıkınca story / Reel görsellerini hazırlar ve Telegram'a gönderir.

- **Takip sayfası ve paylaşımlar:** GitHub Pages (`index.html`, `paylasim.html`)
- **Mağaza eklemek:** `magazalar.json` dosyasına `{ "ad": "...", "url": "https://www.trendyol.com/magaza/..." }` satırı ekle
- **Elle çalıştırmak:** Actions → "Kupon takip" → Run workflow

## Ayarlar (Settings → Secrets and variables → Actions)

| Secret | Ne |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather'ın verdiği token |
| `TELEGRAM_KANAL_ID` | Herkese açık kanal, ör. `@shoppingalerttr` |
| `TELEGRAM_CHAT_ID` | Yöneticinin Telegram ID'si (özel bildirimler) |

## Yerelde

```bash
npm install
node magazalar-test.js --headful              # tüm mağazalar
node magazalar-test.js --headful --listeler   # + en yeniler / çok satanlar
node magazalar-test.js --headful "--sadece=Koton,Mango"   # yalnız deneme
```
