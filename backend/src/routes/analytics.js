const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

const ORDER_PUBLISHED_AT_NULLS_LAST = `(CASE WHEN published_at IS NULL OR TRIM(COALESCE(published_at, '')) = '' THEN 1 ELSE 0 END) ASC`;

// GET /api/analytics — toutes les données analytiques
router.get('/', (req, res) => {
  const db = getDb();

  // ── 1. KPIs avancés ───────────────────────────────────────────────────────
  const totalReviews    = db.prepare("SELECT COUNT(*) as n FROM reviews").get().n;
  const totalResponses  = db.prepare("SELECT COUNT(*) as n FROM responses").get().n;
  const responseRate    = totalReviews > 0 ? Math.round((totalResponses / totalReviews) * 100) : 0;

  // NPS : (% 5 étoiles) - (% 1-2 étoiles)
  const positiveCount = db.prepare("SELECT COUNT(*) as n FROM reviews WHERE rating >= 4").get().n;
  const negativeCount = db.prepare("SELECT COUNT(*) as n FROM reviews WHERE rating <= 2").get().n;
  const nps = totalReviews > 0
    ? Math.round(((positiveCount - negativeCount) / totalReviews) * 100)
    : 0;

  // Délai moyen de traitement (jours entre created_at et updated_at pour les résolus)
  const resolvedAvg = db.prepare(`
    SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
    FROM reviews WHERE status = 'resolved'
  `).get().avg_days;
  const avgResolutionDays = resolvedAvg ? Math.round(resolvedAvg * 10) / 10 : 0;

  // Avis ce mois-ci vs mois dernier
  const thisMonth  = db.prepare("SELECT COUNT(*) as n FROM reviews WHERE strftime('%Y-%m', published_at) = strftime('%Y-%m', 'now')").get().n;
  const lastMonth  = db.prepare("SELECT COUNT(*) as n FROM reviews WHERE strftime('%Y-%m', published_at) = strftime('%Y-%m', date('now','-1 month'))").get().n;
  const monthGrowth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  // ── 2. Évolution des avis par semaine (12 dernières semaines) ────────────
  const weeklyEvolution = db.prepare(`
    SELECT
      strftime('%Y-W%W', published_at) as week,
      COUNT(*) as total,
      SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
      ROUND(AVG(rating), 1) as avg_rating
    FROM reviews
    WHERE published_at >= date('now', '-84 days')
    GROUP BY week
    ORDER BY week ASC
  `).all();

  // ── 3. Évolution mensuelle (12 derniers mois) ────────────────────────────
  const monthlyEvolution = db.prepare(`
    SELECT
      strftime('%Y-%m', published_at) as month,
      COUNT(*) as total,
      SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
      ROUND(AVG(rating), 1) as avg_rating
    FROM reviews
    WHERE published_at >= date('now', '-365 days')
    GROUP BY month
    ORDER BY month ASC
  `).all();

  // ── 4. Répartition par note (1→5) ────────────────────────────────────────
  const ratingDistribution = db.prepare(`
    SELECT rating, COUNT(*) as count
    FROM reviews
    GROUP BY rating
    ORDER BY rating DESC
  `).all();

  // ── 5. Avis par source ───────────────────────────────────────────────────
  const bySource = db.prepare(`
    SELECT source, COUNT(*) as total,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative
    FROM reviews
    GROUP BY source
    ORDER BY total DESC
  `).all();

  // ── 6. Comparaison par site ──────────────────────────────────────────────
  const bySite = db.prepare(`
    SELECT site,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive
    FROM reviews
    GROUP BY site
    ORDER BY total DESC
  `).all();

  // ── 7. Statuts globaux ───────────────────────────────────────────────────
  const statusDistribution = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM reviews GROUP BY status
  `).all();

  // ── 8. Top avis récents négatifs non traités ─────────────────────────────
  const urgentReviews = db.prepare(`
    SELECT id, site, source, author, rating, title, content, published_at, status
    FROM reviews
    WHERE rating <= 2 AND status = 'todo'
    ORDER BY ${ORDER_PUBLISHED_AT_NULLS_LAST}, published_at DESC, id DESC
    LIMIT 5
  `).all();

  // ── 9. Taux de résolution par site ───────────────────────────────────────
  const resolutionRate = bySite.map(s => ({
    site: s.site,
    rate: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0,
    total: s.total,
    resolved: s.resolved,
  }));

  res.json({
    kpis: {
      totalReviews, responseRate, nps,
      avgResolutionDays, thisMonth, lastMonth, monthGrowth,
      positiveCount, negativeCount,
    },
    weeklyEvolution,
    monthlyEvolution,
    ratingDistribution,
    bySource,
    bySite,
    statusDistribution,
    urgentReviews,
    resolutionRate,
  });
});

module.exports = router;
