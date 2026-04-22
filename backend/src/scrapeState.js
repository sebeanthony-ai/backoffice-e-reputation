// État global partagé entre le cron et les routes API
// Empêche les lancements simultanés de scrapeAll()
module.exports = { inProgress: false };
