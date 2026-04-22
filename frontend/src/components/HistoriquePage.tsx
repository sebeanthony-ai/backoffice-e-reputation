import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Search, ExternalLink, ChevronLeft, ChevronRight,
  History, Users, CheckCircle2, Clock, XCircle, Filter,
  Upload, X, ZoomIn, Trash2, ImageIcon, FileQuestion,
  Star, Save,
} from 'lucide-react';
import { fetchSavedReviews, unsaveReviewFromHistorique, type SavedReview } from '../api';
import { HISTORIQUE_API_BASE, getBackofficeHeaders } from '../config';
import { SOURCE_CONFIG, STATUS_CONFIG } from '../types';

const API = HISTORIQUE_API_BASE;

// ── Config des sites ─────────────────────────────────────────────────────────
interface SiteConfig {
  key: string;
  label: string;
  csvPath: string | null;
  favicon: string;
  faviconFallback: string;
  color: string;
  // 'standard'        : STATUT,NOM,PRISE,DATE_SUPP,URL,PUBLI,MODIFIE,CTE,SIREN,DATE,PERIODE,JOUR,EMAIL,TEL,REMB,SUPPORT
  // '60millions'      : idem + PSEUDO en col 2, sans PERIODE
  // 'no-periode'      : standard sans PERIODE (col 10=JOUR directement)
  // 'datalegal'       : STATUT,PRISE,DATE_SUPP,URL,PUBLI,MODIFIE,CTE,DATE,PERIODE,JOUR,NOM,EMAIL,TEL,REMB,SUPPORT
  // 'signal-arnaques' : STATUT,PRISE,DATE_SUPP,URL,PUBLI,COMPTE,DATE,NOM,EMAIL,TEL,REMB,SUPPORT
  // 'startdoc'        : (vide),PRISE,DATE_SUPP,(vide),URL,PUBLI,SITE,DATE,PERIODE,JOUR,NOM,EMAIL,TEL,REMB,SUPPORT
  // 'url-toxiques'    : (vide),SITE,URL,COMMENTAIRES,DATE_CREATION,DUREE_JRS,ACTION1,ACTION2,ACTION3,ACTION4
  // 'traitements'     : STATUT,PLATEFORME,DATE,COMPTE,CONTACT,SOLUTION,CONFIRME
  // 'elptoo-avis'    : (3 lignes meta) STATUT,PRISE,SUPP,URL,PUBLI,SITE,COMPTE,DATE,NOM,EMAIL,TEL,REMB,SUPPORT
  csvFormat?: 'standard' | '60millions' | 'no-periode' | 'datalegal' | 'signal-arnaques' | 'startdoc' | 'url-toxiques' | 'traitements' | 'elptoo-avis';
}

const SITES: SiteConfig[] = [
  {
    key: 'infonet',
    label: 'Infonet — Avis',
    csvPath: '/historique-infonet.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=infonet.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=infonet.fr&sz=32',
    color: '#16A974',
    csvFormat: 'standard',
  },
  {
    key: 'lettreofficielle-toxiques',
    label: 'Lettre Officielle — URLs Toxiques',
    csvPath: '/historique-lettreofficielle-toxiques.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=lettre-officielle.com&sz=32',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=lettre-officielle.com&sz=32',
    color: '#ef4444',
    csvFormat: 'url-toxiques',
  },
  {
    key: 'traitements-risques',
    label: 'Traitements — Risques',
    csvPath: '/historique-traitements-risques.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=32',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=google.com&sz=32',
    color: '#6366f1',
    csvFormat: 'traitements',
  },
  {
    key: 'infonet-toxiques',
    label: 'Infonet — URLs Toxiques',
    csvPath: '/historique-infonet-toxiques.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=infonet.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=infonet.fr&sz=32',
    color: '#ef4444',
    csvFormat: 'url-toxiques',
  },
  {
    key: 'infonet-signal',
    label: 'Infonet — Signal Arnaques',
    csvPath: '/historique-infonet-signal-arnaques.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=signal-arnaques.com&sz=32',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=signal-arnaques.com&sz=32',
    color: '#f59e0b',
    csvFormat: 'signal-arnaques',
  },
  {
    key: 'infonet-60m',
    label: 'Infonet — 60 Millions',
    csvPath: '/historique-infonet-60millions.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=60millions-mag.com&sz=32',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=60millions-mag.com&sz=32',
    color: '#e63946',
    csvFormat: '60millions',
  },
  {
    key: 'datalegal',
    label: 'DataLegal',
    csvPath: '/historique-datalegal.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=datalegal.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=datalegal.fr&sz=32',
    color: '#0ea5e9',
    csvFormat: 'datalegal',
  },
  {
    key: 'postmee',
    label: 'Postmee',
    csvPath: '/historique-postmee.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=postmee.com&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=postmee.com&sz=32',
    color: '#8b5cf6',
    csvFormat: 'datalegal',
  },
  {
    key: 'startdoc-toxiques',
    label: 'Startdoc — URLs Toxiques',
    csvPath: '/historique-startdoc-toxiques.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=startdoc.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=startdoc.fr&sz=32',
    color: '#ef4444',
    csvFormat: 'url-toxiques',
  },
  {
    key: 'startdoc',
    label: 'Startdoc',
    csvPath: '/historique-startdoc.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=startdoc.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=startdoc.fr&sz=32',
    color: '#10b981',
    csvFormat: 'startdoc',
  },
  {
    key: 'wenony',
    label: 'Wenony',
    csvPath: '/historique-wenony.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=wenony.fr&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=wenony.fr&sz=32',
    color: '#f97316',
    csvFormat: 'datalegal',
  },
  {
    key: 'lesentreprises',
    label: 'LesEntreprises',
    csvPath: '/historique-lesentreprises.csv',
    favicon: 'https://www.google.com/s2/favicons?domain=lesentreprises.com&sz=64',
    faviconFallback: 'https://www.google.com/s2/favicons?domain=lesentreprises.com&sz=32',
    color: '#6366f1',
    csvFormat: 'no-periode',
  },
];

// ── Mapping (site du back office + source) → clé historique ────────────────
// Permet, lorsqu'on sauvegarde un avis depuis le back office, de l'afficher
// dans la bonne sous-catégorie de la page Historique.
const BO_TO_HIST_KEY: Record<string, Record<string, string>> = {
  infonet: {
    trustpilot:        'infonet',
    'avis-verifies':   'infonet',
    '60millions':      'infonet-60m',
    'signal-arnaques': 'infonet-signal',
  },
  postmee:        { trustpilot: 'postmee', scamdoc: 'postmee' },
  startdoc:       { trustpilot: 'startdoc' },
  wenony:         { trustpilot: 'wenony' },
  lesentreprises: { trustpilot: 'lesentreprises' },
  datalegal:      { trustpilot: 'datalegal' },
  legaleo:        { trustpilot: 'legaleo' },
};

function mapReviewToHistKey(site: string, source: string): string {
  return BO_TO_HIST_KEY[site]?.[source] ?? site;
}

// ── Détection plateforme d'avis ──────────────────────────────────────────────
interface ReviewPlatform { name: string; favicon: string; }

const PLATFORMS: { match: (url: string) => boolean; info: ReviewPlatform }[] = [
  { match: u => u.includes('trustpilot.com'),
    info: { name: 'Trustpilot', favicon: 'https://www.google.com/s2/favicons?domain=trustpilot.com&sz=32' } },
  { match: u => u.includes('avis-verifies.com') || u.includes('netreviews.eu'),
    info: { name: 'Avis Vérifiés', favicon: 'https://www.google.com/s2/favicons?domain=avis-verifies.com&sz=32' } },
  { match: u => u.includes('60millions-mag.com'),
    info: { name: '60 Millions', favicon: 'https://www.google.com/s2/favicons?domain=60millions-mag.com&sz=32' } },
  { match: u => u.includes('signal-arnaques.com'),
    info: { name: 'Signal Arnaques', favicon: 'https://www.google.com/s2/favicons?domain=signal-arnaques.com&sz=32' } },
  { match: u => u.includes('google.com') || u.includes('maps.google'),
    info: { name: 'Google', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=32' } },
];

function detectPlatform(url: string): ReviewPlatform | null {
  if (!url) return null;
  const found = PLATFORMS.find(p => p.match(url));
  if (found) return found.info;
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return { name: domain, favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32` };
  } catch { return null; }
}

function PlatformLogo({ url }: { url: string }) {
  const platform = detectPlatform(url);
  const [failed, setFailed] = useState(false);
  if (!platform || failed) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5" title={platform.name}>
      <img src={platform.favicon} alt={platform.name} width={16} height={16}
        className="rounded-sm flex-shrink-0" onError={() => setFailed(true)} />
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap hidden xl:block">{platform.name}</span>
    </div>
  );
}

// ── Modal plein écran ────────────────────────────────────────────────────────
function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt="Capture d'écran"
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ── Cellule captures ─────────────────────────────────────────────────────────
function ScreenshotCell({ reviewUrl, screenshots, onUpload, onDelete }: {
  reviewUrl: string;
  screenshots: string[];
  onUpload: (url: string, file: File) => Promise<void>;
  onDelete: (url: string, filename: string) => Promise<void>;
}) {
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        await onUpload(reviewUrl, file);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setUploading(false);
    }
  }, [reviewUrl, onUpload]);

  const runDelete = useCallback(async (filename: string) => {
    setUploadError(null);
    try {
      await onDelete(reviewUrl, filename);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  }, [reviewUrl, onDelete]);

  return (
    <td className="px-3 py-2 align-top max-w-[140px]">
      <div className="flex flex-wrap gap-1.5 items-center">
        {screenshots.map(filename => (
          <div key={filename} className="relative group">
            <img src={`${API}/files/${filename}`} alt="capture"
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setModalSrc(`${API}/files/${filename}`)} />
            <button type="button" onClick={() => runDelete(filename)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white hidden group-hover:flex items-center justify-center hover:bg-red-600 transition-colors">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
            <button onClick={() => setModalSrc(`${API}/files/${filename}`)}
              className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-black/40 rounded text-white hidden group-hover:flex items-center justify-center">
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {reviewUrl && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {uploading
              ? <div className="w-3 h-3 border border-slate-400 border-t-slate-700 rounded-full animate-spin" />
              : <Upload className="w-3.5 h-3.5 text-slate-400" />}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </div>
      {uploadError && (
        <p className="text-[10px] text-red-600 font-medium mt-1 leading-tight" title={uploadError}>
          {uploadError}
        </p>
      )}
      {modalSrc && <ImageModal src={modalSrc} onClose={() => setModalSrc(null)} />}
    </td>
  );
}

// ── Types CSV ────────────────────────────────────────────────────────────────
interface AvisRow {
  statut: string; nom: string; priseDeContact: string; dateSuppression: string;
  urlAvis: string; publication: string; avisModifie: string; cteClient: string;
  sirenSiret: string; dateAvis: string; periode: string; jourSemaine: string;
  email: string; telephone: string; remboursement: string; supportClient: string;
}

const PAGE_SIZE = 50;

function statutBadge(statut: string) {
  if (!(statut || '').trim())
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">—</span>;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 truncate max-w-[120px] block">
      {statut.trim()}
    </span>
  );
}

function cleanText(s: string) { return (s || '').replace(/\n/g, ' ').trim(); }

// ── Affichage Traitements Risques ────────────────────────────────────────────
interface TraitementRow {
  statut: string; plateforme: string; date: string;
  compte: string; contact: string; solution: string; confirme: string;
}

const SITE_FAVICONS: Record<string, string> = {
  infonet:       'https://www.google.com/s2/favicons?domain=infonet.fr&sz=64',
  startdoc:      'https://www.google.com/s2/favicons?domain=startdoc.fr&sz=64',
  postmee:       'https://www.google.com/s2/favicons?domain=postmee.com&sz=64',
  wenony:        'https://www.google.com/s2/favicons?domain=wenony.fr&sz=64',
  datalegal:     'https://www.google.com/s2/favicons?domain=datalegal.fr&sz=64',
  lesentreprises:'https://www.google.com/s2/favicons?domain=lesentreprises.com&sz=64',
  legaleo:       'https://www.google.com/s2/favicons?domain=legaleo.fr&sz=64',
};

function SiteLogo({ name }: { name: string }) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  const src = Object.entries(SITE_FAVICONS).find(([k]) => key.includes(k))?.[1]
    ?? `https://www.google.com/s2/favicons?domain=${name.toLowerCase()}.fr&sz=32`;
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-[11px] font-semibold text-slate-600 capitalize">{name}</span>;
  return (
    <div className="flex items-center gap-1.5">
      <img src={src} alt={name} width={14} height={14} className="rounded-sm flex-shrink-0" onError={() => setFailed(true)} />
      <span className="text-xs font-medium text-slate-600 capitalize">{name}</span>
    </div>
  );
}

function TraitementsRisques({ csvPath }: { csvPath: string }) {
  const [rows, setRows] = useState<TraitementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState('');

  useEffect(() => {
    fetch(csvPath).then(r => r.text()).then(csv => {
      const data = (Papa.parse<string[]>(csv, { skipEmptyLines: false }).data) as string[][];
      setRows(
        data.slice(1)
          .filter(r => r.length >= 3 && (r[1] || '').trim())
          .map(r => ({
            statut:     (r[0] || '').trim(),
            plateforme: cleanText(r[1] || ''),
            date:       cleanText(r[2] || ''),
            compte:     (r[3] || '').trim(),
            contact:    cleanText(r[4] || ''),
            solution:   cleanText(r[5] || ''),
            confirme:   cleanText(r[6] || ''),
          }))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [csvPath]);

  const sites = useMemo(() => Array.from(new Set(rows.map(r => r.plateforme).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q || [r.plateforme, r.contact, r.solution, r.confirme].some(v => v.toLowerCase().includes(q));
      return matchSearch && (!filterSite || r.plateforme === filterSite);
    });
  }, [rows, search, filterSite]);

  const withSolution  = rows.filter(r => r.solution).length;
  const confirmed     = rows.filter(r => r.confirme).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
      <span className="ml-3 text-slate-500 text-sm">Chargement…</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total traitements', value: rows.length,    color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',     icon: <Users className="w-4 h-4" /> },
          { label: 'Solution trouvée',  value: withSolution,   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Confirmés',         value: confirmed,      color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       icon: <Clock className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.bg}`}>
            <div className={s.color}>{s.icon}</div>
            <div>
              <p className="text-xl font-extrabold text-slate-900 leading-none">{s.value.toLocaleString('fr-FR')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher contact, solution…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="">Tous les sites</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="text-xs text-slate-400 -mb-2">{filtered.length.toLocaleString('fr-FR')} traitement{filtered.length > 1 ? 's' : ''}</div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Statut', 'Site', 'Date', 'Compte', 'Contacté depuis', 'Solution', 'Confirmé par'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} className="text-center py-16 text-slate-400 text-sm">Aucun résultat</td></tr>
                : filtered.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 align-top">{statutBadge(row.statut)}</td>
                    <td className="px-4 py-3 align-top"><SiteLogo name={row.plateforme} /></td>
                    <td className="px-4 py-3 align-top text-slate-600 text-xs whitespace-nowrap">{row.date || '—'}</td>
                    <td className="px-4 py-3 align-top">
                      {row.compte
                        ? <a href={row.compte} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" title={row.compte}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500 text-xs max-w-[160px] truncate">{row.contact || '—'}</td>
                    <td className="px-4 py-3 align-top max-w-[180px]">
                      {row.solution
                        ? <span className="text-emerald-700 font-medium text-xs">{row.solution}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500 text-xs whitespace-nowrap">{row.confirme || '—'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Affichage URLs Toxiques ──────────────────────────────────────────────────
interface ToxicRow {
  site: string; url: string; commentaires: string;
  dateCreation: string; dureeJrs: string;
  action1: string; action2: string; action3: string; action4: string;
}

function UrlsToxiques({ csvPath }: { csvPath: string }) {
  const [rows, setRows] = useState<ToxicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(csvPath)
      .then(r => r.text())
      .then(csv => {
        const data = (Papa.parse<string[]>(csv, { skipEmptyLines: false }).data) as string[][];
        // Détecte la ligne d'en-tête et l'offset de colonne dynamiquement
        const headerIdx = data.findIndex(r => r.some(c => (c || '').trim().toLowerCase() === 'site'));
        const headerRow = headerIdx >= 0 ? data[headerIdx] : [];
        const siteCol = headerRow.findIndex(c => (c || '').trim().toLowerCase() === 'site');
        const offset = siteCol >= 0 ? siteCol : 1;
        const dataRows = headerIdx >= 0 ? data.slice(headerIdx + 1) : data.slice(5);
        setRows(
          dataRows
            .filter(r => r.length >= offset + 2 && (r[offset + 1] || '').trim().startsWith('http'))
            .map(r => ({
              site: cleanText(r[offset] || ''),
              url: (r[offset + 1] || '').trim(),
              commentaires: cleanText(r[offset + 2] || ''),
              dateCreation: cleanText(r[offset + 3] || ''),
              dureeJrs: cleanText(r[offset + 4] || ''),
              action1: cleanText(r[offset + 5] || ''),
              action2: cleanText(r[offset + 6] || ''),
              action3: cleanText(r[offset + 7] || ''),
              action4: cleanText(r[offset + 8] || ''),
            }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [csvPath]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? rows : rows.filter(r =>
      [r.site, r.url, r.action1, r.action2, r.action3, r.action4].some(v => v.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const resolved  = rows.filter(r => [r.action1, r.action2, r.action3, r.action4].some(a => a.toLowerCase().includes('juridique') || a.toLowerCase().includes('disparition')));
  const inProcess = rows.filter(r => r.dureeJrs && parseInt(r.dureeJrs) > 0);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-slate-200 border-t-red-400 rounded-full animate-spin" />
      <span className="ml-3 text-slate-500 text-sm">Chargement…</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'URLs toxiques',     value: rows.length,     color: 'text-red-600',     bg: 'bg-red-50 border-red-200',     icon: <XCircle className="w-4 h-4" /> },
          { label: 'Actions juridiques', value: resolved.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Encore actives',     value: inProcess.length, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',  icon: <Clock className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.bg}`}>
            <div className={s.color}>{s.icon}</div>
            <div>
              <p className="text-xl font-extrabold text-slate-900 leading-none">{s.value.toLocaleString('fr-FR')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Rechercher une URL, un site, une action…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>

      <div className="text-xs text-slate-400 -mb-2">{filtered.length.toLocaleString('fr-FR')} URL{filtered.length > 1 ? 's' : ''}</div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Plateforme', 'URL', 'Commentaires', 'Date création', 'Durée (j)', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400 text-sm">Aucun résultat</td></tr>
              ) : filtered.map((row, i) => {
                const actions = [row.action1, row.action2, row.action3, row.action4].filter(Boolean);
                const isResolved = actions.some(a => a.toLowerCase().includes('juridique') || a.toLowerCase().includes('disparition'));
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <PlatformLogo url={row.url} />
                    </td>
                    <td className="px-4 py-3 align-top max-w-[220px]">
                      <a href={row.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 group truncate">
                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-slate-400 group-hover:text-slate-700" />
                        <span className="truncate">{row.url.replace(/https?:\/\/(www\.)?/, '')}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                      {row.commentaires
                        ? <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${parseInt(row.commentaires) > 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{row.commentaires}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500 text-xs whitespace-nowrap">{row.dateCreation || '—'}</td>
                    <td className="px-4 py-3 align-top text-center">
                      {row.dureeJrs
                        ? <span className={`text-xs font-semibold ${parseInt(row.dureeJrs) > 365 ? 'text-red-500' : 'text-slate-600'}`}>{row.dureeJrs}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top max-w-[280px]">
                      {actions.length === 0
                        ? <span className="text-slate-300 text-xs">—</span>
                        : <div className="space-y-1">
                            {actions.map((a, j) => (
                              <p key={j} className={`text-xs leading-snug ${isResolved && j === actions.length - 1 ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                                {a}
                              </p>
                            ))}
                          </div>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Avis sauvegardés depuis le back office ─────────────────────────────────
function SavedReviewsSection({
  saved, siteColor, onUnsave,
}: {
  saved: SavedReview[];
  siteColor: string;
  onUnsave: (id: number) => void | Promise<void>;
}) {
  if (saved.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Save className="w-4 h-4" style={{ color: siteColor }} />
          <span className="text-[13px] font-bold text-slate-800">Avis sauvegardés depuis le back office</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
            {saved.length}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Cliquez sur « Retirer » pour décrocher l'avis de l'historique</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              {['Sauvegardé le', 'Source', 'Auteur', 'Note', 'Date avis', 'Avis', 'Statut', 'Lien', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saved.map(entry => {
              const r = entry.review;
              const src = SOURCE_CONFIG[r.source as keyof typeof SOURCE_CONFIG];
              const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
              const savedDate = new Date(entry.savedAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
              });
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors align-top">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{savedDate}</td>
                  <td className="px-4 py-3">
                    {src ? (
                      <span
                        className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ color: src.color, borderColor: `${src.color}40`, background: `${src.color}10` }}
                      >
                        {src.label}
                      </span>
                    ) : <span className="text-slate-400 text-xs">{r.source}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap max-w-[160px] truncate">{r.author || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                        />
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{r.published_at || '—'}</td>
                  <td className="px-4 py-3 max-w-[320px]">
                    {r.title && <p className="text-slate-800 text-xs font-semibold mb-0.5 truncate">{r.title}</p>}
                    <p className="text-slate-500 text-xs line-clamp-2">{r.content}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {status ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.bg} ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.review_url
                      ? <a href={r.review_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onUnsave(r.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Retirer de l'historique"
                    >
                      <Trash2 className="w-3 h-3" />
                      Retirer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Table d'un site ──────────────────────────────────────────────────────────
function SiteHistorique({ site, screenshotsIndex, onUpload, onDelete, savedForSite, onUnsave }: {
  site: SiteConfig;
  screenshotsIndex: Record<string, string[]>;
  onUpload: (url: string, file: File) => Promise<void>;
  onDelete: (url: string, filename: string) => Promise<void>;
  savedForSite: SavedReview[];
  onUnsave: (id: number) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<AvisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPeriode, setFilterPeriode] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setRows([]); setLoading(true); setNotFound(false);
    setSearch(''); setFilterStatut(''); setFilterPeriode(''); setPage(1);

    if (!site.csvPath) { setLoading(false); setNotFound(true); return; }
    if (site.csvFormat === 'url-toxiques' || site.csvFormat === 'traitements') { setLoading(false); return; }

    fetch(site.csvPath)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.text(); })
      .then(csv => {
        const data = (Papa.parse<string[]>(csv, { skipEmptyLines: false }).data) as string[][];
        const fmt = site.csvFormat ?? 'standard';
        // elptoo-avis: 3 lignes de méta avant l'en-tête → données à partir de la ligne 4
        const startRow = fmt === 'elptoo-avis' ? 4 : 1;
        setRows(
          data.slice(startRow)
            .filter(row => row.length >= 2 && (row[fmt === 'elptoo-avis' ? 0 : 1] || '').trim())
            .map(row => {
              if (fmt === '60millions') {
                // 0:STATUT 1:NOM 2:PSEUDO 3:PRISE 4:SUPP 5:URL 6:PUBLI 7:MODIF 8:CTE 9:SIREN 10:DATE 11:JOUR 12:EMAIL 13:TEL 14:REMB 15:SUPPORT
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[1] || ''),
                  priseDeContact: cleanText(row[3] || ''), dateSuppression: cleanText(row[4] || ''),
                  urlAvis: (row[5] || '').trim(), publication: cleanText(row[6] || ''),
                  avisModifie: cleanText(row[7] || ''), cteClient: cleanText(row[8] || ''),
                  sirenSiret: cleanText(row[9] || ''), dateAvis: cleanText(row[10] || ''),
                  periode: '', jourSemaine: cleanText(row[11] || ''),
                  email: cleanText(row[12] || ''), telephone: cleanText(row[13] || ''),
                  remboursement: cleanText(row[14] || ''), supportClient: cleanText(row[15] || ''),
                };
              }
              if (fmt === 'startdoc') {
                // 0:(vide) 1:PRISE 2:SUPP 3:(vide) 4:URL 5:PUBLI 6:SITE 7:DATE 8:PERIODE 9:JOUR 10:NOM 11:EMAIL 12:TEL 13:REMB 14:SUPPORT
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[10] || ''),
                  priseDeContact: cleanText(row[1] || ''), dateSuppression: cleanText(row[2] || ''),
                  urlAvis: (row[4] || '').trim(), publication: cleanText(row[5] || ''),
                  avisModifie: '', cteClient: cleanText(row[6] || ''),
                  sirenSiret: '', dateAvis: cleanText(row[7] || ''),
                  periode: cleanText(row[8] || ''), jourSemaine: cleanText(row[9] || ''),
                  email: cleanText(row[11] || ''), telephone: cleanText(row[12] || ''),
                  remboursement: cleanText(row[13] || ''), supportClient: cleanText(row[14] || ''),
                };
              }
              if (fmt === 'signal-arnaques') {
                // 0:STATUT 1:PRISE 2:SUPP 3:URL 4:PUBLI 5:COMPTE 6:DATE 7:NOM 8:EMAIL 9:TEL 10:REMB 11:SUPPORT
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[7] || ''),
                  priseDeContact: cleanText(row[1] || ''), dateSuppression: cleanText(row[2] || ''),
                  urlAvis: (row[3] || '').trim(), publication: cleanText(row[4] || ''),
                  avisModifie: '', cteClient: cleanText(row[5] || ''),
                  sirenSiret: '', dateAvis: cleanText(row[6] || ''),
                  periode: '', jourSemaine: '',
                  email: cleanText(row[8] || ''), telephone: cleanText(row[9] || ''),
                  remboursement: cleanText(row[10] || ''), supportClient: cleanText(row[11] || ''),
                };
              }
              if (fmt === 'datalegal') {
                // 0:STATUT 1:PRISE 2:SUPP 3:URL 4:PUBLI 5:MODIF 6:CTE 7:DATE 8:PERIODE 9:JOUR 10:NOM 11:EMAIL 12:TEL 13:REMB 14:SUPPORT
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[10] || ''),
                  priseDeContact: cleanText(row[1] || ''), dateSuppression: cleanText(row[2] || ''),
                  urlAvis: (row[3] || '').trim(), publication: cleanText(row[4] || ''),
                  avisModifie: cleanText(row[5] || ''), cteClient: cleanText(row[6] || ''),
                  sirenSiret: '', dateAvis: cleanText(row[7] || ''),
                  periode: cleanText(row[8] || ''), jourSemaine: cleanText(row[9] || ''),
                  email: cleanText(row[11] || ''), telephone: cleanText(row[12] || ''),
                  remboursement: cleanText(row[13] || ''), supportClient: cleanText(row[14] || ''),
                };
              }
              if (fmt === 'no-periode') {
                // 0:STATUT 1:NOM 2:PRISE 3:SUPP 4:URL 5:PUBLI 6:MODIF 7:CTE 8:SIREN 9:DATE 10:JOUR 11:EMAIL 12:TEL 13:REMB 14:ORIGINE
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[1] || ''),
                  priseDeContact: cleanText(row[2] || ''), dateSuppression: cleanText(row[3] || ''),
                  urlAvis: (row[4] || '').trim(), publication: cleanText(row[5] || ''),
                  avisModifie: cleanText(row[6] || ''), cteClient: cleanText(row[7] || ''),
                  sirenSiret: cleanText(row[8] || ''), dateAvis: cleanText(row[9] || ''),
                  periode: '', jourSemaine: cleanText(row[10] || ''),
                  email: cleanText(row[11] || ''), telephone: cleanText(row[12] || ''),
                  remboursement: cleanText(row[13] || ''), supportClient: cleanText(row[14] || ''),
                };
              }
              if (fmt === 'elptoo-avis') {
                // 0:STATUT 1:PRISE 2:SUPP 3:URL 4:PUBLI 5:SITE 6:COMPTE 7:DATE 8:NOM 9:EMAIL 10:TEL 11:REMB 12:SUPPORT
                return {
                  statut: (row[0] || '').trim(), nom: cleanText(row[8] || ''),
                  priseDeContact: cleanText(row[1] || ''), dateSuppression: cleanText(row[2] || ''),
                  urlAvis: (row[3] || '').trim(), publication: cleanText(row[4] || ''),
                  avisModifie: '', cteClient: cleanText(row[6] || ''),
                  sirenSiret: cleanText(row[5] || ''), dateAvis: cleanText(row[7] || ''),
                  periode: '', jourSemaine: '',
                  email: cleanText(row[9] || ''), telephone: cleanText(row[10] || ''),
                  remboursement: cleanText(row[11] || ''), supportClient: cleanText(row[12] || ''),
                };
              }
              // Format standard
              return {
                statut: (row[0] || '').trim(), nom: cleanText(row[1] || ''),
                priseDeContact: cleanText(row[2] || ''), dateSuppression: cleanText(row[3] || ''),
                urlAvis: (row[4] || '').trim(), publication: cleanText(row[5] || ''),
                avisModifie: cleanText(row[6] || ''), cteClient: cleanText(row[7] || ''),
                sirenSiret: cleanText(row[8] || ''), dateAvis: cleanText(row[9] || ''),
                periode: cleanText(row[10] || ''), jourSemaine: cleanText(row[11] || ''),
                email: cleanText(row[12] || ''), telephone: cleanText(row[13] || ''),
                remboursement: cleanText(row[14] || ''), supportClient: cleanText(row[15] || ''),
              };
            })
        );
        setLoading(false);
      })
      .catch(() => { setLoading(false); setNotFound(true); });
  }, [site]);

  const statuts  = useMemo(() => Array.from(new Set(rows.map(r => r.statut).filter(Boolean))).sort(), [rows]);
  const periodes = useMemo(() => Array.from(new Set(rows.map(r => r.periode).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q || [r.nom, r.email, r.telephone, r.dateAvis, r.urlAvis].some(v => v.toLowerCase().includes(q));
      return matchSearch && (!filterStatut || r.statut === filterStatut) && (!filterPeriode || r.periode === filterPeriode);
    });
  }, [rows, search, filterStatut, filterPeriode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const total     = rows.length;
  const deleted   = rows.filter(r => r.dateSuppression && r.dateSuppression !== '—').length;
  const modified  = rows.filter(r => r.avisModifie && r.avisModifie !== '—').length;
  const noContact = rows.filter(r => !r.dateSuppression && !r.avisModifie).length;
  const withScreenshots = Object.keys(screenshotsIndex).length;

  // Section « avis sauvegardés » à afficher en tête de toutes les variantes.
  const savedSection = (
    <SavedReviewsSection saved={savedForSite} siteColor={site.color} onUnsave={onUnsave} />
  );

  // Placeholder si CSV pas encore dispo
  if (site.csvFormat === 'url-toxiques' && site.csvPath) return (
    <div className="space-y-5">
      {savedSection}
      <UrlsToxiques csvPath={site.csvPath} />
    </div>
  );
  if (site.csvFormat === 'traitements' && site.csvPath) return (
    <div className="space-y-5">
      {savedSection}
      <TraitementsRisques csvPath={site.csvPath} />
    </div>
  );

  if (notFound) return (
    <div className="space-y-5">
      {savedSection}
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <FileQuestion className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600 font-semibold mb-1">CSV non disponible pour {site.label}</p>
        <p className="text-slate-400 text-sm">Envoie le fichier dans le chat pour l'intégrer.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="space-y-5">
      {savedSection}
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        <span className="ml-3 text-slate-500 text-sm">Chargement…</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {savedSection}
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total avis',    value: total,           icon: <Users className="w-4 h-4" />,        color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
          { label: 'Supprimés',     value: deleted,         icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Modifiés',      value: modified,        icon: <Clock className="w-4 h-4" />,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
          { label: 'Sans issue',    value: noContact,       icon: <XCircle className="w-4 h-4" />,      color: 'text-red-500',     bg: 'bg-red-50 border-red-200' },
          { label: 'Avec captures', value: withScreenshots, icon: <ImageIcon className="w-4 h-4" />,    color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.bg}`}>
            <div className={s.color}>{s.icon}</div>
            <div>
              <p className="text-xl font-extrabold text-slate-900 leading-none">{s.value.toLocaleString('fr-FR')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher un client, email, téléphone…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 appearance-none">
            <option value="">Tous les statuts</option>
            {statuts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <select value={filterPeriode} onChange={e => { setFilterPeriode(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="">Toutes les périodes</option>
          {periodes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="text-xs text-slate-400 -mb-2">
        {filtered.length.toLocaleString('fr-FR')} résultat{filtered.length > 1 ? 's' : ''} · page {page}/{totalPages}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Captures', 'Plateforme', 'Statut', 'Client', 'Date avis', 'Période', 'Prise de contact', 'Suppression', 'Avis modifié', 'Lien', 'Email', 'Téléphone'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-slate-400 text-sm">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun résultat
                  </td>
                </tr>
              ) : paginated.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <ScreenshotCell reviewUrl={row.urlAvis} screenshots={screenshotsIndex[row.urlAvis] || []} onUpload={onUpload} onDelete={onDelete} />
                  <td className="px-4 py-3 align-top"><PlatformLogo url={row.urlAvis} /></td>
                  <td className="px-4 py-3 align-top">{statutBadge(row.statut)}</td>
                  <td className="px-4 py-3 align-top font-medium text-slate-900 whitespace-nowrap max-w-[160px] truncate">{row.nom || '—'}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">{row.dateAvis || '—'}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-500 text-xs">{row.periode || '—'}</td>
                  <td className="px-4 py-3 align-top max-w-[200px]">
                    <span className="text-slate-600 text-xs line-clamp-2">{row.priseDeContact || '—'}</span>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    {row.dateSuppression ? <span className="text-emerald-600 font-medium text-xs">{row.dateSuppression}</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top max-w-[160px]">
                    {row.avisModifie ? <span className="text-amber-600 text-xs line-clamp-1">{row.avisModifie}</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {row.urlAvis
                      ? <a href={row.urlAvis} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-500 text-xs max-w-[160px] truncate">{row.email || '—'}</td>
                  <td className="px-4 py-3 align-top text-slate-500 text-xs whitespace-nowrap">{row.telephone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <span className="text-xs text-slate-400">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length.toLocaleString('fr-FR')}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + idx;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Groupes de navigation ─────────────────────────────────────────────────────
interface NavGroup {
  brand: string;
  faviconKey: string; // clé du site dans SITES pour le favicon du groupe
  items: { key: string; sublabel: string | null }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    brand: 'Infonet',
    faviconKey: 'infonet',
    items: [
      { key: 'infonet',         sublabel: 'Avis' },
      { key: 'infonet-60m',     sublabel: '60 Millions' },
      { key: 'infonet-signal',  sublabel: 'Signal Arnaques' },
      { key: 'infonet-toxiques',sublabel: 'URLs Toxiques' },
    ],
  },
  {
    brand: 'DataLegal',
    faviconKey: 'datalegal',
    items: [{ key: 'datalegal', sublabel: null }],
  },
  {
    brand: 'Postmee',
    faviconKey: 'postmee',
    items: [{ key: 'postmee', sublabel: null }],
  },
  {
    brand: 'Startdoc',
    faviconKey: 'startdoc',
    items: [
      { key: 'startdoc',          sublabel: 'Avis' },
      { key: 'startdoc-toxiques', sublabel: 'URLs Toxiques' },
    ],
  },
  {
    brand: 'Wenony',
    faviconKey: 'wenony',
    items: [{ key: 'wenony', sublabel: null }],
  },
  {
    brand: 'LesEntreprises',
    faviconKey: 'lesentreprises',
    items: [{ key: 'lesentreprises', sublabel: null }],
  },
  {
    brand: 'Lettre Officielle',
    faviconKey: 'lettreofficielle-toxiques',
    items: [{ key: 'lettreofficielle-toxiques', sublabel: 'URLs Toxiques' }],
  },
  {
    brand: 'Traitements',
    faviconKey: 'traitements-risques',
    items: [{ key: 'traitements-risques', sublabel: 'Risques d\'avis' }],
  },
];

// ── Page principale ───────────────────────────────────────────────────────────
export default function HistoriquePage() {
  const [activeKey, setActiveKey] = useState('infonet');
  const [screenshotsIndex, setScreenshotsIndex] = useState<Record<string, string[]>>({});
  const [faviconErrors, setFaviconErrors] = useState<Record<string, boolean>>({});
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>([]);

  const activeSite = SITES.find(s => s.key === activeKey) ?? SITES[0];

  const loadScreenshots = useCallback(() => {
    fetch(`${API}/screenshots`, { headers: getBackofficeHeaders() })
      .then(r => r.json()).then(setScreenshotsIndex).catch(() => {});
  }, []);
  useEffect(() => { loadScreenshots(); }, [loadScreenshots]);

  const loadSavedReviews = useCallback(() => {
    fetchSavedReviews().then(setSavedReviews).catch(() => {});
  }, []);
  useEffect(() => { loadSavedReviews(); }, [loadSavedReviews]);

  const handleUnsave = useCallback(async (id: number) => {
    await unsaveReviewFromHistorique(id);
    setSavedReviews(prev => prev.filter(r => r.review.id !== id));
  }, []);

  // Regroupe les avis sauvegardés par clé historique (site × source → key).
  const savedByHistKey = useMemo(() => {
    const map: Record<string, SavedReview[]> = {};
    for (const entry of savedReviews) {
      const key = mapReviewToHistKey(entry.review.site, entry.review.source);
      (map[key] ||= []).push(entry);
    }
    // Tri : sauvegardés les plus récents en haut.
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    }
    return map;
  }, [savedReviews]);

  const handleUpload = useCallback(async (reviewUrl: string, file: File) => {
    const fd = new FormData();
    fd.append('reviewUrl', reviewUrl);
    fd.append('screenshot', file);
    const r = await fetch(`${API}/screenshots`, { method: 'POST', body: fd, headers: getBackofficeHeaders() });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(data.error || `Échec envoi (${r.status})`);
    await loadScreenshots();
  }, [loadScreenshots]);

  const handleDelete = useCallback(async (reviewUrl: string, filename: string) => {
    const r = await fetch(`${API}/screenshots`, {
      method: 'DELETE',
      headers: getBackofficeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reviewUrl, filename }),
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(data.error || `Échec suppression (${r.status})`);
    await loadScreenshots();
  }, [loadScreenshots]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">Historique</h1>
        <p className="text-slate-500 text-sm">Suivi e-réputation par site</p>
      </div>

      {/* Sous-onglets sites — segmented control scrollable */}
      <div className="overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-1 bg-slate-100/70 rounded-2xl p-1 min-w-max">
          {SITES.map(site => {
            const isActive = site.key === activeKey;
            const savedCount = (savedByHistKey[site.key] || []).length;
            return (
              <button
                key={site.key}
                onClick={() => setActiveKey(site.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <img
                  src={faviconErrors[site.key] ? site.faviconFallback : site.favicon}
                  alt=""
                  width={15}
                  height={15}
                  className="rounded-sm object-contain flex-shrink-0"
                  onError={() => setFaviconErrors(prev => ({ ...prev, [site.key]: true }))}
                />
                {site.label}
                {savedCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-indigo-500 text-white"
                    title={`${savedCount} avis sauvegardé${savedCount > 1 ? 's' : ''} depuis le back office`}
                  >
                    {savedCount}
                  </span>
                )}
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: site.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <SiteHistorique
        key={activeKey}
        site={activeSite}
        screenshotsIndex={screenshotsIndex}
        savedForSite={savedByHistKey[activeKey] || []}
        onUnsave={handleUnsave}
        onUpload={handleUpload}
        onDelete={handleDelete}
      />
    </div>
  );
}
