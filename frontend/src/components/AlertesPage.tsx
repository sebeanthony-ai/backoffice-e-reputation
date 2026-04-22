import { Bell, CheckCheck, ExternalLink, Star, Trash2, Zap } from 'lucide-react';
import { SITE_CONFIG, SOURCE_CONFIG } from '../types';
import type { SiteKey, SourceKey } from '../types';
import SiteFavicon from './SiteFavicon';

export interface ReviewAlert {
  id: number;
  site: string;
  source: string;
  count: number;
  timestamp: Date;
  read: boolean;
}

interface AlertesPageProps {
  alerts: ReviewAlert[];
  onDismiss: (id: number) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  // Navigue vers le site et indique à la page cible quel avis mettre en avant
  // (source + nombre de nouveaux avis de l'alerte cliquée).
  onNavigate: (site: string, source: string, count: number) => void;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function AlertesPage({ alerts, onDismiss, onMarkAllRead, onClearAll, onNavigate }: AlertesPageProps) {
  // Clic sur une alerte : on la retire de la liste ET on navigue vers le site
  // en transmettant la source + le nombre d'avis concernés, pour que la page
  // cible filtre et mette en avant le(s) avis à traiter.
  const handleAlertClick = (alert: ReviewAlert) => {
    onDismiss(alert.id);
    onNavigate(alert.site, alert.source, alert.count);
  };
  const unreadCount = alerts.filter(a => !a.read).length;
  const totalNew = alerts.reduce((s, a) => s + a.count, 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Alertes</h1>
          <p className="text-slate-400 text-sm">
            Nouveaux avis détectés en temps réel sur vos plateformes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              Tout marquer lu
            </button>
          )}
          {alerts.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 rounded-xl text-sm font-medium text-slate-400 hover:text-red-500 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Effacer tout
            </button>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Bell className="w-3.5 h-3.5" /></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Alertes</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{alerts.length}</p>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Star className="w-3.5 h-3.5" /></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Nouveaux avis</span>
            </div>
            <p className="text-3xl font-extrabold text-emerald-600">{totalNew}</p>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-red-50 text-red-500"><Zap className="w-3.5 h-3.5" /></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Non lus</span>
            </div>
            <p className="text-3xl font-extrabold text-red-500">{unreadCount}</p>
          </div>
        </div>
      )}

      {/* Liste des alertes */}
      {alerts.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-slate-300" />
          </div>
          <h3 className="text-slate-700 font-bold mb-1">Aucune alerte pour l'instant</h3>
          <p className="text-slate-400 text-sm max-w-xs">
            Dès qu'un nouvel avis sera détecté lors de la synchronisation automatique, il apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {[...alerts].reverse().map(alert => {
            const siteCfg = SITE_CONFIG[alert.site as SiteKey];
            const srcCfg  = SOURCE_CONFIG[alert.source as SourceKey];

            return (
              <div
                key={alert.id}
                role={siteCfg ? 'button' : undefined}
                tabIndex={siteCfg ? 0 : undefined}
                onClick={siteCfg ? () => handleAlertClick(alert) : undefined}
                onKeyDown={siteCfg ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAlertClick(alert);
                  }
                } : undefined}
                className={`group flex items-center gap-4 bg-white rounded-3xl px-6 py-5 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${
                  siteCfg ? 'cursor-pointer' : ''
                } ${
                  alert.read
                    ? 'shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                    : 'ring-1 ring-indigo-100 shadow-[0_8px_30px_rgba(99,102,241,0.08)]'
                }`}
              >
                {/* Indicateur non-lu */}
                <div className="flex-shrink-0">
                  {!alert.read
                    ? <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse block" />
                    : <span className="w-2.5 h-2.5 rounded-full bg-slate-200 block" />
                  }
                </div>

                {/* Favicon site */}
                {siteCfg ? (
                  <SiteFavicon site={alert.site as SiteKey} size={36} className="rounded-xl border border-slate-100 shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0" />
                )}

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {siteCfg?.label ?? alert.site}
                    </span>
                    {srcCfg && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ color: srcCfg.color, borderColor: `${srcCfg.color}40`, background: `${srcCfg.color}10` }}
                      >
                        {srcCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{timeAgo(alert.timestamp)}</p>
                </div>

                {/* Badge count */}
                <div
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm"
                  style={{
                    background: siteCfg ? `${siteCfg.color}12` : '#6366f110',
                    color: siteCfg?.text ?? '#6366f1',
                  }}
                >
                  <span>+{alert.count}</span>
                  <span className="font-medium text-[11px] opacity-70">avis</span>
                </div>

                {/* Bouton voir (le clic sur la carte a le même effet, ceci reste pour l'affordance visuelle) */}
                {siteCfg && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAlertClick(alert); }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all opacity-0 group-hover:opacity-100"
                  >
                    Voir <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
