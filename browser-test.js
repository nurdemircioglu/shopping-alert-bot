// Gerçek tarayıcı ile tek sayfa açılışı. Kullanım: node browser-test.js [--headful]
// Captcha/challenge görülürse durur; atlatmaya çalışmaz.
const fs = require('fs');
const { chromium } = require('playwright');
const URL = 'https://www.trendyol.com/magaza/koton-m-637?sst=0';
const headful = process.argv.includes('--headful');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: !headful });
  } catch {
    browser = await chromium.launch({ headless: !headful });
  }
  const page = await (await browser.newContext({ locale: 'tr-TR' })).newPage();

  // JSON dışı (HTML/stream/JS) yanıtlar da taranır: kod kartları SSR ile gelebilir
  const hits = [];
  page.on('response', async r => {
    const u = r.url();
    const ct = r.headers()['content-type'] || '';
    if (!/json|html|text|javascript/.test(ct) || /\.(css|woff2?)(\?|$)/.test(u)) return;
    try {
      const body = await r.text();
      const m = body.match(/KOTON\d{2,4}|adet kaldı|couponCode|"code"\s*:\s*"[A-Z0-9]{4,}"|lowerLimit/i);
      if (m || /coupon|kupon/i.test(u)) {
        const i = m ? Math.max(0, m.index - 1500) : 0;
        hits.push({ url: u, status: r.status(), contentType: ct, match: m && m[0], sample: body.slice(i, i + 4000) });
      }
    } catch {}
  });

  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('status:', resp && resp.status());
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() => document.body.innerText);
  if (/captcha|robot olmadığınızı|access denied|challenge/i.test(text)) {
    console.log('ENGEL: captcha/challenge görüldü, duruyorum.');
    await page.screenshot({ path: __dirname + '/engel.png' });
    await browser.close();
    process.exit(2);
  }

  // İlk açılışta gelen "Takip Et" kupon pop-up'ını kapat
  await page.keyboard.press('Escape');
  for (const sel of ['[class*="modal"] [class*="close"]', '[class*="popup"] [class*="close"]',
    '[aria-label*="Kapat" i]', '[aria-label*="close" i]', 'button:has-text("Kapat")']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      console.log('pop-up kapatıldı:', sel);
      break;
    }
  }
  await page.waitForTimeout(1500);

  const heading = page.getByText('İndirim Kodları').first();
  if (await heading.count()) {
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
  } else {
    console.log("'İndirim Kodları' başlığı bulunamadı");
  }
  await page.screenshot({ path: __dirname + '/sayfa.png', fullPage: false });

  // Kupon kartı = hem "Alt Limit" hem "adet kaldı" içeren en küçük blok
  const { coupons, sectionHtml } = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div, li, section, article')].filter(e => {
      const t = e.innerText || '';
      return /Alt Limit/i.test(t) && /adet kaldı/i.test(t) && t.length < 600;
    });
    const cards = els.filter(e => !els.some(o => o !== e && e.contains(o)));
    const coupons = cards.map(e => {
      const t = e.innerText.replace(/\s+/g, ' ').trim();
      const kodlar = (t.match(/\b[A-Z][A-Z0-9]{4,}\b/g) || []).filter(w => !/^(TL|ALT|LIMIT)$/.test(w));
      return {
        raw: t,
        tutar: (t.match(/\d[\d.]*\s*(TL|₺)/) || [])[0] || '',
        kod: kodlar[0] || '',
        altLimit: (t.match(/Alt Limit[:\s]*[\d.]+\s*(TL|₺)?/i) || [])[0] || '',
        sure: (t.match(/\d{1,2}:\d{2}(:\d{2})?|\d+\s*(gün|saat|dk|dakika|sn)[^,]*|Son [^,]{1,20}/i) || [])[0] || '',
        kalan: (t.match(/[\d.]+\s*adet kaldı/i) || [])[0] || '',
        html: e.outerHTML.slice(0, 3000),
      };
    });
    const sec = cards[0] && (cards[0].closest('section') || cards[0].parentElement?.parentElement);
    return { coupons, sectionHtml: sec ? sec.outerHTML : '' };
  });
  fs.writeFileSync(__dirname + '/kupon-bolumu.html', sectionHtml);
  fs.writeFileSync(__dirname + '/sayfa-tam.html', await page.content());

  fs.writeFileSync(__dirname + '/kuponlar.json', JSON.stringify(coupons, null, 2));
  fs.writeFileSync(__dirname + '/kupon-endpointleri.json', JSON.stringify(hits, null, 2));
  console.log('kupon sayısı:', coupons.length);
  console.table(coupons.map(({ raw, html, ...c }) => c));
  console.log('ham kart metinleri:', coupons.map(c => c.raw));
  console.log('KOTON kodları tam HTML içinde:', [...new Set((await page.content()).match(/KOTON\d{2,4}/g) || [])]);
  console.log('eşleşen yanıtlar:', hits.map(h => `${h.match || '-'}  ${h.url.slice(0, 140)}`));
  await browser.close();
})().catch(e => { console.error('HATA:', e.message); process.exit(1); });
