// Son toplama ile bir öncekini karşılaştırır, değişiklikleri bulur ve paylaşıma hazır
// story görselleri (1080x1920 PNG) + açıklama metni üretir. İnternete bağlanmaz.
// Kullanım: node paylasim-olustur.js   (magazalar-test.js bitince otomatik de çalışır)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { veriTopla } = require('./rapor-olustur');

const DIR = __dirname;
const OUT = path.join(DIR, 'paylasim');
const GECMIS = path.join(DIR, 'gecmis.json');
const AZ_KALDI = 0.15;          // stokun %15'inden azı kaldıysa "tükeniyor"
const SON_SAATLER = 6 * 36e5;   // 6 saatten az kaldıysa "son saatler"

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = n => n == null ? '' : Number(n).toLocaleString('tr-TR') + ' TL';
const bitisMs = b => new Date(String(b).replace(/(\.\d+)?$/, '') + '+03:00').getTime();
function kalanYazi(b) {
  const t = bitisMs(b) - Date.now();
  if (t <= 0) return 'süresi doldu';
  const g = Math.floor(t / 864e5), s = Math.floor(t % 864e5 / 36e5), d = Math.floor(t % 36e5 / 6e4);
  return g ? `${g} gün ${s} saat` : s ? `${s} saat ${d} dk` : `${d} dk`;
}

// Her fırsata kalıcı bir anahtar ver
function firsatlar(veri) {
  const out = [];
  for (const m of veri.magazalar) {
    for (const k of m.kodlar) out.push({ anahtar: `kod:${m.ad}:${k.kod}`, tur: 'kod', magaza: m.ad, url: m.url, ...k });
    for (const k of m.kuponlar) out.push({ anahtar: `kupon:${m.ad}:${k.indirim}:${k.altLimit}`, tur: 'kupon', magaza: m.ad, url: m.url, ...k });
    for (const k of m.kampanyalar) out.push({ anahtar: `kampanya:${m.ad}:${k.ad}`, tur: 'kampanya', magaza: m.ad, url: m.url, ...k });
  }
  return out;
}

// Her fırsat için her olay bir kez bildirilir (gecmis.json'daki "bildirilen" listesi)
function degisiklikler(simdi, onceki, ilkCalisma) {
  const once = new Map(onceki.map(f => [f.anahtar, f]));
  const olaylar = [];
  for (const f of simdi) {
    const o = once.get(f.anahtar);
    f.bildirilen = o ? [...(o.bildirilen || [])] : [];
    const kosullar = {
      yeni: !o && !ilkCalisma,
      tukeniyor: f.tur === 'kod' && f.toplam && f.kalan / f.toplam < AZ_KALDI,
      'son-saatler': f.bitis && bitisMs(f.bitis) - Date.now() > 0 && bitisMs(f.bitis) - Date.now() < SON_SAATLER,
    };
    for (const [olay, olur] of Object.entries(kosullar)) {
      if (!olur || f.bildirilen.includes(olay)) continue;
      f.bildirilen.push(olay);
      // İlk çalışmada mevcut durumu kaydet ama bildirim üretme
      if (!ilkCalisma) { olaylar.push({ olay, ...f }); break; }
    }
  }
  return olaylar;
}

const OLAY = { yeni: 'YENİ', tukeniyor: 'TÜKENİYOR', 'son-saatler': 'SON SAATLER' };

function storyHtml({ baslik, rozet, satirlar, alt }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}body{width:1080px;height:1920px;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;
  background:linear-gradient(160deg,#ff8a2a 0%,#f2541b 55%,#c2185b 100%);color:#fff;padding:140px 80px;display:flex;flex-direction:column}
  .rozet{align-self:flex-start;background:#fff;color:#f2541b;font-weight:800;font-size:40px;padding:14px 30px;border-radius:999px;letter-spacing:.04em}
  h1{font-size:92px;line-height:1.02;margin:44px 0 56px;letter-spacing:-.02em}
  .kart{background:#fff;color:#1f1d1a;border-radius:36px;padding:40px 44px;margin-bottom:28px}
  .ust{display:flex;justify-content:space-between;align-items:baseline}.magaza{font-size:38px;font-weight:700;color:#7a746b}
  .tutar{font-size:84px;font-weight:900;color:#f2541b;line-height:1}.kosul{font-size:34px;color:#7a746b;margin-top:6px}
  .kod{margin-top:22px;border:4px dashed #f2541b;border-radius:20px;padding:16px;text-align:center;font:800 64px ui-monospace,Menlo,monospace;letter-spacing:.06em}
  .bilgi{display:flex;justify-content:space-between;margin-top:18px;font-size:32px;color:#7a746b}.bilgi b{color:#c4452f}
  .alt{margin-top:auto;font-size:36px;opacity:.95;text-align:center}
  .tek h1{margin-top:auto;font-size:110px}.tek .tutar{font-size:130px}.tek .kod{font-size:92px;padding:26px}.tek .kosul,.tek .bilgi{font-size:40px}
  </style></head><body class="${satirlar.length === 1 ? 'tek' : ''}">
  <div class="rozet">${esc(rozet)}</div><h1>${baslik}</h1>
  ${satirlar.map(f => `<div class="kart">
    <div class="ust"><span class="tutar">${esc(f.indirim)}</span><span class="magaza">${esc(f.magaza)}</span></div>
    <div class="kosul">${f.tur === 'kampanya' ? esc(f.ad) : esc(tl(f.altLimit)) + ' ve üzeri'}${f.tur === 'kupon' ? ' · Kupon: “Kazan”a bas' : ''}</div>
    ${f.tur === 'kod' ? `<div class="kod">${esc(f.kod)}</div>` : ''}
    <div class="bilgi"><span>${f.tur === 'kod' ? `${Number(f.kalan).toLocaleString('tr-TR')} adet kaldı` : ''}</span><span>⏳ <b>${esc(kalanYazi(f.bitis))}</b></span></div>
  </div>`).join('')}
  <div class="alt">${esc(alt)}</div></body></html>`;
}

function metin(f) {
  const ne = f.tur === 'kod' ? `kodu: ${f.kod}` : f.tur === 'kupon' ? 'kuponu (mağazada “Kazan”a bas)' : `kampanyası: ${f.ad}`;
  const kosul = f.tur === 'kampanya' ? '' : ` · ${tl(f.altLimit)} ve üzeri`;
  const kalan = f.tur === 'kod' ? ` · ${Number(f.kalan).toLocaleString('tr-TR')} adet kaldı` : '';
  return `${OLAY[f.olay] || ''} ${f.magaza} ${f.indirim} ${ne}${kosul}${kalan} · ⏳ ${kalanYazi(f.bitis)}`.trim();
}

async function olustur() {
  fs.mkdirSync(OUT, { recursive: true });
  const veri = veriTopla();
  const simdi = firsatlar(veri);
  let onceki = null;
  try { onceki = JSON.parse(fs.readFileSync(GECMIS, 'utf8')); } catch {}
  const ilkCalisma = !onceki;
  const olaylar = degisiklikler(simdi, onceki || [], ilkCalisma);
  fs.writeFileSync(GECMIS, JSON.stringify(simdi, null, 2));

  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const ciz = async (dosya, opts) => {
    await page.setContent(storyHtml(opts));
    await page.screenshot({ path: path.join(OUT, dosya) });
  };

  // 1) Günün özeti: indirim kodları önce, sonra kuponlar; story'ye en fazla 3 kart sığar
  const ozet = simdi.filter(f => f.tur !== 'kampanya' && bitisMs(f.bitis) > Date.now())
    .sort((a, b) => (a.tur === 'kod' ? 0 : 1) - (b.tur === 'kod' ? 0 : 1) || bitisMs(a.bitis) - bitisMs(b.bitis)).slice(0, 3);
  if (ozet.length) await ciz('ozet-story.png', { rozet: 'GÜNÜN KODLARI', baslik: 'Bugün geçerli<br>indirim kodları', satirlar: ozet, alt: 'Kaydet, alışverişte kullan 🧡' });

  // 2) Her değişiklik için ayrı story
  for (const [i, f] of olaylar.entries()) {
    const baslik = f.olay === 'yeni' ? `${esc(f.magaza)}'da<br>yeni ${f.tur === 'kod' ? 'indirim kodu' : f.tur}!`
      : f.olay === 'tukeniyor' ? 'Hızlı ol,<br>kod tükeniyor!' : 'Son saatler,<br>kaçırma!';
    await ciz(`${String(i + 1).padStart(2, '0')}-${f.olay}.png`, { rozet: OLAY[f.olay], baslik, satirlar: [f], alt: 'Takipte kal, fırsatları ilk sen gör 🔔' });
  }
  await browser.close();

  const hashtag = '#trendyol #indirimkodu #kupon #efsanekasım #indirim #fırsat';
  const satirlar = [
    `Güncelleme: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`,
    ilkCalisma ? '(İlk çalışma: değişiklikleri bir sonraki çalışmadan itibaren yakalarım.)' : '',
    '', '== DEĞİŞİKLİKLER ==', ...(olaylar.length ? olaylar.map(metin) : ['Yeni bir şey yok.']),
    '', '== GÜNÜN ÖZETİ (açıklama metni) ==',
    '🔥 Bugün geçerli Trendyol indirim kodları:',
    ...simdi.filter(f => f.tur !== 'kampanya').map(f => '• ' + metin({ ...f, olay: '' })),
    '', hashtag,
  ];
  fs.writeFileSync(path.join(OUT, 'metin.txt'), satirlar.join('\n'));
  for (const o of olaylar) o.metin = metin(o);   // bildirim.js görsel açıklaması olarak kullanır
  console.log(`Paylaşım: ${olaylar.length} değişiklik, ${fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length} görsel → ${OUT}`);
  return olaylar;
}

module.exports = olustur;
if (require.main === module) olustur().catch(e => { console.error('HATA:', e.message); process.exit(1); });
