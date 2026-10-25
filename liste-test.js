// Mağazanın "en yeniler" ve "çok satanlar" listelerini bir kez açıp HTML'ini kaydeder (keşif amaçlı).
// Kullanım: node liste-test.js <sellerId> [--headful]
const fs = require('fs');
const { chromium } = require('playwright');
const mid = process.argv[2] || '637';
const headful = process.argv.includes('--headful');
const SIRALAR = { 'en-yeniler': 'MOST_RECENT', 'cok-satanlar': 'BEST_SELLER' };

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: !headful }); }
  catch { browser = await chromium.launch({ headless: !headful }); }
  const page = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  fs.mkdirSync(__dirname + '/listeler', { recursive: true });
  let ilk = true;
  for (const [ad, sst] of Object.entries(SIRALAR)) {
    if (!ilk) await page.waitForTimeout(10000 + Math.random() * 5000);
    ilk = false;
    const url = `https://www.trendyol.com/sr?mid=${mid}&os=1&sst=${sst}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    const text = await page.evaluate(() => document.body.innerText);
    console.log(ad, 'status:', resp && resp.status(), '| url:', page.url());
    if ((resp && resp.status() === 403) || /captcha|you have been blocked|robot olmadığınızı/i.test(text)) {
      console.log('ENGEL görüldü, duruyorum.'); break;
    }
    await page.keyboard.press('Escape');
    for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(700); }
    fs.writeFileSync(`${__dirname}/listeler/${mid}-${ad}.html`, await page.content());
    console.log(' ilk metin:', text.replace(/\s+/g, ' ').slice(0, 300));
  }
  await browser.close();
})().catch(e => { console.error('HATA:', e.message); process.exit(1); });
