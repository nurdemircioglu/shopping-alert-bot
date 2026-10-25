// Birden çok Trendyol mağazasının indirim kodu / kupon / kampanya verisini okur.
// Kullanım: node magazalar-test.js [--headful]
// Her mağaza tek sayfa açılışı, aralarında 10-15 sn bekleme. Captcha/engelde durur.
const fs = require('fs');
const { chromium } = require('playwright');
const { urunleriTopla } = require('./urunler');

// Mağaza listesi magazalar.json'da: yeni marka eklemek için oraya { "ad", "url" } satırı ekle
const TUMU = JSON.parse(fs.readFileSync(__dirname + '/magazalar.json', 'utf8'));
// --sadece=Kremi,Missha: yalnız bu mağazaları dene; geçmişe, rapora ve paylaşımlara dokunmaz
const sadece = (process.argv.find(a => a.startsWith('--sadece=')) || '').slice(9).split(',').filter(Boolean);
const MAGAZALAR = sadece.length ? TUMU.filter(m => sadece.includes(m.ad)) : TUMU;
const headful = process.argv.includes('--headful');
// --listeler: her mağaza için "en yeniler" ve "çok satanlar" listelerini de aç (mağaza başına +2 sayfa).
// Günde 1-2 kez yeterli; her 30 dakikada açmak engellenme riskini artırır.
const listeler = process.argv.includes('--listeler');
const LISTE_SIRALARI = { 'en-yeniler': 'MOST_RECENT', 'cok-satanlar': 'BEST_SELLER' };
const OUT = __dirname + '/magazalar';
fs.mkdirSync(OUT, { recursive: true });
const bekle = ms => new Promise(r => setTimeout(r, ms));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function popupKapat(page) {
  await page.keyboard.press('Escape');
  for (const sel of ['[class*="popup"] [class*="close"]', '[class*="modal"] [class*="close"]',
    '[aria-label*="Kapat" i]', '[aria-label*="close" i]', 'button:has-text("Kapat")']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); break; }
  }
  await page.waitForTimeout(1500);
}

// Sayfadaki gömülü state içinden "promotions" ve "coupon" nesnelerini bul
function stateBul() {
  const seen = new Set();
  function ara(o, d) {
    if (!o || typeof o !== 'object' || d > 8 || seen.has(o)) return null;
    seen.add(o);
    if (o.promotions && typeof o.promotions === 'object' && ('coupon' in o || 'codePromotions' in o.promotions)) {
      return { promotions: o.promotions, coupon: o.coupon || null };
    }
    for (const k of Object.keys(o)) {
      try { const r = ara(o[k], d + 1); if (r) return r; } catch {}
    }
    return null;
  }
  for (const k of Object.keys(window)) {
    if (!/PROPS|STATE|DATA/i.test(k)) continue;
    try { const r = ara(window[k], 0); if (r) return { kaynak: k, ...r }; } catch {}
  }
  return null;
}

// Bölüm başlıklarına göre görünen metin (yedek / kampanya metinleri için)
function bolumMetinleri() {
  const out = {};
  for (const h of ['İndirim Kodları', 'Kuponlar', 'Kampanyalar', 'Kupon']) {
    const el = [...document.querySelectorAll('h1,h2,h3,h4,span,div,p')]
      .find(e => (e.innerText || '').trim() === h);
    if (!el) continue;
    let box = el.parentElement;
    for (let i = 0; i < 4 && box && (box.innerText || '').length < 80; i++) box = box.parentElement;
    if (box) out[h] = box.innerText.replace(/\s+/g, ' ').trim().slice(0, 2000);
  }
  return out;
}

// Yedek: HTML kaynağında "key":{...} nesnesini parantez dengesiyle çıkar
function htmldenNesne(html, key) {
  const i = html.indexOf(`"${key}":{`);
  if (i < 0) return null;
  let d = 0, str = false, esc = false;
  const start = html.indexOf('{', i);
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true;
    else if (ch === '{') d++;
    else if (ch === '}' && --d === 0) {
      try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; }
    }
  }
  return null;
}

function kodlariOzetle(promotions) {
  const list = (promotions && promotions.codePromotions) || [];
  return list.flatMap(p => ((p.codes && p.codes.items) || [{}]).map(c => ({
    tur: 'indirim kodu',
    ad: p.name,
    kod: c.code || p.description || '',
    indirim: p.awardType === 'AMOUNT' ? `${p.awardValue} TL` : p.awardType === 'PERCENTAGE' ? `%${p.awardValue}` : `${p.awardValue} ${p.awardType}`,
    altLimit: p.selectionConditionOverValue,
    kalan: c.remainingUsageCount,
    toplam: c.maxUsageCount,
    bitis: p.endDate,
  })));
}

const odul = (type, val) => type === 'AMOUNT' ? `${val} TL` : type === 'PERCENTAGE' ? `%${val}` : `${val} ${type || ''}`.trim();

function kampanyalariOzetle(promotions) {
  return ((promotions && promotions.promotionWithProducts) || []).map(p => ({
    ad: p.name,
    indirim: odul(p.awardType, p.awardValue),
    kosul: p.selectionConditionOver === 'QUANTITY' ? `${p.selectionConditionOverValue} adet+`
      : p.selectionConditionOver === 'AMOUNT' ? `${p.selectionConditionOverValue} TL+` : (p.selectionConditionOver || ''),
    tip: p.discountType,
    bitis: p.endDate,
  }));
}

function kuponlariOzetle(coupon) {
  return ((coupon && coupon.collectable) || []).map(c => ({
    indirim: odul(c.discountType, c.discount),
    altLimit: c.lowerLimit,
    maxIndirim: c.maxDiscountAmount,
    bitis: c.couponEndDate,
    tip: c.couponType,
  }));
}

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: !headful }); }
  catch { browser = await chromium.launch({ headless: !headful }); }
  const page = await (await browser.newContext({ locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })).newPage();
  const sonuc = [];

  for (const [i, m] of MAGAZALAR.entries()) {
    if (i > 0) await bekle(10000 + Math.random() * 5000);
    console.log(`\n=== ${m.ad} ===`);
    const kayit = { magaza: m.ad, url: m.url };
    try {
      let resp = await page.goto(m.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      // Yurt dışından (ör. GitHub sunucuları) açılınca Trendyol ülke seçme sayfasına yönlendiriyor:
      // Türkiye'yi seç, seçim çerezde kalır; sonra mağaza sayfasını yeniden aç
      if (page.url().includes('select-country')) {
        console.log('Ülke seçme sayfası → Türkiye seçiliyor');
        // Çerez bandı ülke seçimini engelliyor: zorunlu olmayan çerezleri reddet
        const reddet = page.getByRole('button', { name: 'Tümünü Reddet' });
        if (await reddet.isVisible().catch(() => false)) { await reddet.click(); await page.waitForTimeout(1000); }
        const kutu = page.locator('#m-country-selection');
        const yerelSecim = kutu.locator('select');
        if (await yerelSecim.count()) await yerelSecim.first().selectOption({ label: 'Türkiye' });
        else {
          await kutu.getByText('Select your country').first().click();
          await page.waitForTimeout(800);
          await kutu.getByText('Türkiye', { exact: true }).last().click();
        }
        await page.waitForTimeout(800);
        await kutu.getByRole('button', { name: /^(Select|Seç)$/ }).first().click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(3000);
        resp = await page.goto(m.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
        if (page.url().includes('select-country')) console.log('UYARI: Türkiye seçimi tutmadı');
      }
      kayit.status = resp && resp.status();
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      if (kayit.status === 403 || /captcha|robot olmadığınızı|you have been blocked|access denied/i.test(text)) {
        console.log('ENGEL görüldü, duruyorum. status:', kayit.status);
        await page.screenshot({ path: `${OUT}/${slug(m.ad)}-engel.png` });
        kayit.engel = true;
        sonuc.push(kayit);
        break;
      }
      await popupKapat(page);
      // Kampanya/kupon ve ürün bölümleri aşağıda, tembel yükleniyor: kademeli kaydır
      for (let s = 0; s < 8; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(700); }

      let state = await page.evaluate(stateBul);
      if (!state) {
        const html = (await resp.text().catch(() => '')) || (await page.content());
        const promotions = htmldenNesne(html, 'promotions');
        if (promotions) state = { kaynak: 'html', promotions, coupon: htmldenNesne(html, 'coupon') };
      }
      kayit.stateKaynak = state && state.kaynak;
      kayit.kodlar = kodlariOzetle(state && state.promotions);
      kayit.promotionAnahtarlari = state ? Object.keys(state.promotions) : [];
      kayit.kuponlar = kuponlariOzetle(state && state.coupon);
      kayit.kampanyalar = kampanyalariOzetle(state && state.promotions);
      kayit.bolumler = await page.evaluate(bolumMetinleri);
      const urunler = await page.evaluate(urunleriTopla);
      kayit.urunSayisi = urunler.length;
      fs.writeFileSync(`${OUT}/${slug(m.ad)}-urunler.json`, JSON.stringify(urunler, null, 2));

      const mid = (m.url.match(/-m-(\d+)/) || [])[1];
      if (listeler && mid) {
        for (const [ad, sst] of Object.entries(LISTE_SIRALARI)) {
          await bekle(8000 + Math.random() * 4000);
          const r = await page.goto(`https://www.trendyol.com/sr?mid=${mid}&os=1&sst=${sst}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await page.waitForTimeout(4000);
          if ((r && r.status() === 403) || /captcha|you have been blocked/i.test(await page.evaluate(() => document.body.innerText))) {
            throw new Error(`${ad} listesinde ENGEL görüldü`);
          }
          await page.keyboard.press('Escape');
          for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(700); }
          const liste = await page.evaluate(urunleriTopla);
          fs.writeFileSync(`${OUT}/${slug(m.ad)}-${ad}.json`, JSON.stringify(liste, null, 2));
          console.log(`${ad}: ${liste.length} ürün`);
        }
      }
      fs.writeFileSync(`${OUT}/${slug(m.ad)}-state.json`, JSON.stringify(state, null, 2));
      if (!state) {
        fs.writeFileSync(`${OUT}/${slug(m.ad)}-sayfa.html`, await page.content());
        const ozet = await page.evaluate(() => ({ url: location.href, baslik: document.title, metin: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400) }));
        console.log('VERİ YOK → gerçek adres:', ozet.url, '| başlık:', ozet.baslik, '\n  sayfa metni:', ozet.metin);
      }
      await page.screenshot({ path: `${OUT}/${slug(m.ad)}.png` });

      console.log('status:', kayit.status, '| state:', kayit.stateKaynak || 'BULUNAMADI');
      console.log('promotions alanları:', kayit.promotionAnahtarlari.join(', ') || '-');
      console.log('ürün:', kayit.urunSayisi);
      for (const [baslik, liste] of [['İndirim kodları', kayit.kodlar.map(({ ad, tur, ...k }) => k)],
        ['Kuponlar', kayit.kuponlar], ['Kampanyalar', kayit.kampanyalar]]) {
        if (liste.length) { console.log(baslik + ':'); console.table(liste); }
        else console.log(baslik + ': yok');
      }
    } catch (e) {
      kayit.hata = e.message;
      console.log('HATA:', e.message);
    }
    sonuc.push(kayit);
  }

  if (sadece.length) {
    fs.writeFileSync(__dirname + '/magazalar-deneme.json', JSON.stringify(sonuc, null, 2));
    console.log('\nDeneme bitti: magazalar-deneme.json (geçmiş ve paylaşımlar değişmedi)');
    await browser.close();
    return;
  }
  fs.writeFileSync(__dirname + '/magazalar-sonuc.json', JSON.stringify(sonuc, null, 2));
  console.log('\nKaydedildi: magazalar-sonuc.json ve magazalar/ klasörü');
  await browser.close();
  require('./rapor-olustur')();
  const olaylar = await require('./paylasim-olustur')();
  await require('./reel-olustur')();
  await require('./urun-story-olustur')();
  require('./site-olustur')();
  await require('./bildirim')(olaylar);
})().catch(e => { console.error('HATA:', e.message); process.exit(1); });
