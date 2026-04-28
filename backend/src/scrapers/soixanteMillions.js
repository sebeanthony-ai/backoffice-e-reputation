const { launchBrowser } = require('./browserLauncher');

const FORUM_URL = 'https://www.60millions-mag.com/forum/d/294228-abonnement-info-net';

/**
 * Scrape le fil de discussion 60 Millions de Consommateurs sur Infonet.
 * Flarum charge les posts au scroll — on scrolle jusqu'à épuisement.
 */
async function scrape60Millions() {
  // En prod, @sparticuz/chromium gère les flags RAM-saving (Render Starter 512MB).
  const browser = await launchBrowser({
    extraArgs: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--lang=fr-FR',
    ],
    viewport: { width: 1280, height: 900 },
  });

  const reviews = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' });

    // Bloquer images/médias/polices : énorme gain RAM/réseau.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('[60Millions] Chargement du fil de discussion...');
    await page.goto(FORUM_URL, { waitUntil: 'networkidle2', timeout: 45000 });

    // Attente du premier post
    try {
      await page.waitForSelector('article.Post', { timeout: 20000 });
    } catch {
      console.warn('[60Millions] Aucun article.Post détecté après 20s, on continue quand même.');
    }

    // Scroll progressif pour déclencher le chargement lazy de Flarum
    let previousCount = 0;
    let sameCountStreak = 0;
    const MAX_STREAK = 4;

    while (sameCountStreak < MAX_STREAK) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2500 + Math.random() * 1000);

      const currentCount = await page.evaluate(
        () => document.querySelectorAll('article.Post.CommentPost').length
      );
      console.log(`[60Millions] Posts chargés : ${currentCount}`);

      if (currentCount === previousCount) {
        sameCountStreak++;
      } else {
        sameCountStreak = 0;
        previousCount = currentCount;
      }
    }

    // Extraction de tous les posts visibles
    const posts = await page.evaluate((forumUrl) => {
      const results = [];
      const articles = document.querySelectorAll('article.Post.CommentPost');

      articles.forEach((article, idx) => {
        try {
          const postId = article.getAttribute('data-id') || `idx_${idx}`;

          // Auteur — plusieurs sélecteurs possibles selon version Flarum
          const authorEl =
            article.querySelector('.PostUser .username') ||
            article.querySelector('.PostUser a[href*="/u/"]') ||
            article.querySelector('.PostUser a') ||
            article.querySelector('[class*="username"]');
          const author = authorEl?.textContent?.trim() || 'Anonyme';

          // Date
          const timeEl = article.querySelector('time');
          const publishedAt =
            timeEl?.getAttribute('datetime')?.split('T')[0] ||
            new Date().toISOString().split('T')[0];

          // Contenu textuel du post (on exclut les citations imbriquées pour ne pas dupliquer)
          const bodyEl = article.querySelector('.Post-body');
          let content = '';
          if (bodyEl) {
            // Retire les blockquotes pour éviter la duplication du texte cité
            const clone = bodyEl.cloneNode(true);
            clone.querySelectorAll('blockquote').forEach((bq) => bq.remove());
            content = (clone.innerText || clone.textContent || '').trim();
          }

          if (content && content.length > 15) {
            results.push({
              postId,
              author,
              publishedAt,
              content,
              reviewUrl: `${forumUrl}/${postId}`,
            });
          }
        } catch (_) {}
      });

      return results;
    }, FORUM_URL);

    console.log(`[60Millions] ${posts.length} posts extraits`);

    for (const post of posts) {
      reviews.push({
        external_id: `60m_infonet_${post.postId}`,
        site: 'infonet',
        source: '60millions',
        author: post.author,
        rating: 1,
        title: '',
        content: post.content,
        published_at: post.publishedAt,
        review_url: post.reviewUrl,
        status: 'todo',
      });
    }
  } finally {
    await browser.close();
  }

  console.log(`[60Millions] Total : ${reviews.length} avis`);
  return reviews;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { scrape60Millions };
