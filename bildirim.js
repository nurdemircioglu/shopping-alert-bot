// Yeni olay (yeni kod / tükeniyor / son saatler) varsa Telegram'a gönderir. Tek bot, iki hedef:
//  - TELEGRAM_KANAL_ID: herkese açık kanal → her olay için story görseli + kısa açıklama
//  - TELEGRAM_CHAT_ID:  yönetici (sen) → aynı görseller + Reel + paylaşım sayfası linki
// TELEGRAM_BOT_TOKEN yoksa ya da hedeflerin hiçbiri yoksa hiçbir şey yapmaz.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'paylasim');
const MARKA = 'Shopping Alert';

async function gonder(chatId, yontem, alanlar, dosyaAlani, dosya) {
  const form = new FormData();
  form.append('chat_id', chatId);
  for (const [k, v] of Object.entries(alanlar)) form.append(k, v);
  if (dosya) form.append(dosyaAlani, new Blob([fs.readFileSync(dosya)]), path.basename(dosya));
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${yontem}`, { method: 'POST', body: form });
  if (!r.ok) console.log('Telegram hatası:', r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

async function bildir(olaylar) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_KANAL_ID: kanal, TELEGRAM_CHAT_ID: yonetici } = process.env;
  if (!token || (!kanal && !yonetici) || !olaylar || !olaylar.length) return;
  const gorseller = fs.readdirSync(OUT).filter(f => /^\d+-.*\.png$/.test(f)).sort();

  if (kanal) {
    for (const [i, f] of gorseller.entries()) {
      const o = olaylar[i];
      const url = o && o.url ? `\n🛍️ ${o.url.split('?')[0]}` : '';
      await gonder(kanal, 'sendPhoto', { caption: `${(o && o.metin) || ''}${url}\n\n🔔 ${MARKA}` }, 'photo', path.join(OUT, f));
    }
  }

  if (yonetici) {
    const site = process.env.SITE_URL ? `\n📲 Tüm paylaşımlar: ${process.env.SITE_URL}paylasim.html` : '';
    await gonder(yonetici, 'sendMessage', { text: `🔔 ${olaylar.length} yeni fırsat${kanal ? ' (kanala da gönderildi)' : ''}${site}` });
    for (const [i, f] of gorseller.entries()) {
      await gonder(yonetici, 'sendPhoto', { caption: (olaylar[i] && olaylar[i].metin) || '' }, 'photo', path.join(OUT, f));
    }
    const reel = path.join(OUT, 'reel.mp4');
    if (fs.existsSync(reel)) {
      const aciklama = fs.existsSync(path.join(OUT, 'reel-aciklama.txt')) ? fs.readFileSync(path.join(OUT, 'reel-aciklama.txt'), 'utf8') : '';
      await gonder(yonetici, 'sendVideo', { caption: aciklama.slice(0, 1000) }, 'video', reel);
    }
  }
  console.log('Telegram: bildirim gönderildi');
}

module.exports = bildir;
module.exports.gonder = gonder;
