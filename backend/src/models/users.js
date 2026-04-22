const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

const ROLES = ['admin', 'agent'];

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    role: row.role || 'agent',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function findByEmail(email) {
  if (!email) return null;
  return getDb()
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
    .get(email);
}

function findById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function listAll() {
  return getDb()
    .prepare('SELECT * FROM users ORDER BY role DESC, email ASC')
    .all()
    .map(sanitizeUser);
}

function createUser({ email, password, name = '', role = 'agent' }) {
  if (!email || !password) throw new Error('Email et mot de passe requis');
  if (!ROLES.includes(role)) throw new Error('Rôle invalide');
  if (password.length < 6) throw new Error('Mot de passe trop court (min. 6 caractères)');

  const existing = findByEmail(email);
  if (existing) throw new Error('Un utilisateur avec cet email existe déjà');

  const hash = bcrypt.hashSync(password, 10);
  const info = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES (?, ?, ?, ?)`
    )
    .run(email.trim().toLowerCase(), hash, (name || '').trim(), role);
  return sanitizeUser(findById(info.lastInsertRowid));
}

function updateUser(id, { name, role, password, email }) {
  const user = findById(id);
  if (!user) throw new Error('Utilisateur introuvable');

  const fields = [];
  const values = [];
  if (typeof name === 'string') {
    fields.push('name = ?');
    values.push(name.trim());
  }
  if (typeof email === 'string' && email.trim()) {
    const nextEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new Error('Email invalide');
    }
    if (nextEmail !== (user.email || '').toLowerCase()) {
      const existing = findByEmail(nextEmail);
      if (existing && existing.id !== id) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }
      fields.push('email = ?');
      values.push(nextEmail);
    }
  }
  if (typeof role === 'string') {
    if (!ROLES.includes(role)) throw new Error('Rôle invalide');
    fields.push('role = ?');
    values.push(role);
  }
  if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) throw new Error('Mot de passe trop court (min. 6 caractères)');
    fields.push('password_hash = ?');
    values.push(bcrypt.hashSync(password, 10));
  }
  if (!fields.length) return sanitizeUser(user);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  getDb()
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values);
  return sanitizeUser(findById(id));
}

function deleteUser(id) {
  const user = findById(id);
  if (!user) throw new Error('Utilisateur introuvable');
  if (user.role === 'admin') {
    const admins = getDb()
      .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")
      .get().c;
    if (admins <= 1) throw new Error('Impossible de supprimer le dernier admin');
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return true;
}

function verifyPassword(user, password) {
  if (!user || !user.password_hash) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

/** Crée un admin initial depuis ADMIN_EMAIL / ADMIN_PASSWORD si aucun n'existe. */
function seedInitialAdmin() {
  const db = getDb();
  const { c } = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get();
  if (c > 0) return;

  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  if (!email || !password) {
    console.log(
      '[Auth] Aucun admin en base. Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans .env pour créer le premier admin.'
    );
    return;
  }

  try {
    createUser({ email, password, name, role: 'admin' });
    console.log(`[Auth] Admin initial créé : ${email}`);
  } catch (err) {
    console.error('[Auth] Impossible de créer l\'admin initial:', err.message);
  }
}

module.exports = {
  ROLES,
  sanitizeUser,
  findByEmail,
  findById,
  listAll,
  createUser,
  updateUser,
  deleteUser,
  verifyPassword,
  seedInitialAdmin,
};
