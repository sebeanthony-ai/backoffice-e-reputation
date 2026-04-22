import { useState, useEffect, useCallback, useRef } from 'react';
import type { Review, ReviewStatus, SiteKey, SourceKey } from '../types';
import { SOURCE_CONFIG, STATUS_CONFIG } from '../types';
import { fetchReviews } from '../api';
import ReviewTable, { type ReviewTableSortField } from './ReviewTable';
import { Search, Filter, RefreshCw, Calendar, X, ChevronDown } from 'lucide-react';

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: "Aujourd'hui",      from: () => toISODate(startOfDay(new Date())), to: () => toISODate(new Date()) },
  { label: '7 derniers jours', from: () => { const d = startOfDay(new Date()); d.setDate(d.getDate()-6); return toISODate(d); }, to: () => toISODate(new Date()) },
  { label: '30 derniers jours',from: () => { const d = startOfDay(new Date()); d.setDate(d.getDate()-29); return toISODate(d); }, to: () => toISODate(new Date()) },
  { label: '3 derniers mois',  from: () => { const d = startOfDay(new Date()); d.setMonth(d.getMonth()-3); return toISODate(d); }, to: () => toISODate(new Date()) },
  { label: 'Cette année',      from: () => `${new Date().getFullYear()}-01-01`, to: () => toISODate(new Date()) },
  { label: 'Année précédente', from: () => `${new Date().getFullYear()-1}-01-01`, to: () => `${new Date().getFullYear()-1}-12-31` },
];

interface SiteReviewsProps {
  site: SiteKey | 'all';
  refreshTrigger?: number;
  // Focus optionnel déclenché par un clic sur une alerte : on pré-filtre la
  // liste sur la bonne source et on met en avant le premier avis (le plus
  // récemment scrapé) pour que l'utilisateur puisse le traiter directement.
  focus?: { source: SourceKey; count: number; nonce: number };
}

const SOURCES_BY_SITE: Record<string, SourceKey[]> = {
  all:             ['trustpilot', 'avis-verifies', 'signal-arnaques', '60millions', 'scamdoc'],
  infonet:         ['trustpilot', 'avis-verifies', 'signal-arnaques', '60millions'],
  postmee:         ['trustpilot', 'scamdoc'],
  startdoc:        ['trustpilot'],
  wenony:          ['trustpilot'],
  legaleo:         ['trustpilot'],
  lesentreprises:  ['trustpilot'],
  datalegal:       ['trustpilot'],
};

export default function SiteReviews({ site, refreshTrigger, focus }: SiteReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<SourceKey | ''>('');
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [activePreset, setActivePreset] = useState<string>('');
  const [showFilters, setShowFilters]   = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sortField, setSortField] = useState<ReviewTableSortField>('published_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Avis à mettre en évidence (expand + scroll + flash) après avoir cliqué
  // sur une alerte. Défini une fois la liste chargée.
  const [highlightReviewId, setHighlightReviewId] = useState<number | null>(null);
  // Flag levé par l'effet de `focus` et consommé par l'effet de load pour
  // éviter de mettre en avant un avis lors d'un reload indépendant.
  const pendingFocusRef = useRef(false);

  const availableSources = SOURCES_BY_SITE[site] || [];
  const hasDateFilter = !!(dateFrom || dateTo);
  const hasFilters = !!(statusFilter || sourceFilter || ratingFilter || search || hasDateFilter);

  const load = useCallback(async (p = 1, soft = false) => {
    if (soft) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchReviews({
        site: site === 'all' ? undefined : site,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        rating: ratingFilter || undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        page: p, limit: 100,
        sort_by: sortField,
        sort_dir: sortDir,
      });
      setReviews(data.reviews);
      setTotal(data.pagination.total);
      setPage(data.pagination.page);
      setPages(data.pagination.pages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [site, statusFilter, sourceFilter, ratingFilter, search, dateFrom, dateTo, sortField, sortDir]);

  useEffect(() => { load(1); }, [load, refreshTrigger]);

  // Clic sur une alerte : on aligne les filtres sur la source de l'alerte,
  // on passe en tri « dernier scrapé d'abord » et on ne garde que les avis
  // « À traiter », puis on lève un flag pour mettre le 1er résultat en avant.
  // On réagit au `nonce` (via un ref) pour pouvoir re-déclencher l'effet même
  // si l'utilisateur revient sur la même alerte/site.
  const lastFocusNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focus) return;
    if (lastFocusNonceRef.current === focus.nonce) return;
    lastFocusNonceRef.current = focus.nonce;
    pendingFocusRef.current = true;
    setSearch('');
    setRatingFilter('');
    setDateFrom(''); setDateTo(''); setActivePreset('');
    setSourceFilter(focus.source);
    setStatusFilter('todo');
    setSortField('created_at');
    setSortDir('desc');
    setShowFilters(true);
    // `load` sera relancé automatiquement via ses dépendances.
  }, [focus]);

  // Dès que le chargement correspondant au focus est terminé, on met en avant
  // le premier avis de la liste (le plus récemment scrapé pour cette source).
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    if (loading || refreshing) return;
    pendingFocusRef.current = false;
    if (reviews.length > 0) {
      setHighlightReviewId(reviews[0].id);
    } else {
      setHighlightReviewId(null);
    }
  }, [reviews, loading, refreshing]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(1); };

  const handleColumnSort = (field: ReviewTableSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'published_at' ? 'desc' : 'asc');
    }
  };
  const handleReviewUpdated = (review: Review) => {
    if (review.id === -1) { load(page); return; }
    setReviews(prev => prev.map(r => r.id === review.id ? review : r));
  };
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setDateFrom(preset.from()); setDateTo(preset.to());
    setActivePreset(preset.label); setShowDatePicker(false);
  };
  const clearDate = () => { setDateFrom(''); setDateTo(''); setActivePreset(''); };
  const clearFilters = () => { setStatusFilter(''); setSourceFilter(''); setRatingFilter(''); setSearch(''); clearDate(); };

  const dateBtnLabel = activePreset || (hasDateFilter ? `${dateFrom || '…'} → ${dateTo || '…'}` : 'Période');

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 sticky top-0 z-20 bg-white/95 backdrop-blur-sm py-3 -mt-3 -mx-1 px-1 rounded-2xl">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[240px] max-w-md">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher par auteur, contenu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] transition-all"
              />
          </div>
        </form>

        {/* Date picker button */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] ${
              hasDateFilter
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{dateBtnLabel}</span>
            {hasDateFilter
              ? <X className="w-3.5 h-3.5 ml-1 opacity-60 hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); clearDate(); }} />
              : <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-50" />
            }
          </button>

          {showDatePicker && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-slate-100 rounded-2xl shadow-xl p-5 w-[360px]">
              <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-widest">Raccourcis</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {PRESETS.map(p => (
                  <button
                    key={p.label} onClick={() => applyPreset(p)}
                    className={`px-3 py-2 rounded-lg text-xs text-left font-medium transition-all border ${
                      activePreset === p.label
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-widest">Période personnalisée</p>
              <div className="flex gap-3 items-center mb-5">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Du</label>
                  <input type="date" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
                  />
                </div>
                <span className="text-slate-300 text-sm mt-5">→</span>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Au</label>
                  <input type="date" value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button onClick={clearDate} className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors">
                  Effacer
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
                >
                  Appliquer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] ${
            statusFilter || sourceFilter || ratingFilter
              ? 'bg-indigo-50 text-indigo-700'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtres
          {(statusFilter || sourceFilter || ratingFilter) && (
            <span className="bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">!</span>
          )}
        </button>

        <button
          onClick={() => load(1, true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 transition-all shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
          Actualiser
        </button>

        <div className="text-sm font-medium text-slate-400 ml-auto">
          {loading && !refreshing ? 'Chargement...' : `${total} avis`}
        </div>
      </div>

      {/* Active date badge */}
      {hasDateFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-medium text-indigo-700 shadow-sm">
            <Calendar className="w-3.5 h-3.5 opacity-70" />
            {activePreset || `${dateFrom || '…'} → ${dateTo || '…'}`}
            <button onClick={clearDate} className="hover:text-red-500 transition-colors ml-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* ── Filters panel ───────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex flex-wrap gap-5 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-2 font-bold">Statut</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as ReviewStatus | '')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
              >
                <option value="">Tous les statuts</option>
                {(Object.entries(STATUS_CONFIG) as [ReviewStatus, typeof STATUS_CONFIG[ReviewStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-2 font-bold">Source</label>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as SourceKey | '')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
              >
                <option value="">Toutes les sources</option>
                {availableSources.map(src => (
                  <option key={src} value={src}>{SOURCE_CONFIG[src].label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-2 font-bold">Note</label>
              <select
                value={ratingFilter}
                onChange={e => setRatingFilter(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
              >
                <option value="">Toutes les notes</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{'★'.repeat(n)} ({n} étoile{n > 1 ? 's' : ''})</option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-all"
              >
                Tout effacer
              </button>
            )}
          </div>

          {/* Status quick filters */}
          <div className="flex gap-2.5 mt-5 flex-wrap pt-4 border-t border-slate-100">
            {(Object.entries(STATUS_CONFIG) as [ReviewStatus, typeof STATUS_CONFIG[ReviewStatus]][]).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${statusFilter === k ? `${v.bg} ${v.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 bg-white'}
                `}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      {loading && reviews.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">Chargement des avis…</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <ReviewTable
            reviews={reviews} total={total} page={page} pages={pages}
            onPageChange={(p) => { setPage(p); load(p); }}
            onReviewUpdated={handleReviewUpdated} site={site}
            sortField={sortField} sortDir={sortDir} onColumnSort={handleColumnSort}
            highlightReviewId={highlightReviewId}
            onHighlightConsumed={() => setHighlightReviewId(null)}
          />
        </div>
      )}

      {showDatePicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
      )}
    </div>
  );
}
