#!/usr/bin/env node
/**
 * Insère les avis Avis Vérifiés d'infonet.fr récupérés manuellement.
 * Source : https://www.avis-verifies.com/avis-clients/infonet.fr
 *
 * Usage:
 *   node scripts/seed-avis-verifies-infonet.js           # dry-run (affichage uniquement)
 *   node scripts/seed-avis-verifies-infonet.js --execute  # insertion réelle
 */

const { getDb } = require('../src/models/database');

const reviews = [
  // Page 1 – du plus récent au plus ancien
  {
    external_id: 'av_infonet_009',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Joel C.',
    rating: 4,
    title: 'Mauvaise expérience initiale résolue par le service client',
    content: "J'ai eu au départ une mauvaise expérience avec INFONET du à une erreur de ma part mais cette erreur a été induite par un site internet fort peu explicite. Il faut savoir que ce site s'adresse uniquement à des professionnels, ce qui supprime de fait le délai de rétractation des 14 jours si vous avez plus de 5 salariés. Ce point devrait à mon avis être souligné d'une façon plus claire. Selon moi, ceci n'est pas suffisamment mis en évidence : le chiffre 3 euros est en gras et largement surdimensionné par rapport au 79€ par mois avec engagement de 12 mois. Par ailleurs, lorsque vous payez votre première demande de renseignements à 3€, il est indiqué en noir gras \"je demande l'accès immédiat à ma demande\" et à côté et en dessous, en petits caractères de teinte grisâtre que vous renoncez à votre droit de rétractation et que cela vous engage à un abonnement d'un an de 79€ HT soit 94,8€ mensuel ou 1137,6€ annuel. Cependant, je dois souligner que le service de réclamation que j'ai contacté a été tout à fait correct, d'une grande disponibilité et d'une grande amabilité. Ce service a reconnu ma bonne foi et m'a remboursé intégralement les sommes qui m'avait été prélevé.",
    published_at: '2026-04-13',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_010',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Bruno M.',
    rating: 3,
    title: 'En attente des actions promises',
    content: "Je reste dans l'attente de la mise en oeuvre des actions promises dans votre mail du 09/02/2026 et qui conditionnent mon avis final.",
    published_at: '2026-02-19',
    status: 'in_progress',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_011',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Aleksandr M.',
    rating: 1,
    title: 'Abonnement non consenti – arnaque',
    content: "Je voulais seulement acheter un document, mais ils m'ont souscrit à un abonnement de 12 mois. Le service client a refusé de m'aider. Ils affirment que j'ai signé un contrat avec eux, mais je n'ai jamais vu ce contrat et je n'en ai jamais été informé. Ma conclusion : c'est une arnaque bien ficelée. Du moins dans mon cas.",
    published_at: '2026-01-01',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_012',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'D. L.',
    rating: 1,
    title: 'Expérience plus que désagréable',
    content: "Je ne recommande aucun de leurs services, une expérience plus que désagréable. Faites tout pour vous passer d'eux.",
    published_at: '2025-12-26',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_013',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'David J.',
    rating: 5,
    title: 'Top très bon site',
    content: 'Top très bon site',
    published_at: '2025-10-10',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_014',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Nathalie L.',
    rating: 3,
    title: 'Modèle pas vraiment gratuit',
    content: "modèle pas vraiment gratuit , dommage qu'on ne connaisse pas le prix avant de télécharger",
    published_at: '2025-09-30',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_015',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Salim H.',
    rating: 4,
    title: 'Bien',
    content: 'Bien',
    published_at: '2025-09-16',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_016',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Gregory G.',
    rating: 3,
    title: 'Avis en attente de la réception',
    content: "Je donnerai mon avis sur le site que quand j'aurai reçu ma lettre de motivation",
    published_at: '2025-09-11',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_017',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Luftime G.',
    rating: 5,
    title: 'Très bien',
    content: 'Très bien',
    published_at: '2025-08-25',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_018',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Rodrigue fabrice T.',
    rating: 4,
    title: 'Bien merci',
    content: 'Bien merci a vous',
    published_at: '2025-08-16',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_019',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'D. M.',
    rating: 5,
    title: 'Très bien',
    content: 'Très bien',
    published_at: '2025-08-11',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_020',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Tiphene L.',
    rating: 4,
    title: 'Bien',
    content: 'Bien',
    published_at: '2025-07-24',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_021',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Daria B.',
    rating: 3,
    title: 'Daria',
    content: 'Daria',
    published_at: '2025-07-23',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_022',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Audrey V.',
    rating: 5,
    title: 'Simple efficace et pratique',
    content: 'simple efficaces et pratique.....',
    published_at: '2025-07-21',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_023',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Cédrine sorelle M.',
    rating: 5,
    title: 'Super',
    content: 'Super',
    published_at: '2025-07-15',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_024',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Christophe B.',
    rating: 5,
    title: 'Remerciements à Monsieur Merlin',
    content: "Bonjour, je tiens personnellement à remercier monsieur Merlin qui a eu la gentillesse de m'appeler car je n'avais pas été content du téléchargement d'une lettre type ce monsieur m'a gentiment appelé pour m'envoyer des lettres type de contestation ce monsieur a été très efficace et je tiens personnellement à le remercier bien cordialement à vous",
    published_at: '2025-07-10',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_025',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'E. M.',
    rating: 5,
    title: 'Excellent',
    content: 'Excellent',
    published_at: '2025-07-07',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_026',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'S. B.',
    rating: 3,
    title: "Pas encore testé",
    content: "J'ai pas encore testé",
    published_at: '2025-06-30',
    status: 'todo',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_027',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Jean luc P.',
    rating: 5,
    title: 'Super',
    content: 'Super',
    published_at: '2025-06-29',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
  {
    external_id: 'av_infonet_028',
    site: 'infonet',
    source: 'avis-verifies',
    author: 'Laila B.',
    rating: 4,
    title: 'Bien',
    content: 'Bien',
    published_at: '2025-06-07',
    status: 'resolved',
    review_url: 'https://www.avis-verifies.com/avis-clients/infonet.fr',
  },
];

function main() {
  const execute = process.argv.includes('--execute');
  const db = getDb();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO reviews
      (external_id, site, source, author, rating, title, content, published_at, status, review_url)
    VALUES
      (@external_id, @site, @source, @author, @rating, @title, @content, @published_at, @status, @review_url)
  `);

  if (!execute) {
    console.log(`[dry-run] ${reviews.length} avis Avis Vérifiés à insérer pour infonet :`);
    reviews.forEach(r => console.log(`  ${r.external_id} | ${r.author} | ${r.published_at} | ⭐${r.rating} | ${r.title}`));
    console.log('\nRelancez avec --execute pour insérer.');
    return;
  }

  const insert = db.transaction(data => {
    let inserted = 0;
    for (const r of data) {
      const info = stmt.run(r);
      if (info.changes > 0) inserted++;
    }
    return inserted;
  });

  const inserted = insert(reviews);
  console.log(`[seed-avis-verifies-infonet] Inséré : ${inserted} / ${reviews.length} avis.`);
}

main();
