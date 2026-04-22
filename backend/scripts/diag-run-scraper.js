// Lance le vrai scraper Trustpilot sur un site (1 page) et log le résultat
const { scrapeTrustpilot } = require('../src/scrapers/trustpilot');

(async () => {
  const site = process.argv[2] || 'infonet';
  console.log('[TEST] scrapeTrustpilot:', site);
  const t0 = Date.now();
  try {
    const reviews = await scrapeTrustpilot(site, 1);
    console.log(`[TEST] durée: ${Date.now() - t0}ms, avis: ${reviews.length}`);
    if (reviews.length) {
      console.log('[TEST] Premier avis:', JSON.stringify(reviews[0], null, 2));
    } else {
      console.log('[TEST] Aucun avis extrait.');
    }
  } catch (e) {
    console.error('[TEST] Erreur:', e);
  }
})();
