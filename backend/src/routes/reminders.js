const express = require('express');
const router  = express.Router();
const { getDb } = require('../models/database');

// GET /api/reminders — liste des rappels (pending + triggered non dismissed)
router.get('/', (req, res) => {
  const db = getDb();
  const { status, review_id } = req.query;

  let query = `
    SELECT r.*, rv.author, rv.site, rv.source, rv.title, rv.content
    FROM reminders r
    LEFT JOIN reviews rv ON rv.id = r.review_id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += ' AND r.status = ?'; params.push(status); }
  else { query += " AND r.status != 'dismissed'"; }
  if (review_id) { query += ' AND r.review_id = ?'; params.push(review_id); }

  query += ' ORDER BY r.remind_at ASC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/reminders — créer un rappel
router.post('/', (req, res) => {
  const db = getDb();
  const { review_id, message, remind_at } = req.body;

  if (!remind_at) return res.status(400).json({ error: 'remind_at required' });

  const result = db.prepare(`
    INSERT INTO reminders (review_id, message, remind_at)
    VALUES (?, ?, ?)
  `).run(review_id || null, message || '', remind_at);

  const created = db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /api/reminders/:id — mettre à jour le statut
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { status } = req.body;

  if (!['pending', 'triggered', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.prepare(`UPDATE reminders SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, req.params.id);

  res.json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id));
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
