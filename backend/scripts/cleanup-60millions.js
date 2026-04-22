#!/usr/bin/env node
/**
 * Supprime tous les avis importés depuis « 60 Millions de consommateurs »
 * (source = 60millions en base).
 *
 *   node scripts/cleanup-60millions.js           # dry-run (compte)
 *   node scripts/cleanup-60millions.js --execute
 */

const { getDb } = require('../src/models/database');

const SOURCE = '60millions';

function main() {
  const execute = process.argv.includes('--execute');
  const db = getDb();

  const n = db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE source = ?').get(SOURCE).n;
  console.log(`[cleanup-60millions] Avis concernés : ${n}`);

  if (n === 0) {
    process.exit(0);
  }
  if (!execute) {
    console.log('Dry-run : ajoutez --execute pour supprimer.');
    process.exit(0);
  }

  const info = db.prepare('DELETE FROM reviews WHERE source = ?').run(SOURCE);
  console.log(`[cleanup-60millions] Supprimé : ${info.changes} (réponses / rappels en cascade).`);
  process.exit(0);
}

main();
