import { useState } from 'react';
import type { Review } from '../types';
import { updateReview } from '../api';
import ReminderForm from './ReminderForm';
import { Clock, Phone, Check, Edit3, X } from 'lucide-react';

interface TimelineSectionProps {
  review: Review;
  onReviewUpdated: (review: Review) => void;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Convertit un datetime-local string en ISO pour l'affichage */
function toDisplayInput(iso: string): string {
  if (!iso) return '';
  // Si déjà au format datetime-local (YYYY-MM-DDTHH:MM)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) return iso.slice(0, 16);
  return iso;
}

interface EventRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  onSave: (val: string) => void;
  isDate?: boolean;
  isDateTime?: boolean;
}

function EventRow({ icon, iconBg, label, value, onSave, isDateTime = false }: EventRowProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState('');

  const startEdit = () => { setInput(toDisplayInput(value)); setEditing(true); };
  const cancel    = () => setEditing(false);
  const save      = () => { onSave(input); setEditing(false); };

  return (
    <div className="flex items-start gap-3">
      {/* Icône */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>

        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              type={isDateTime ? 'datetime-local' : 'date'}
              value={input}
              onChange={e => setInput(e.target.value)}
              className="border border-blue-400 rounded-lg px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              autoFocus
            />
            <button onClick={save} className="p-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={cancel} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
              <X className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group/row cursor-pointer" onClick={startEdit}>
            <span className={`text-sm ${value ? 'text-slate-800 font-medium' : 'text-slate-400 italic'}`}>
              {value ? formatDateTime(value) : 'Cliquer pour définir…'}
            </span>
            <Edit3 className="w-3 h-3 text-slate-300 group-hover/row:text-slate-500 flex-shrink-0 transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelineSection({ review, onReviewUpdated }: TimelineSectionProps) {

  const handleSave = async (field: 'contacted_at', value: string) => {
    const updated = await updateReview(review.id, { [field]: value });
    onReviewUpdated(updated);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Chronologie</p>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 space-y-4">

        {/* Ligne de connexion visuelle */}
        <div className="relative">
          <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-100 -z-0" />
          <div className="relative space-y-4">

            {/* Avis reçu */}
            <EventRow
              icon={<Clock className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-50"
              label="Avis reçu"
              value={review.published_at}
              onSave={() => {}}  // published_at est en lecture seule
              isDateTime={false}
            />

            {/* Client contacté */}
            <EventRow
              icon={<Phone className="w-4 h-4 text-emerald-500" />}
              iconBg="bg-emerald-50"
              label="Client contacté"
              value={review.contacted_at || ''}
              onSave={(val) => handleSave('contacted_at', val)}
              isDateTime={true}
            />

          </div>
        </div>

        {/* Rappels de relance */}
        <div className="pt-2 border-t border-slate-100">
          <ReminderForm reviewId={review.id} reviewAuthor={review.author} />
        </div>

        {/* Délai de traitement */}
        {review.contacted_at && review.published_at && (() => {
          try {
            const received  = new Date(review.published_at);
            const contacted = new Date(review.contacted_at);
            const diffMs    = contacted.getTime() - received.getTime();
            if (diffMs < 0) return null;
            const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const label     = diffDays > 0 ? `${diffDays}j ${diffHours}h` : `${diffHours}h`;
            return (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-slate-500">Délai de prise en charge : <strong className="text-slate-700">{label}</strong></span>
              </div>
            );
          } catch { return null; }
        })()}
      </div>
    </div>
  );
}
