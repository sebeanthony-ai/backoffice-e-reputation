const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const SITES = {
  infonet:        'https://fr.trustpilot.com/review/infonet.fr',
  postmee:        'https://fr.trustpilot.com/review/postmee.com',
  startdoc:       'https://fr.trustpilot.com/review/startdoc.fr',
  wenony:         'https://fr.trustpilot.com/review/wenony.fr',
  legaleo:        'https://fr.trustpilot.com/review/legaleo.fr',
  lesentreprises: 'https://fr.trustpilot.com/review/lesentreprises.com',
  datalegal:      'https://fr.trustpilot.com/review/datalegal.fr',
};

// Pool de vrais User-Agents Chrome (Windows, macOS, Linux) — mis à jour 2025
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
];

// Viewports réalistes (largeur x hauteur)
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
];

// Proxies optionnels : TRUSTPILOT_PROXIES="host:port:user:pass,host:port:user:pass"
// ou sans auth : "host:port,host:port"
function loadProxies() {
  const raw = process.env.TRUSTPILOT_PROXIES || '';
  if (!raw.trim()) return [];
  return raw.split(',').map(p => p.trim()).filter(Boolean).map(p => {
    const parts = p.split(':');
    if (parts.length === 4) return { host: parts[0], port: parts[1], username: parts[2], password: parts[3] };
    if (parts.length === 2) return { host: parts[0], port: parts[1], username: null, password: null };
    return null;
  }).filter(Boolean);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Délai humain avec légère variation gaussienne
function humanDelay(baseMs, jitterMs = 0) {
  const jitter = jitterMs ? (Math.random() * jitterMs * 2 - jitterMs) : 0;
  return sleep(Math.max(500, baseMs + jitter));
}

async function simulateHumanBehavior(page) {
  try {
    const scrollSteps = randInt(3, 7);
    const docH = await page.evaluate(() => document.body.scrollHeight);
    const step = Math.floor(docH / scrollSteps);

    for (let i = 1; i <= scrollSteps; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), step * i);
      await sleep(randInt(300, 800));
    }

    // Léger retour en haut (valeur calculée côté Node, passée à la page)
    const topY = randInt(0, 200);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), topY);
    await sleep(randInt(200, 500));

    const x = randInt(100, 1200);
    const y = randInt(100, 700);
    await page.mouse.move(x, y, { steps: randInt(5, 15) });
  } catch (_) {}
}

async function dismissCookieBanner(page) {
  try {
    const selectors = [
      'button[id*="accept"]',
      'button[class*="accept"]',
      'button[data-testid*="accept"]',
      '#onetrust-accept-btn-handler',
      '.cookie-accept',
      '[aria-label*="Accept"]',
      '[aria-label*="Accepter"]',
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await sleep(500);
        return;
      }
    }
  } catch (_) {}
}

async function scrapeTrustpilot(site, maxPages) {
  const baseUrl = SITES[site];
  if (!baseUrl) throw new Error(`Unknown site: ${site}`);

  // Limite de pages : 10 par défaut (≈ 200 avis, largement suffisant pour la
  // veille e-réputation quotidienne) ; ajustable via SCRAPING_MAX_PAGES.
  // La valeur précédente (50) faisait régulièrement crasher l'instance Render
  // 512MB en OOM avant la fin du scraping.
  const effectiveMax = maxPages
    ?? parseInt(process.env.SCRAPING_MAX_PAGES || '10', 10);

  const proxies = loadProxies();
  const proxy   = proxies.length ? pick(proxies) : null;
  const ua      = pick(USER_AGENTS);
  const vp      = pick(VIEWPORTS);

  // Args optimisés pour environnements contraints en RAM (Render Starter 512MB).
  // Voir https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI,IsolateOrigins,site-per-process',
    '--disable-ipc-flooding-protection',
    '--disable-breakpad',
    '--no-zygote',
    '--lang=fr-FR,fr',
    `--window-size=${vp.width},${vp.height}`,
  ];

  if (proxy) {
    args.push(`--proxy-server=http://${proxy.host}:${proxy.port}`);
  }

  const browser = await puppeteer.launch({ headless: 'new', args });
  const reviews = [];

  try {
    const page = await browser.newPage();

    // Auth proxy si besoin
    if (proxy?.username) {
      await page.authenticate({ username: proxy.username, password: proxy.password });
    }

    await page.setViewport({ width: vp.width, height: vp.height });
    await page.setUserAgent(ua);
    // IMPORTANT : n'override QUE Accept-Language.
    // Chrome gère seul Accept / Accept-Encoding / sec-ch-ua* / Sec-Fetch-* en
    // cohérence avec l'UA. Les overrider ici crée une signature incohérente
    // (valeurs doublonnées ou contradictoires) que Cloudflare détecte et bloque (réponse vide / 403).
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Masquer les traces d'automatisation dans le contexte JS de la page
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    // Bloquer images/médias/polices : énorme gain RAM/réseau, sans incidence
    // sur le contenu (le HTML et le JSON anti-bot transitent toujours).
    // On garde stylesheet pour ne pas casser certaines vérifs anti-bot qui
    // observent le rendu CSS (Cloudflare/DataDome).
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    let consecutiveEmpty = 0;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    for (let p = 1; p <= effectiveMax; p++) {
      const url = p === 1 ? baseUrl : `${baseUrl}?page=${p}`;
      console.log(`[Trustpilot] Scraping ${site} page ${p} [UA: ...${ua.slice(-30)}]`);

      let pageReviews = [];
      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const retryDelay = randInt(8000, 15000);
            console.log(`[Trustpilot] Retry ${attempt}/${MAX_RETRIES} page ${p} dans ${retryDelay}ms...`);
            await sleep(retryDelay);
          }

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

          // Gestion bannière cookies (surtout page 1)
          if (p === 1 || attempt > 0) await dismissCookieBanner(page);

          // Attente adaptative selon la page
          const baseWait = p === 1 ? 3000 : 2000;
          await sleep(baseWait + Math.random() * 2000);

          // Comportement humain (scroll + souris)
          await simulateHumanBehavior(page);

          // Attente supplémentaire pour le rendu JS
          await sleep(randInt(500, 1500));

          pageReviews = await page.evaluate((siteName) => {
            const results = [];

            const cards = document.querySelectorAll(
              '[data-service-review-card-paper], article[class*="styles_reviewCard"], [class*="reviewCard"], section[class*="reviewCard"]'
            );

            cards.forEach((card) => {
              try {
                // Note
                const ratingEl = card.querySelector('[data-service-review-rating]');
                let rating = parseInt(ratingEl?.getAttribute('data-service-review-rating') || '0');
                if (!rating) {
                  const img = card.querySelector('img[alt*="étoile"], img[alt*="star"], img[alt*="Étoile"], img[alt*="Star"]');
                  const alt = img?.getAttribute('alt') || '';
                  const m = alt.match(/(\d)/);
                  rating = m ? parseInt(m[1]) : 0;
                }
                if (!rating) {
                  const starDiv = card.querySelector('[class*="star"], [class*="Star"], [class*="rating"], [class*="Rating"]');
                  const cls = starDiv?.className || '';
                  const m2 = cls.match(/[_-](\d)[_-]/);
                  rating = m2 ? parseInt(m2[1]) : 3;
                }

                // Auteur — on teste les sélecteurs en ordre de spécificité
                // (querySelector avec liste suit l'ordre DOM, ce qui peut
                // remonter les initiales de l'avatar avant le nom complet).
                const authorSelList = [
                  '[data-consumer-name-typography]',
                  '[class*="consumerName"]',
                  '[class*="consumer-information"] a',
                  '[class*="consumerInfo"] a[name="consumer-profile"] span',
                  '[class*="consumerInfo"] span',
                ];
                let author = 'Anonyme';
                for (const sel of authorSelList) {
                  const el = card.querySelector(sel);
                  const txt = el?.textContent?.trim();
                  if (txt) { author = txt; break; }
                }

                // Titre
                const titleEl = card.querySelector(
                  '[data-service-review-title-typography], h2[class*="title"], [class*="reviewTitle"]'
                );
                const title = titleEl?.textContent?.trim() || '';

                // Contenu
                const contentEl = card.querySelector(
                  '[data-service-review-text-typography], p[class*="body"], [class*="reviewContent"] p, [class*="reviewBody"], p[class*="review"]'
                );
                const content = contentEl?.textContent?.trim() || '';

                // Date
                const timeEl = card.querySelector('time');
                const publishedAt = timeEl?.getAttribute('datetime')?.split('T')[0]
                  || new Date().toISOString().split('T')[0];

                // UUID / lien
                const reviewUUID = card.getAttribute('data-review-uuid') || '';
                const linkEl = card.querySelector('a[href*="/reviews/"]');
                const reviewHref = linkEl?.getAttribute('href') || '';
                const reviewUrl = reviewHref
                  ? `https://fr.trustpilot.com${reviewHref}`
                  : (reviewUUID ? `https://fr.trustpilot.com/reviews/${reviewUUID}` : '');

                const authorSlug = author.toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^a-z0-9_]/g, '')
                  .slice(0, 30);
                const externalId = reviewUUID
                  ? `tp_${siteName}_${reviewUUID}`
                  : `tp_${siteName}_${authorSlug}_${publishedAt}`;

                if (content && content.length > 1) {
                  results.push({
                    external_id: externalId,
                    site: siteName,
                    source: 'trustpilot',
                    author,
                    rating: rating || 3,
                    title,
                    content,
                    published_at: publishedAt,
                    review_url: reviewUrl,
                    status: 'todo',
                  });
                }
              } catch (_) {}
            });

            return results;
          }, site);

          success = true;
          break;

        } catch (err) {
          console.error(`[Trustpilot] Erreur page ${p} attempt ${attempt} (${site}):`, err.message);
          if (attempt === MAX_RETRIES) {
            retryCount++;
            // Après 3 erreurs consécutives de page, on arrête
            if (retryCount >= 3) {
              console.error(`[Trustpilot] Trop d'erreurs consécutives pour ${site}, arrêt.`);
              break;
            }
          }
        }
      }

      if (!success) break;
      retryCount = 0;

      console.log(`[Trustpilot] ${site} page ${p}: ${pageReviews.length} avis`);
      reviews.push(...pageReviews);

      if (pageReviews.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) break;
      } else {
        consecutiveEmpty = 0;
      }

      // Délai humain entre les pages — plus long au fur et à mesure
      const baseDelay = Math.min(3000 + p * 200, 8000);
      const jitter    = randInt(1000, 4000);
      await humanDelay(baseDelay, jitter);

      // Pause longue aléatoire toutes les 5 pages (simule une lecture)
      if (p % 5 === 0) {
        const longPause = randInt(5000, 12000);
        console.log(`[Trustpilot] Pause longue (${longPause}ms) après page ${p}...`);
        await sleep(longPause);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[Trustpilot] ${site}: ${reviews.length} avis total`);
  return reviews;
}

module.exports = { scrapeTrustpilot };
