/**
 * Configuration runtime (build Vite).
 * En prod : définir VITE_API_URL = origine du backend **sans** `/api`,
 * ex. https://xxx.onrender.com
 * (Si vous avez collé https://xxx.onrender.com/api, le /api final est retiré automatiquement.)
 * En local : laisser vide → proxy Vite (/api, /socket.io).
 */
function normalizeApiOrigin(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  // Évite https://host/api + notre suffixe /api → double /api/api
  if (s.endsWith('/api')) s = s.slice(0, -4);
  return s;
}

const raw = normalizeApiOrigin(import.meta.env.VITE_API_URL || '');

export const API_ORIGIN = raw;
export const API_BASE = raw ? `${raw}/api` : '/api';
export const HISTORIQUE_API_BASE = `${API_BASE}/historique`;

/** Clé partagée optionnelle (même valeur que BACKOFFICE_API_KEY côté serveur). */
export const BACKOFFICE_KEY = (import.meta.env.VITE_BACKOFFICE_KEY || '').trim();

/** En-têtes pour les `fetch` hors axios (ex. uploads Historique). */
export function getBackofficeHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (BACKOFFICE_KEY) h['X-Backoffice-Key'] = BACKOFFICE_KEY;
  return h;
}
