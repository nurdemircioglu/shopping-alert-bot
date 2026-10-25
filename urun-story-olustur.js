// Mağaza ürünlerinden story'ler (1080x1920 PNG) üretir:
//  - urunler-<magaza>.png       mağaza ana sayfasındaki en çok beğenilenler (puanlanarak seçilir)
//  - yeniler-<magaza>.png       en yeni ürünler (listeler/<id>-en-yeniler)
//  - coksatan-<magaza>.png      çok satanlar (listeler/<id>-cok-satanlar)
//  - sepet-<magaza>.png         aktif indirim koduyla örnek sepet hesabı
// Kullanım: node urun-story-olustur.js   (magazalar-test.js bitince otomatik de çalışır)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { veriTopla } = require('./rapor-olustur');

const DIR = __dirname;
const OUT = path.join(DIR, 'paylasim');
const ADET = 6;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = n => n == null ? '' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' TL';
const bugun = () => new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
const saat = () => new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const oku = f => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'magazalar', f), 'utf8')); } catch { return []; } };

// "343 kişi favoriledi" → 343, "1,3B kişi" → 1300
function sosyalSayi(s) {
  const m = String(s || '').match(/([\d.,]+)\s*([BbKk])?/);
  if (!m) return 0;
  return Number(m[1].replace(/\./g, '').replace(',', '.')) * (m[2] ? 1000 : 1);
}
const indirimli = u => ({ ...u, indirim: u.eskiFiyat ? Math.round((1 - u.fiyat / u.eskiFiyat) * 100) : 0 });
const gecerli = u => u.gorsel && u.fiyat;

function enBegenilenler(urunler) {
  const bonus = { 'Trend Ürünler': 300, 'Kaçırılmayacak Ürünler': 250, 'Dikkat Çeken Ürünler': 150 };
  return urunler.filter(gecerli).map(indirimli)
    .map(u => ({ ...u, skor: sosyalSayi(u.sosyal) + u.indirim * 20 + (bonus[u.bolum] || 0) + (u.puan || 0) * 30 }))
    .sort((a, b) => b.skor - a.skor).slice(0, ADET);
}
// Listeler zaten Trendyol tarafından sıralı geliyor: sırayı koru
const ilkler = urunler => urunler.filter(gecerli).map(indirimli).slice(0, ADET);

const ORTAK_CSS = `*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden}
  body{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;background:#f7f1ea;color:#1f1d1a;padding:130px 56px 0;display:flex;flex-direction:column}
  h1{font-size:76px;line-height:1.05;letter-spacing:-.02em;margin-bottom:12px}
  .alt-baslik{font-size:36px;color:#7a746b;margin-bottom:26px}
  .kod{margin-top:24px;background:#1f1d1a;color:#fff;border-radius:28px;padding:26px 32px;display:flex;justify-content:space-between;align-items:center}
  .kod span{font-size:34px}.kod b{font:800 52px ui-monospace,Menlo,monospace;letter-spacing:.05em;color:#ffb27a}
  .link-alani{flex:1}`;

const kodBandi = kod => kod ? `<div class="kod"><span>${esc(tl(kod.altLimit))} üzeri ${esc(kod.indirim)} indirim</span><b>${esc(kod.kod)}</b></div>` : '';

function kolajHtml({ baslik, altBaslik, urunler, kod }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${ORTAK_CSS}
  .izgara{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px}
  .urun{position:relative;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 6px 24px rgba(60,40,20,.08)}
  .urun img{display:block;width:100%;aspect-ratio:2/3;height:auto;object-fit:cover;object-position:top}
  .rozet{position:absolute;top:12px;left:12px;background:#f2541b;color:#fff;font-weight:800;font-size:26px;padding:4px 14px;border-radius:999px}
  .bilgi{padding:10px 14px 12px}
  .ad{font-size:21px;color:#5c564e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fiyat{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:6px}
  .fiyat b{font-size:32px;color:#f2541b}.fiyat s{font-size:22px;color:#a39c92}
  .sosyal{font-size:20px;color:#a35b1a;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  </style></head><body>
  <h1>${baslik}</h1><div class="alt-baslik">${esc(altBaslik)}</div>
  <div class="izgara">${urunler.map(u => `<div class="urun">
    <img src="${esc(u.gorsel)}">${u.indirim >= 5 ? `<div class="rozet">%${u.indirim}</div>` : ''}
    <div class="bilgi"><div class="ad">${esc(u.ad)}</div>
      <div class="fiyat"><b>${tl(u.fiyat)}</b>${u.eskiFiyat ? `<s>${tl(u.eskiFiyat)}</s>` : ''}</div>
      ${u.sosyal ? `<div class="sosyal">🧡 ${esc(u.sosyal)}</div>` : ''}</div></div>`).join('')}</div>
  ${kodBandi(kod)}<div class="link-alani"></div></body></html>`;
}

// Alt limiti en az aşan 2-3 ürünlük kombinasyon: indirimin etkisi en büyük olan sepet
function sepetSec(urunler, altLimit) {
  const aday = urunler.filter(gecerli).slice(0, 18);
  let enIyi = null;
  const dene = sec => {
    const toplam = sec.reduce((t, u) => t + u.fiyat, 0);
    if (toplam >= altLimit && (!enIyi || toplam < enIyi.toplam)) enIyi = { urunler: sec, toplam };
  };
  for (let i = 0; i < aday.length; i++)
    for (let j = i + 1; j < aday.length; j++) {
      dene([aday[i], aday[j]]);
      for (let k = j + 1; k < aday.length; k++) dene([aday[i], aday[j], aday[k]]);
    }
  return enIyi;
}

function sepetHtml({ magaza, sepet, kod }) {
  const indirimTutar = parseFloat(String(kod.indirim).replace(/[^\d,]/g, '').replace(',', '.'));
  const odenecek = sepet.toplam - indirimTutar;
  const oran = Math.round((indirimTutar / sepet.toplam) * 100);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${ORTAK_CSS}
  body{background:linear-gradient(170deg,#fff4ea 0%,#f7f1ea 60%)}
  .etiket{align-self:flex-start;transform:rotate(-3deg);background:#fff;border:4px solid #1f1d1a;border-radius:20px;padding:14px 26px;font-size:46px;font-weight:800;box-shadow:8px 8px 0 #f2541b;margin-bottom:40px}
  .sepet{background:#fff;border-radius:36px;padding:16px 36px;box-shadow:0 10px 40px rgba(60,40,20,.1)}
  .satir{display:flex;gap:26px;align-items:center;padding:22px 0;border-bottom:2px solid #f1ebe4}
  .satir img{width:150px;height:225px;object-fit:cover;object-position:top;border-radius:18px;flex:none}
  .satir .ad{font-size:30px;line-height:1.25;color:#3a3631;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .satir .f{font-size:40px;font-weight:800;margin-top:10px}.satir .f s{font-size:26px;color:#a39c92;font-weight:500;margin-left:10px}
  .hesap{padding:24px 0 14px;font-size:34px}
  .hesap div{display:flex;justify-content:space-between;padding:8px 0}
  .hesap .indirim{color:#2f8a57;font-weight:700}
  .hesap .toplam{border-top:3px dashed #e7e2db;margin-top:10px;padding-top:20px;font-size:48px;font-weight:900}
  .hesap .toplam b{color:#f2541b}
  .not{font-size:24px;color:#a39c92;margin-top:16px;text-align:center}
  </style></head><body>
  <div class="etiket">🛒 ${esc(magaza)}'da ${esc(tl(kod.altLimit))} alana<br>${esc(kod.indirim)} indirim!!!</div>
  <div class="sepet">
    ${sepet.urunler.map(u => `<div class="satir"><img src="${esc(u.gorsel)}"><div><div class="ad">${esc(u.ad)}</div>
      <div class="f">${tl(u.fiyat)}${u.eskiFiyat ? `<s>${tl(u.eskiFiyat)}</s>` : ''}</div></div></div>`).join('')}
    <div class="hesap">
      <div><span>Ara toplam</span><span>${tl(sepet.toplam)}</span></div>
      <div class="indirim"><span>${esc(kod.kod)} kodu</span><span>−${tl(indirimTutar)}</span></div>
      <div class="toplam"><span>Ödeyeceğin</span><b>${tl(odenecek)}</b></div>
    </div>
  </div>
  <div class="kod"><span>Sepette <b style="font:inherit;color:#ffb27a">%${oran}</b> tasarruf</span><b>${esc(kod.kod)}</b></div>
  <div class="not">Fiyatlar ${esc(bugun())} ${esc(saat())} itibarıyla. Sepette değişebilir.</div>
  <div class="link-alani"></div></body></html>`;
}

async function olustur() {
  const veri = veriTopla();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const uretilen = [];
  const ciz = async (dosya, html, urunler) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT, dosya + '.png') });
    fs.writeFileSync(path.join(OUT, dosya + '-linkler.txt'),
      urunler.map(u => `${u.ad} · ${tl(u.fiyat)}${u.eskiFiyat ? ` (eski ${tl(u.eskiFiyat)})` : ''}\n${u.url}`).join('\n\n'));
    uretilen.push(dosya + '.png');
  };

  for (const m of veri.magazalar) {
    const s = slug(m.ad);
    const kod = m.kodlar.slice().sort((a, b) => a.altLimit - b.altLimit)[0];
    const cift = l => l.slice(0, l.length - (l.length % 3 === 0 ? 0 : l.length % 3));   // 3'lü satırlar

    const begenilen = cift(enBegenilenler(oku(`${s}-urunler.json`)));
    if (begenilen.length >= 3) await ciz(`urunler-${s}`, kolajHtml({ baslik: `${esc(m.ad)}'da en çok<br>beğenilenler 🧡`, altBaslik: `${begenilen.some(u => u.indirim >= 5) ? 'İndirimli fiyatlar' : 'Mağazanın favorileri'} · ${bugun()}`, urunler: begenilen, kod }), begenilen);

    const yeniler = cift(ilkler(oku(`${s}-en-yeniler.json`)));
    if (yeniler.length >= 3) await ciz(`yeniler-${s}`, kolajHtml({ baslik: `${esc(m.ad)}'da<br>yeni gelenler ✨`, altBaslik: `Mağazaya bu hafta eklenenler · ${bugun()}`, urunler: yeniler, kod }), yeniler);

    const coksatan = oku(`${s}-cok-satanlar.json`);
    const coksatanSecim = cift(ilkler(coksatan));
    if (coksatanSecim.length >= 3) await ciz(`coksatan-${s}`, kolajHtml({ baslik: `${esc(m.ad)}'da<br>çok satanlar 🔥`, altBaslik: `Herkes bunları alıyor · ${bugun()}`, urunler: coksatanSecim, kod }), coksatanSecim);

    // Sepet: önce çok satanlardan, yoksa ana sayfa ürünlerinden
    if (kod) {
      const sepet = sepetSec(coksatan.length ? coksatan : oku(`${s}-urunler.json`), kod.altLimit);
      if (sepet) await ciz(`sepet-${s}`, sepetHtml({ magaza: m.ad, sepet, kod }), sepet.urunler);
    }
  }
  await browser.close();
  console.log('Ürün story:', uretilen.length ? uretilen.join(', ') : 'yeterli ürün yok');
  return uretilen;
}

module.exports = olustur;
if (require.main === module) olustur().catch(e => { console.error('HATA:', e.message); process.exit(1); });
