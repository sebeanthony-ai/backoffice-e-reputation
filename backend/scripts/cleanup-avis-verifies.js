#!/usr/bin/env node
/**
 * Supprime les avis importés depuis Avis Vérifiés (données obsolètes avant correction du scraper).
 *
 * Usage:
 *   node scripts/cleanup-avis-verifies.js              # aperçu (dry-run)
 *   node scripts/cleanup-avis-verifies.js --execute    # suppression
 *   node scripts/cleanup-avis-verifies.js --execute --legacy-only
 *   node scripts/cleanup-avis-verifies.js --execute --all-sites
 *   node scripts/cleanup-avis-verifies.js --execute --site=infonet
 *
 * --legacy-only : ne supprime que les lignes dont external_id ne correspond pas au nouveau format
 *                 (id DOM reviews__item__…), ex. av_infonet_0_2026-04-15
 */

const { getDb } = require('../src/models/database');

function parseArgs(argv) {
  const out = {
    execute: false,
    legacyOnly: false,
    allSites: false,
    site: 'infonet',
    help: false,
  };
  for (const a of argv) {
    if (a === '--execute') out.execute = true;
    else if (a === '--legacy-only') out.legacyOnly = true;
    else if (a === '--all-sites') out.allSites = true;
    else if (a.startsWith('--site=')) out.site = a.slice('--site='.length);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`
Nettoyage des avis « Avis Vérifiés » dans reviews.db

  node scripts/cleanup-avis-verifies.js              Dry-run : compte les lignes concernées
  node scripts/cleanup-avis-verifies.js --execute    Supprime (réponses / rappels en cascade)

Options:
  --site=infonet     Site ciblé (défaut: infonet)
  --all-sites        Tous les sites pour source = avis-verifies
  --legacy-only      Uniquement les anciens external_id (sans reviews__item__ dans l’id)
`);
    process.exit(0);
  }

  const db = getDb();

  let where = `source = 'avis-verifies'`;
  const params = [];
  if (!args.allSites) {
    where += ' AND site = ?';
    params.push(args.site);
  }
  if (args.legacyOnly) {
    where += ` AND external_id NOT LIKE '%reviews__item__%'`;
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS n FROM reviews WHERE ${where}`).get(...params);
  const n = countRow.n;

  const scope = args.allSites ? 'tous les sites' : `site « ${args.site} »`;
  const mode = args.legacyOnly ? ' (anciens IDs uniquement)' : '';

  console.log(`[cleanup-avis-verifies] Cible : ${scope}${mode}`);
  console.log(`[cleanup-avis-verifies] Lignes à supprimer : ${n}`);

  if (n === 0) {
    console.log('Rien à faire.');
    process.exit(0);
  }

  if (!args.execute) {
    console.log('\nDry-run : aucune suppression. Relancez avec --execute pour appliquer.');
    process.exit(0);
  }

  const del = db.prepare(`DELETE FROM reviews WHERE ${where}`);
  const info = del.run(...params);

  console.log(`[cleanup-avis-verifies] Supprimé : ${info.changes} avis (réponses / rappels liés en cascade).`);
  process.exit(0);
}

main();
