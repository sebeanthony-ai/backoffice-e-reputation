const express = require('express');
const router = express.Router();
const { scrapeAndSave, scrapeAll } = require('../scrapers');
const { getDb } = require('../models/database');
const scrapeState = require('../scrapeState');

/** Combinaisons site+source autorisées. Toute autre est rejetée. */
const ALLOWED_TASKS = [
  { site: 'infonet',        source: 'trustpilot' },
  { site: 'infonet',        source: 'signal-arnaques' },
  { site: 'postmee',        source: 'trustpilot' },
  { site: 'startdoc',       source: 'trustpilot' },
  { site: 'wenony',         source: 'trustpilot' },
  { site: 'legaleo',        source: 'trustpilot' },
  { site: 'lesentreprises', source: 'trustpilot' },
  { site: 'datalegal',      source: 'trustpilot' },
  { site: 'infonet',        source: '60millions' },
];

// POST /api/scraping/run - trigger scraping for specific site+source
//
// Body :
//   { site, source, quick? }
//   quick=true  => 3 pages (~30s pour Trustpilot, défaut côté UI manuel)
//   quick=false => défaut du scraper (10 pages)
router.post('/run', async (req, res) => {
  const { site, source } = req.body;
  const quick = req.body?.quick === true;
  const maxPages = quick ? 3 : undefined;

  if (scrapeState.inProgress) {
    return res.status(409).json({ error: 'Scraping already in progress' });
  }

  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }

  const allowed = ALLOWED_TASKS.some(t => t.site === site && t.source === source);
  if (!allowed) {
    return res.status(403).json({ error: `Combinaison ${site}/${source} non autorisée.` });
  }

  scrapeState.inProgress = true;
  const io = req.app.get('io');
  if (io) io.emit('scrape_status', { inProgress: true, source: 'manual', site, scrapeSource: source });
  res.json({ message: 'Scraping started', site, source, quick });

  try {
    const result = await scrapeAndSave(site, source, { maxPages });
    if (io) {
      io.emit('scrape_complete', { site, source, ...result });
      if (result.newReviews > 0 || result.updated > 0) {
        io.emit('reviews_synced', { site, source, inserted: result.newReviews, updated: result.updated });
      }
      if (result.newReviews > 0) {
        io.emit('new_reviews', { site, source, count: result.newReviews });
      }
    }
  } catch (err) {
    console.error('Scraping error:', err.message);
    if (io) io.emit('scrape_error', { site, source, error: err.message });
  } finally {
    scrapeState.inProgress = false;
    if (io) io.emit('scrape_status', { inProgress: false });
  }
});

// POST /api/scraping/run-all - trigger all scrapers
//
// Body (optionnel) :
//   { quick: true }   => 3 pages Trustpilot par site (~4 min total).
//                        Utilisé par le bouton "Tout synchroniser" du back-office.
//   {} ou { quick: false }
//                     => valeur par défaut du scraper (10 pages, ~15 min).
//                        Utilisé par le cron quotidien à 4h.
router.post('/run-all', async (req, res) => {
  if (scrapeState.inProgress) {
    return res.status(409).json({ error: 'Scraping already in progress' });
  }

  const quick = req.body?.quick === true;
  // 3 pages Trustpilot ≈ 60 avis récents par site, suffisant pour un refresh
  // manuel. Le cron quotidien continue de scraper en profondeur (10 pages).
  const maxPages = quick ? 3 : undefined;

  scrapeState.inProgress = true;
  const io = req.app.get('io');
  if (io) io.emit('scrape_status', { inProgress: true, source: quick ? 'manual-all-quick' : 'manual-all' });
  res.json({ message: 'Full scraping started', quick });

  try {
    const results = await scrapeAll(io, { maxPages });
    if (io) io.emit('scrape_all_complete', { results, quick });
  } catch (err) {
    if (io) io.emit('scrape_error', { error: err.message });
  } finally {
    scrapeState.inProgress = false;
    if (io) io.emit('scrape_status', { inProgress: false });
  }
});

// GET /api/scraping/logs - get scraping history
router.get('/logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT * FROM scrape_logs ORDER BY scraped_at DESC LIMIT 50
  `).all();
  res.json(logs);
});

// GET /api/scraping/status
router.get('/status', (req, res) => {
  res.json({ inProgress: scrapeState.inProgress });
});

module.exports = router;
