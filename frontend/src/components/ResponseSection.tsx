import { useState, useEffect, useRef } from 'react';
import { fetchResponses, createResponse, updateResponse, deleteResponse } from '../api';
import type { Response } from '../api';
import { SITE_CONFIG } from '../types';
import type { Review } from '../types';
import {
  MessageSquarePlus, Send, Edit3, Trash2, Check, X,
  CheckCircle, Clock, ExternalLink,
} from 'lucide-react';

interface ResponseSectionProps { review: Review; }

const SOURCE_URLS: Record<string, string> = {
  trustpilot:        'https://fr.trustpilot.com',
  'avis-verifies':   'https://www.avis-verifies.com',
  'signal-arnaques': 'https://www.signal-arnaques.com',
};

const AGENTS = ['Équipe E-Réputation', 'Service Client', 'Direction', 'Community Manager'];

export default function ResponseSection({ review }: ResponseSectionProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState(AGENTS[0]);
  const [isPublished, setIsPublished] = useState(false);
  const getReviewUrl = (r: Review): string => {
    if (r.review_url) return r.review_url;
    const domains: Record<string, string> = {
      infonet: 'infonet.fr', postmee: 'postmee.com', startdoc: 'startdoc.fr',
      wenony: 'wenony.fr', legaleo: 'legaleo.fr', lesentreprises: 'lesentreprises.com',
    };
    if (r.source === 'trustpilot')      return `https://fr.trustpilot.com/review/${domains[r.site] || r.site}`;
    if (r.source === 'avis-verifies')   return 'https://www.avis-verifies.com/avis-clients/infonet.fr';
    if (r.source === 'signal-arnaques') return 'https://www.signal-arnaques.com/scam/view/899068';
    return '';
  };

  const [publishedOn, setPublishedOn] = useState(getReviewUrl(review));
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const siteCfg = SITE_CONFIG[review.site];

  useEffect(() => {
    fetchResponses(review.id).then(setResponses).finally(() => setLoading(false));
  }, [review.id]);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const created = await createResponse(review.id, {
        author: newAuthor, content: newContent,
        is_published: isPublished, published_on: publishedOn,
      });
      setResponses(prev => [...prev, created]);
      setNewContent(''); setIsPublished(false); setPublishedOn(getReviewUrl(review)); setShowForm(false);
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (resp: Response) => {
    if (!editContent.trim()) return;
    const updated = await updateResponse(review.id, resp.id, { content: editContent });
    setResponses(prev => prev.map(r => r.id === resp.id ? updated : r));
    setEditingId(null);
  };

  const handleTogglePublish = async (resp: Response) => {
    const updated = await updateResponse(review.id, resp.id, {
      is_published: !resp.is_published,
      published_on: !resp.is_published ? getReviewUrl(review) : resp.published_on,
    });
    setResponses(prev => prev.map(r => r.id === resp.id ? updated : r));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette réponse ?')) return;
    await deleteResponse(review.id, id);
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const startEdit = (resp: Response) => {
    setEditingId(resp.id); setEditContent(resp.content);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="mt-2 border-t border-slate-200 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4" style={{ color: siteCfg.text }} />
          <span className="text-sm font-semibold text-slate-800">Réponses à l'avis</span>
          {responses.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${siteCfg.color}15`, color: siteCfg.text }}>
              {responses.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setTimeout(() => textareaRef.current?.focus(), 50); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: showForm ? `${siteCfg.color}20` : `${siteCfg.color}10`,
            border: `1px solid ${siteCfg.color}35`,
            color: siteCfg.text,
          }}
        >
          {showForm ? <X className="w-3 h-3" /> : <MessageSquarePlus className="w-3 h-3" />}
          {showForm ? 'Annuler' : 'Rédiger une réponse'}
        </button>
      </div>

      {/* Thread */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
          <div className="w-3 h-3 border border-slate-300 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      ) : responses.length === 0 && !showForm ? (
        <p className="text-slate-400 text-xs italic py-1">Aucune réponse rédigée pour cet avis.</p>
      ) : (
        <div className="space-y-3 mb-3">
          {responses.map(resp => (
            <div key={resp.id} className="flex gap-3">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: `${siteCfg.color}20`, color: siteCfg.text }}>
                {initials(resp.author)}
              </div>

              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  {/* Meta */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: siteCfg.text }}>{resp.author}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-slate-400 text-xs">{formatDate(resp.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {resp.is_published ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="w-3 h-3" />
                          Publié
                          {resp.published_on && (
                            <a href={resp.published_on} target="_blank" rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-600">
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <Clock className="w-3 h-3" /> Brouillon
                        </span>
                      )}
                      <button onClick={() => handleTogglePublish(resp)} title={resp.is_published ? 'Marquer comme brouillon' : 'Marquer comme publié'}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <CheckCircle className="w-3 h-3" />
                      </button>
                      <button onClick={() => startEdit(resp)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(resp.id)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {editingId === resp.id ? (
                    <div className="space-y-2">
                      <textarea
                        ref={textareaRef} value={editContent} onChange={e => setEditContent(e.target.value)} rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleEdit(resp); if (e.key === 'Escape') setEditingId(null); }}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(resp)} className="flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 rounded text-xs text-white transition-colors">
                          <Check className="w-3 h-3" /> Sauvegarder
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs text-slate-600 transition-colors">
                          <X className="w-3 h-3" /> Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{resp.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New response form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
          style={{ borderLeft: `3px solid ${siteCfg.color}` }}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nouvelle réponse</p>

          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 mb-1">Rédigé par</label>
              <select
                value={newAuthor} onChange={e => setNewAuthor(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-blue-400"
              >
                {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                <div
                  className={`w-8 h-4 rounded-full transition-all relative ${isPublished ? 'bg-emerald-400' : 'bg-slate-300'}`}
                  onClick={() => setIsPublished(v => !v)}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isPublished ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-slate-500">Publié sur la plateforme</span>
              </label>
            </div>
          </div>

          {isPublished && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">URL de publication (optionnel)</label>
              <input type="url" value={publishedOn} onChange={e => setPublishedOn(e.target.value)}
                placeholder={`${SOURCE_URLS[review.source] || 'https://'}...`}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-blue-400 placeholder-slate-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">Contenu de la réponse</label>
            <textarea
              ref={!editingId ? textareaRef : undefined}
              value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder="Rédigez votre réponse ici… (Ctrl+Enter pour envoyer)" rows={4}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-slate-400"
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-slate-400">{newContent.length} caractères</span>
              <span className="text-xs text-slate-400">Ctrl+Enter pour envoyer</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs text-slate-600 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSubmit} disabled={!newContent.trim() || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: siteCfg.color }}
            >
              {submitting
                ? <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                : <Send className="w-3 h-3" />
              }
              Enregistrer la réponse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
