import { useState, useEffect } from 'react';
import { fetchReminders, createReminder, deleteReminder, updateReminder } from '../api';
import type { Reminder } from '../types';
import { SITE_CONFIG } from '../types';
import {
  Bell, BellOff, Plus, X, Clock, CheckCheck,
  AlertTriangle, Calendar,
} from 'lucide-react';

const PRESETS = [
  { label: '1 heure',   hours: 1 },
  { label: '2 heures',  hours: 2 },
  { label: '24 heures', hours: 24 },
  { label: '48 heures', hours: 48 },
  { label: '1 semaine', hours: 168 },
];

function hoursFromNow(h: number): string {
  const d = new Date(Date.now() + h * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatFull(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `il y a ${Math.floor(diff / 60000)} min`;
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Échu';
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `dans ${Math.floor(diff / 60000)} min`;
  if (h < 24) return `dans ${h}h`;
  return `dans ${Math.floor(h / 24)}j`;
}

interface ReminderCardProps {
  reminder: Reminder;
  onDismiss: (id: number) => void;
  onDelete: (id: number) => void;
}

function ReminderCard({ reminder, onDismiss, onDelete }: ReminderCardProps) {
  const isOverdue = reminder.status === 'triggered';
  const siteCfg = reminder.site ? SITE_CONFIG[reminder.site as keyof typeof SITE_CONFIG] : null;

  return (
    <div className={`relative rounded-3xl p-5 transition-all group ${
      isOverdue
        ? 'bg-gradient-to-br from-amber-50 to-orange-50 shadow-[0_8px_30px_rgba(245,158,11,0.1)]'
        : 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]'
    }`}>
      {isOverdue && (
        <div className="flex items-center gap-1.5 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">
            Action requise · {timeAgo(reminder.remind_at)}
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icône */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isOverdue ? 'bg-amber-100' : 'bg-slate-100'
        }`}>
          <Bell className={`w-4 h-4 ${isOverdue ? 'text-amber-500' : 'text-slate-400'}`} />
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-tight mb-1">
            {reminder.message || 'Rappel de relance'}
          </p>

          {/* Context avis */}
          {reminder.author && (
            <div className="flex items-center gap-1.5 mb-2">
              {siteCfg && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: siteCfg.color }}
                >
                  {siteCfg.label}
                </span>
              )}
              <span className="text-xs text-slate-500 truncate">
                Avis de <strong className="text-slate-700">{reminder.author}</strong>
              </span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3 h-3 flex-shrink-0 ${isOverdue ? 'text-amber-500' : 'text-slate-400'}`} />
            <span className={`text-xs ${isOverdue ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
              {isOverdue ? `Échu ${timeAgo(reminder.remind_at)}` : timeUntil(reminder.remind_at)}
              {' · '}
              <span className="text-slate-400">{formatFull(reminder.remind_at)}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {isOverdue && (
            <button
              onClick={() => onDismiss(reminder.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
              title="Marquer comme traité"
            >
              <CheckCheck className="w-3 h-3" /> Traité
            </button>
          )}
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Supprimer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface RemindersPageProps {
  onReminderChange?: () => void;
}

export default function RemindersPage({ onReminderChange }: RemindersPageProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [message, setMessage]     = useState('');
  const [remindAt, setRemindAt]   = useState(hoursFromNow(24));
  const [saving, setSaving]       = useState(false);

  const load = () => {
    fetchReminders().then(r => { setReminders(r); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!remindAt || !message.trim()) return;
    setSaving(true);
    try {
      const created = await createReminder({ message, remind_at: remindAt });
      setReminders(prev => [created, ...prev]);
      setMessage(''); setRemindAt(hoursFromNow(24)); setShowForm(false);
      onReminderChange?.();
    } finally { setSaving(false); }
  };

  const handleDismiss = async (id: number) => {
    await updateReminder(id, { status: 'dismissed' });
    setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
    onReminderChange?.();
  };

  const handleDelete = async (id: number) => {
    await deleteReminder(id);
    setReminders(prev => prev.filter(r => r.id !== id));
    onReminderChange?.();
  };

  const overdue  = reminders.filter(r => r.status === 'triggered');
  const pending  = reminders.filter(r => r.status === 'pending').sort(
    (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
  );
  const dismissed = reminders.filter(r => r.status === 'dismissed');

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Rappels de relance
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {overdue.length > 0
              ? `${overdue.length} rappel(s) en attente de traitement`
              : `${pending.length} rappel(s) programmé(s)`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nouveau rappel
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-blue-50 rounded-3xl p-6 space-y-4 shadow-[0_8px_30px_rgba(59,130,246,0.08)]">
          <p className="text-sm font-semibold text-blue-800">Créer un rappel</p>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.hours} onClick={() => setRemindAt(hoursFromNow(p.hours))}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 font-medium transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="text" value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Ex : Relancer si pas de réponse au mail de ce matin"
            className="w-full border border-blue-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-800"
          />

          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <input type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)}
              className="flex-1 border border-blue-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-800" />
          </div>

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !message.trim() || !remindAt}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-xl font-semibold transition-colors">
              {saving ? 'Enregistrement…' : '✓ Créer le rappel'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-xl transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : (
        <>
          {/* ── Échus (urgents) */}
          {overdue.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  À traiter maintenant
                </h2>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  {overdue.length}
                </span>
              </div>
              <div className="space-y-3">
                {overdue.map(r => (
                  <ReminderCard key={r.id} reminder={r} onDismiss={handleDismiss} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {/* ── À venir */}
          {pending.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Programmés
                </h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  {pending.length}
                </span>
              </div>
              <div className="space-y-3">
                {pending.map(r => (
                  <ReminderCard key={r.id} reminder={r} onDismiss={handleDismiss} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {/* ── Vide */}
          {overdue.length === 0 && pending.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BellOff className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Aucun rappel programmé</p>
              <p className="text-slate-400 text-sm mt-1">
                Créez un rappel depuis cette page ou depuis la fiche d'un avis
              </p>
              <button onClick={() => setShowForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium mx-auto transition-colors hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Créer un rappel
              </button>
            </div>
          )}

          {/* ── Traités (discrets) */}
          {dismissed.length > 0 && (
            <section className="opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                  Traités ({dismissed.length})
                </p>
              </div>
              <div className="space-y-2">
                {dismissed.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-xl">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-slate-500 flex-1 truncate">{r.message || 'Rappel'}</p>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
