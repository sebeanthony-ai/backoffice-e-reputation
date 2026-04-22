const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

const UPLOAD_DIR  = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'historique')
  : path.join(__dirname, '../../uploads/historique');
const INDEX_FILE  = path.join(UPLOAD_DIR, '_index.json');
// Avis "épinglés" depuis le back office vers la page Historique.
// Stockés dans un JSON plat pour ne pas toucher aux CSV externes.
const SAVED_FILE  = path.join(UPLOAD_DIR, '_saved_reviews.json');

// Crée le dossier si nécessaire
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Charge/sauvegarde l'index URL → [filenames]
function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch { return {}; }
}
function saveIndex(idx) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

function loadSaved() {
  try { return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8')); } catch { return []; }
}
function persistSaved(arr) {
  fs.writeFileSync(SAVED_FILE, JSON.stringify(arr, null, 2));
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  },
});

// Servir les fichiers uploadés
router.use('/files', express.static(UPLOAD_DIR));

// GET /api/historique/screenshots — renvoie l'index complet
router.get('/screenshots', (_req, res) => {
  res.json(loadIndex());
});

// POST /api/historique/screenshots — upload une capture pour une URL
// body: { reviewUrl: string }  +  file field "screenshot"
router.post(
  '/screenshots',
  (req, res, next) => {
    upload.single('screenshot')(req, res, (err) => {
      if (err) {
        const msg = err.message || 'Fichier invalide';
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  (req, res) => {
    try {
      const { reviewUrl } = req.body;
      if (!reviewUrl || !req.file) {
        return res.status(400).json({ error: 'reviewUrl et fichier image requis' });
      }

      const idx = loadIndex();
      if (!idx[reviewUrl]) idx[reviewUrl] = [];
      idx[reviewUrl].push(req.file.filename);
      saveIndex(idx);

      res.json({ filename: req.file.filename, reviewUrl });
    } catch (e) {
      console.error('[historique/screenshots POST]', e);
      res.status(500).json({ error: 'Impossible d\'enregistrer la capture sur le serveur' });
    }
  },
);

// DELETE /api/historique/screenshots — supprime une capture
// body: { reviewUrl, filename }
router.delete('/screenshots', (req, res) => {
  const { reviewUrl, filename } = req.body;
  if (!reviewUrl || !filename) return res.status(400).json({ error: 'reviewUrl et filename requis' });

  const idx = loadIndex();
  if (idx[reviewUrl]) {
    idx[reviewUrl] = idx[reviewUrl].filter(f => f !== filename);
    if (idx[reviewUrl].length === 0) delete idx[reviewUrl];
    saveIndex(idx);
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.json({ ok: true });
});

// ── Avis sauvegardés (épinglés) ─────────────────────────────────────────────
// Stockés côté backend pour survivre aux sessions et être visibles sur la page
// Historique.

// GET /api/historique/saved-reviews — tous les avis sauvegardés
router.get('/saved-reviews', (_req, res) => {
  res.json(loadSaved());
});

// POST /api/historique/saved-reviews — sauvegarde (ou met à jour) un avis
// body: { review: { id, site, source, author, rating, title, content,
//   published_at, status, note, review_url, ... } }
router.post('/saved-reviews', (req, res) => {
  try {
    const review = req.body && req.body.review;
    if (!review || typeof review.id !== 'number') {
      return res.status(400).json({ error: 'review.id (number) requis' });
    }
    const arr = loadSaved();
    const record = { review, savedAt: new Date().toISOString() };
    const idx = arr.findIndex(r => r.review && r.review.id === review.id);
    if (idx >= 0) arr[idx] = { ...record, savedAt: arr[idx].savedAt };
    else arr.push(record);
    persistSaved(arr);
    res.json(record);
  } catch (e) {
    console.error('[historique/saved-reviews POST]', e);
    res.status(500).json({ error: 'Impossible d\'enregistrer l\'avis (disque ou permissions)' });
  }
});

// DELETE /api/historique/saved-reviews/:id — retire un avis sauvegardé
router.delete('/saved-reviews/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id invalide' });
  const arr = loadSaved().filter(r => !r.review || r.review.id !== id);
  persistSaved(arr);
  res.json({ ok: true });
});

module.exports = router;
