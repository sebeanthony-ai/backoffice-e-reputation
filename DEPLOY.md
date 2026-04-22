# Déploiement (équipe)

Le front tourne sur **Vercel**, l’API sur **Render** (ou tout autre hébergement Node avec une URL publique).

## 1. Backend sur Render

1. [render.com](https://render.com) → **New** → **Web Service** → connecter ce dépôt Git.
2. **Root Directory** : `backend`
3. **Build Command** : `npm install`
4. **Start Command** : `npm start`
5. **Health Check Path** : `/api/health`
6. Ajouter un **disque persistant** : mount `/data`, 1 Go (SQLite + captures).
7. **Environment** (Variables) :

| Clé | Valeur |
|-----|--------|
| `NODE_VERSION` | `20` |
| `DATA_DIR` | `/data` |
| `CORS_ORIGINS` | `https://TON-PROJET.vercel.app` (remplacer après l’étape 2 ; plusieurs URLs séparées par des virgules) |
| `BACKOFFICE_API_KEY` | une longue chaîne aléatoire (partagée avec l’équipe via Vercel) |

8. Déployer et noter l’URL publique, ex. `https://backoffice-api-xxxx.onrender.com`.

Tester : ouvrir `https://TON-API/api/health` → JSON `{"status":"ok",...}`.

## 2. Front sur Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → même dépôt.
2. **Root Directory** : laisser **vide** (racine du repo) — le `vercel.json` à la racine build le dossier `frontend`.
3. **Environment Variables** (Production, et Preview si besoin) :

| Clé | Valeur |
|-----|--------|
| `VITE_API_URL` | `https://TON-API.onrender.com` **sans** `/api` à la fin |
| `VITE_BACKOFFICE_KEY` | **exactement** la même valeur que `BACKOFFICE_API_KEY` sur Render |

4. **Deploy**.

5. Revenir sur Render et mettre à jour `CORS_ORIGINS` avec l’URL Vercel exacte (ex. `https://backoffice-xxx.vercel.app`), puis **Manual Deploy** sur Render si besoin.

## 3. Vérifications

- Le site Vercel charge les avis (plus de 404 sur `/api`).
- En-tête : statut **Synchronisé** (vert) si le WebSocket rejoint le backend.

## Dépannage 404

- `VITE_API_URL` manquant ou faux → chaque appel API part vers `https://xxx.vercel.app/api/...` qui n’existe pas. Corriger la variable et **redéployer** le front (les variables `VITE_*` sont injectées au **build**).
- URL avec `/api` en trop : le code retire automatiquement un suffixe `/api` sur `VITE_API_URL`.
