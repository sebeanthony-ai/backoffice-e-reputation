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
router.post('/run', async (req, res) => {
  const { site, source } = req.body;

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
  res.json({ message: 'Scraping started', site, source });

  try {
    const result = await scrapeAndSave(site, source);
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
router.post('/run-all', async (req, res) => {
  if (scrapeState.inProgress) {
    return res.status(409).json({ error: 'Scraping already in progress' });
  }

  scrapeState.inProgress = true;
  const io = req.app.get('io');
  if (io) io.emit('scrape_status', { inProgress: true, source: 'manual-all' });
  res.json({ message: 'Full scraping started' });

  try {
    const results = await scrapeAll(io);
    if (io) io.emit('scrape_all_complete', { results });
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
