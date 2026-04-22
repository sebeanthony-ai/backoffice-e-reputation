const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

/** Avis sans date en fin de liste ; puis published_at puis id (cohérent avec l’index lexicographique ISO). */
const ORDER_PUBLISHED_AT_NULLS_LAST = `(CASE WHEN published_at IS NULL OR TRIM(COALESCE(published_at, '')) = '' THEN 1 ELSE 0 END) ASC`;

// GET /api/reviews - list reviews with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { site, source, status, rating, search, date_from, date_to, page = 1, limit = 50, sort_by, sort_dir } = req.query;

  const ALLOWED_SORT_FIELDS = ['published_at', 'created_at', 'rating', 'author', 'status', 'source'];
  const sortField = ALLOWED_SORT_FIELDS.includes(sort_by) ? sort_by : 'published_at';
  const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC';

  let query = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];

  if (site && site !== 'all') { query += ' AND site = ?'; params.push(site); }
  if (source) { query += ' AND source = ?'; params.push(source); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (rating) { query += ' AND rating = ?'; params.push(parseInt(rating)); }
  if (date_from) { query += ' AND published_at >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND published_at <= ?'; params.push(date_to); }
  if (search) {
    query += ' AND (content LIKE ? OR author LIKE ? OR title LIKE ? OR note LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (sortField === 'published_at') {
    query += ` ORDER BY ${ORDER_PUBLISHED_AT_NULLS_LAST}, published_at ${sortDirection}, id ${sortDirection}`;
  } else {
    query += ` ORDER BY ${sortField} ${sortDirection}, id ${sortDirection}`;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params)?.cnt || 0;

  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const reviews = db.prepare(query).all(...params);

  res.json({
    reviews,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    }
  });
});

// GET /api/reviews/stats - get statistics
router.get('/stats', (req, res) => {
  const db = getDb();

  const byStatus = db.prepare(`
    SELECT site, status, COUNT(*) as count FROM reviews GROUP BY site, status
  `).all();

  const bySource = db.prepare(`
    SELECT site, source, COUNT(*) as count, AVG(rating) as avg_rating FROM reviews GROUP BY site, source
  `).all();

  const byRating = db.prepare(`
    SELECT site, rating, COUNT(*) as count FROM reviews GROUP BY site, rating ORDER BY site, rating
  `).all();

  const recent = db.prepare(`
    SELECT * FROM reviews WHERE status = 'todo'
    ORDER BY ${ORDER_PUBLISHED_AT_NULLS_LAST}, published_at DESC, id DESC
    LIMIT 5
  `).all();

  const totals = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      ROUND(AVG(rating), 1) as avg_rating
    FROM reviews
  `).get();

  const siteStats = db.prepare(`
    SELECT 
      site,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive
    FROM reviews
    GROUP BY site
  `).all();

  res.json({ totals, siteStats, byStatus, bySource, byRating, recent });
});

// GET /api/reviews/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.json(review);
});

// PATCH /api/reviews/:id - update status, note, assigned_to, agents, contacted_at
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { status, note, assigned_to, agents, contacted_at } = req.body;

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const fields = [];
  const params = [];

  if (status       !== undefined) { fields.push('status = ?');       params.push(status); }
  if (note         !== undefined) { fields.push('note = ?');         params.push(note); }
  if (assigned_to  !== undefined) { fields.push('assigned_to = ?');  params.push(assigned_to); }
  if (agents       !== undefined) { fields.push('agents = ?');       params.push(agents); }
  if (contacted_at !== undefined) { fields.push('contacted_at = ?'); params.push(contacted_at); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push('updated_at = datetime(\'now\')');
  params.push(req.params.id);

  db.prepare(`UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/reviews/bulk/status - bulk status update
router.patch('/bulk/status', (req, res) => {
  const db = getDb();
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || !status) {
    return res.status(400).json({ error: 'ids array and status required' });
  }

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE reviews SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`)
    .run(status, ...ids);

  res.json({ updated: ids.length });
});

module.exports = router;
