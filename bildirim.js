// Yeni olay (yeni kod / tükeniyor / son saatler) varsa Telegram'a gönderir. Tek bot, iki hedef:
//  - TELEGRAM_KANAL_ID: herkese açık kanal → her olay için story görseli + kısa açıklama
//  - TELEGRAM_CHAT_ID:  yönetici (sen) → aynı görseller + Reel + paylaşım sayfası linki
// TELEGRAM_BOT_TOKEN yoksa ya da hedeflerin hiçbiri yoksa hiçbir şey yapmaz.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'paylasim');
const MARKA = 'Shopping Alert';

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tl = n => n == null ? '' : Number(n).toLocaleString('tr-TR') + ' TL';

// Telegram açıklaması (parse_mode HTML). Kod <code> içinde: Telegram'da dokununca kopyalanır.
function aciklama(o) {
  const { kalanYazi } = require('./paylasim-olustur');
  const ne = { kod: 'indirim kodu', kupon: 'kupon', kampanya: 'kampanya' }[o.tur] || o.tur;
  const satirlar = [`🆕 <b>${esc(o.magaza)}</b> · yeni ${ne}!`];
  if (o.tur === 'kampanya') {
    satirlar.push(`🏷️ ${esc(o.ad)}`, `💸 ${esc(o.indirim)}${o.kosul ? ` · ${esc(o.kosul)}` : ''}`);
  } else {
    satirlar.push(`💸 ${esc(o.indirim)} indirim · ${esc(tl(o.altLimit))} ve üzeri`);
    if (o.tur === 'kod') satirlar.push(`🔑 Kod: <code>${esc(o.kod)}</code>  (dokun, kopyalansın)`);
    else satirlar.push('👉 Mağaza sayfasında kupona “Kazan” de');
  }
  const kalan = o.tur === 'kod' && o.kalan != null ? `📦 ${Number(o.kalan).toLocaleString('tr-TR')} adet kaldı · ` : '';
  satirlar.push(`${kalan}⏳ ${esc(kalanYazi(o.bitis))}`);
  if (o.url) satirlar.push(`🛍️ ${esc(o.url.split('?')[0])}`);
  return satirlar.join('\n');
}

async function gonder(chatId, yontem, alanlar, dosyaAlani, dosya) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('parse_mode', 'HTML');
  for (const [k, v] of Object.entries(alanlar)) form.append(k, v);
  if (dosya) form.append(dosyaAlani, new Blob([fs.readFileSync(dosya)]), path.basename(dosya));
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${yontem}`, { method: 'POST', body: form });
  await new Promise(res => setTimeout(res, 1100));   // Telegram sınırı: ~1 mesaj/sn
  if (!r.ok) console.log(`Telegram hatası (${chatId}):`, r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

async function bildir(olaylar) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_KANAL_ID: kanal, TELEGRAM_CHAT_ID: yonetici } = process.env;
  if (!token || (!kanal && !yonetici) || !olaylar || !olaylar.length) return;
  const gorseller = fs.readdirSync(OUT).filter(f => /^\d+-.*\.png$/.test(f)).sort();

  if (kanal) {
    for (const [i, f] of gorseller.entries()) {
      const o = olaylar[i];
      await gonder(kanal, 'sendPhoto', { caption: `${o ? aciklama(o) : ''}\n\n🔔 ${MARKA}` }, 'photo', path.join(OUT, f));
    }
  }

  if (yonetici) {
    const site = process.env.SITE_URL ? `\n📲 Tüm paylaşımlar: ${process.env.SITE_URL}paylasim.html` : '';
    await gonder(yonetici, 'sendMessage', { text: `🔔 ${olaylar.length} yeni fırsat${kanal ? ' (kanala da gönderildi)' : ''}${site}` });
    for (const [i, f] of gorseller.entries()) {
      await gonder(yonetici, 'sendPhoto', { caption: olaylar[i] ? aciklama(olaylar[i]) : '' }, 'photo', path.join(OUT, f));
    }
    const reel = path.join(OUT, 'reel.mp4');
    if (fs.existsSync(reel)) {
      const reelMetni = fs.existsSync(path.join(OUT, 'reel-aciklama.txt')) ? fs.readFileSync(path.join(OUT, 'reel-aciklama.txt'), 'utf8') : '';
      await gonder(yonetici, 'sendVideo', { caption: esc(reelMetni.slice(0, 1000)) }, 'video', reel);
    }
  }
  console.log('Telegram: bildirim gönderildi');
}

module.exports = bildir;
module.exports.gonder = gonder;
module.exports.aciklama = aciklama;
