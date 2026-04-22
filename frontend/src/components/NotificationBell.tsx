import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import type { Reminder } from '../types';
import { updateReminder } from '../api';
import { SITE_CONFIG } from '../types';

interface NotificationBellProps {
  notifications: Reminder[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}

function formatRemindAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

export default function NotificationBell({ notifications, onDismiss, onDismissAll }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const triggered = notifications.filter(n => n.status === 'triggered');
  const pending   = notifications.filter(n => n.status === 'pending');
  const count = triggered.length;
  const hasPending = pending.length > 0;

  // Animation cloche à chaque nouvelle notification
  useEffect(() => {
    if (count > 0) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 1000);
      return () => clearTimeout(t);
    }
  }, [count]);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleDismiss = async (id: number) => {
    await updateReminder(id, { status: 'dismissed' });
    onDismiss(id);
  };

  const handleDismissAll = async () => {
    for (const n of triggered) {
      await updateReminder(n.id, { status: 'dismissed' });
    }
    onDismissAll();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg transition-all ${
          count > 0
            ? open
              ? 'bg-red-100 text-red-600'
              : 'text-red-500 hover:text-red-700 hover:bg-red-50'
            : hasPending
              ? open
                ? 'bg-amber-100 text-amber-600'
                : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
              : open
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        }`}
        title={count > 0 ? `${count} rappel(s) échu(s)` : hasPending ? `${pending.length} rappel(s) à venir` : 'Notifications'}
      >
        <Bell className={`w-5 h-5 ${animate ? 'animate-bounce' : ''}`} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
            {count > 9 ? '9+' : count}
          </span>
        )}
        {count === 0 && hasPending && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full shadow-sm" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Rappels</span>
              {count > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                  {count}
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={handleDismissAll}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-96 overflow-y-auto">
            {triggered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aucune notification</p>
              </div>
            ) : (
              triggered.map(n => {
                const siteColor = n.site && SITE_CONFIG[n.site as keyof typeof SITE_CONFIG]?.color;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-amber-50/50 transition-colors"
                  >
                    {/* Indicateur couleur site */}
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: siteColor || '#f59e0b' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {n.message || 'Rappel de relance'}
                      </p>
                      {n.author && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          Avis de <strong>{n.author}</strong>
                          {n.site && ` — ${SITE_CONFIG[n.site as keyof typeof SITE_CONFIG]?.label || n.site}`}
                        </p>
                      )}
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        ⏰ Échu depuis {formatRemindAt(n.remind_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(n.id)}
                      className="p-1 text-slate-300 hover:text-slate-600 rounded transition-colors flex-shrink-0"
                      title="Ignorer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.filter(n => n.status === 'pending').length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {notifications.filter(n => n.status === 'pending').length} rappel(s) à venir
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
