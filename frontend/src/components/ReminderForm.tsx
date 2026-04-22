import { useState, useEffect } from 'react';
import { createReminder, fetchReminders, deleteReminder } from '../api';
import type { Reminder } from '../types';
import { Bell, BellOff, Plus, X, Clock } from 'lucide-react';

interface ReminderFormProps {
  reviewId: number;
  reviewAuthor?: string;
}

const PRESETS = [
  { label: '2 heures',  hours: 2 },
  { label: '24 heures', hours: 24 },
  { label: '48 heures', hours: 48 },
  { label: '1 semaine', hours: 168 },
];

function formatRemindAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function hoursFromNow(h: number): string {
  const d = new Date(Date.now() + h * 3600 * 1000);
  // Format datetime-local: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReminderForm({ reviewId, reviewAuthor }: ReminderFormProps) {
  const [reminders, setReminders]   = useState<Reminder[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [message, setMessage]       = useState(`Relance ${reviewAuthor || 'client'} si pas de réponse`);
  const [remindAt, setRemindAt]     = useState(hoursFromNow(24));
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetchReminders({ review_id: reviewId })
      .then(setReminders)
      .catch(() => {});
  }, [reviewId]);

  const handleCreate = async () => {
    if (!remindAt) return;
    setSaving(true);
    try {
      const created = await createReminder({
        review_id: reviewId,
        message,
        remind_at: remindAt,
      });
      setReminders(prev => [...prev, created]);
      setShowForm(false);
      setMessage(`Relance ${reviewAuthor || 'client'} si pas de réponse`);
      setRemindAt(hoursFromNow(24));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteReminder(id);
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const activeReminders = reminders.filter(r => r.status !== 'dismissed');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> Rappels de relance
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Plus className="w-3 h-3" /> Ajouter
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
          {/* Présets rapides */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.hours}
                onClick={() => setRemindAt(hoursFromNow(p.hours))}
                className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Message */}
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Message du rappel…"
            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-800"
          />

          {/* Date/heure */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <input
              type="datetime-local"
              value={remindAt}
              onChange={e => setRemindAt(e.target.value)}
              className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-800"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !remindAt}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Créer le rappel'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des rappels existants */}
      {activeReminders.length > 0 ? (
        <div className="space-y-1.5">
          {activeReminders.map(r => (
            <div
              key={r.id}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                r.status === 'triggered'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Bell className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${r.status === 'triggered' ? 'text-amber-500' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-medium truncate">{r.message || 'Rappel'}</p>
                <p className={`mt-0.5 ${r.status === 'triggered' ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                  {r.status === 'triggered' ? '⚠️ Échu — ' : ''}
                  {formatRemindAt(r.remind_at)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : !showForm && (
        <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
          <BellOff className="w-3.5 h-3.5" /> Aucun rappel programmé
        </p>
      )}
    </div>
  );
}
