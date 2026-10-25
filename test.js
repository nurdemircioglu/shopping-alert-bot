// Tek bir düz fetch denemesi (1 istek).
const fs = require('fs');
const URL = 'https://www.trendyol.com/magaza/koton-m-637?sst=0';

(async () => {
  const res = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  const html = await res.text();
  fs.writeFileSync(__dirname + '/fetch-sonuc.html', html);
  console.log('status:', res.status, 'size:', html.length);
  const codes = [...new Set(html.match(/KOTON\d{2,4}/g) || [])];
  console.log('KOTON kodlari:', codes);
  for (const k of ['coupon', 'kupon', 'İndirim Kodları', 'captcha', 'challenge', '__INITIAL_STATE__', '__NEXT_DATA__']) {
    console.log(`'${k}' geçiyor mu:`, html.includes(k));
  }
})().catch(e => { console.error('HATA:', e.message); process.exit(1); });
