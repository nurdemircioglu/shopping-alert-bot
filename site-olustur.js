// GitHub Pages için site/ klasörünü hazırlar: index.html (takip sayfası) + paylasim.html (story/Reel galerisi).
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SITE = path.join(DIR, 'site');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GRUPLAR = [
  ['Yeni fırsat bildirimleri', f => /^\d+-.*\.png$/.test(f)],
  ['Reels', f => f === 'reel.mp4'],
  ['Günün kodları', f => f === 'ozet-story.png'],
  ['Sepet hesapları', f => f.startsWith('sepet-') && f.endsWith('.png')],
  ['En çok beğenilenler', f => f.startsWith('urunler-') && f.endsWith('.png')],
  ['Yeni gelenler', f => f.startsWith('yeniler-') && f.endsWith('.png')],
  ['Çok satanlar', f => f.startsWith('coksatan-') && f.endsWith('.png')],
];

function olustur() {
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE, 'p'), { recursive: true });
  fs.copyFileSync(path.join(DIR, 'rapor.html'), path.join(SITE, 'index.html'));
  const dosyalar = fs.existsSync(path.join(DIR, 'paylasim')) ? fs.readdirSync(path.join(DIR, 'paylasim')) : [];
  for (const f of dosyalar) fs.copyFileSync(path.join(DIR, 'paylasim', f), path.join(SITE, 'p', f));
  const metin = f => fs.existsSync(path.join(DIR, 'paylasim', f)) ? fs.readFileSync(path.join(DIR, 'paylasim', f), 'utf8') : '';
  const saat = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' });

  const bolumler = GRUPLAR.map(([baslik, eslesir]) => {
    const liste = dosyalar.filter(eslesir).sort();
    if (!liste.length) return '';
    return `<h2>${esc(baslik)}</h2><div class="izgara">${liste.map(f => {
      const linkler = f.endsWith('.png') ? metin(f.replace('.png', '-linkler.txt')) : '';
      const medya = f.endsWith('.mp4') ? `<video src="p/${f}" controls playsinline preload="metadata"></video>` : `<img src="p/${f}" loading="lazy" alt="">`;
      return `<figure>${medya}<figcaption><a href="p/${f}" download>İndir</a>${linkler ? `<details><summary>Ürün linkleri</summary><pre>${esc(linkler)}</pre></details>` : ''}</figcaption></figure>`;
    }).join('')}</div>`;
  }).join('');

  const aciklama = metin('reel-aciklama.txt') || metin('metin.txt');
  fs.writeFileSync(path.join(SITE, 'paylasim.html'), `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Paylaşımlar</title><style>
:root{--bg:#f6f4f1;--kart:#fff;--yazi:#1f1d1a;--soluk:#7a746b;--vurgu:#f27a1a;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--kart:#211f1c;--yazi:#efebe5;--soluk:#a39c92;--vurgu:#ff8c33;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--yazi);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.sayfa{max-width:1100px;margin:0 auto;padding:24px 16px 60px}h1{margin:0 0 4px}nav a{color:var(--vurgu)}
h2{margin:28px 0 10px;font-size:18px}.izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
figure{margin:0;background:var(--kart);border-radius:12px;overflow:hidden}img,video{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#000}
figcaption{padding:8px 10px;font-size:13px}figcaption a{color:var(--vurgu);font-weight:600}
details{margin-top:4px}pre{white-space:pre-wrap;font-size:11px;max-height:200px;overflow:auto}
.metin{background:var(--kart);border-radius:12px;padding:12px;white-space:pre-wrap;font-size:14px}
</style></head><body><div class="sayfa">
<h1>Paylaşımlar</h1><p style="color:var(--soluk);margin:0">Son güncelleme ${esc(saat)} · <nav style="display:inline"><a href="./">Kupon takip sayfası →</a></nav></p>
${bolumler || '<p>Henüz paylaşım yok.</p>'}
${aciklama ? `<h2>Hazır açıklama metni</h2><div class="metin">${esc(aciklama)}</div>` : ''}
</div></body></html>`);
  console.log('Site hazır:', SITE);
}

module.exports = olustur;
if (require.main === module) olustur();
