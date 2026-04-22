const express = require('express');
const router = express.Router({ mergeParams: true }); // access :reviewId
const { getDb } = require('../models/database');

// GET /api/reviews/:reviewId/responses
router.get('/', (req, res) => {
  const db = getDb();
  const { reviewId } = req.params;
  const responses = db.prepare(
    'SELECT * FROM responses WHERE review_id = ? ORDER BY created_at ASC'
  ).all(reviewId);
  res.json(responses);
});

// POST /api/reviews/:reviewId/responses
router.post('/', (req, res) => {
  const db = getDb();
  const { reviewId } = req.params;
  const { author = 'Équipe E-Réputation', content, is_published = 0, published_on = '' } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: 'content requis' });

  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return res.status(404).json({ error: 'Avis introuvable' });

  const result = db.prepare(`
    INSERT INTO responses (review_id, author, content, is_published, published_on)
    VALUES (?, ?, ?, ?, ?)
  `).run(reviewId, author.trim(), content.trim(), is_published ? 1 : 0, published_on);

  const created = db.prepare('SELECT * FROM responses WHERE id = ?').get(result.lastInsertRowid);

  // Emit via WebSocket
  const io = req.app.get('io');
  if (io) io.emit('response_added', { reviewId: parseInt(reviewId), response: created });

  res.status(201).json(created);
});

// PATCH /api/reviews/:reviewId/responses/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id, reviewId } = req.params;
  const { content, author, is_published, published_on } = req.body;

  const existing = db.prepare('SELECT * FROM responses WHERE id = ? AND review_id = ?').get(id, reviewId);
  if (!existing) return res.status(404).json({ error: 'Réponse introuvable' });

  const fields = [];
  const params = [];
  if (content !== undefined)      { fields.push('content = ?');      params.push(content.trim()); }
  if (author !== undefined)       { fields.push('author = ?');       params.push(author.trim()); }
  if (is_published !== undefined) { fields.push('is_published = ?'); params.push(is_published ? 1 : 0); }
  if (published_on !== undefined) { fields.push('published_on = ?'); params.push(published_on); }

  if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });

  fields.push("updated_at = datetime('now')");
  params.push(id, reviewId);

  db.prepare(`UPDATE responses SET ${fields.join(', ')} WHERE id = ? AND review_id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM responses WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/reviews/:reviewId/responses/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id, reviewId } = req.params;
  const existing = db.prepare('SELECT id FROM responses WHERE id = ? AND review_id = ?').get(id, reviewId);
  if (!existing) return res.status(404).json({ error: 'Réponse introuvable' });
  db.prepare('DELETE FROM responses WHERE id = ?').run(id);
  res.json({ deleted: true });
});

module.exports = router;
