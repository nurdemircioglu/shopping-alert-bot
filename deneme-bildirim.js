// Telegram biçimini görmek için TEK deneme mesajı: son "--sadece" denemesindeki ilk mağazanın
// en yakın biten kodu için story çizer, kanala ve yöneticiye "DENEME" etiketiyle gönderir.
// Geçmişe ve paylasim/ klasörüne dokunmaz.
// Kullanım: TELEGRAM_BOT_TOKEN=... TELEGRAM_KANAL_ID=@kanal TELEGRAM_CHAT_ID=123 node deneme-bildirim.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { storyHtml, metin } = require('./paylasim-olustur');
const { gonder } = require('./bildirim');

(async () => {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_KANAL_ID: kanal, TELEGRAM_CHAT_ID: yonetici } = process.env;
  const m = require('./magazalar-deneme.json').find(m => m.kodlar && m.kodlar.length);
  if (!m) throw new Error('magazalar-deneme.json içinde kodu olan mağaza yok; önce --sadece= ile deneme çalıştır');
  const k = [...m.kodlar].sort((a, b) => a.bitis.localeCompare(b.bitis))[0];
  const f = { ...k, tur: 'kod', magaza: m.magaza, url: m.url, olay: 'son-saatler' };

  const dosya = path.join(__dirname, 'deneme-story.png');
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(storyHtml({ rozet: 'DENEME', baslik: 'Son saatler,<br>kaçırma!', satirlar: [f], alt: 'Takipte kal, fırsatları ilk sen gör 🔔' }));
  await page.screenshot({ path: dosya });
  await browser.close();

  const caption = `🧪 DENEME MESAJI — biçim kontrolü\n\n${metin(f)}\n🛍️ ${m.url.split('?')[0]}\n\n🔔 Shopping Alert`;
  console.log('Görsel:', dosya, '\nAçıklama:\n' + caption);
  if (!token) return console.log('\nTELEGRAM_BOT_TOKEN yok, gönderilmedi.');
  for (const hedef of [kanal, yonetici].filter(Boolean)) {
    const ok = await gonder(hedef, 'sendPhoto', { caption }, 'photo', dosya);
    console.log(ok ? 'Gönderildi →' : 'GÖNDERİLEMEDİ →', hedef);
  }
})().catch(e => { console.error('HATA:', e.message); process.exit(1); });
