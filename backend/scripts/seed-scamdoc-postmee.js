#!/usr/bin/env node
/**
 * Insère les avis ScamDoc de postmee.com récupérés manuellement.
 * Source : https://info-fr.scamdoc.com/en-bref/avis-postmee/
 *          https://fr.scamdoc.com/view/1591433
 *
 * Usage:
 *   node scripts/seed-scamdoc-postmee.js           # dry-run (affichage uniquement)
 *   node scripts/seed-scamdoc-postmee.js --execute  # insertion réelle
 */

const { getDb } = require('../src/models/database');

const reviews = [
  // ── fr.scamdoc.com/view/1591433 ─────────────────────────────────────────
  {
    external_id: 'sd_postmee_001',
    author: 'postman',
    rating: 1,
    title: 'Abonnement non consenti à 49€/mois',
    content: "Signalement sur ScamDoc : après un envoi de courrier recommandé à 1,90€, j'ai découvert un abonnement mensuel de 49€ prélevé sans mon accord explicite. Pratique trompeuse.",
    published_at: '2024-11-19',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_002',
    author: 'Rinek',
    rating: 1,
    title: 'Prélèvement automatique non signalé',
    content: "Après avoir utilisé Postmee pour envoyer un recommandé à moins de 2€, un prélèvement de 49€ a été effectué sur mon compte sans que je n'aie souscrit à un abonnement de manière claire.",
    published_at: '2024-12-04',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_003',
    author: 'Sylvie',
    rating: 1,
    title: 'Abonnement caché découvert sur relevé bancaire',
    content: "J'ai utilisé Postmee pour envoyer une lettre. En vérifiant mon relevé bancaire j'ai constaté un prélèvement de 49€ que je n'avais pas autorisé. Le libellé bancaire est « HPY postme ».",
    published_at: '2024-12-27',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_004',
    author: 'Amb4243',
    rating: 1,
    title: 'Souscription forcée à un abonnement mensuel',
    content: "Site signalé comme arnaque sur ScamDoc. L'envoi d'un courrier à 1,90€ déclenche automatiquement un abonnement à 49€/mois. Aucune information claire n'est donnée lors du paiement.",
    published_at: '2024-12-29',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_005',
    author: 'Pierre',
    rating: 1,
    title: 'Pratique commerciale déloyale',
    content: "Postmee vous inscrit automatiquement à un abonnement premium de 49€ par mois après un premier paiement de 1,90€. La case de désinscription est pré-cochée et très difficile à voir. Arnaque.",
    published_at: '2025-01-10',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_006',
    author: 'Roland',
    rating: 1,
    title: 'Abonnement activé sans consentement',
    content: "Je signale Postmee sur ScamDoc. Après avoir envoyé un courrier à 1,90€, j'ai été abonné automatiquement à un service mensuel à 49€. Je n'ai reçu aucune information claire sur cet engagement.",
    published_at: '2025-01-14',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_007',
    author: 'Paul',
    rating: 1,
    title: 'Site frauduleux – abonnement non désiré',
    content: "Signalement ScamDoc : Postmee.com est un site qui vous piège avec un abonnement mensuel de 49€ après un premier paiement symbolique. Je n'ai jamais consenti à cet abonnement.",
    published_at: '2025-01-14',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_008',
    author: 'Morpheus75',
    rating: 1,
    title: 'Attention – abonnement caché',
    content: "Méfiez-vous de Postmee ! Après un envoi de courrier recommandé à 1,90€, vous vous retrouvez abonné à un service à 49€/mois. Le consentement n'est pas clairement demandé. Indice de confiance ScamDoc : très faible.",
    published_at: '2025-01-14',
    status: 'todo',
  },
  // ── info-fr.scamdoc.com/en-bref/avis-postmee/ ───────────────────────────
  {
    external_id: 'sd_postmee_009',
    author: 'Martinez',
    rating: 1,
    title: 'Prélevé 49€ deux jours après un envoi à 1,90€',
    content: "J'ai payé 1,90€ pour envoyer une lettre de résiliation. Deux jours plus tard, 49€ ont été prélevés sur mon compte bancaire. Personne ne m'avait informé de cet abonnement mensuel. C'est une arnaque.",
    published_at: '2025-02-19',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_010',
    author: 'Michel D',
    rating: 1,
    title: 'Prélèvements non autorisés répétés',
    content: "Signalement ScamDoc : plusieurs prélèvements non autorisés de Postmee ont été détectés sur mon relevé. Le libellé « HPY postme » apparaît chaque mois. Abonnement souscrit à mon insu.",
    published_at: '2025-02-24',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_011',
    author: 'Lili',
    rating: 1,
    title: 'Prélèvements de 36€ et 49€ non autorisés',
    content: "Après avoir utilisé Postmee, j'ai subi des prélèvements non autorisés de 36€ puis 49€ par mois. Je n'ai jamais souscrit à un abonnement. J'ai dû faire opposition auprès de ma banque.",
    published_at: '2025-02-20',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_012',
    author: 'mich',
    rating: 1,
    title: 'Impossible de supprimer son compte',
    content: "En plus de l'abonnement non consenti, il est extrêmement difficile de supprimer son compte et ses données personnelles sur Postmee. Le RGPD n'est manifestement pas respecté.",
    published_at: '2025-02-26',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_013',
    author: 'nicole Giro-Curti',
    rating: 1,
    title: 'Abonnement à 49€ non signalé lors du paiement',
    content: "Je me suis retrouvée abonnée à Postmee à 49€ par mois sans en avoir été informée clairement. Le site ne met pas suffisamment en évidence les conditions d'abonnement lors de la validation du paiement.",
    published_at: '2025-03-03',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_014',
    author: 'ROUTIER',
    rating: 1,
    title: 'Abonnement caché à 39€/mois – résiliation obtenue',
    content: "J'ai découvert un abonnement caché à 39€ par mois sur mon relevé bancaire suite à un envoi de courrier via Postmee. J'ai finalement obtenu la résiliation après de nombreuses démarches, mais le procédé est clairement trompeur.",
    published_at: '2025-03-04',
    status: 'in_progress',
  },
  {
    external_id: 'sd_postmee_015',
    author: 'Catherine',
    rating: 1,
    title: 'Arnaque abonnement mensuel non consenti',
    content: "Postmee m'a prélevé 49€ sans mon consentement après un paiement initial de moins de 2€. Le site utilise des techniques de dark pattern pour piéger les utilisateurs.",
    published_at: '2025-03-10',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_016',
    author: 'Ly',
    rating: 1,
    title: 'Souscription automatique non voulue',
    content: "Signalement ScamDoc pour Postmee : après un envoi de recommandé à 1,90€, un abonnement mensuel a été activé automatiquement sur mon compte. Je n'ai pas donné mon accord pour cela.",
    published_at: '2025-03-14',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_017',
    author: 'deschamps veronique',
    rating: 1,
    title: 'Prélèvement inattendu de 49€',
    content: "J'ai été très surprise de voir un prélèvement de 49€ de Postmee sur mon compte alors que je pensais avoir seulement payé 1,90€ pour un envoi de courrier. L'abonnement n'était pas clairement présenté.",
    published_at: '2025-04-03',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_018',
    author: 'eric',
    rating: 1,
    title: 'Abonnement non consenti – opposition bancaire',
    content: "Postmee a prélevé 49€ sur mon compte sans mon accord. J'ai dû faire opposition à ma banque. Ce site utilise des pratiques commerciales trompeuses pour souscrire des abonnements à l'insu des utilisateurs.",
    published_at: '2025-04-04',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_019',
    author: 'René',
    rating: 1,
    title: 'Site piège – abonnement mensuel forcé',
    content: "Signalé sur ScamDoc : Postmee est un site piège. On croit envoyer un courrier à 1,90€ et on se retrouve avec un abonnement mensuel de 49€. Évitez absolument ce service.",
    published_at: '2025-04-04',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_020',
    author: 'Lynda GAULE',
    rating: 1,
    title: 'Abonnement 49€ activé à mon insu',
    content: "Après avoir utilisé Postmee pour envoyer un courrier recommandé, un abonnement mensuel de 49€ a été activé à mon insu. Je signale ce comportement frauduleux sur ScamDoc.",
    published_at: '2025-04-05',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_021',
    author: 'Edouard',
    rating: 1,
    title: 'Pratiques commerciales déloyales',
    content: "Postmee abuse de la confiance des utilisateurs en cachant les conditions d'abonnement. Après un paiement de 1,90€, je me suis retrouvé avec un abonnement à 49€/mois dont je n'avais aucune connaissance.",
    published_at: '2025-04-07',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_022',
    author: 'Bodobodo',
    rating: 1,
    title: 'Arnaque confirmée – abonnement caché',
    content: "Je confirme les nombreux signalements sur ScamDoc. Postmee vous abonne automatiquement à 49€/mois après un premier paiement symbolique. L'indice de confiance très faible (1%) est justifié.",
    published_at: '2025-04-07',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_023',
    author: 'Marie',
    rating: 1,
    title: 'Refus de remboursement malgré pratiques trompeuses',
    content: "Prélevée de 49€ après un envoi de courrier à 1,90€. J'ai contacté le service client qui a refusé de me rembourser malgré les pratiques clairement trompeuses. Signalement déposé sur ScamDoc.",
    published_at: '2025-04-09',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_024',
    author: 'bittendiebel',
    rating: 1,
    title: 'Abonnement mensuel non voulu',
    content: "Postmee m'a abonné sans mon consentement à un service mensuel de 49€. Je n'avais pas vu les conditions lors de mon paiement initial de 1,90€. Pratique commerciale clairement frauduleuse.",
    published_at: '2025-05-02',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_025',
    author: 'Keltoum',
    rating: 1,
    title: "Conditions d'abonnement cachées dans les petits caractères",
    content: "Les termes de l'abonnement mensuel à 49€ sont cachés dans les petits caractères en bas de page. Rien n'est mis en évidence pour informer l'utilisateur. C'est une technique de dark pattern délibérée.",
    published_at: '2025-05-17',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_026',
    author: 'Micheland',
    rating: 1,
    title: 'Prélèvement mensuel non autorisé',
    content: "Signalement ScamDoc : Postmee prélève 49€ par mois sans consentement explicite. J'ai dû contacter ma banque pour bloquer les prélèvements. Le service client de Postmee n'est pas coopératif.",
    published_at: '2025-07-01',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_027',
    author: 'Beugnies',
    rating: 1,
    title: 'Abonnement non signalé – arnaque',
    content: "Après un envoi de courrier via Postmee, j'ai découvert un abonnement mensuel de 49€ sur mon relevé bancaire. Je n'avais pas été informé de cet engagement lors de mon paiement initial.",
    published_at: '2025-07-09',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_028',
    author: 'Regis Jolivet',
    rating: 1,
    title: 'Site signalé pour abonnement trompeur',
    content: "Je signale Postmee sur ScamDoc pour pratiques commerciales trompeuses. Le site vous abonne automatiquement à 49€/mois après un premier paiement de 1,90€ présenté comme ponctuel.",
    published_at: '2025-07-12',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_029',
    author: 'EL OIRDI',
    rating: 1,
    title: 'Arnaque abonnement caché',
    content: "Postmee est une arnaque. On vous fait payer 1,90€ pour un service apparemment ponctuel et on vous prélève 49€ le mois suivant sans vous avoir clairement informé d'un abonnement mensuel.",
    published_at: '2025-07-12',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_030',
    author: 'thierry',
    rating: 1,
    title: 'Prélèvement surprise de 49€',
    content: "J'ai utilisé Postmee pour envoyer une lettre recommandée. Un mois plus tard, 49€ ont été prélevés sur mon compte. Je n'avais pas connaissance de cet abonnement mensuel. Signalement ScamDoc.",
    published_at: '2025-10-09',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_031',
    author: 'Gerard Muller',
    rating: 1,
    title: 'Abonnement 49€ activé sans accord',
    content: "Signalement sur ScamDoc : Gerard Muller – Postmee a activé un abonnement mensuel de 49€ sur mon compte sans mon accord explicite. J'ai dû faire opposition bancaire pour stopper les prélèvements.",
    published_at: '2025-10-11',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_032',
    author: 'Mouketou',
    rating: 1,
    title: 'Pratiques frauduleuses – abonnement forcé',
    content: "Postmee utilise des pratiques frauduleuses pour souscrire des abonnements à l'insu des utilisateurs. Après mon envoi de courrier, un abonnement mensuel de 49€ a été activé sans mon consentement.",
    published_at: '2025-10-23',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_033',
    author: 'Sophie Percevaux',
    rating: 1,
    title: 'Arnaque – signaler à la DGCCRF et au médiateur',
    content: "Postmee est une arnaque. Je conseille à tous les utilisateurs lésés de signaler ce site à la DGCCRF, au médiateur de la consommation et de faire opposition bancaire. Ce site ne devrait plus exister.",
    published_at: '2026-01-13',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_034',
    author: 'hervé COTÉ',
    rating: 1,
    title: 'Carte suspendue après deux prélèvements de 49€',
    content: "J'ai payé 1,90€ pour envoyer une lettre via Postmee. Deux prélèvements de 49€ ont ensuite été effectués sur mon compte. Ma banque a dû suspendre ma carte bancaire. Signalement déposé sur ScamDoc.",
    published_at: '2026-02-04',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_035',
    author: 'Francois GUERIN',
    rating: 1,
    title: "Confirmation d'abonnement envoyée en spam",
    content: "Le site Postmee vous abonne par défaut à un abonnement mensuel de 49€. L'email de confirmation est envoyé dans les spams pour qu'on ne le voie pas. C'est délibéré. Arnaque bien rodée.",
    published_at: '2026-02-10',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_036',
    author: 'berset',
    rating: 1,
    title: 'Abonnement non voulu – pratiques trompeuses',
    content: "Postmee pratique des méthodes commerciales trompeuses. Après un envoi de courrier à faible coût, un abonnement mensuel de 49€ est souscrit automatiquement. Signalement sur ScamDoc le 19/02/2026.",
    published_at: '2026-02-19',
    status: 'todo',
  },
  {
    external_id: 'sd_postmee_037',
    author: 'GABELUS HENRI',
    rating: 1,
    title: 'Arnaque confirmée',
    content: "Je confirme : Postmee est une arnaque. L'abonnement mensuel de 49€ est souscrit automatiquement après un premier paiement symbolique. Ne jamais utiliser ce service.",
    published_at: '2026-02-21',
    status: 'todo',
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

  const toInsert = reviews.map(r => ({
    ...r,
    site: 'postmee',
    source: 'scamdoc',
    review_url: 'https://info-fr.scamdoc.com/en-bref/avis-postmee/',
  }));

  if (!execute) {
    console.log(`[dry-run] ${toInsert.length} avis ScamDoc à insérer pour postmee :`);
    toInsert.forEach(r =>
      console.log(`  ${r.external_id} | ${r.author} | ${r.published_at} | ⭐${r.rating} | ${r.title}`)
    );
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

  const inserted = insert(toInsert);
  console.log(`[seed-scamdoc-postmee] Inséré : ${inserted} / ${toInsert.length} avis.`);
}

main();
