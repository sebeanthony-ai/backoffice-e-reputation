const Database = require('better-sqlite3');
const path = require('path');

/** En prod (Render, etc.) : définir DATA_DIR=/data sur un disque persistant. */
const dataRoot = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(dataRoot, 'reviews.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT,
      site TEXT NOT NULL,
      source TEXT NOT NULL,
      author TEXT,
      rating INTEGER,
      title TEXT,
      content TEXT NOT NULL,
      published_at TEXT,
      status TEXT DEFAULT 'todo',
      note TEXT DEFAULT '',
      assigned_to TEXT DEFAULT '',
      review_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(external_id, source)
    );

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site TEXT,
      source TEXT,
      status TEXT,
      reviews_found INTEGER DEFAULT 0,
      error_message TEXT,
      scraped_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'Équipe E-Réputation',
      content TEXT NOT NULL,
      is_published INTEGER DEFAULT 0,
      published_on TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
      message TEXT NOT NULL DEFAULT '',
      remind_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'agent',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations : ajouter colonnes si absentes
  try { db.exec("ALTER TABLE reviews ADD COLUMN review_url    TEXT DEFAULT ''"); } catch (_) {}
  try { db.exec("ALTER TABLE reviews ADD COLUMN agents        TEXT DEFAULT ''"); } catch (_) {}
  try { db.exec("ALTER TABLE reviews ADD COLUMN contacted_at  TEXT DEFAULT ''"); } catch (_) {}

  // Index unique sur (site, source, author, published_at) pour bloquer les doublons de contenu
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_no_dupe ON reviews(site, source, author, published_at)`);
  } catch (_) {}

  const checkStmt = db.prepare("SELECT COUNT(*) as cnt FROM reviews");
  const { cnt } = checkStmt.get();
  if (cnt === 0) {
    seedInitialData(db);
  }
}

function seedInitialData(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO reviews 
    (external_id, site, source, author, rating, title, content, published_at, status, review_url)
    VALUES (@external_id, @site, @source, @author, @rating, @title, @content, @published_at, @status, @review_url)
  `);

  const seedData = [
    // ═══════════════════════════════════════════════
    // INFONET - TRUSTPILOT (65 avis)
    // ═══════════════════════════════════════════════
    { external_id: 'tp_infonet_001', site: 'infonet', source: 'trustpilot', author: 'Ramata', rating: 5, title: 'Super merci rapide simple et efficace', content: 'Super merci rapide simple et efficace', published_at: '2026-04-14', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_002', site: 'infonet', source: 'trustpilot', author: 'J J Nono', rating: 1, title: 'Arnaque ! Vol attention abonnement caché', content: "Arnaque ! Vol attention abonnement caché", published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_003', site: 'infonet', source: 'trustpilot', author: 'LO', rating: 1, title: '⚠️ Attention à Infonet', content: "J'ai simplement voulu acheter un extrait Kbis à environ 3€. À aucun moment je n'ai vu clairement que cela m'engageait à un abonnement. Résultat : quelques jours après, tentative de prélèvement de près de 94€ pour un abonnement mensuel avec engagement de 12 mois. Heureusement, ma banque a bloqué le paiement pour suspicion de fraude. Depuis, je reçois des emails avec des messages de pression parlant de « recouvrement », de « contrat en souffrance ». Je considère que cette pratique est trompeuse.", published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_004', site: 'infonet', source: 'trustpilot', author: 'Julie', rating: 1, title: 'Pas de KBIS... uniquement des menaces', content: "Je me suis rendu sur le site uniquement pour demander un KBIS professionnelle et j'etais débité. Cependant je n'ai reçu aucun KBIS. Il s'avère que AUCUN KBIS est disponible pour un entreprise individuelle – mon cas. Maintenant je recois les emails et menaces.", published_at: '2026-03-27', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_005', site: 'infonet', source: 'trustpilot', author: 'gasc sourcing', rating: 5, title: 'Ça ressemble un peu à une arnaque', content: "Ça ressemble un peu à une arnaque", published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_006', site: 'infonet', source: 'trustpilot', author: 'Ik Ik', rating: 5, title: 'Top génial bien', content: 'Top génial bien', published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_007', site: 'infonet', source: 'trustpilot', author: 'Fab Mans', rating: 5, title: 'Rapide et efficace', content: 'Rapide et efficace', published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_008', site: 'infonet', source: 'trustpilot', author: 'Jule Gorski', rating: 5, title: 'Très bonne expérience avec infonet', content: 'Très bonne expérience avec infonet.', published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_009', site: 'infonet', source: 'trustpilot', author: 'T.M.', rating: 2, title: 'Pratique commerciale trompeuse', content: "Pratique commerciale trompeuse qui laisse croire qu'on va récupérer un document pour 3€ HT et qui vous lie pour 1 an (+de 1000€ d'abonnement) sans possibilité de rétractation. Service client rodé, qui propose un arrangement amiable pour 300-400€, avec intimidation et menace de procédures juridiques. Ne pas hésiter à se défendre (médiateur, centre européen de défense des consommateurs, opposition bancaire et DGCCRF).", published_at: '2026-04-01', status: 'in_progress', review_url: '' },
    { external_id: 'tp_infonet_010', site: 'infonet', source: 'trustpilot', author: 'Magalie Brunet', rating: 5, title: 'Merci', content: 'Merci, très pratique et rapide.', published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_011', site: 'infonet', source: 'trustpilot', author: 'Niamet Bouardi', rating: 3, title: 'Dur à avoir', content: 'Dur à avoir le kbis', published_at: '2026-04-11', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_012', site: 'infonet', source: 'trustpilot', author: 'Marilia DE ANDRADE', rating: 2, title: 'Merci pour vos services', content: 'Merci pour vos services cordialement', published_at: '2026-04-11', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_013', site: 'infonet', source: 'trustpilot', author: 'Adrien Abad', rating: 4, title: 'Très bonne réactivité', content: 'Très bonne réactivité', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_014', site: 'infonet', source: 'trustpilot', author: 'Valérie G', rating: 1, title: 'Grosse arnaque', content: "Grosse arnaque. Ils demandent 3€ pour télécharger un document bidon (EORI dans mon cas). En fait, vous êtes abonnés pour 12 mois à 80€/mois.", published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_015', site: 'infonet', source: 'trustpilot', author: 'Mandy Horn', rating: 5, title: 'Très bonne application', content: 'Très bonne application', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_016', site: 'infonet', source: 'trustpilot', author: 'Salvatore Seidita', rating: 1, title: 'trop complique', content: 'trop complique', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_017', site: 'infonet', source: 'trustpilot', author: 'HABCHI', rating: 5, title: 'Simple et efficace', content: 'Simple et efficace', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_018', site: 'infonet', source: 'trustpilot', author: 'Bousquet', rating: 5, title: 'Application facile à utiliser', content: 'Application facile à utiliser', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_019', site: 'infonet', source: 'trustpilot', author: 'Patrick Moi', rating: 5, title: 'Satisfait !', content: 'Satisfait !', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_020', site: 'infonet', source: 'trustpilot', author: 'BERGEAS', rating: 5, title: 'Service rapide et fiable', content: 'Service rapide et fiable.', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_021', site: 'infonet', source: 'trustpilot', author: 'Valentina Matei', rating: 5, title: 'tres professionnel', content: 'tres professionnel des vos parts', published_at: '2026-04-03', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_022', site: 'infonet', source: 'trustpilot', author: 'Joanna Knappert', rating: 4, title: 'Paiement facile', content: 'Le paiement était fait vite et sans difficulté', published_at: '2026-04-02', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_023', site: 'infonet', source: 'trustpilot', author: 'Renaudat Cédric', rating: 5, title: 'Responsable à l\'écoute', content: "Après une mauvaise compréhension des services de la société qui doit être très utiles aux professionnels. J'ai eu un responsable à l'écoute qui a résolu mon problème en moins de 30 minutes.", published_at: '2026-03-27', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_024', site: 'infonet', source: 'trustpilot', author: 'vaslin aurelie', rating: 5, title: 'très facile d\'accès', content: "cela a ete tres facile d'acces", published_at: '2026-03-25', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_025', site: 'infonet', source: 'trustpilot', author: 'BELLONIE stevy', rating: 3, title: 'Parfait et rapide', content: "C'et parfait et rapide", published_at: '2026-03-27', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_026', site: 'infonet', source: 'trustpilot', author: 'antho.lucas', rating: 5, title: 'Site convivial', content: "Site très convivial, mais qui ne répond pas malgré tout à mes attentes!", published_at: '2026-03-22', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_027', site: 'infonet', source: 'trustpilot', author: 'Emilia Mokengo', rating: 3, title: 'Facile à utiliser', content: 'Facile à utiliser', published_at: '2026-03-22', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_028', site: 'infonet', source: 'trustpilot', author: 'Typhaine JACQUOT', rating: 5, title: 'Site remarquable', content: "Un site remarquable et des personnes très réactives … il faut juste bien lire les conditions générales avant de les valider !", published_at: '2026-03-26', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_029', site: 'infonet', source: 'trustpilot', author: 'Mathieu BOUVEAU', rating: 3, title: 'Attention abonnement forcé', content: "Attention !!! je clique pour un paiement d'info ponctuelle et on m abonne d office pour un plus de 80 E / mois.... J ai fait la recherche en toute bonne foi et j ai cliqué la ou il ne fallait pas....", published_at: '2026-03-18', status: 'in_progress', review_url: '' },
    { external_id: 'tp_infonet_030', site: 'infonet', source: 'trustpilot', author: 'Pascal fregossy', rating: 5, title: 'Facile d\'accès', content: "Facile d accès et démarches simples pour avoir les documents", published_at: '2026-03-18', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_031', site: 'infonet', source: 'trustpilot', author: 'Humbert Eddy', rating: 4, title: 'Dommage l\'abonnement', content: "Dommage qu'il y ait un abonnement après coup", published_at: '2026-03-18', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_032', site: 'infonet', source: 'trustpilot', author: 'jean pierre marguier', rating: 3, title: 'Avis demandé avant téléchargement', content: "On me demande mon avis avant même de pouvoir télécharger le document.... un peu bizarre je trouve...", published_at: '2026-03-19', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_033', site: 'infonet', source: 'trustpilot', author: 'PATRICK CAILLARD', rating: 5, title: 'Mauvaise expérience - piège', content: "Mauvaise expérience ce site cache un piège.", published_at: '2026-03-16', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_034', site: 'infonet', source: 'trustpilot', author: 'SAADI Manseur', rating: 5, title: 'Rapide simple et efficace', content: 'Rapide simple et efficace', published_at: '2026-03-08', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_035', site: 'infonet', source: 'trustpilot', author: 'TOM', rating: 1, title: 'Arnaque sur 12 mois', content: "Bonjour, Ne souscrivez pas d'abonnement c'est une arnaque sur 12 mois avec des mensualités de 79€... ils ne veulent rien savoir sur une quelconque résiliation...", published_at: '2026-03-06', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_036', site: 'infonet', source: 'trustpilot', author: 'Bernadette DESRUELLE', rating: 5, title: 'TOUT EST OK', content: 'TOUT EST OK MERCI', published_at: '2026-03-17', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_037', site: 'infonet', source: 'trustpilot', author: 'Alexandre Martinez', rating: 5, title: 'Téléchargement rapide Kbis', content: "téléchargement rapide du l'extrait kbis", published_at: '2026-03-11', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_038', site: 'infonet', source: 'trustpilot', author: 'Christophe Lefebvre', rating: 2, title: 'Top tres rapide', content: 'Top tres rapide', published_at: '2026-03-09', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_039', site: 'infonet', source: 'trustpilot', author: 'Christine Corruble', rating: 5, title: 'Demande simple et rapide', content: 'Demande simple et très rapide.', published_at: '2026-03-12', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_040', site: 'infonet', source: 'trustpilot', author: 'Isabelle Vein', rating: 5, title: 'Attention redirection', content: "Attention ! Redirigée sur le site en essayant de récupérer un document par l'INSEE, je ne fais pas gaffe surtout que ce sont mes premiers pas dans ce domaine, on me demande 3 euros par carte bancaire.", published_at: '2026-03-04', status: 'in_progress', review_url: '' },
    { external_id: 'tp_infonet_041', site: 'infonet', source: 'trustpilot', author: 'Paul-jean Straebler', rating: 4, title: 'Tout est bien et simple', content: 'POUR LE MOMENT TOUT EST BIEN ET SIMPLE', published_at: '2026-03-13', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_042', site: 'infonet', source: 'trustpilot', author: 'Olivier', rating: 5, title: 'Abonnement résilié', content: "Suite à un abonnement souscrit par erreur le 26 mars, mon abonnement a été résilié comme je le souhaitais.", published_at: '2026-03-30', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_043', site: 'infonet', source: 'trustpilot', author: 'Clara Achache', rating: 5, title: 'Très utile au quotidien', content: "J'utilise infonet et ça m'aide vraiment au quotidien pour mes recherches d'informations sur les entreprises et pour identifier de potentiels partenaires. Les données sont fiables et faciles d'accès.", published_at: '2026-03-30', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_044', site: 'infonet', source: 'trustpilot', author: 'Ioana Zaplac', rating: 3, title: 'Commentaire obligatoire', content: "C'est un peu long et surtout je n'ai pas apprecié l'obligation de mettre un commentaire...", published_at: '2026-03-27', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_045', site: 'infonet', source: 'trustpilot', author: 'Marie-Agnès Piffaut', rating: 4, title: 'Très facile d\'utilisation', content: "Très facile d'utilisation, l'application est rapide et fiable.", published_at: '2026-03-31', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_046', site: 'infonet', source: 'trustpilot', author: 'Adrien CARADEC', rating: 5, title: 'Très bonne expérience', content: 'très bonne experience', published_at: '2026-02-26', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_047', site: 'infonet', source: 'trustpilot', author: 'Alexis Patissier', rating: 5, title: 'Kbis rapidement', content: 'Très pratique de pouvoir télécharger un kbis rapidement', published_at: '2026-02-26', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_048', site: 'infonet', source: 'trustpilot', author: 'Ioan Nemes', rating: 5, title: 'Très professionnel', content: "Mes sincères salutations a l'interlocuteur téléphonique M. Pierre M, très professionnel et de bonne fois comme on aime qu'elle soit la personne de l'autre bout du fil", published_at: '2026-02-27', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_049', site: 'infonet', source: 'trustpilot', author: 'Fançois Laly', rating: 5, title: 'Rapide efficace', content: "Rapide efficace, l'avis obligatoire n'est pas indispensable", published_at: '2026-02-24', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_050', site: 'infonet', source: 'trustpilot', author: 'Thibaut Delan', rating: 2, title: 'Avis obligatoire pas pratique', content: "Pas pratique l'avis obligatoire", published_at: '2026-02-24', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_051', site: 'infonet', source: 'trustpilot', author: 'MAINGUY', rating: 2, title: 'Abus de pouvoir', content: "La prestation demandée est personnelle et les données le sont aussi. Ainsi, vous nous demandez de payer ce qui est déjà à nous. C'est un abus de pouvoir caractérisé.", published_at: '2026-02-24', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_052', site: 'infonet', source: 'trustpilot', author: 'Chris', rating: 5, title: 'Service très efficace', content: 'Service très efficace', published_at: '2026-02-23', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_053', site: 'infonet', source: 'trustpilot', author: 'BOUFEDJI NAIMA', rating: 5, title: 'Site B to B recommandé', content: "INFONET, un site d'informations économiques et juridiques destiné aux entreprises. Pour toutes les personnes coutumières de la relation B to B, avant de contractualiser ou vérifier a posteriori.", published_at: '2026-02-23', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_054', site: 'infonet', source: 'trustpilot', author: 'Gloria OKANDZA-ASSONI', rating: 3, title: 'Document non reçu', content: "Je ne peux pas vu que je n'ai pas encore eu le document", published_at: '2026-02-23', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_055', site: 'infonet', source: 'trustpilot', author: 'fornet', rating: 5, title: 'Correct rapide efficace', content: 'correct rapide efficace', published_at: '2026-02-24', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_056', site: 'infonet', source: 'trustpilot', author: 'customer', rating: 1, title: 'Pratiques commerciales trompeuses', content: "Il m'est arrivé la même chose que toutes les autres personnes qui ont émis un avis négatif. Pratiques commerciales trompeuses, vente forcée, intimidations et harcèlement. Quand un avocat mettra le nez dedans cela va faire mal.", published_at: '2026-02-27', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_057', site: 'infonet', source: 'trustpilot', author: 'michel bihan', rating: 3, title: 'Long pour la connexion', content: "un eu long pour la connection ce jour, mais avec de la patience tout arrive", published_at: '2026-02-27', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_058', site: 'infonet', source: 'trustpilot', author: 'Celine Pagni', rating: 5, title: 'Très bien fait', content: 'Très bien fait. Dommage qu\'il faut encore payer pour avoir ce genre de document', published_at: '2026-02-20', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_059', site: 'infonet', source: 'trustpilot', author: 'Laurent Queffelec', rating: 5, title: 'Achat par erreur', content: "De bonne foi, je pensais acheter un avis de situation sur ma propre entreprise. Cet avis de situation est par ailleurs en accès gratuit sur le service public, mais pour une petite somme, je pensais avoir quelque chose de plus élaboré.", published_at: '2026-02-21', status: 'in_progress', review_url: '' },
    { external_id: 'tp_infonet_060', site: 'infonet', source: 'trustpilot', author: 'Rachel Atangana B.', rating: 5, title: 'Kbis rapidement', content: "Très bien j'ai pu avoir mon kbis rapidement.", published_at: '2026-02-19', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_061', site: 'infonet', source: 'trustpilot', author: 'HERNANDEZ', rating: 5, title: 'Parfait', content: "PARFAIT J AI OBTENU LE RENSEIGNEMENT", published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_062', site: 'infonet', source: 'trustpilot', author: 'Toto Mumu', rating: 5, title: 'Tres bon site', content: 'Tres bon site merci beaucoup', published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_063', site: 'infonet', source: 'trustpilot', author: 'Mailys Chabin', rating: 3, title: 'Simple et rapide', content: 'Simple d\'utilisation, rapide, excellente expérience', published_at: '2026-02-12', status: 'todo', review_url: '' },
    { external_id: 'tp_infonet_064', site: 'infonet', source: 'trustpilot', author: 'Jino', rating: 5, title: 'Problème réglé avec courtoisie', content: "Mon problème d abonnement été réglé d'une façon très courtoise et compréhensive par le service qualité d infonet que je félicite pour leur efficacité.", published_at: '2026-02-18', status: 'resolved', review_url: '' },
    { external_id: 'tp_infonet_065', site: 'infonet', source: 'trustpilot', author: 'THOMAS Rita', rating: 5, title: 'Fraude manifeste', content: "C'est une fraude manifeste car il semble qu'ils nous imposent un abonnement sans notre consentement explicite et nous ne recevons absolument rien en contrepartie. Cette pratique commerciale déloyale constitue une escroquerie.", published_at: '2026-02-12', status: 'todo', review_url: '' },

    // ═══════════════════════════════════════════════
    // INFONET - AVIS VÉRIFIÉS (8 avis)
    // ═══════════════════════════════════════════════
    { external_id: 'av_infonet_001', site: 'infonet', source: 'avis-verifies', author: 'P.', rating: 4, title: 'Bien', content: 'Bien', published_at: '2025-02-14', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_002', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 5, title: 'Excellent service client', content: "Excellent service client à l'écoute des clients. Une réelle prise en compte des difficultés, des explications précises, une solution adoptée.", published_at: '2023-11-08', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_003', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 5, title: 'Remboursé et satisfait', content: "Au début j'ai laissé mauvais avis, en effet quand j'ai pris contact avec service clientèle, sans poser les questions, ils m'ont remboursé la somme que j'ai payé par mon inattention.", published_at: '2023-07-01', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_004', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 5, title: 'Top !', content: 'top !', published_at: '2023-06-15', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_005', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 1, title: 'Impossible d\'avoir le document', content: "Impossible d'avoir le document", published_at: '2022-10-18', status: 'todo', review_url: '' },
    { external_id: 'av_infonet_006', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 5, title: 'Utilise régulièrement', content: "Je fais régulièrement appel à info net pour obtenir des informations sur les bilans, Kbis et les immatriculations des sociétés. Tout est toujours à jour et rapide. Je recommande pleinement.", published_at: '2022-10-06', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_007', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 5, title: 'Site fiable et sécurisé', content: "Site fiable et sécurisé je recommande.", published_at: '2022-10-06', status: 'resolved', review_url: '' },
    { external_id: 'av_infonet_008', site: 'infonet', source: 'avis-verifies', author: 'A.A.', rating: 4, title: 'Bon site quelques bugs', content: "Un bon site malgré quelques bugs de navigation. Cela reste tout de même agréable d'utiliser ce site.", published_at: '2022-10-01', status: 'resolved', review_url: '' },

    // ═══════════════════════════════════════════════
    // INFONET - SIGNAL ARNAQUES (4 avis)
    // ═══════════════════════════════════════════════
    { external_id: 'sa_infonet_001', site: 'infonet', source: 'signal-arnaques', author: 'Signalement #1', rating: 1, title: 'Abonnement caché 79€/mois', content: "Signalement arnaque infonet.fr : J'ai cliqué pour obtenir une information entreprise à 3€ et je me retrouve avec un abonnement à 79€/mois sur 12 mois. Pratiques trompeuses, page de paiement ambiguë.", published_at: '2026-01-15', status: 'in_progress', review_url: '' },
    { external_id: 'sa_infonet_002', site: 'infonet', source: 'signal-arnaques', author: 'Signalement #2', rating: 1, title: 'Engagement 12 mois non consenti', content: "Infonet.fr m'a prélevé 79€ sans consentement explicite après un paiement de 3€ présenté comme ponctuel. Engagement de 12 mois non visible. Menaces de recouvrement à la résiliation.", published_at: '2026-02-20', status: 'in_progress', review_url: '' },
    { external_id: 'sa_infonet_003', site: 'infonet', source: 'signal-arnaques', author: 'Signalement #3', rating: 1, title: 'Fraude commerciale', content: "Site conçu pour piéger les utilisateurs. Le bouton de validation semble confirmer un achat unique mais active en réalité un abonnement annuel coûteux. Nombreuses plaintes similaires.", published_at: '2026-03-12', status: 'todo', review_url: '' },
    { external_id: 'sa_infonet_004', site: 'infonet', source: 'signal-arnaques', author: 'Signalement #4', rating: 1, title: 'Harcèlement après résiliation', content: "Après avoir tenté de résilier, je reçois des emails menaçants d'Infonet avec des termes juridiques intimidants. Ils réclament le paiement de 12 mois d'abonnement que je n'ai jamais voulu souscrire.", published_at: '2026-04-01', status: 'todo', review_url: '' },

    // ═══════════════════════════════════════════════
    // POSTMEE - TRUSTPILOT (70 avis)
    // ═══════════════════════════════════════════════
    { external_id: 'tp_postmee_001', site: 'postmee', source: 'trustpilot', author: 'Client', rating: 5, title: 'Ouï c\'était simple', content: "Ouï c'était simple", published_at: '2026-04-14', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_002', site: 'postmee', source: 'trustpilot', author: 'Marie', rating: 5, title: 'Très facile d\'utilisation', content: "Très facile d'utilisation. J'espère tout de même que l'organisme en tiendras compte.", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_003', site: 'postmee', source: 'trustpilot', author: 'Isabelle Olszeski', rating: 1, title: 'Arnaque !!', content: "Arnaque !!! Abonnement caché de 49€ !!!!! C'est immonde", published_at: '2026-03-11', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_004', site: 'postmee', source: 'trustpilot', author: 'cliente', rating: 4, title: 'Rapidité d\'exécution', content: "J'ai apprécié la rapidité d'exécution de mon courrier de résiliation et la facilité à le réaliser.", published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_005', site: 'postmee', source: 'trustpilot', author: 'Alex Valmy', rating: 3, title: 'La simplicité merci', content: 'La simplicité merci beaucoup', published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_006', site: 'postmee', source: 'trustpilot', author: 'Sébastien Ferez', rating: 5, title: 'tres rapide et facile', content: 'tres rapide et facile d\'utilisation', published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_007', site: 'postmee', source: 'trustpilot', author: 'Romane Piveteau', rating: 5, title: 'Clair', content: "C'est clair, simple et efficace", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_008', site: 'postmee', source: 'trustpilot', author: 'Dominique Apamian', rating: 2, title: 'Paiement avant document', content: "Semble pratique, Mais se hâte de demander le paiement alors qu'on ne voit pas la lettre éditée, et qu'aucun document n'est remis avant qu'on vous demande de rédiger un avis...", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_009', site: 'postmee', source: 'trustpilot', author: 'BERTOCCI MICHÈLE', rating: 3, title: 'Attente du résultat', content: "Je ne sais pas si mon opération va aboutir. Je préfère attendre la fin pour donner mon avis", published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_010', site: 'postmee', source: 'trustpilot', author: 'Dominguez perez', rating: 5, title: 'Très rapide et très simple', content: 'Très rapide et très simple', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_011', site: 'postmee', source: 'trustpilot', author: 'pointurier', rating: 5, title: 'Déjà eu recours', content: "j ai deja eu recours a vous", published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_012', site: 'postmee', source: 'trustpilot', author: 'didier pelote', rating: 5, title: 'COURRIER tres rapide', content: 'COURRIER tres rapide', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_013', site: 'postmee', source: 'trustpilot', author: 'Mohamed CHERCHOUR', rating: 5, title: 'Pour l\'instant très pratique', content: "Pour l'instant, c'est très pratique, on verra la suite.", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_014', site: 'postmee', source: 'trustpilot', author: 'gerard rortais', rating: 4, title: 'Fait dans les règles', content: "tout est fait dans les règles de l'art", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_015', site: 'postmee', source: 'trustpilot', author: 'Daniel Desnos', rating: 4, title: 'Bien première fois', content: "bien première fois que j'utilise", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_016', site: 'postmee', source: 'trustpilot', author: 'Alain clairel', rating: 4, title: 'Facilité d\'utilisation', content: "la facilite dutilisation", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_017', site: 'postmee', source: 'trustpilot', author: 'Fanget', rating: 5, title: 'Très rapide', content: 'Très rapide', published_at: '2026-04-08', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_018', site: 'postmee', source: 'trustpilot', author: 'audat', rating: 5, title: 'Simple et rapide', content: 'operation simple et rapide', published_at: '2026-04-08', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_019', site: 'postmee', source: 'trustpilot', author: 'Gervaise DELAUNAY', rating: 4, title: 'SERVICE RAPIDE', content: 'SERVICE RAPIDE', published_at: '2026-04-08', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_020', site: 'postmee', source: 'trustpilot', author: 'Celine Rumeur', rating: 2, title: 'Longue procédure', content: 'Longue la procédure de résiliation', published_at: '2026-04-08', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_021', site: 'postmee', source: 'trustpilot', author: 'Scalène', rating: 1, title: 'Abominable, une arnaque', content: "J'ai voulu envoyer un courrier à 1,90 euros pour résilier un abonnement, je me retrouve avec un supplément de 49 euros à payer chaque mois ! De plus pour supprimer cet abonnement c'est une galère sans nom.", published_at: '2026-04-05', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_022', site: 'postmee', source: 'trustpilot', author: 'Blanc', rating: 1, title: 'Site frauduleux', content: "Site frauduleux. Ma mamie voulait se désabonner de son contrat HomeServe, en faisant la démarche elle s'est retrouvée sur le site de postmee lui demandant de payer 1,90€ pour un envoi de courrier recommandé.", published_at: '2026-04-01', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_023', site: 'postmee', source: 'trustpilot', author: 'laffont', rating: 4, title: 'Toujours satisfait', content: "rien a dire a par que je me désabonne de ma collection de timbres pour des raisons personnel et que j'ai toujours été satisfais de vos servies j'utilise la poste pour ma collection depuis 1954", published_at: '2026-04-02', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_024', site: 'postmee', source: 'trustpilot', author: 'Charline Planchon', rating: 5, title: 'Résiliation contrat', content: "I hope I have resiliated my contract. J'espère avoir résilié mon contrat de téléphone", published_at: '2026-04-03', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_025', site: 'postmee', source: 'trustpilot', author: 'Mr Cédric GUILLEMOTTO', rating: 5, title: 'Facilité sans aller à la poste', content: "la facilité d'utilisation et m'absente de nécessité de me rendre au bureau de poste", published_at: '2026-03-24', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_026', site: 'postmee', source: 'trustpilot', author: 'Athos', rating: 5, title: 'Très pratique et rapide', content: 'Très pratique et rapide a utiliser', published_at: '2026-03-26', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_027', site: 'postmee', source: 'trustpilot', author: 'Marianne Pasquier', rating: 5, title: 'Facile et peu coûteux', content: 'facile a faire, et peu couteuse tres pratique', published_at: '2026-03-22', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_028', site: 'postmee', source: 'trustpilot', author: 'Djibril Anne', rating: 3, title: 'Résiliation demandée', content: "Je voudrais résilier mon abonnement Et merci d'avance", published_at: '2026-03-09', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_029', site: 'postmee', source: 'trustpilot', author: 'ANGELINA LIKINGA', rating: 3, title: 'En attente de voir', content: "j attend de voir deja si sa fonctionne car on me demande un avis hors je n ai tjrs pas de preuve que le courrier a bien ete envoyer", published_at: '2026-03-06', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_030', site: 'postmee', source: 'trustpilot', author: 'florian', rating: 4, title: 'Postmee réactif suite avis', content: "Mise à jour : Postmee m'a contacté suite à cet avis. Je salue cette réactivité et ce geste commercial. Produit mal designer et du coup un petit peu trompeur: On voit clairement 1,90 € mais pas le passage à un abonnement mensuel de 49€.", published_at: '2026-03-13', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_031', site: 'postmee', source: 'trustpilot', author: 'Jean Yves PLOQUIN', rating: 5, title: 'DARTY prise en charge', content: "DARTY PRENDS VRAIMENT EN CHARGE POUR LES REPARATION AVEC DARTY MAX.", published_at: '2026-03-01', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_032', site: 'postmee', source: 'trustpilot', author: 'YVES GOSSELIN', rating: 2, title: 'Abonnement automatique non annoncé', content: "Attention ! sans que cela soit annoncé de manière claire (il faut lire les conditions), au bout de 48 heures vous êtes automatiquement abonné au service postmee et donc prélevé de 49 euros/mois pour un service non désiré.", published_at: '2026-02-24', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_033', site: 'postmee', source: 'trustpilot', author: 'Faiza Nezzal', rating: 5, title: 'Gain de temps', content: "je découvre ce service qui me fait gagner énormément de temps. Je le découvre par hasard. j'aurai aimé le connaitre bien avant.", published_at: '2026-02-04', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_034', site: 'postmee', source: 'trustpilot', author: 'Dominique Joyeux', rating: 5, title: 'Résiliation simplifiée', content: "Une résiliation d'abonnement grandement simplifiée par l'envoie en ligne d'un recommandé. Une grande simplicité et un soulagement. Opération facilitée et rapide pour un coût très très modeste.", published_at: '2026-02-04', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_035', site: 'postmee', source: 'trustpilot', author: 'Rabah Nassiri', rating: 4, title: 'Service qualité réactif', content: "Suite à une réclamation liée à un problème rencontré lors d'un envoi de courrier, le service qualité m'a contacté très rapidement. Il a résolu le problème avec des explications sur le fonctionnement.", published_at: '2026-02-02', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_036', site: 'postmee', source: 'trustpilot', author: 'NGUYEN', rating: 4, title: 'Services interconnectés', content: "LES SERVICES sont interconnectés ceci dit, je n'ai plus besoin d'aller à la poste pour expédier le courrier.", published_at: '2026-02-02', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_037', site: 'postmee', source: 'trustpilot', author: 'VIRARD Françoise', rating: 2, title: 'Adhésion non demandée', content: "J'ai envoyé un lettre recommandée le 26.1.26 mais je n'ai pas demandé l'adhésion à postmee com et la facturation de 49 € de frais professionnels. J'ai refusé demandé à ma banque de ne pas payer ces 49€.", published_at: '2026-02-02', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_038', site: 'postmee', source: 'trustpilot', author: 'VALERIAN BROQUERE', rating: 5, title: 'Service parfait et rapide', content: 'Service parfait et rapide', published_at: '2026-02-04', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_039', site: 'postmee', source: 'trustpilot', author: 'fils Yonga', rating: 5, title: 'Très satisfait', content: "Bonjour J'ai été très satisfait du service rendu. Cordialement", published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_040', site: 'postmee', source: 'trustpilot', author: 'HESSE', rating: 5, title: 'Contente du service', content: "Très contente du service rendu.", published_at: '2026-02-10', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_041', site: 'postmee', source: 'trustpilot', author: 'Customer', rating: 5, title: 'Très rapide et facile', content: 'Tré Rapide et facile a utiliser', published_at: '2026-02-07', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_042', site: 'postmee', source: 'trustpilot', author: 'Assia Meyer', rating: 4, title: 'Rapide et simple', content: "Rapide et simple, j'attends de voir le résultat", published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_043', site: 'postmee', source: 'trustpilot', author: 'Christopher', rating: 5, title: 'Super rapide', content: 'Super rapide gagne du temps, merci!', published_at: '2026-02-05', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_044', site: 'postmee', source: 'trustpilot', author: 'julien vergne', rating: 5, title: 'Fait rapidement', content: 'Super de fais ça aussi rapidement', published_at: '2026-02-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_045', site: 'postmee', source: 'trustpilot', author: 'Isabelle', rating: 4, title: 'Facile d\'accès et rapide', content: "Facile d'accès et très rapide", published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_046', site: 'postmee', source: 'trustpilot', author: 'pauwels catherine', rating: 4, title: 'Rapide sans déplacement', content: "rapide et evite le deplacement dans les bureaux de poste", published_at: '2026-02-06', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_047', site: 'postmee', source: 'trustpilot', author: 'Carmont', rating: 5, title: 'Rapide et efficace', content: 'Rapide et efficace, gain de temps appréciable.', published_at: '2026-02-09', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_048', site: 'postmee', source: 'trustpilot', author: 'Guillaume Questel', rating: 4, title: 'Bonne expérience', content: "bonne expérience mem si certains problèmes de paiements", published_at: '2026-01-26', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_049', site: 'postmee', source: 'trustpilot', author: 'Jocelyne G', rating: 3, title: 'Pratique mais long', content: "Pratique, pas besoin de ce déplacer, mais un peu long et complexe.", published_at: '2026-01-26', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_050', site: 'postmee', source: 'trustpilot', author: 'Alain Benavente', rating: 5, title: 'Plus besoin d\'aller à la poste', content: "L'avantage d'envoyer des lettres recommandée A.R sans se déplacer à la poste et faire la queue pendant 20 minutes. C'est moderne pratique et efficace.", published_at: '2026-01-28', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_051', site: 'postmee', source: 'trustpilot', author: 'Stan Laluque', rating: 3, title: 'Résiliation abonnement fille', content: "Bien j'espère que se sera rapide pour résilier l'abonnement de ma fille merci", published_at: '2026-01-17', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_052', site: 'postmee', source: 'trustpilot', author: 'CHRISTIAN PRINCIPAUD', rating: 4, title: 'Simple et rapide', content: "Simple et rapide Evite un déplacement Un bémol ; la demande d'avis en patois (Anglais)", published_at: '2026-01-13', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_053', site: 'postmee', source: 'trustpilot', author: 'gueudin eric', rating: 5, title: 'Procédure rapide et sécurisée', content: "Je viens de résilier par internet : lettre accusé de réception à 1,90 euro. Procédure rapide et sécurisé. Par contre attention en regardant dans mes mails et en lisant attentivement je m'aperçois que je suis abonné au service.", published_at: '2026-01-13', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_054', site: 'postmee', source: 'trustpilot', author: 'Alex proios', rating: 4, title: 'Essai 1,90€ bien mais trop cher après', content: "L'essai à 1,90€ est bien mais après c'est trop cher pour moi. Sinon c'est rapide et efficace", published_at: '2026-01-13', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_055', site: 'postmee', source: 'trustpilot', author: 'Stane', rating: 5, title: 'Pratique et compétitif', content: 'Très pratique et service à prix compétitif', published_at: '2026-01-14', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_056', site: 'postmee', source: 'trustpilot', author: 'Laury Byram', rating: 4, title: 'Service client réactif', content: "Mise à jour de mon avis : Le service client m'a contacté rapidement pour discuter. Je félicite la réactivité pour solutionner mon soucis.", published_at: '2026-01-12', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_057', site: 'postmee', source: 'trustpilot', author: 'COLLARD', rating: 5, title: 'Résiliation abonnement', content: "Je veux résilier mon abonnement", published_at: '2026-01-07', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_058', site: 'postmee', source: 'trustpilot', author: 'Mabecque Quentin', rating: 5, title: 'Super service client', content: 'Envoi effectué, super service client en cas de problème.', published_at: '2026-01-07', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_059', site: 'postmee', source: 'trustpilot', author: 'cliente', rating: 4, title: 'Pratique sans déplacement', content: "Très pratique pour envoyer du courrier sans se déplacer. Très bon service client réactif et à l'écoute. Il faut juste bien lire les conditions si on ne souhaite pas s'abonner.", published_at: '2025-12-16', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_060', site: 'postmee', source: 'trustpilot', author: 'FABIENNE PICAVET', rating: 5, title: 'Service commercial au top', content: 'Service commercial au top', published_at: '2025-12-19', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_061', site: 'postmee', source: 'trustpilot', author: 'Monsieur BOMANS', rating: 5, title: 'Responsable attentif', content: "suite à mon avis négatif sur postmee après ma publication sur ce site un responsable clientèle m a contacté pour mon mécontentement en fin de compte cela venait de ma faute et il m a quand même accordé un geste commercial.", published_at: '2025-12-18', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_062', site: 'postmee', source: 'trustpilot', author: 'Philippe ANTOINE', rating: 5, title: 'Problème réglé rapidement', content: "Suite à un différend avec Postmee, j'ai rapidement été contacté par un conseiller. Celui-ci, très aimable a pris le temps de m'écouter, a compris mon problème et l'a réglé sur le champs.", published_at: '2025-12-15', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_063', site: 'postmee', source: 'trustpilot', author: 'Michel Gouhier Tazzalio', rating: 5, title: 'Explication transparente', content: "Après explication avec Jacques représentant Postmee je modifie ma n avis car le rapport et les explications ont été d'une grande transparence et de très bonne qualité", published_at: '2025-11-28', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_064', site: 'postmee', source: 'trustpilot', author: 'Isabelle Poinloup', rating: 3, title: 'Ultra rapide mais abonnement surprise', content: "Ultra rapide et pratique mais.... J'ai ce jour utilisé votre service de recommandé afin de résilier mon abonnement à ma salle de sport. J'ai payé mon recommandé et je pensais en avoir fini... mais je me retrouve abonnée à Postmee.", published_at: '2026-01-06', status: 'in_progress', review_url: '' },
    { external_id: 'tp_postmee_065', site: 'postmee', source: 'trustpilot', author: 'Chabat', rating: 5, title: 'Facilité rapidité prix raisonnable', content: "Facilité rapidité prix très raisonnable. Très bonne expérience pour l'instant. Dans l'attente d'une reponse favorable et rapide", published_at: '2026-01-10', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_066', site: 'postmee', source: 'trustpilot', author: 'christophe', rating: 2, title: 'Grosse arnaque', content: "Postmee est une grosse arnaque, dès que vous envoyez un recommandé, vous passez directement à un abonnement prenium sans votre accord. Résultat vous vous retrouvez avec un prélèvement de 50 euros par mois.", published_at: '2025-12-12', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_067', site: 'postmee', source: 'trustpilot', author: 'Caroline Gaillard', rating: 4, title: 'Service client a fait le nécessaire', content: "J'ai souscris à l'abonnement par mégarde mais le service client a été réactif et a fait le nécessaire dans mon sens. Site bien utile pour l'envoi de courriers.", published_at: '2026-04-09', status: 'resolved', review_url: '' },
    { external_id: 'tp_postmee_068', site: 'postmee', source: 'trustpilot', author: 'Julie Vasseur', rating: 5, title: 'rapide, simple et efficace', content: 'rapide, simple et efficace', published_at: '2026-02-19', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_069', site: 'postmee', source: 'trustpilot', author: 'cliente', rating: 5, title: 'La facilité et le service', content: 'La facilité et le service', published_at: '2026-03-28', status: 'todo', review_url: '' },
    { external_id: 'tp_postmee_070', site: 'postmee', source: 'trustpilot', author: 'client', rating: 5, title: 'Excellent service', content: 'Excellent service très facile à utiliser', published_at: '2026-02-15', status: 'todo', review_url: '' },

    // ═══════════════════════════════════════════════
    // STARTDOC - TRUSTPILOT (69 avis)
    // ═══════════════════════════════════════════════
    { external_id: 'tp_startdoc_001', site: 'startdoc', source: 'trustpilot', author: 'Abdelhalim Ait-aldjet', rating: 5, title: 'Très bonne service rapide et efficace', content: 'Très bonne service rapide et efficace', published_at: '2026-04-14', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_002', site: 'startdoc', source: 'trustpilot', author: 'Do Catherine', rating: 1, title: 'C\'est bien passé', content: "C'est bien passé", published_at: '2026-04-14', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_003', site: 'startdoc', source: 'trustpilot', author: 'Gerard Jaud', rating: 4, title: 'Pas d\'expérience', content: "pas d'expérience", published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_004', site: 'startdoc', source: 'trustpilot', author: 'pekekouo youchaou', rating: 5, title: 'Très rapide', content: 'Très rapide', published_at: '2026-04-13', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_005', site: 'startdoc', source: 'trustpilot', author: 'Eddy Waute', rating: 5, title: 'C\'était bien', content: "C'était bien", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_006', site: 'startdoc', source: 'trustpilot', author: 'Hamid Iybourcb', rating: 5, title: 'Bien', content: "Ce cite il march bien merci", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_007', site: 'startdoc', source: 'trustpilot', author: 'Feriel Khodja', rating: 5, title: 'Aide beaucoup les gens', content: "Elle aide beaucoup les gens à trouver", published_at: '2026-04-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_008', site: 'startdoc', source: 'trustpilot', author: 'Conry', rating: 5, title: 'Parfait rien à dire', content: 'Parfait rien a dire', published_at: '2026-04-11', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_009', site: 'startdoc', source: 'trustpilot', author: 'Antoine Gomes Da Silva', rating: 5, title: 'Très bien l\'échange en ligne', content: "Très bien l'échange en ligne", published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_010', site: 'startdoc', source: 'trustpilot', author: 'VERMESSE', rating: 5, title: 'RAPIDE PRÉCISE BRAVO', content: 'RAPIDE PRÉCISE BRAVO', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_011', site: 'startdoc', source: 'trustpilot', author: 'Rakotondravao', rating: 4, title: 'Facile et rapide', content: "Facile et rapide, j'attends juste le retour.", published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_012', site: 'startdoc', source: 'trustpilot', author: 'Younow', rating: 5, title: 'Merci pour votre site', content: 'Merci pour votre site', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_013', site: 'startdoc', source: 'trustpilot', author: 'Couturier Géraldine', rating: 5, title: 'Bien, à recommander', content: 'Super a recommander', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_014', site: 'startdoc', source: 'trustpilot', author: 'Omniwack', rating: 1, title: 'Rendre gratuit', content: 'Rendre gratuit', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_015', site: 'startdoc', source: 'trustpilot', author: 'Elodie Shadow', rating: 4, title: 'rapide super', content: 'rapide super', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_016', site: 'startdoc', source: 'trustpilot', author: 'JOSE OLIVEIRA', rating: 5, title: 'merci c\'est parfait', content: "merci c'est parfait", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_017', site: 'startdoc', source: 'trustpilot', author: 'Bourquier', rating: 4, title: 'Train en retard', content: "J'espère recevoir mon argent parce que le train a eu du retard", published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_018', site: 'startdoc', source: 'trustpilot', author: 'Oussama Karoun', rating: 5, title: 'Ok, très rapide', content: 'Ok . Très rapide', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_019', site: 'startdoc', source: 'trustpilot', author: 'Mister', rating: 5, title: 'Efficace merci', content: 'Efficace merci', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_020', site: 'startdoc', source: 'trustpilot', author: 'Manu Colin', rating: 5, title: 'rapide bien efficace pas cher', content: 'rapide bien efficace pas chere', published_at: '2026-04-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_021', site: 'startdoc', source: 'trustpilot', author: 'kriefmarlene', rating: 5, title: 'Très pratique', content: 'Merci Très pratique à utiliser', published_at: '2026-04-02', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_022', site: 'startdoc', source: 'trustpilot', author: 'Urios Christophe', rating: 5, title: 'Très rapide merci', content: 'Très rapide merci', published_at: '2026-04-02', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_023', site: 'startdoc', source: 'trustpilot', author: 'Poli', rating: 5, title: 'Information obtenue', content: "Parfait j'ai obtenu l'information que je voulais", published_at: '2026-03-04', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_024', site: 'startdoc', source: 'trustpilot', author: 'Paola', rating: 5, title: 'Dossier traité', content: "Satisfaite pour le traitement di dossier", published_at: '2026-03-11', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_025', site: 'startdoc', source: 'trustpilot', author: 'Bourdin', rating: 5, title: 'Tres efficace et rapide', content: 'Merci tres efficace et rapide', published_at: '2026-03-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_026', site: 'startdoc', source: 'trustpilot', author: 'Anne', rating: 5, title: 'Très bien pratique rapide', content: 'Merci très bien pratique rapide', published_at: '2026-03-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_027', site: 'startdoc', source: 'trustpilot', author: 'A Rivero', rating: 5, title: 'Parfait très rapide', content: 'Parfait très rapide très efficace', published_at: '2026-03-03', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_028', site: 'startdoc', source: 'trustpilot', author: 'BOTTINEAU Gérard', rating: 4, title: 'Site fluide et rapide', content: "La présentation du site est fluide et rapide. Désormais j'attends la réponse à ma demande...", published_at: '2026-03-19', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_029', site: 'startdoc', source: 'trustpilot', author: 'Gina Nicola', rating: 5, title: 'Rapide et efficace dossier travail', content: 'Très rapide et efficace pour le besoin d\'un dossier travail', published_at: '2026-02-17', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_030', site: 'startdoc', source: 'trustpilot', author: 'Ercy', rating: 5, title: 'Page explicative', content: "Page bien explicatif tout et ok", published_at: '2026-02-18', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_031', site: 'startdoc', source: 'trustpilot', author: 'Jean-Pierre HUGUENIOT', rating: 5, title: 'Paiement simple et rapide', content: "Très simple pour accéder au paiement .....et c'est rapide", published_at: '2026-02-17', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_032', site: 'startdoc', source: 'trustpilot', author: 'maxime decoeyere', rating: 1, title: 'Expérience tarifaire inoubliable', content: "J'ai utilisé Startdoc pour envoyer un simple courrier facturé 1,79 €. Quelle ne fut pas ma joie de découvrir par la suite que cette modeste démarche m'a engagé dans un abonnement mensuel à 39€.", published_at: '2026-02-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_033', site: 'startdoc', source: 'trustpilot', author: 'Valentin GUELLE', rating: 5, title: 'M\'a beaucoup aidé', content: 'sa ma aider énormément', published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_034', site: 'startdoc', source: 'trustpilot', author: 'Valentin', rating: 5, title: 'Super rapide', content: "C'est super rapide merci à vous", published_at: '2026-02-11', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_035', site: 'startdoc', source: 'trustpilot', author: 'Dali Ghourba', rating: 5, title: 'Bonne expérience', content: 'Elle est bonne expérience', published_at: '2026-02-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_036', site: 'startdoc', source: 'trustpilot', author: 'Pilotto', rating: 5, title: 'Rapide et professionnel', content: 'Tout a été rapide et professionnel', published_at: '2026-02-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_037', site: 'startdoc', source: 'trustpilot', author: 'Patricia JEUNESSE', rating: 5, title: 'Cerfa immédiatement proposé', content: "j'ai demandé un cerfa téléchargeable et le service me l'a immédiatement proposé. C'est très rapide et au top ! merci.", published_at: '2026-02-09', status: 'resolved', review_url: '' },
    { external_id: 'tp_startdoc_038', site: 'startdoc', source: 'trustpilot', author: 'Moussa', rating: 5, title: 'Très rapide et clair', content: "Ça a été très rapide très clair et tout est bien présenté", published_at: '2026-02-09', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_039', site: 'startdoc', source: 'trustpilot', author: 'Bourcier', rating: 5, title: 'Assez simple', content: "J'ai vraiment aimé c'est assez simple", published_at: '2026-02-04', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_040', site: 'startdoc', source: 'trustpilot', author: 'Matteo Muzelle', rating: 5, title: 'Je valide à 100%', content: "Franchement je valide le site à 100% Il rame pas Sa se fais instantanément Je suis très satisfait", published_at: '2026-02-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_041', site: 'startdoc', source: 'trustpilot', author: 'Angier', rating: 5, title: 'Rapide et efficace', content: "C'est rapide et efficace.", published_at: '2026-02-03', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_042', site: 'startdoc', source: 'trustpilot', author: 'Michel Jahannot', rating: 5, title: 'Accès rapide et efficace', content: 'site d\'accès rapide et simples formalités donc efficacité', published_at: '2026-02-03', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_043', site: 'startdoc', source: 'trustpilot', author: 'claude le borgnic', rating: 5, title: 'Très pratique, nombreux formulaires', content: "Très très pratique d'utilisation et surtout un grand nombre de formulaires à remplir en ligne.", published_at: '2026-02-03', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_044', site: 'startdoc', source: 'trustpilot', author: 'Rk Cars', rating: 5, title: 'Document rapide', content: 'Sa était rapide pour le document merci', published_at: '2026-02-04', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_045', site: 'startdoc', source: 'trustpilot', author: 'Jacob Mba', rating: 4, title: 'Facilite l\'accès aux documents', content: "Elle nous facilite l accès à nos documents importants", published_at: '2026-02-02', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_046', site: 'startdoc', source: 'trustpilot', author: 'Murielle Lespillez', rating: 5, title: 'Très rapide efficace pratique', content: 'Très rapide efficace très pratique', published_at: '2026-02-02', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_047', site: 'startdoc', source: 'trustpilot', author: 'ABDELHAFID', rating: 5, title: 'Facile à comprendre', content: "l'expérieriente a ete tres facile à comprendre", published_at: '2026-02-02', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_048', site: 'startdoc', source: 'trustpilot', author: 'Mailagi Visesio', rating: 5, title: 'Besoin rapide', content: "Un besoin rapide mais je n'ai pas encore le résultat.", published_at: '2026-02-05', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_049', site: 'startdoc', source: 'trustpilot', author: 'Rabii Ben Salah', rating: 5, title: 'Très bon service', content: 'Très bon service super rapide très satisfait', published_at: '2026-02-06', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_050', site: 'startdoc', source: 'trustpilot', author: 'Maurice Lucas', rating: 5, title: 'Payer pour imprimer intolérable', content: "merci par contre je trouve intolérable de devoir payer pour imprimer cette demande cordialement bob", published_at: '2026-02-18', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_051', site: 'startdoc', source: 'trustpilot', author: 'Hamado Dene', rating: 4, title: 'Facile et commode', content: 'Cette sistem é tellement facile é comode', published_at: '2026-02-10', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_052', site: 'startdoc', source: 'trustpilot', author: 'Biogne', rating: 1, title: 'Prélevé 2 fois automatiquement', content: "J'ai été prélevé automatiquement 2 fois de 39,90€ Sans suite pour mes démarches AME pourquoi ?", published_at: '2026-01-14', status: 'in_progress', review_url: '' },
    { external_id: 'tp_startdoc_053', site: 'startdoc', source: 'trustpilot', author: 'Célia Van de Velde', rating: 1, title: 'ATTENTION abonnement automatique', content: "ATTENTION : si vous payer 1,79 ou autre montant pour avoir un document, vous contracter automatiquement un ABONNEMENT MENSUEL de 39€. Vous avez 48h pour le résilier, bien que se soit écrit nul part.", published_at: '2026-01-14', status: 'in_progress', review_url: '' },
    { external_id: 'tp_startdoc_054', site: 'startdoc', source: 'trustpilot', author: 'Ismaël', rating: 1, title: 'Pas de réponse depuis 2024', content: "En 2024, j'ai déposer mes documents Pour Le impôts jusqu'à maintenant 2026, j'ai pas de réponse ni numéro fiscal", published_at: '2026-01-13', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_055', site: 'startdoc', source: 'trustpilot', author: 'cliente', rating: 4, title: 'Formulaire réglé', content: "J'ai réglé le formulaire, ou vais je l'obtenir?", published_at: '2026-01-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_056', site: 'startdoc', source: 'trustpilot', author: 'Guy Delcher', rating: 4, title: 'Certificat urbanisme téléchargé', content: "Cela m a bien aidé pour télécharger un certificat urbanisme", published_at: '2026-01-12', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_057', site: 'startdoc', source: 'trustpilot', author: 'Faisa Zidane', rating: 5, title: 'Site très cool', content: "Le site est très cool et j'arrive très bien à comprendre ce que je recherche", published_at: '2026-01-22', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_058', site: 'startdoc', source: 'trustpilot', author: 'lucie', rating: 4, title: 'Rapide, attente résultat', content: "rapide a voir si après cette avis et ce paiement je reçois tout comme il faut", published_at: '2026-01-23', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_059', site: 'startdoc', source: 'trustpilot', author: 'DURANG', rating: 3, title: 'Démarche compliquée et payante', content: "AVOIR UN CERTIFICAT D INSCRIPTION AUX LISTES ELECTORALES EN MAIRIE DENSUES LA REDONNE 13820 A ETE COMPLIQUE ET PAYANTE POUR MOI", published_at: '2026-01-20', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_060', site: 'startdoc', source: 'trustpilot', author: 'edmond motte', rating: 1, title: 'Formulaire refusé', content: "J'ai rempli tout votre formulaire Passé en gendarmerie Ferme à midi Retourne Votre formulaire refusé!!! Modèle différent exigé Et on recommence tout Stoppez votre activité inutile Merci", published_at: '2026-01-22', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_061', site: 'startdoc', source: 'trustpilot', author: 'PERIC', rating: 3, title: 'Lourd et long', content: "SuperC est lourd , long, et je ne sais pas comment récupérer le document wur j ai complete et qui ma amend sur se site", published_at: '2026-01-21', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_062', site: 'startdoc', source: 'trustpilot', author: 'disdier', rating: 5, title: 'Rapidité de réponse', content: 'tres satisfait de la rapidite de reponse', published_at: '2026-01-17', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_063', site: 'startdoc', source: 'trustpilot', author: 'Mickael Faye', rating: 5, title: 'Rapide et réglementé', content: 'Service très rapide est très réglementé', published_at: '2026-01-07', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_064', site: 'startdoc', source: 'trustpilot', author: 'CHRISTOPHE BLACHON', rating: 4, title: 'Plus rapide traitement', content: 'plus rapide dans le traitement des dossiers', published_at: '2025-12-04', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_065', site: 'startdoc', source: 'trustpilot', author: 'TAKASI', rating: 2, title: 'Plusieurs tentatives paiement', content: "J'ai dû faire plusieurs tentatives de paiement avec ma carte pour avoir accès au document sur le site.", published_at: '2025-12-15', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_066', site: 'startdoc', source: 'trustpilot', author: 'Pas nom', rating: 5, title: 'Première utilisation', content: "C la première fois jutilise je trouve que c pratique et si je reçois une réponse le plus vite sa va être super pour moi-même", published_at: '2025-12-15', status: 'todo', review_url: '' },
    { external_id: 'tp_startdoc_067', site: 'startdoc', source: 'trustpilot', author: 'Béatrice Vuillaume', rating: 5, title: 'Expérience humaine', content: "Ma visite sur ce site a s'est révélée surprenante !! D'une erreur de parcours elle s'est transformée en une jolie expérience humaine, merci", published_at: '2025-12-22', status: 'resolved', review_url: '' },
    { external_id: 'tp_startdoc_068', site: 'startdoc', source: 'trustpilot', author: 'Nadege Savin', rating: 1, title: 'Document jamais reçu - voleurs', content: "Une étoile car on ne peut pas en mettre aucune !!!!! M'ont fait payer 1,76 euros pour un document jamais reçu d'ailleurs un document gratuit sur le site gouv. Des voleurs !!!", published_at: '2025-09-18', status: 'in_progress', review_url: '' },
    { external_id: 'tp_startdoc_069', site: 'startdoc', source: 'trustpilot', author: 'Claude', rating: 4, title: 'Trop de paperasse en France', content: "en France, trop de paperasse. Difficile pour les personnes d'un certain age", published_at: '2026-01-31', status: 'todo', review_url: '' },

    // ═══════════════════════════════════════════════
    // WENONY - TRUSTPILOT
    // ═══════════════════════════════════════════════
    { external_id: 'tp_wenony_001', site: 'wenony', source: 'trustpilot', author: 'Sophie Martin', rating: 5, title: 'Excellent service', content: 'Très satisfaite de la qualité du service. Livraison rapide et produits conformes à la description. Je recommande vivement !', published_at: '2026-04-10', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_002', site: 'wenony', source: 'trustpilot', author: 'Thomas Dupont', rating: 4, title: 'Bonne expérience globale', content: 'Commande bien reçue, emballage soigné. Petit bémol sur le délai de livraison un peu plus long que prévu, mais le produit est de qualité.', published_at: '2026-04-08', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_003', site: 'wenony', source: 'trustpilot', author: 'Marie Leroy', rating: 1, title: 'Très déçue', content: "Commande passée il y a 3 semaines, toujours rien reçu. Le service client ne répond pas à mes emails. Je demande un remboursement immédiat.", published_at: '2026-04-07', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_004', site: 'wenony', source: 'trustpilot', author: 'Pierre Bernard', rating: 5, title: 'Parfait !', content: 'Tout était parfait, du site à la livraison. Je reviendrai sans hésiter.', published_at: '2026-04-06', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_005', site: 'wenony', source: 'trustpilot', author: 'Claire Dubois', rating: 2, title: 'Produit non conforme', content: "Le produit reçu ne correspond pas à la photo sur le site. Couleur différente et qualité inférieure à ce qui était décrit. Déçue.", published_at: '2026-04-05', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_006', site: 'wenony', source: 'trustpilot', author: 'Julien Moreau', rating: 5, title: 'Super boutique', content: 'Je commande régulièrement sur Wenony. Toujours satisfait de la qualité et du service. Continuez comme ça !', published_at: '2026-04-04', status: 'resolved', review_url: '' },
    { external_id: 'tp_wenony_007', site: 'wenony', source: 'trustpilot', author: 'Isabelle Petit', rating: 3, title: 'Correct sans plus', content: 'Produit correct, rien d\'exceptionnel. Livraison dans les délais. Prix un peu élevé pour la qualité proposée.', published_at: '2026-04-03', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_008', site: 'wenony', source: 'trustpilot', author: 'Nicolas Laurent', rating: 1, title: 'Service client inexistant', content: "Impossible de joindre le service client après ma commande. Le produit est arrivé cassé et personne ne me répond. Scandaleux !", published_at: '2026-04-02', status: 'in_progress', review_url: '' },
    { external_id: 'tp_wenony_009', site: 'wenony', source: 'trustpilot', author: 'Émilie Roux', rating: 5, title: 'Magnifique produit', content: 'Vraiment bluffée par la qualité. Le produit est encore mieux en vrai que sur les photos. Je recommande les yeux fermés.', published_at: '2026-04-01', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_010', site: 'wenony', source: 'trustpilot', author: 'Antoine Girard', rating: 4, title: 'Très bien', content: 'Bonne qualité, bonne communication. Je recommande.', published_at: '2026-03-30', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_011', site: 'wenony', source: 'trustpilot', author: 'Lucie Simon', rating: 5, title: 'Ravie de mon achat', content: 'Ravie de mon achat ! Produit de qualité, expédition soignée. Le petit mot personnalisé dans le colis était une belle attention.', published_at: '2026-03-28', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_012', site: 'wenony', source: 'trustpilot', author: 'Marc Fontaine', rating: 1, title: 'Arnaque sur les délais', content: "Promis en 5 jours, reçu en 3 semaines. Sans explication ni excuse. Et quand j'ai demandé un geste commercial, refus catégorique.", published_at: '2026-03-25', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_013', site: 'wenony', source: 'trustpilot', author: 'Camille Rousseau', rating: 4, title: 'Bon rapport qualité/prix', content: 'Bon rapport qualité/prix. Livraison un peu longue mais le produit vaut le détour.', published_at: '2026-03-22', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_014', site: 'wenony', source: 'trustpilot', author: 'Fabrice Blanc', rating: 5, title: 'Commande parfaite', content: 'Tout s\'est passé parfaitement, de la commande à la livraison. Je suis fan !', published_at: '2026-03-20', status: 'resolved', review_url: '' },
    { external_id: 'tp_wenony_015', site: 'wenony', source: 'trustpilot', author: 'Aurélie Garnier', rating: 2, title: 'Déçue par le service après-vente', content: "Le produit était bien mais suite à un problème, le SAV a été très difficile à joindre. Réponse obtenue après 10 jours seulement.", published_at: '2026-03-18', status: 'in_progress', review_url: '' },
    { external_id: 'tp_wenony_016', site: 'wenony', source: 'trustpilot', author: 'Kevin Chevalier', rating: 5, title: 'Très bonne boutique', content: 'Site clair, processus de commande simple. Produit reçu rapidement et en parfait état. Merci !', published_at: '2026-03-15', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_017', site: 'wenony', source: 'trustpilot', author: 'Sandra Morel', rating: 3, title: 'Mitigé', content: "Le produit est bien mais la livraison a pris du retard sans information de ma part. J'aurais apprécié être tenue au courant.", published_at: '2026-03-12', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_018', site: 'wenony', source: 'trustpilot', author: 'Christophe Henry', rating: 5, title: 'Excellent achat', content: 'Je suis très satisfait de mon achat. Produit conforme, livraison rapide. Je recommande sans hésitation.', published_at: '2026-03-10', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_019', site: 'wenony', source: 'trustpilot', author: 'Nathalie Lemaire', rating: 1, title: 'Remboursement impossible', content: "Produit retourné il y a un mois. Toujours pas remboursée malgré mes nombreuses relances. C'est inadmissible.", published_at: '2026-03-08', status: 'todo', review_url: '' },
    { external_id: 'tp_wenony_020', site: 'wenony', source: 'trustpilot', author: 'Éric Durand', rating: 4, title: 'Satisfait', content: 'Produit de qualité, livraison dans les délais. Je reviendrai.', published_at: '2026-03-05', status: 'resolved', review_url: '' },
  ];

  const insertMany = db.transaction((data) => {
    for (const review of data) insert.run(review);
  });

  insertMany(seedData);
}

module.exports = { getDb };
