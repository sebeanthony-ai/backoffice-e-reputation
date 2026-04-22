require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');

const reviewsRouter    = require('./routes/reviews');
const scrapingRouter   = require('./routes/scraping');
const responsesRouter  = require('./routes/responses');
const analyticsRouter  = require('./routes/analytics');
const remindersRouter  = require('./routes/reminders');
const historiqueRouter = require('./routes/historique');
const authRouter       = require('./routes/auth');
const usersRouter      = require('./routes/users');
const { scrapeAll } = require('./scrapers');
const { getDb } = require('./models/database');
const { seedInitialAdmin, findById } = require('./models/users');
const { requireAuth, COOKIE_NAME } = require('./middleware/auth');
const scrapeState = require('./scrapeState');

const app = express();
const server = http.createServer(app);

/** Origines autorisées (front Vercel, etc.), séparées par des virgules. Vide = tout autoriser (dev local). */
function parseCorsOrigins() {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
const corsOrigins = parseCorsOrigins();

const io = new Server(server, {
  cors: {
    origin: corsOrigins.length ? corsOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Authentification Socket.IO : le cookie de session suffit (le front met withCredentials: true).
// Fallback : token dans socket.handshake.auth.token (Bearer).
io.use((socket, next) => {
  try {
    if (!process.env.JWT_SECRET) return next();
    const cookies = parseCookieHeader(socket.handshake.headers.cookie || '');
    const token = cookies[COOKIE_NAME] || (socket.handshake.auth && socket.handshake.auth.token);
    if (!token) return next(new Error('Unauthorized'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = findById(payload.sub);
    if (!user) return next(new Error('Unauthorized'));
    socket.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (_err) {
    next(new Error('Unauthorized'));
  }
});

function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

app.use(
  cors({
    origin: corsOrigins.length
      ? (origin, cb) => {
          if (!origin) return cb(null, true);
          if (corsOrigins.includes(origin)) return cb(null, true);
          cb(new Error('Not allowed by CORS'));
        }
      : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.set('io', io);

// Routes publiques
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRouter);

// Fichiers d'écrans publics pour affichage dans les <img>
// (le middleware d'auth plus bas les ignore)
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const p = req.path || '';
  if (req.method === 'GET' && p.startsWith('/historique/files/')) return next();
  return requireAuth(req, res, next);
});

// Routes protégées
app.use('/api/users', usersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/reviews/:reviewId/responses', responsesRouter);
app.use('/api/scraping', scrapingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/historique', historiqueRouter);

// WebSocket
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id, socket.user ? `(${socket.user.email})` : '');
  socket.on('disconnect', () => console.log('[WS] Client disconnected:', socket.id));
});

// Init DB + seed admin
getDb();
seedInitialAdmin();

// Vérification des rappels chaque minute
cron.schedule('* * * * *', () => {
  try {
    const db = getDb();
    const due = db.prepare(`
      SELECT r.*, rv.author, rv.site, rv.source, rv.title
      FROM reminders r
      LEFT JOIN reviews rv ON rv.id = r.review_id
      WHERE r.status = 'pending' AND r.remind_at <= datetime('now')
    `).all();

    for (const reminder of due) {
      db.prepare(`UPDATE reminders SET status = 'triggered', updated_at = datetime('now') WHERE id = ?`)
        .run(reminder.id);
      io.emit('reminder:due', reminder);
      console.log(`[Rappel] Échéance atteinte: ${reminder.message || 'Sans message'} (review: ${reminder.author || 'N/A'})`);
    }
  } catch (err) {
    console.error('[Cron/Reminders] Erreur:', err.message);
  }
});

// Synchronisation automatique des avis : toutes les sources (Trustpilot, Avis Vérifiés, Signal Arnaques…)
// — jamais « 60 Millions » (désactivé dans scrapeAndSave / liste des tâches).
// Déclenchement : toutes les 5 minutes par défaut. Surcharge possible via SCRAPING_CRON (ex. "*/30 * * * *" = 30 min).
const DEFAULT_SCRAPING_CRON = '*/5 * * * *';
const scrapingCron = process.env.SCRAPING_CRON || DEFAULT_SCRAPING_CRON;
cron.schedule(scrapingCron, async () => {
  if (scrapeState.inProgress) {
    console.log('[Cron] Scraping déjà en cours, passage ignoré.');
    return;
  }
  console.log('[Cron] Synchronisation automatique des avis (toutes les sources)...');
  scrapeState.inProgress = true;
  io.emit('scrape_status', { inProgress: true, source: 'cron' });
  try {
    await scrapeAll(io);
    console.log('[Cron] Synchronisation terminée');
  } catch (err) {
    console.error('[Cron] Erreur synchronisation:', err.message);
  } finally {
    scrapeState.inProgress = false;
    io.emit('scrape_status', { inProgress: false });
  }
});

// Optionnel : une synchro au démarrage (après délai) — SCRAPING_ON_START=1
if (process.env.SCRAPING_ON_START === '1') {
  const delayMs = parseInt(process.env.SCRAPING_START_DELAY_MS || '20000', 10);
  setTimeout(() => {
    console.log('[Startup] Synchronisation initiale des avis...');
    scrapeAll(io).catch((err) => console.error('[Startup] Synchro:', err.message));
  }, delayMs);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Back Office E-Reputation API running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready`);
  console.log(`🕐 Synchro auto avis (cron): ${scrapingCron}`);
  if (process.env.SCRAPING_ON_START === '1') {
    console.log(`⏱️  Synchro au démarrage dans ${parseInt(process.env.SCRAPING_START_DELAY_MS || '20000', 10) / 1000}s\n`);
  } else {
    console.log('');
  }
});
