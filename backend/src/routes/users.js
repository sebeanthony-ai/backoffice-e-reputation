const express = require('express');
const router = express.Router();

const {
  listAll,
  createUser,
  updateUser,
  deleteUser,
  findById,
  sanitizeUser,
} = require('../models/users');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, (_req, res) => {
  res.json({ users: listAll() });
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const { email, password, name, role } = req.body || {};
    const user = createUser({ email, password, name, role });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur création' });
  }
});

router.get('/:id', requireAdmin, (req, res) => {
  const user = findById(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user: sanitizeUser(user) });
});

router.patch('/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, role, password, email } = req.body || {};

    if (role && role !== 'admin' && req.user.id === id) {
      return res
        .status(400)
        .json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin' });
    }

    const user = updateUser(id, { name, role, password, email });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur mise à jour' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.id === id) {
      return res
        .status(400)
        .json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    deleteUser(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur suppression' });
  }
});

module.exports = router;
