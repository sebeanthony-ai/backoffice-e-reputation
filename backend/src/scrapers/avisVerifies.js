const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

const BASE = 'https://www.avis-verifies.com';

/**
 * Pagination par curseur (?p=xxxxx) via link[rel="next"], pas ?p=2.
 * Avis dans <li class="skp-review-item" id="reviews__item__N"> …
 */
async function scrapeAvisVerifies(site) {
  const urls = {
    infonet: `${BASE}/avis-clients/infonet.fr`,
  };

  let nextUrl = urls[site];
  if (!nextUrl) return [];

  const reviews = [];
  const seenPageUrls = new Set();
  let safety = 0;

  while (nextUrl && safety < 40) {
    if (seenPageUrls.has(nextUrl)) break;
    seenPageUrls.add(nextUrl);
    safety += 1;

    try {
      const response = await axios.get(nextUrl, { headers: HEADERS, timeout: 20000 });
      const $ = cheerio.load(response.data);

      const pageReviews = parseAvisVerifiesPage($, site);
      reviews.push(...pageReviews);

      const nextHref = $('link[rel="next"]').attr('href');
      nextUrl = nextHref
        ? (nextHref.startsWith('http') ? nextHref : new URL(nextHref, BASE).href)
        : null;

      if (!nextUrl) break;
      await sleep(900);
    } catch (err) {
      console.error(`[AvisVerifies] Error scraping ${site}:`, nextUrl, err.message);
      break;
    }
  }

  return reviews;
}

function parseAvisVerifiesPage($, site) {
  const reviews = [];

  $('#reviews__list li.skp-review-item, ul.skp-reviews__list li.skp-review-item').each((i, element) => {
    try {
      const el = $(element);

      const textEl = el.find('.skp-review-item__text').first();
      const content = textEl.text().trim();

      const infoText = el.find('.skp-review-item__info').first().text().trim();
      let author = infoText || '';
      if (!author || /^anonyme$/i.test(author)) {
        author = 'Anonyme';
      }

      const stars = el.find('.skp-review-item__stars').first();
      let rating = parseInt(stars.attr('data-rating'), 10);
      if (Number.isNaN(rating) || rating < 1) {
        const aria = stars.attr('aria-label') || '';
        const m = aria.match(/(\d)/);
        rating = m ? parseInt(m[1], 10) : 0;
      }
      if (!rating || rating < 1) rating = 3;

      const dateStr = el.find('.skp-review-item__date').first().text().trim();
      let publishedAt = parseFrenchDate(dateStr);
      if (!publishedAt) {
        const summary = el.find('.skp-review-item__summary').first().text().trim();
        const exp = summary.match(/Expérience du:\s*(.+)/i);
        if (exp) publishedAt = parseFrenchDate(exp[1].trim());
      }
      if (!publishedAt) {
        console.warn('[AvisVerifies] Date non parsée:', dateStr || '(vide)', 'site=', site);
        publishedAt = new Date().toISOString().split('T')[0];
      }

      const itemId = el.attr('id') || `idx_${i}`;
      const stableKey = itemId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const external_id = `av_${site}_${stableKey}`;

      const reviewUrl = `${urlsForSite(site)}#${itemId}`;

      if (content && content.length > 3) {
        reviews.push({
          external_id,
          site,
          source: 'avis-verifies',
          author,
          rating: Math.min(5, Math.max(1, rating)),
          title: '',
          content,
          published_at: publishedAt,
          review_url: reviewUrl,
          status: 'todo',
        });
      }
    } catch (err) {
      console.warn('[AvisVerifies] parse item:', err.message);
    }
  });

  return reviews;
}

function urlsForSite(site) {
  if (site === 'infonet') return `${BASE}/avis-clients/infonet.fr`;
  return `${BASE}/avis-clients/${site}.fr`;
}

/** Dates du type « 13 avr. 2026 », « 26 janv. 2026 » (mois avec accents gérés) */
function parseFrenchDate(str) {
  if (!str) return null;
  const t = str.replace(/\s+/g, ' ').trim();
  const match = t.match(/(\d{1,2})\s+([^\d]+?)\.?\s+(\d{4})/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const year = match[3];
  let monLabel = match[2].toLowerCase().replace(/\./g, '').trim();
  monLabel = monLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const months = {
    janv: '01',
    janvier: '01',
    fevr: '02',
    fevrier: '02',
    mars: '03',
    avr: '04',
    avril: '04',
    mai: '05',
    juin: '06',
    juil: '07',
    juillet: '07',
    aout: '08',
    août: '08',
    sept: '09',
    septembre: '09',
    oct: '10',
    octobre: '10',
    nov: '11',
    novembre: '11',
    dec: '12',
    decembre: '12',
    décembre: '12',
  };

  let m = months[monLabel];
  if (!m) m = months[monLabel.substring(0, 4)];
  if (!m) m = months[monLabel.substring(0, 3)];

  if (!m) return null;
  return `${year}-${m}-${day}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { scrapeAvisVerifies, parseFrenchDate };
