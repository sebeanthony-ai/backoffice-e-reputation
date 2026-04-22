import React, { useState, useRef, useEffect } from 'react';
import type { Review, ReviewStatus, SiteKey } from '../types';
import { STATUS_CONFIG, SITE_CONFIG } from '../types';
import { updateReview, bulkUpdateStatus, fetchSavedReviews, saveReviewToHistorique, unsaveReviewFromHistorique } from '../api';
import StarRating from './StarRating';
import StatusBadge from './StatusBadge';
import SourceBadge from './SourceBadge';
import ResponseSection from './ResponseSection';
import AgentSelector from './AgentSelector';
import TimelineSection from './TimelineSection';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Edit3, Check, X, Eye, ExternalLink, Save, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface ReviewTableProps {
  reviews: Review[]; total: number; page: number; pages: number;
  onPageChange: (page: number) => void; onReviewUpdated: (review: Review) => void;
  site?: SiteKey | 'all';
  // Identifiant d'un avis à mettre en avant (expand + scroll + flash) au
  // prochain rendu, typiquement après un clic sur une alerte.
  highlightReviewId?: number | null;
  onHighlightConsumed?: () => void;
}

export type ReviewTableSortField = 'published_at' | 'created_at' | 'rating' | 'author' | 'status' | 'source';

interface ReviewTableSortProps {
  sortField: ReviewTableSortField;
  sortDir: 'asc' | 'desc';
  onColumnSort: (field: ReviewTableSortField) => void;
}

export default function ReviewTable({
  reviews, total, page, pages, onPageChange, onReviewUpdated,
  sortField, sortDir, onColumnSort,
  highlightReviewId, onHighlightConsumed,
}: ReviewTableProps & ReviewTableSortProps) {
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ReviewStatus>('todo');
  // Avis actuellement « flashé » (halo temporaire) après un clic sur une alerte.
  const [flashId, setFlashId] = useState<number | null>(null);
  // IDs des avis déjà épinglés dans la page Historique.
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  // ID de l'avis en cours de sauvegarde/désauvegarde (spinner).
  const [savingId, setSavingId] = useState<number | null>(null);
  /** Retour après clic sur la disquette (sauvegarde Historique). */
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Charge au montage la liste des avis déjà sauvegardés pour afficher le
  // bon état visuel du bouton « disquette » (vert si déjà dans l'historique).
  useEffect(() => {
    fetchSavedReviews()
      .then(list => setSavedIds(new Set(list.map(r => r.review.id))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!saveFeedback) return;
    const t = window.setTimeout(() => setSaveFeedback(null), 4500);
    return () => window.clearTimeout(t);
  }, [saveFeedback]);

  const apiErrorMessage = (err: unknown): string => {
    const ax = err as { response?: { data?: { error?: string } }; message?: string };
    if (ax?.response?.data?.error) return String(ax.response.data.error);
    if (err instanceof Error && err.message) return err.message;
    return 'Impossible de contacter le serveur. Vérifiez la connexion ou la clé API.';
  };

  const handleToggleSave = async (review: Review) => {
    setSavingId(review.id);
    setSaveFeedback(null);
    try {
      if (savedIds.has(review.id)) {
        await unsaveReviewFromHistorique(review.id);
        setSavedIds(prev => { const n = new Set(prev); n.delete(review.id); return n; });
        setSaveFeedback({ type: 'ok', message: 'Avis retiré de l’Historique.' });
      } else {
        await saveReviewToHistorique(review);
        setSavedIds(prev => new Set(prev).add(review.id));
        setSaveFeedback({
          type: 'ok',
          message: 'Avis enregistré dans Historique (onglet correspondant à la marque / source).',
        });
      }
    } catch (err) {
      console.error('save-review', err);
      setSaveFeedback({ type: 'err', message: apiErrorMessage(err) });
    } finally {
      setSavingId(null);
    }
  };

  // Quand un avis est désigné comme « à mettre en avant » (depuis une alerte),
  // on déplie sa ligne, on la fait défiler à l'écran et on déclenche un halo
  // éphémère pour guider l'utilisateur vers l'avis à traiter.
  useEffect(() => {
    if (!highlightReviewId) return;
    const row = rowRefs.current.get(highlightReviewId);
    if (!row) return;
    setExpandedRow(highlightReviewId);
    setFlashId(highlightReviewId);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t1 = window.setTimeout(() => setFlashId(null), 2200);
    onHighlightConsumed?.();
    return () => window.clearTimeout(t1);
  }, [highlightReviewId, reviews]);

  const handleStatusCycle = async (review: Review) => {
    const cycle: ReviewStatus[] = ['todo', 'in_progress', 'resolved'];
    const next = cycle[(cycle.indexOf(review.status) + 1) % cycle.length];
    onReviewUpdated(await updateReview(review.id, { status: next }));
  };

  const startEditNote = (review: Review) => {
    setEditingNote(review.id); setNoteValue(review.note || '');
    setTimeout(() => noteRef.current?.focus(), 50);
  };
  const saveNote = async (id: number) => {
    onReviewUpdated(await updateReview(id, { note: noteValue }));
    setEditingNote(null);
  };
  const cancelNote = () => setEditingNote(null);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedIds.size === reviews.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(reviews.map(r => r.id)));
  };
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    await bulkUpdateStatus(Array.from(selectedIds), bulkStatus);
    setSelectedIds(new Set());
    onReviewUpdated({ id: -1 } as Review);
  };

  const SiteColorLink = ({ href, siteColor, isDirect }: { href: string; siteColor?: string; isDirect: boolean }) => {
    const [hovered, setHovered] = useState(false);
    const title = isDirect ? 'Voir cet avis directement' : 'Voir les avis sur la plateforme';
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        className={`p-1.5 rounded transition-all relative ${isDirect ? 'ring-1 ring-transparent hover:ring-current' : ''}`}
        style={hovered && siteColor
          ? { color: siteColor, background: `${siteColor}15` }
          : isDirect
            ? { color: '#64748b', background: 'transparent' }
            : { color: '#cbd5e1', background: 'transparent' }}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {isDirect && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Lien direct vers l'avis" />
        )}
      </a>
    );
  };

  const SortIcon = ({ field }: { field: ReviewTableSortField }) =>
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  // URL directe vers l'avis si disponible, sinon URL générale de la plateforme
  const getReviewUrl = (review: Review): string => {
    if (review.review_url) return review.review_url;
    const domains: Record<string, string> = {
      infonet: 'infonet.fr', postmee: 'postmee.com', startdoc: 'startdoc.fr',
      wenony: 'wenony.fr', legaleo: 'legaleo.fr', lesentreprises: 'lesentreprises.com',
    };
    if (review.source === 'trustpilot')      return `https://fr.trustpilot.com/review/${domains[review.site] || review.site}`;
    if (review.source === 'avis-verifies')   return 'https://www.avis-verifies.com/avis-clients/infonet.fr';
    if (review.source === 'signal-arnaques') return 'https://www.signal-arnaques.com/scam/view/899068';
    return '#';
  };

  return (
    <div className="flex flex-col h-full relative">
      {saveFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-start gap-2 max-w-sm px-4 py-3 rounded-2xl shadow-lg border text-sm ${
            saveFeedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
          role="status"
        >
          {saveFeedback.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          )}
          <span>{saveFeedback.message}</span>
        </div>
      )}
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 bg-indigo-50/80 border-b border-indigo-100 px-6 py-3 animate-in fade-in slide-in-from-top-2 sticky top-0 z-20">
          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">{selectedIds.size}</span>
          <span className="text-indigo-900 text-sm font-medium">avis sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          
          <div className="ml-auto flex items-center gap-3">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as ReviewStatus)}
              className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {(Object.entries(STATUS_CONFIG) as [ReviewStatus, typeof STATUS_CONFIG[ReviewStatus]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={handleBulkUpdate} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition-colors shadow-sm">
              Appliquer
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 text-sm font-medium px-2">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div>
        <table className="w-full text-sm">
          <thead className="sticky top-[62px] z-10">
            <tr className="border-b border-slate-100 bg-white shadow-[0_1px_0_0_#f1f5f9]">
              <th className="px-4 py-4 text-left w-8 bg-white">
                <input
                  type="checkbox"
                  checked={selectedIds.size === reviews.length && reviews.length > 0}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              {[
                { label: 'Date',    field: 'published_at' as ReviewTableSortField },
                { label: 'Auteur',  field: 'author'       as ReviewTableSortField },
                { label: 'Note',    field: 'rating'       as ReviewTableSortField },
                { label: 'Source',  field: 'source'       as ReviewTableSortField },
              ].map(col => (
                <th key={col.field} className="px-4 py-4 text-left cursor-pointer hover:text-slate-900 text-slate-400 font-bold text-[11px] uppercase tracking-widest select-none bg-white" onClick={() => onColumnSort(col.field)}>
                  <div className="flex items-center gap-1.5 pointer-events-none">{col.label} <SortIcon field={col.field} /></div>
                </th>
              ))}
              <th className="px-4 py-4 text-left text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-white">Avis</th>
              <th className="px-4 py-4 text-left text-slate-400 font-bold text-[11px] uppercase tracking-widest w-40 bg-white">Note interne</th>
              <th className="px-4 py-4 text-left text-slate-400 font-bold text-[11px] uppercase tracking-widest w-24 bg-white">Agent(s)</th>
              <th className="px-4 py-4 text-left cursor-pointer hover:text-slate-900 text-slate-400 font-bold text-[11px] uppercase tracking-widest select-none bg-white" onClick={() => onColumnSort('status')}>
                <div className="flex items-center gap-1.5 pointer-events-none">Statut <SortIcon field="status" /></div>
              </th>
              <th className="px-4 py-4 text-left text-slate-400 font-bold text-[11px] uppercase tracking-widest w-16 bg-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review, idx) => (
              <React.Fragment key={review.id}>
                <tr
                  ref={(el) => {
                    if (el) rowRefs.current.set(review.id, el);
                    else rowRefs.current.delete(review.id);
                  }}
                  className={`
                    border-b border-slate-100 transition-colors group bg-white
                    ${flashId === review.id ? 'ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-white shadow-[0_0_0_4px_rgba(99,102,241,0.15)] animate-pulse' : ''}
                  `}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(review.id)} onChange={() => toggleSelect(review.id)}
                      className="rounded border-slate-300 accent-blue-500" />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {review.published_at
                      ? new Date(review.published_at + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium text-sm whitespace-nowrap">{review.author}</td>
                  <td className="px-4 py-3"><StarRating rating={review.rating} /></td>
                  <td className="px-4 py-3"><SourceBadge source={review.source} site={review.site} /></td>
                  <td className="px-4 py-3 max-w-[280px]">
                    {review.title && <div className="text-slate-800 text-xs font-medium mb-0.5 truncate">{review.title}</div>}
                    <p className="text-slate-600 text-xs line-clamp-2">{review.content}</p>
                  </td>
                  <td className="px-4 py-3 w-40">
                    {editingNote === review.id ? (
                      <div className="flex flex-col gap-1">
                        <textarea
                          ref={noteRef} value={noteValue} onChange={e => setNoteValue(e.target.value)}
                          className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 resize-none w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                          rows={2}
                          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote(review.id); if (e.key === 'Escape') cancelNote(); }}
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => saveNote(review.id)} className="p-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors shadow-sm">
                            <Check className="w-3 h-3 text-white" />
                          </button>
                          <button onClick={cancelNote} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                            <X className="w-3 h-3 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 group/note cursor-pointer" onClick={() => startEditNote(review)}>
                        {review.note
                          ? <p className="text-slate-700 text-[13px] line-clamp-2 flex-1 leading-relaxed bg-amber-50/50 px-2 py-1 rounded-md border border-amber-100/50">{review.note}</p>
                          : <p className="text-slate-400 text-[13px] italic flex-1 px-2 py-1">Ajouter une note...</p>
                        }
                        <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover/note:text-indigo-500 flex-shrink-0 mt-1 transition-colors opacity-0 group-hover/note:opacity-100" />
                      </div>
                    )}
                  </td>
                  {/* Colonne Agent — sélecteur inline */}
                  <td className="px-4 py-4 w-32" onClick={e => e.stopPropagation()}>
                    <AgentSelector
                      value={review.agents || ''}
                      onChange={async (val) => {
                        onReviewUpdated(await updateReview(review.id, { agents: val }));
                      }}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={review.status} onClick={() => handleStatusCycle(review)} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setExpandedRow(expandedRow === review.id ? null : review.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Voir l'avis complet"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* Disquette : sauvegarde l'avis dans la page Historique,
                          dans la catégorie du site/source correspondant. */}
                      <button
                        onClick={() => handleToggleSave(review)}
                        disabled={savingId === review.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${
                          savedIds.has(review.id)
                            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={
                          savedIds.has(review.id)
                            ? 'Retirer cet avis de la page Historique'
                            : 'Enregistrer cet avis dans Historique (onglet site / source)'
                        }
                      >
                        {savingId === review.id ? (
                          <span className="block w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                      <SiteColorLink href={getReviewUrl(review)} siteColor={SITE_CONFIG[review.site]?.color} isDirect={!!review.review_url} />
                    </div>
                  </td>
                </tr>

                {expandedRow === review.id && (
                  <tr key={`${review.id}-expanded`} className="bg-white border-b border-slate-100">
                    <td colSpan={10} className="px-8 py-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl">

                        {/* Col 1 : avis original + réponses + note + agent(s) */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Avis original</p>
                          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                              <span className="text-slate-900 font-bold text-sm">{review.author}</span>
                              <StarRating rating={review.rating} size="sm" />
                              <SourceBadge source={review.source} site={review.site} />
                              <span className="text-slate-400 text-[11px] font-medium ml-auto">{review.published_at}</span>
                            </div>
                            {review.title && <p className="text-slate-900 text-sm font-bold mb-1.5">{review.title}</p>}
                            <p className="text-slate-600 text-sm leading-relaxed">{review.content}</p>
                          </div>

                          {/* Réponses : rattachées directement à l'avis */}
                          <div className="mt-4">
                            <ResponseSection review={review} />
                          </div>

                          {review.note && (
                            <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl">
                              <p className="text-amber-700 text-[11px] font-bold uppercase tracking-widest mb-1.5">Note interne</p>
                              <p className="text-amber-900 text-sm leading-relaxed">{review.note}</p>
                            </div>
                          )}

                          {/* Agent selector */}
                          <div className="mt-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Agent(s) en charge</p>
                            <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                              <AgentSelector
                                value={review.agents || ''}
                                onChange={async (val) => {
                                  onReviewUpdated(await updateReview(review.id, { agents: val }));
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Col 2 : chronologie */}
                        <div>
                          <TimelineSection review={review} onReviewUpdated={onReviewUpdated} />
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  Aucun avis trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">{total} avis au total · Page {page} / {pages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
              className="p-2 rounded-lg hover:bg-white hover:border hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              let p = i + 1;
              if (pages > 7) {
                if (page <= 4) p = i + 1;
                else if (page >= pages - 3) p = pages - 6 + i;
                else p = page - 3 + i;
              }
              return (
                <button key={p} onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                    page === p ? 'bg-blue-600 text-white' : 'hover:bg-white hover:border hover:border-slate-200 text-slate-500'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button onClick={() => onPageChange(page + 1)} disabled={page === pages}
              className="p-2 rounded-lg hover:bg-white hover:border hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
