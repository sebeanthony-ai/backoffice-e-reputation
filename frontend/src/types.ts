export type ReviewStatus = 'todo' | 'in_progress' | 'resolved';
export type SiteKey = 'infonet' | 'postmee' | 'startdoc' | 'wenony' | 'legaleo' | 'lesentreprises' | 'datalegal';
export type SourceKey = 'trustpilot' | 'avis-verifies' | 'signal-arnaques' | '60millions' | 'scamdoc';

export interface Review {
  id: number;
  external_id: string;
  site: SiteKey;
  source: SourceKey;
  author: string;
  rating: number;
  title: string;
  content: string;
  published_at: string;
  status: ReviewStatus;
  note: string;
  assigned_to: string;
  agents: string;        // IDs des agents séparés par virgule, ex: "violaine,marc"
  contacted_at: string;  // ISO datetime du 1er contact client, ex: "2026-04-14T10:30"
  review_url: string;
  created_at: string;
  updated_at: string;
}

// ─── Agents ────────────────────────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  color: string;   // couleur de l'avatar
  initials: string;
}

export const AGENTS: Agent[] = [
  { id: 'violaine',  name: 'Violaine',  color: '#8b5cf6', initials: 'VI' },
  { id: 'marc',      name: 'Marc',      color: '#0ea5e9', initials: 'MA' },
  { id: 'sophie',    name: 'Sophie',    color: '#f97316', initials: 'SO' },
  { id: 'thomas',    name: 'Thomas',    color: '#10b981', initials: 'TH' },
  { id: 'lea',       name: 'Léa',       color: '#e11d48', initials: 'LE' },
  { id: 'nicolas',   name: 'Nicolas',   color: '#f59e0b', initials: 'NI' },
];

export interface SiteStats {
  site: SiteKey;
  total: number;
  todo: number;
  in_progress: number;
  resolved: number;
  avg_rating: number;
  negative: number;
  positive: number;
}

export interface GlobalStats {
  totals: {
    total: number; todo: number; in_progress: number;
    resolved: number; avg_rating: number;
  };
  siteStats: SiteStats[];
  bySource: { site: SiteKey; source: SourceKey; count: number; avg_rating: number }[];
  byRating: { site: SiteKey; rating: number; count: number }[];
  recent: Review[];
}

export interface Pagination { total: number; page: number; limit: number; pages: number; }
export interface ReviewsResponse { reviews: Review[]; pagination: Pagination; }

// ─── Rappels / Relances ────────────────────────────────────────────────────
export interface Reminder {
  id: number;
  review_id: number | null;
  message: string;
  remind_at: string;       // ISO datetime
  status: 'pending' | 'triggered' | 'dismissed';
  created_at: string;
  // champs joints depuis reviews
  author?: string;
  site?: string;
  source?: string;
  title?: string;
}

// color  = couleur décorative (fond teinté, bordure, icône)
// text   = couleur de texte garantissant 4.5:1 de contraste sur fond blanc
// Favicon helper.
// NOTE : `logo.clearbit.com` a été arrêté (DNS ne résout plus depuis fin 2025,
// après le rachat de Clearbit par HubSpot). On utilise Google Favicons (taille
// 64 pour un rendu correct en retina), avec DuckDuckGo en fallback.
const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const favFallback = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

/** Charte infonet.fr/mediakit/ — vert #16A974, neutres #283136 / #F9FAFB */
export const INFONET_BRAND = {
  primary: '#16A974',
  ink: '#283136',
  muted: '#606568',
  border: '#CBCFD1',
  surface: '#E8E9EA',
  canvas: '#F9FAFB',
} as const;

export const SITE_CONFIG: Record<SiteKey, {
  label: string; color: string; text: string;
  url: string; bg: string; favicon: string; faviconFallback: string;
}> = {
  infonet:  {
    label: 'Infonet.fr',
    color: INFONET_BRAND.primary,
    text: INFONET_BRAND.ink,
    bg: 'bg-[#F9FAFB] border-[#CBCFD1]',
    url: 'https://infonet.fr',
    favicon: fav('infonet.fr'),
    faviconFallback: favFallback('infonet.fr'),
  },
  postmee:  {
    label: 'Postmee.com',        color: '#234160', text: '#1a3355',
    bg: 'bg-blue-50 border-blue-200',       url: 'https://postmee.com',
    favicon: fav('postmee.com'),            faviconFallback: favFallback('postmee.com'),
  },
  startdoc: {
    label: 'Startdoc.fr',        color: '#2f76de', text: '#1a4e9f',
    bg: 'bg-blue-50 border-blue-200',       url: 'https://www.startdoc.fr',
    favicon: fav('startdoc.fr'),            faviconFallback: favFallback('startdoc.fr'),
  },
  wenony:   {
    label: 'Wenony.fr',          color: '#37bc2b', text: '#1a6e10',
    bg: 'bg-green-50 border-green-200',     url: 'https://wenony.fr',
    favicon: fav('wenony.fr'),              faviconFallback: favFallback('wenony.fr'),
  },
  legaleo:  {
    label: 'Legaleo.fr',         color: '#967dfa', text: '#5b21b6',
    bg: 'bg-violet-50 border-violet-200',   url: 'https://legaleo.fr',
    favicon: '/legaleo-logo.png',           faviconFallback: '/legaleo-logo.png',
  },
  lesentreprises: {
    label: 'LesEntreprises.com', color: '#6366f1', text: '#4338ca',
    bg: 'bg-indigo-50 border-indigo-200',   url: 'https://lesentreprises.com',
    favicon: fav('lesentreprises.com'),     faviconFallback: favFallback('lesentreprises.com'),
  },
  datalegal: {
    label: 'DataLegal.fr',       color: '#3c50a0', text: '#1e3a8a',
    bg: 'bg-indigo-50 border-indigo-200',   url: 'https://datalegal.fr',
    favicon: '/datalegal-favicon.png',      faviconFallback: '/datalegal-favicon.png',
  },
};

export const SOURCE_CONFIG: Record<SourceKey, {
  label: string; color: string; text: string; icon: string; favicon: string;
}> = {
  'trustpilot':      { label: 'Trustpilot',        color: '#00b67a', text: '#064e3b', icon: '⭐', favicon: 'https://www.google.com/s2/favicons?domain=trustpilot.com&sz=32' },
  'avis-verifies':   { label: 'Avis Vérifiés',     color: '#ff6900', text: '#9a3412', icon: '✅', favicon: 'https://www.google.com/s2/favicons?domain=avis-verifies.com&sz=32' },
  'signal-arnaques': { label: 'Signal Arnaques',   color: '#f59e0b', text: '#78350f', icon: '⚠️', favicon: 'https://www.google.com/s2/favicons?domain=signal-arnaques.com&sz=32' },
  '60millions':      { label: '60 Millions Conso', color: '#e11d48', text: '#9f1239', icon: '📰', favicon: 'https://www.google.com/s2/favicons?domain=60millions-mag.com&sz=32' },
  'scamdoc':         { label: 'ScamDoc',           color: '#7c3aed', text: '#4c1d95', icon: '🔍', favicon: 'https://www.google.com/s2/favicons?domain=scamdoc.com&sz=32' },
};

export const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string; dot: string }> = {
  todo:        { label: 'À traiter', color: 'text-red-700',     bg: 'bg-red-50 border-red-300',     dot: 'bg-red-500' },
  in_progress: { label: 'En cours',  color: 'text-amber-800',   bg: 'bg-amber-50 border-amber-300', dot: 'bg-amber-500' },
  resolved:    { label: 'Résolu',    color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-300', dot: 'bg-emerald-600' },
};
