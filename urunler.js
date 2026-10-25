// Mağaza sayfasındaki ürün kartlarını okur (tarayıcı içinde çalışır: page.evaluate(urunleriTopla)).
function urunleriTopla() {
  const fiyat = s => { const m = String(s).match(/([\d.]+(?:,\d+)?)\s*TL/); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };
  const gorulen = new Set();
  const out = [];
  for (const a of document.querySelectorAll('a.product-card')) {
    const id = a.id || (a.getAttribute('href') || '').match(/-p-(\d+)/)?.[1];
    if (!id || gorulen.has(id)) continue;
    gorulen.add(id);
    const img = a.querySelector('img.image');
    const bilgi = a.querySelector('.info-wrapper');
    const metin = (bilgi ? bilgi.innerText : a.innerText).replace(/\s+/g, ' ').trim();
    const fiyatlar = (metin.match(/[\d.]+(?:,\d+)?\s*TL/g) || []).map(fiyat);
    const sepette = metin.match(/Sepette\s*([\d.]+(?:,\d+)?\s*TL)/);
    // Kartın bölümü: başlık (.title-wrapper__text) içeren en yakın üst öğe
    let kap = a.parentElement;
    while (kap && !kap.querySelector('.title-wrapper__text')) kap = kap.parentElement;
    const bolum = kap?.querySelector('.title-wrapper__text')?.innerText?.trim() || '';
    const favori = a.querySelector('[data-testid="social-proof-content-favoriteCount"] .description');
    out.push({
      id,
      url: new URL(a.getAttribute('href'), location.origin).href.split('?')[0],
      gorsel: img ? img.src.replace(/mnresize\/\d+\//, 'mnresize/1200/') : null,
      marka: a.querySelector('.product-brand')?.innerText?.trim() || '',
      ad: (a.querySelector('.product-name')?.innerText || img?.alt || '').trim(),
      puan: Number(a.querySelector('.average-rating, .rating__score')?.innerText) || null,
      yorum: Number((a.querySelector('.total-count, .rating__total, [class*="rating-count"]')?.innerText || '').replace(/\D/g, '')) || null,
      sosyal: favori ? favori.innerText.replace(/\s+/g, ' ').replace(/!$/, '').trim()
        : (metin.match(/[\d.,]+[BbKk]?\+?\s*kişi\s+\S+/) || [])[0] || '',
      eskiFiyat: fiyatlar.length > 1 ? Math.max(...fiyatlar) : null,
      fiyat: sepette ? fiyat(sepette[1]) : (fiyatlar.length ? Math.min(...fiyatlar) : null),
      sepetteFiyat: !!sepette,
      bolum,
    });
  }
  return out;
}

module.exports = { urunleriTopla };
