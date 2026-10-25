// magazalar-test.js çıktısından takip sayfası (rapor.html) üretir. İnternete bağlanmaz.
// Kullanım: node rapor-olustur.js   (magazalar-test.js bitince otomatik de çalışır)
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const odul = (type, val) => type === 'AMOUNT' ? `${val} TL` : type === 'PERCENTAGE' ? `%${val}` : `${val}`;
const tl = n => n == null ? '' : Number(n).toLocaleString('tr-TR') + ' TL';

function veriTopla() {
  const sonucPath = path.join(DIR, 'magazalar-sonuc.json');
  const sonuc = JSON.parse(fs.readFileSync(sonucPath, 'utf8'));
  const guncelleme = fs.statSync(sonucPath).mtime;
  const magazalar = sonuc.map(m => {
    let state = null;
    try { state = JSON.parse(fs.readFileSync(path.join(DIR, 'magazalar', slug(m.magaza) + '-state.json'), 'utf8')); } catch {}
    const promos = (state && state.promotions) || {};
    const kodlar = (promos.codePromotions || []).flatMap(p => ((p.codes && p.codes.items) || []).map(c => ({
      kod: c.code, ad: p.name, indirim: odul(p.awardType, p.awardValue),
      altLimit: p.selectionConditionOverValue, kalan: Number(c.remainingUsageCount), toplam: c.maxUsageCount,
      bitis: p.endDate,
    })));
    const kuponlar = ((state && state.coupon && state.coupon.collectable) || []).map(c => ({
      indirim: odul(c.discountType, c.discount), altLimit: c.lowerLimit, bitis: c.couponEndDate,
      link: c.descriptionLink ? 'https://www.trendyol.com' + c.descriptionLink : null,
    }));
    const kampanyalar = (promos.promotionWithProducts || []).map(p => ({
      ad: p.name, indirim: odul(p.awardType, p.awardValue), bitis: p.endDate,
      kosul: !p.selectionConditionOverValue ? ''
        : p.selectionConditionOver === 'QUANTITY' ? `${p.selectionConditionOverValue} adet ve üzeri`
        : p.selectionConditionOver === 'AMOUNT' ? `${tl(p.selectionConditionOverValue)} ve üzeri` : '',
    }));
    return { ad: m.magaza, url: m.url, status: m.status, veriVar: !!state,
      hata: m.hata || (m.engel ? 'Engel görüldü' : !state ? 'Bu çalışmada veri okunamadı' : null), kodlar, kuponlar, kampanyalar };
  });
  return { guncelleme, magazalar };
}

function kart(m) {
  const toplam = m.kodlar.length + m.kuponlar.length + m.kampanyalar.length;
  const bitis = b => b ? `<span class="sure" data-bitis="${esc(b)}"></span>` : '';
  const kodlar = m.kodlar.map(k => {
    const oran = k.toplam ? Math.round((k.kalan / k.toplam) * 100) : 0;
    return `<div class="kod">
      <div class="kod-ust"><span class="tutar">${esc(k.indirim)}</span><span class="alt">${esc(tl(k.altLimit))} ve üzeri</span></div>
      <button class="kopyala" data-kod="${esc(k.kod)}" title="Kodu kopyala"><span>${esc(k.kod)}</span><small>Kopyala</small></button>
      <div class="bar"><i style="width:${oran}%"></i></div>
      <div class="kod-alt"><span>${k.kalan.toLocaleString('tr-TR')} / ${Number(k.toplam).toLocaleString('tr-TR')} adet kaldı</span>${bitis(k.bitis)}</div>
    </div>`;
  }).join('');
  const kuponlar = m.kuponlar.map(k => `<li><b>${esc(k.indirim)}</b> kupon · ${esc(tl(k.altLimit))} ve üzeri ${bitis(k.bitis)}</li>`).join('');
  const kampanyalar = m.kampanyalar.map(k => `<li><b>${esc(k.ad)}</b>${k.kosul && !k.ad.includes('Adet') ? ` · ${esc(k.kosul)}` : ''} ${bitis(k.bitis)}</li>`).join('');
  return `<article class="magaza${toplam ? '' : ' bos'}" data-firsat="${toplam}">
    <header><h2>${esc(m.ad)}</h2><a href="${esc(m.url)}" target="_blank" rel="noopener">Mağazaya git ↗</a></header>
    ${m.hata ? `<p class="uyari">${esc(m.hata)}</p>` : ''}
    ${kodlar ? `<h3>İndirim kodları</h3><div class="kodlar">${kodlar}</div>` : ''}
    ${kuponlar ? `<h3>Kuponlar <em>“Kazan” ile hesaba eklenir</em></h3><ul>${kuponlar}</ul>` : ''}
    ${kampanyalar ? `<h3>Kampanyalar <em>sepette otomatik uygulanır</em></h3><ul>${kampanyalar}</ul>` : ''}
    ${!toplam && !m.hata ? '<p class="yok">Şu an kod, kupon veya kampanya yok.</p>' : ''}
  </article>`;
}

function html({ guncelleme, magazalar }) {
  const sirali = [...magazalar].sort((a, b) =>
    (b.kodlar.length * 100 + b.kuponlar.length * 10 + b.kampanyalar.length) -
    (a.kodlar.length * 100 + a.kuponlar.length * 10 + a.kampanyalar.length));
  const say = k => magazalar.reduce((n, m) => n + m[k].length, 0);
  const saat = guncelleme.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kupon Takip</title>
<style>
:root{--bg:#f6f4f1;--kart:#fff;--yazi:#1f1d1a;--soluk:#7a746b;--cizgi:#e7e2db;--vurgu:#f27a1a;--vurgu-zemin:#fff1e6;--yesil:#2f8a57;--kirmizi:#c4452f;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--kart:#211f1c;--yazi:#efebe5;--soluk:#a39c92;--cizgi:#34312c;--vurgu:#ff8c33;--vurgu-zemin:#3a2616;--yesil:#5cc28a;--kirmizi:#ff7a63;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--yazi);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.sayfa{max-width:1100px;margin:0 auto;padding:28px 16px 60px}
.ust{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px;margin-bottom:20px}
h1{margin:0;font-size:28px;letter-spacing:-.02em}.ust p{margin:4px 0 0;color:var(--soluk)}
.ozet{display:flex;gap:10px;flex-wrap:wrap}.ozet div{background:var(--kart);border:1px solid var(--cizgi);border-radius:12px;padding:8px 14px;text-align:center}
.ozet b{display:block;font-size:20px}.ozet span{font-size:12px;color:var(--soluk)}
label.filtre{display:inline-flex;gap:8px;align-items:center;color:var(--soluk);font-size:14px;margin-bottom:16px;cursor:pointer}
.izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.magaza{background:var(--kart);border:1px solid var(--cizgi);border-radius:16px;padding:18px}
.magaza.bos{opacity:.65}body.gizle .magaza.bos{display:none}
.magaza header{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
h2{margin:0;font-size:19px}header a{color:var(--soluk);font-size:13px;text-decoration:none}header a:hover{color:var(--vurgu)}
h3{margin:16px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--soluk)}h3 em{text-transform:none;letter-spacing:0;font-weight:400;font-style:normal;opacity:.8}
.kodlar{display:grid;gap:10px}.kod{border:1px dashed var(--vurgu);background:var(--vurgu-zemin);border-radius:12px;padding:12px}
.kod-ust{display:flex;justify-content:space-between;align-items:baseline}.tutar{font-size:22px;font-weight:700;color:var(--vurgu)}.alt{font-size:13px;color:var(--soluk)}
.kopyala{margin:8px 0;width:100%;display:flex;justify-content:space-between;align-items:center;border:0;border-radius:8px;background:var(--vurgu);color:#fff;padding:9px 12px;font:600 15px ui-monospace,Menlo,monospace;cursor:pointer}
.kopyala small{font:500 12px -apple-system,sans-serif;opacity:.9}.kopyala.ok{background:var(--yesil)}
.bar{height:5px;border-radius:3px;background:var(--cizgi);overflow:hidden}.bar i{display:block;height:100%;background:var(--vurgu)}
.kod-alt{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:12.5px;color:var(--soluk)}
ul{margin:0;padding:0;list-style:none}li{padding:7px 0;border-top:1px solid var(--cizgi);font-size:14px}li:first-child{border-top:0}
.sure{font-size:12.5px;color:var(--soluk);white-space:nowrap}.sure.acil{color:var(--kirmizi);font-weight:600}.sure.bitti{text-decoration:line-through}
li .sure::before{content:"· "}.yok{color:var(--soluk);margin:12px 0 0;font-size:14px}.uyari{color:var(--kirmizi)}
footer{margin-top:28px;color:var(--soluk);font-size:13px}code{background:var(--cizgi);padding:1px 6px;border-radius:5px}
</style></head><body>
<div class="sayfa">
  <div class="ust">
    <div><h1>Kupon Takip</h1><p>Trendyol mağazaları · son güncelleme ${esc(saat)}</p></div>
    <div class="ozet"><div><b>${say('kodlar')}</b><span>indirim kodu</span></div><div><b>${say('kuponlar')}</b><span>kupon</span></div><div><b>${say('kampanyalar')}</b><span>kampanya</span></div></div>
  </div>
  <label class="filtre"><input type="checkbox" id="gizle"> Fırsatı olmayan mağazaları gizle</label>
  <div class="izgara">${sirali.map(kart).join('')}</div>
  <footer>Yenilemek için: <code>node magazalar-test.js --headful</code> · Kalan adetler ve süreler son güncelleme anına aittir.</footer>
</div>
<script>
// Bitiş tarihleri TR saati (UTC+3) olarak geliyor
function kalan(b){const t=new Date(b.replace(/(\\.\\d+)?$/,'')+'+03:00')-Date.now();if(t<=0)return{y:'Süresi doldu',c:'bitti'};
const g=Math.floor(t/864e5),s=Math.floor(t%864e5/36e5),d=Math.floor(t%36e5/6e4);
return{y:(g?g+' gün ':'')+(g<2?s+' sa ':'')+(g?'':d+' dk ')+'kaldı',c:t<864e5?'acil':''}}
function guncelle(){document.querySelectorAll('.sure').forEach(e=>{const r=kalan(e.dataset.bitis);e.textContent=r.y;e.className='sure '+r.c})}
guncelle();setInterval(guncelle,30000);
document.querySelectorAll('.kopyala').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.kod);b.classList.add('ok');b.querySelector('small').textContent='Kopyalandı ✓';setTimeout(()=>{b.classList.remove('ok');b.querySelector('small').textContent='Kopyala'},1500)}catch{}});
const cb=document.getElementById('gizle');try{cb.checked=localStorage.getItem('gizle')==='1'}catch{}
const uygula=()=>{document.body.classList.toggle('gizle',cb.checked);try{localStorage.setItem('gizle',cb.checked?'1':'0')}catch{}};cb.onchange=uygula;uygula();
</script></body></html>`;
}

function olustur() {
  const out = path.join(DIR, 'rapor.html');
  fs.writeFileSync(out, html(veriTopla()));
  console.log('Takip sayfası:', out);
  return out;
}

module.exports = olustur;
module.exports.veriTopla = veriTopla;
if (require.main === module) olustur();
