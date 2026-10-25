// Günün kodlarından ~12-16 sn'lik dikey Reels videosu (1080x1920 MP4, sessiz) + kapak görseli üretir.
// Müzik bilerek yok: Instagram/TikTok'ta trend bir ses eklemek erişimi artırır.
// Kullanım: node reel-olustur.js   (magazalar-test.js bitince otomatik de çalışır)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ffmpeg = require('ffmpeg-static');
const { veriTopla } = require('./rapor-olustur');

const DIR = __dirname;
const OUT = path.join(DIR, 'paylasim');
const FPS = 24;
const GIRIS = 2.2, KART = 2.6, CIKIS = 2.2;   // saniye

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = n => n == null ? '' : Number(n).toLocaleString('tr-TR') + ' TL';
const bitisMs = b => new Date(String(b).replace(/(\.\d+)?$/, '') + '+03:00').getTime();
function kalanYazi(b) {
  const t = bitisMs(b) - Date.now();
  const g = Math.floor(t / 864e5), s = Math.floor(t % 864e5 / 36e5), d = Math.floor(t % 36e5 / 6e4);
  return g ? `${g} gün ${s} saat` : s ? `${s} saat ${d} dk` : `${d} dk`;
}

function secim() {
  const veri = veriTopla();
  const liste = [];
  for (const m of veri.magazalar) {
    for (const k of m.kodlar) liste.push({ tur: 'kod', magaza: m.ad, ...k });
    for (const k of m.kuponlar) liste.push({ tur: 'kupon', magaza: m.ad, ...k });
  }
  return liste.filter(f => bitisMs(f.bitis) > Date.now())
    .sort((a, b) => (a.tur === 'kod' ? 0 : 1) - (b.tur === 'kod' ? 0 : 1) || bitisMs(a.bitis) - bitisMs(b.bitis))
    .slice(0, 4);
}

function html(kartlar) {
  const tarih = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
  const sahne = (i, ic) => {
    const bas = GIRIS + i * KART;
    return `<section class="sahne kart-sahne" style="--bas:${bas}s;--sure:${KART}s">${ic}</section>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden}
  body{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#fff;background:linear-gradient(160deg,#ff8a2a 0%,#f2541b 55%,#c2185b 100%)}
  .sahne{position:absolute;inset:0;padding:160px 80px;display:flex;flex-direction:column;justify-content:center;opacity:0;
    animation:gor var(--sure) linear var(--bas) both}
  @keyframes gor{0%{opacity:0}6%{opacity:1}94%{opacity:1}100%{opacity:0}}
  .rozet{align-self:flex-start;background:#fff;color:#f2541b;font-weight:800;font-size:44px;padding:16px 34px;border-radius:999px}
  .buyuk{font-size:128px;font-weight:900;line-height:1;letter-spacing:-.03em;margin:40px 0}
  .orta{font-size:52px;opacity:.95}
  .giris .buyuk,.cikis .buyuk{animation:yuksel .7s cubic-bezier(.2,.8,.2,1) calc(var(--bas) + .1s) both}
  @keyframes yuksel{from{transform:translateY(80px);opacity:0}to{transform:none;opacity:1}}
  .kart{background:#fff;color:#1f1d1a;border-radius:44px;padding:56px 56px 48px;animation:kay .6s cubic-bezier(.2,.8,.2,1) calc(var(--bas) + .05s) both}
  @keyframes kay{from{transform:translateY(140px) scale(.94);opacity:0}to{transform:none;opacity:1}}
  .ust{display:flex;justify-content:space-between;align-items:baseline}.magaza{font-size:50px;font-weight:700;color:#7a746b}
  .tutar{font-size:170px;font-weight:900;color:#f2541b;line-height:1;letter-spacing:-.03em}
  .kosul{font-size:46px;color:#7a746b;margin-top:10px}
  .kod{margin-top:34px;border:5px dashed #f2541b;border-radius:26px;padding:26px;text-align:center;font:800 96px ui-monospace,Menlo,monospace;letter-spacing:.06em;
    animation:vurgu .5s ease calc(var(--bas) + .9s) both}
  @keyframes vurgu{0%{transform:scale(.9);background:#fff}50%{transform:scale(1.06);background:#fff1e6}100%{transform:none;background:#fff}}
  .bilgi{display:flex;justify-content:space-between;margin-top:28px;font-size:44px;color:#7a746b}.bilgi b{color:#c4452f}
  .sira{position:absolute;top:110px;left:80px;font-size:44px;font-weight:700;opacity:.9}
  .ipucu{margin-top:40px;font-size:46px;text-align:center;opacity:.95}
  </style></head><body>
  <section class="sahne giris" style="--bas:0s;--sure:${GIRIS}s">
    <div class="rozet">${esc(tarih)}</div>
    <div class="buyuk">Bugün geçerli<br>Trendyol<br>kodları 🔥</div>
    <div class="orta">Kaydet, sepette kullan</div>
  </section>
  ${kartlar.map((f, i) => sahne(i, `
    <div class="sira">${i + 1} / ${kartlar.length}</div>
    <div class="kart">
      <div class="ust"><span class="tutar">${esc(f.indirim)}</span><span class="magaza">${esc(f.magaza)}</span></div>
      <div class="kosul">${esc(tl(f.altLimit))} ve üzeri</div>
      ${f.tur === 'kod' ? `<div class="kod">${esc(f.kod)}</div>` : `<div class="kod" style="font-size:64px">“KAZAN”a bas</div>`}
      <div class="bilgi"><span>${f.tur === 'kod' ? Number(f.kalan).toLocaleString('tr-TR') + ' adet kaldı' : 'Mağaza kuponu'}</span><span>⏳ <b>${esc(kalanYazi(f.bitis))}</b></span></div>
    </div>
    <div class="ipucu">${f.tur === 'kod' ? 'Sepette “İndirim Kodu” alanına yaz' : 'Mağaza sayfasında kuponu topla'}</div>`)).join('')}
  <section class="sahne cikis" style="--bas:${GIRIS + kartlar.length * KART}s;--sure:${CIKIS + 0.3}s">
    <div class="buyuk">Kaçırmamak<br>için takip et 🔔</div>
    <div class="orta">Yeni kodları ilk biz paylaşıyoruz</div>
  </section>
  </body></html>`;
}

async function olustur() {
  const kartlar = secim();
  if (!kartlar.length) { console.log('Reel: geçerli kod/kupon yok, video üretilmedi'); return null; }
  fs.mkdirSync(OUT, { recursive: true });
  const kareDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'reel-'));
  const sure = GIRIS + kartlar.length * KART + CIKIS;
  const toplamKare = Math.round(sure * FPS);

  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(html(kartlar));
  await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  // Her kareyi animasyon zamanını elle ayarlayarak çek: takılma olmadan akıcı video
  for (let i = 0; i < toplamKare; i++) {
    const ms = (i / FPS) * 1000;
    await page.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), ms);
    await page.screenshot({ path: path.join(kareDir, `k${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (Math.abs(ms - (GIRIS + 0.9) * 1000) < 500 / FPS) fs.copyFileSync(path.join(kareDir, `k${String(i).padStart(4, '0')}.jpg`), path.join(OUT, 'reel-kapak.jpg'));
  }
  await browser.close();

  const mp4 = path.join(OUT, 'reel.mp4');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(kareDir, 'k%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  fs.rmSync(kareDir, { recursive: true, force: true });

  const aciklama = [
    `🔥 Bugün geçerli Trendyol indirim kodları`,
    ...kartlar.map(f => `• ${f.magaza} ${f.indirim}${f.tur === 'kod' ? ` → ${f.kod}` : ' kupon (mağazada Kazan)'} · ${tl(f.altLimit)} ve üzeri · ⏳ ${kalanYazi(f.bitis)}`),
    '', 'Kaydet 📌 Arkadaşına gönder 💌 Kaçırmamak için takip et 🔔',
    '', '#trendyol #indirimkodu #kupon #efsanekasım #indirim #fırsat #alışveriş',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'reel-aciklama.txt'), aciklama);
  console.log(`Reel: ${sure.toFixed(1)} sn, ${kartlar.length} kart → ${mp4}`);
  return mp4;
}

module.exports = olustur;
if (require.main === module) olustur().catch(e => { console.error('HATA:', e.message); process.exit(1); });
