const { getDb } = require('../models/database');
const { scrapeTrustpilot } = require('./trustpilot');
const { scrapeAvisVerifies } = require('./avisVerifies');
const { scrapeSignalArnaques } = require('./otherSources');
const { scrape60Millions } = require('./soixanteMillions');

async function scrapeAndSave(site, source) {
  const db = getDb();
  let reviews = [];
  let error = null;

  try {
    if (source === 'trustpilot') {
      reviews = await scrapeTrustpilot(site);
    } else if (source === 'avis-verifies') {
      reviews = await scrapeAvisVerifies(site);
    } else if (source === 'signal-arnaques') {
      reviews = await scrapeSignalArnaques();
    } else if (source === '60millions') {
      reviews = await scrape60Millions();
    }

    const checkExisting = db.prepare(
      'SELECT id FROM reviews WHERE site = ? AND source = ? AND author = ? AND published_at = ?'
    );

    // INSERT OR IGNORE handles both UNIQUE constraints (external_id+source and site+source+author+date)
    const upsert = db.prepare(`
      INSERT OR IGNORE INTO reviews
        (external_id, site, source, author, rating, title, content, published_at, status, review_url)
      VALUES (@external_id, @site, @source, @author, @rating, @title, @content, @published_at, @status, @review_url)
    `);

    const syncBatch = db.transaction((data) => {
      let inserted = 0;
      let skipped = 0;
      for (const review of data) {
        // Skip if already exists by content identity (prevents duplicates when external_id drifts)
        const existing = checkExisting.get(review.site, review.source, review.author, review.published_at);
        if (existing) {
          skipped++;
          continue;
        }
        const result = upsert.run({ ...review, review_url: review.review_url || '' });
        if (result.changes > 0) inserted++;
        else skipped++;
      }
      return { inserted, updated: skipped };
    });

    const { inserted, updated } = syncBatch(reviews);
    const synced = inserted + updated;

    db.prepare(`
      INSERT INTO scrape_logs (site, source, status, reviews_found)
      VALUES (?, ?, 'success', ?)
    `).run(site || 'all', source, synced);

    return {
      success: true,
      newReviews: inserted,
      updated,
      synced,
      total: reviews.length,
    };
  } catch (err) {
    error = err.message;
    db.prepare(`
      INSERT INTO scrape_logs (site, source, status, error_message)
      VALUES (?, ?, 'error', ?)
    `).run(site || 'all', source, error);
    throw err;
  }
}

async function scrapeAll(io) {
  const tasks = [
    { site: 'infonet',         source: 'trustpilot' },
    { site: 'postmee',         source: 'trustpilot' },
    { site: 'startdoc',        source: 'trustpilot' },
    { site: 'wenony',          source: 'trustpilot' },
    { site: 'legaleo',         source: 'trustpilot' },
    { site: 'lesentreprises',  source: 'trustpilot' },
    { site: 'datalegal',       source: 'trustpilot' },
    { site: 'infonet',         source: 'signal-arnaques' },
    { site: 'infonet',         source: '60millions' },
  ];

  const results = [];
  for (const task of tasks) {
    try {
      const result = await scrapeAndSave(task.site, task.source);
      results.push({ ...task, ...result });

      if (io && (result.newReviews > 0 || result.updated > 0)) {
        io.emit('reviews_synced', {
          site: task.site,
          source: task.source,
          inserted: result.newReviews,
          updated: result.updated,
        });
      }
      if (io && result.newReviews > 0) {
        io.emit('new_reviews', { site: task.site, source: task.source, count: result.newReviews });
      }

      await sleep(2000);
    } catch (err) {
      results.push({ ...task, success: false, error: err.message });
    }
  }

  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeAndSave, scrapeAll };
