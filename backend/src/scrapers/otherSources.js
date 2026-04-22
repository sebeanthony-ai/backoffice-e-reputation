const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

async function scrapeSignalArnaques() {
  const url = 'https://www.signal-arnaques.com/scam/view/899068';
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);
    const reviews = [];

    $('[class*="comment"], [class*="report"], [class*="avis"], [class*="testimony"]').each((i, element) => {
      const el = $(element);
      const content = el.find('p, [class*="content"], [class*="text"]').first().text().trim();
      const author = el.find('[class*="author"], [class*="user"]').first().text().trim() || 'Anonyme';
      const dateEl = el.find('time, [class*="date"]');
      const publishedAt = dateEl.attr('datetime')?.split('T')[0] || new Date().toISOString().split('T')[0];

      const reviewUrl = 'https://www.signal-arnaques.com/scam/view/899068';

      if (content && content.length > 20) {
        reviews.push({
          external_id: `sa_infonet_${i}`,
          site: 'infonet',
          source: 'signal-arnaques',
          author,
          rating: 1,
          title: 'Signalement Signal Arnaques',
          content,
          published_at: publishedAt,
          review_url: reviewUrl,
          status: 'todo',
        });
      }
    });

    return reviews;
  } catch (err) {
    console.error('[SignalArnaques] Scraping error:', err.message);
    return [];
  }
}

module.exports = { scrapeSignalArnaques };
