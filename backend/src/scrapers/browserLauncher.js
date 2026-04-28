// Wrapper de lancement du navigateur Puppeteer.
//
// En production (NODE_ENV=production, typiquement Render/Heroku/Lambda),
// on utilise `@sparticuz/chromium` : un binaire Chromium pré-compilé pour
// les environnements contraints en RAM (~150–250MB vs ~400MB pour Chrome
// standard). Indispensable sur Render Starter (512MB) qui se faisait OOM
// kill avec Puppeteer + Chrome standard.
//
// En développement local, on garde `puppeteer` classique (Chrome installé
// par Puppeteer lors de `npm install`) pour ne pas dépendre de la disponi-
// bilité du binaire @sparticuz pour la plateforme du dev (macOS arm64,
// Windows, etc.).
//
// Dans les deux cas, on attache `puppeteer-extra-plugin-stealth` pour
// échapper aux détections d'automatisation côté Trustpilot/Cloudflare.

const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const isProduction = process.env.NODE_ENV === 'production';

// Cache du wrapper puppeteer-extra (évite de re-`use(StealthPlugin())` à
// chaque appel, ce qui empile les hooks et finit par crasher).
let cachedPuppeteer = null;

function getPuppeteer() {
  if (cachedPuppeteer) return cachedPuppeteer;

  if (isProduction) {
    const { addExtra } = require('puppeteer-extra');
    const puppeteerCore = require('puppeteer-core');
    const wrapped = addExtra(puppeteerCore);
    wrapped.use(StealthPlugin());
    cachedPuppeteer = wrapped;
  } else {
    const puppeteer = require('puppeteer-extra');
    puppeteer.use(StealthPlugin());
    cachedPuppeteer = puppeteer;
  }
  return cachedPuppeteer;
}

/**
 * Lance un navigateur headless adapté à l'environnement.
 * @param {object} opts
 * @param {string[]} [opts.extraArgs] - args Chrome additionnels
 * @param {{ width: number, height: number }} [opts.viewport]
 * @returns {Promise<import('puppeteer-core').Browser>}
 */
async function launchBrowser({ extraArgs = [], viewport } = {}) {
  const puppeteer = getPuppeteer();

  if (isProduction) {
    const chromium = require('@sparticuz/chromium');
    // Désactive WebGL et autres features lourdes (gain RAM ~50MB).
    chromium.setGraphicsMode = false;

    return puppeteer.launch({
      args: [...chromium.args, ...extraArgs],
      defaultViewport: viewport || chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // Dev local : Chrome installé par Puppeteer.
  return puppeteer.launch({
    headless: 'new',
    args: extraArgs,
    defaultViewport: viewport,
  });
}

module.exports = { launchBrowser };
