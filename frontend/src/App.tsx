import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import SiteReviews from './components/SiteReviews';
import ScrapingPanel from './components/ScrapingPanel';
import Analytics from './components/Analytics';
import RemindersPage from './components/RemindersPage';
import NotificationBell from './components/NotificationBell';
import AlertesPage from './components/AlertesPage';
import HistoriquePage from './components/HistoriquePage';
import EquipePage from './components/EquipePage';
import Login from './components/Login';
import UserMenu from './components/UserMenu';
import type { ReviewAlert } from './components/AlertesPage';
import { SITE_CONFIG, STATUS_CONFIG, INFONET_BRAND } from './types';
import type { SiteKey, SourceKey, ReviewStatus, Reminder } from './types';
import { fetchReminders } from './api';
import { API_ORIGIN, BACKOFFICE_KEY } from './config';
import SiteFavicon from './components/SiteFavicon';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  LayoutDashboard, Globe, RefreshCw, Loader2,
  Star, BarChart2, Bell, AlertTriangle, Zap, History, Users,
} from 'lucide-react';

type TabId =
  | 'dashboard'
  | 'analytics'
  | 'reminders'
  | 'alertes'
  | 'historique'
  | 'equipe'
  | SiteKey
  | 'all'
  | 'scraping';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!user) return <Login />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [socket] = useState<Socket>(() =>
    io(API_ORIGIN || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      ...(BACKOFFICE_KEY ? { auth: { backofficeKey: BACKOFFICE_KEY } } : {}),
    }),
  );

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // Focus déclenché par un clic sur une alerte : indique à SiteReviews de
  // pré-filtrer sur la bonne source et de mettre en avant le(s) nouvel(s) avis.
  // `nonce` change à chaque clic pour permettre de re-déclencher l'effet même
  // si l'utilisateur revient sur la même alerte/site.
  const [reviewFocus, setReviewFocus] = useState<
    { site: SiteKey; source: SourceKey; count: number; nonce: number } | null
  >(null);
  const [alerts, setAlerts] = useState<ReviewAlert[]>(() => {
    try {
      const raw = localStorage.getItem('bo_alerts');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ReviewAlert[];
      // Restaure les Date + dédoublonne les alertes identiques (site+source+count)
      // reçues à moins de 10s d'intervalle — nettoie les doublons hérités d'avant
      // l'introduction de la déduplication côté handler socket.
      const DEDUP_WINDOW_MS = 10_000;
      const restored = parsed.map(a => ({ ...a, timestamp: new Date(a.timestamp) }));
      const deduped: ReviewAlert[] = [];
      for (const a of restored) {
        const dup = deduped.find(b =>
          b.site === a.site && b.source === a.source && b.count === a.count &&
          Math.abs(b.timestamp.getTime() - a.timestamp.getTime()) < DEDUP_WINDOW_MS
        );
        if (!dup) deduped.push(a);
      }
      return deduped;
    } catch { return []; }
  });
  // Chargement initial des rappels
  useEffect(() => {
    fetchReminders().then(setReminders).catch(() => {});
  }, []);

  // Persistance des alertes dans localStorage
  useEffect(() => {
    try { localStorage.setItem('bo_alerts', JSON.stringify(alerts)); } catch {}
  }, [alerts]);

  useEffect(() => {
    // Fenêtre de déduplication : on ignore les events `new_reviews` strictement
    // identiques (site+source+count) reçus à moins de 10s d'intervalle. Cela
    // protège contre d'éventuels doublons dus à des écouteurs résiduels après
    // HMR ou à une double émission côté backend.
    const DEDUP_WINDOW_MS = 10_000;

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNewReviews = ({ site, source, count }: { site: string; source: string; count: number }) => {
      addNotification(`${count} nouvel(s) avis sur ${site} (${source})`, 'success');
      setRefreshTrigger(t => t + 1);

      setAlerts(prev => {
        const now = Date.now();
        const isDuplicate = prev.some(a =>
          a.site === site && a.source === source && a.count === count &&
          (now - new Date(a.timestamp).getTime()) < DEDUP_WINDOW_MS
        );
        if (isDuplicate) return prev;

        const newId = prev.length ? Math.max(...prev.map(a => a.id)) + 1 : 1;
        return [...prev, { id: newId, site, source, count, timestamp: new Date(), read: false }];
      });

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification(`🔔 ${count} nouvel(s) avis — ${site}`, { body: `Source : ${source}` });
      }
    };

    const onReviewsSynced = () => setRefreshTrigger(t => t + 1);

    const onScrapeComplete = ({ site, source, newReviews, updated }: any) => {
      const parts = [`${newReviews ?? 0} nouveau(x)`];
      if (updated > 0) parts.push(`${updated} mis à jour`);
      addNotification(`Sync ${site}/${source} · ${parts.join(', ')}`, 'info');
    };

    const onScrapeError = ({ error }: { error: string }) => {
      addNotification(`Erreur de synchronisation: ${error}`, 'error');
    };

    const onReminderDue = (reminder: Reminder) => {
      setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, status: 'triggered' } : r));
      if (Notification.permission === 'granted') {
        new Notification('⏰ Rappel de relance', {
          body: `${reminder.message || 'Relance client'} — ${reminder.author || ''}`,
          icon: '/legaleo-logo.png',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_reviews', onNewReviews);
    socket.on('reviews_synced', onReviewsSynced);
    socket.on('scrape_complete', onScrapeComplete);
    socket.on('scrape_error', onScrapeError);
    socket.on('reminder:due', onReminderDue);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_reviews', onNewReviews);
      socket.off('reviews_synced', onReviewsSynced);
      socket.off('scrape_complete', onScrapeComplete);
      socket.off('scrape_error', onScrapeError);
      socket.off('reminder:due', onReminderDue);
    };
  }, []);

  const addNotification = (message: string, type: Notification['type']) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const overdueCount = reminders.filter(r => r.status === 'triggered').length;
  const pendingCount = reminders.filter(r => r.status === 'pending').length;
  const unreadAlerts = alerts.filter(a => !a.read).length;
  const isInfonet = activeTab === 'infonet';
  const activeSite = (activeTab in SITE_CONFIG) ? activeTab as SiteKey : null;

  // Ouverture de l'onglet : on NE marque plus tout comme lu.
  // Chaque alerte sera marquée lue individuellement quand l'utilisateur clique dessus.
  const handleOpenAlertes = () => {
    setActiveTab('alertes');
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number; onClick?: () => void }[] = [
    { id: 'dashboard',  label: 'Dashboard',       icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analytics',  label: 'Analytiques',     icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'alertes',    label: 'Alertes',          icon: <Zap className="w-4 h-4" />, badge: unreadAlerts, onClick: handleOpenAlertes },
    { id: 'all',        label: 'Tous les avis',   icon: <Globe className="w-4 h-4" /> },
    ...Object.entries(SITE_CONFIG).map(([key, cfg]) => ({
      id: key as SiteKey,
      label: cfg.label,
      icon: <SiteFavicon site={key as SiteKey} size={16} />,
    })),
    { id: 'scraping',   label: 'Synchronisation',  icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'historique', label: 'Historique',       icon: <History className="w-4 h-4" /> },
    { id: 'reminders',  label: 'Rappels',          icon: <Bell className="w-4 h-4" />, badge: overdueCount || (pendingCount > 0 ? pendingCount : 0) },
    ...(user?.role === 'admin'
      ? [{ id: 'equipe' as TabId, label: 'Équipe', icon: <Users className="w-4 h-4" /> }]
      : []),
  ];

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isInfonet ? 'bg-white' : 'bg-slate-50/50'
      }`}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.72)',
          borderBottom: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 2px 32px rgba(15,23,42,0.07), 0 1px 0 rgba(0,0,0,0.05)',
        }}
      >
        {/* Accent bar top */}
        <div
          className="h-0.5 w-full"
          style={{
            background: isInfonet
              ? `linear-gradient(90deg, ${INFONET_BRAND.primary}, #129d68)`
              : 'linear-gradient(90deg, #0f172a, #334155, #64748b)',
          }}
        />
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex items-center justify-between h-18" style={{ height: '72px' }}>

            {/* ── Logo / Site actif ── */}
            <div className="flex items-center gap-3.5 transition-all duration-200">
              {activeSite ? (
                <>
                  <SiteFavicon
                    site={activeSite}
                    size={40}
                    className="rounded-2xl shadow-sm border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-[16px] font-extrabold text-slate-900 leading-none tracking-tight">
                      {SITE_CONFIG[activeSite].label}
                    </span>
                    <a
                      href={SITE_CONFIG[activeSite].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-400 mt-1 leading-none font-medium tracking-wide hover:text-slate-600 transition-colors"
                    >
                      {SITE_CONFIG[activeSite].url.replace('https://', '')}
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isInfonet
                        ? `linear-gradient(135deg, ${INFONET_BRAND.primary}, #129d68)`
                        : 'linear-gradient(135deg, #1e293b, #475569)',
                      boxShadow: isInfonet
                        ? `0 6px 16px ${INFONET_BRAND.primary}40`
                        : '0 6px 16px rgba(15,23,42,0.25)',
                    }}
                  >
                    <Star className="text-white" style={{ width: '1.2rem', height: '1.2rem', fill: 'white' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[22px] font-extrabold text-slate-900 leading-none tracking-tight">E-Réputation</span>
                    <span className="text-[13px] text-slate-400 mt-1.5 leading-none font-medium tracking-wide">Back Office</span>
                  </div>
                </>
              )}
            </div>

            {/* ── Favicons des sites ── */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-slate-50/80 border border-slate-100">
              {(Object.entries(SITE_CONFIG) as [SiteKey, typeof SITE_CONFIG[SiteKey]][]).map(([key, cfg]) => {
                const isActive = activeTab === key;
                // Nom court : on retire les extensions (.fr, .com, …) pour rester compact
                const shortLabel = cfg.label.replace(/\.(fr|com|net|org)$/i, '');
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    title={cfg.label}
                    className={`relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                      isActive
                        ? 'bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)]'
                        : 'hover:bg-white/80 hover:shadow-sm'
                    }`}
                    style={isActive ? { boxShadow: `0 4px 14px ${cfg.color}30` } : undefined}
                  >
                    <SiteFavicon site={key} size={18} className="rounded-md flex-shrink-0" />
                    <span
                      className={`text-[9px] font-semibold leading-none tracking-wide transition-colors ${
                        isActive ? '' : 'text-slate-500'
                      }`}
                      style={isActive ? { color: cfg.color } : undefined}
                    >
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Droite ── */}
            <div className="flex items-center gap-2.5">
              {/* Pill statut connexion */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                connected
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`} />
                {connected ? 'Synchronisé' : 'Hors ligne'}
              </div>

              <div className="w-px h-5 bg-slate-100 hidden sm:block mx-1" />

              <NotificationBell
                notifications={reminders}
                onDismiss={(id) => setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r))}
                onDismissAll={() => setReminders(prev => prev.map(r => r.status === 'triggered' ? { ...r, status: 'dismissed' } : r))}
              />

              <div className="w-px h-5 bg-slate-100 hidden sm:block mx-1" />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`w-64 flex-shrink-0 flex flex-col py-6 z-10 sticky top-0 h-screen overflow-y-auto ${
            isInfonet ? 'bg-white' : 'bg-white/40 backdrop-blur-xl'
          }`}
          style={{ boxShadow: '4px 0 30px rgba(0, 0, 0, 0.02)' }}
        >
          <nav className="space-y-1 px-3">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              const siteCfg = Object.entries(SITE_CONFIG).find(([k]) => k === tab.id)?.[1];
              const isReminders = tab.id === 'reminders';
              const isAlertes  = tab.id === 'alertes';
              const hasUnreadAlert = isAlertes && unreadAlerts > 0;
              return (
                <button
                  key={tab.id}
                  onClick={tab.onClick ?? (() => setActiveTab(tab.id))}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all text-left group
                    ${isActive
                      ? isReminders
                        ? overdueCount > 0
                          ? 'bg-amber-50 text-amber-700 font-semibold'
                          : 'bg-slate-100 text-slate-900 font-semibold'
                        : isAlertes && hasUnreadAlert
                          ? 'bg-red-50 text-red-700 font-semibold'
                          : 'bg-white shadow-[0_4px_20px_rgb(0,0,0,0.04)] text-slate-900 font-semibold'
                      : isReminders && overdueCount > 0
                        ? 'text-amber-600 hover:bg-amber-50'
                        : hasUnreadAlert
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                    }
                  `}
                  style={
                    isActive && siteCfg && isInfonet && tab.id === 'infonet'
                      ? { boxShadow: `0 4px 20px ${INFONET_BRAND.primary}15` }
                      : {}
                  }
                >
                  <span className={`flex-shrink-0 transition-colors ${
                    hasUnreadAlert
                      ? 'text-red-500'
                      : isReminders && overdueCount > 0
                        ? 'text-amber-500'
                        : isActive
                          ? (siteCfg ? '' : 'text-slate-900')
                          : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {isAlertes && hasUnreadAlert
                      ? <span className="relative inline-flex"><Zap className="w-4 h-4 animate-pulse" /></span>
                      : tab.icon
                    }
                  </span>
                  <span className="flex-1">{tab.label}</span>
                  {/* Badge alertes */}
                  {isAlertes && unreadAlerts > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold leading-none bg-red-500 text-white">
                      {unreadAlerts}
                    </span>
                  )}
                  {/* Badge rappels */}
                  {isReminders && tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                      overdueCount > 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {isActive && !isReminders && !isAlertes && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background:
                          isInfonet && tab.id === 'infonet'
                            ? INFONET_BRAND.primary
                            : siteCfg?.text || '#334155',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mini widget alertes (si rappels échus) */}
          {overdueCount > 0 && activeTab !== 'reminders' && (
            <div className="mx-3 mt-3">
              <button
                onClick={() => setActiveTab('reminders')}
                className="w-full rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-3 text-left transition-all hover:shadow-md hover:border-amber-300 group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-700">
                    {overdueCount} rappel{overdueCount > 1 ? 's' : ''} échu{overdueCount > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-amber-600 leading-tight mb-2">
                  Des clients attendent d'être relancés
                </p>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 group-hover:gap-2 transition-all">
                  Voir les rappels
                  <span className="text-amber-400">→</span>
                </div>
              </button>
            </div>
          )}

          {/* Status legend */}
          <div
            className={`mt-auto px-6 py-6 ${
              isInfonet ? '' : ''
            }`}
          >
            <p className="text-[10px] mb-3 font-bold uppercase tracking-widest text-slate-400">
              Statuts
            </p>
            <div className="space-y-2">
              {(Object.entries(STATUS_CONFIG) as [ReviewStatus, typeof STATUS_CONFIG[ReviewStatus]][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                  <span className="text-xs font-medium text-slate-500">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-8 overflow-auto">
          {activeTab === 'dashboard' && (
            <Dashboard onNavigate={site => setActiveTab(site as TabId)} />
          )}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'alertes' && (
            <AlertesPage
              alerts={alerts}
              onDismiss={id => setAlerts(prev => prev.filter(a => a.id !== id))}
              onMarkAllRead={() => setAlerts(prev => prev.map(a => ({ ...a, read: true })))}
              onClearAll={() => setAlerts([])}
              onNavigate={(site, source, count) => {
                setReviewFocus({
                  site: site as SiteKey,
                  source: source as SourceKey,
                  count,
                  nonce: Date.now(),
                });
                setActiveTab(site as TabId);
              }}
            />
          )}
          {activeTab === 'all' && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Tous les avis</h1>
                <p className="text-slate-500 text-sm">Vue consolidée de toutes vos sources</p>
              </div>
              <SiteReviews site="all" refreshTrigger={refreshTrigger} />
            </div>
          )}
          {activeSite && (
            <div className="max-w-6xl mx-auto">
              <SiteReviews
                site={activeSite}
                refreshTrigger={refreshTrigger}
                focus={reviewFocus && reviewFocus.site === activeSite ? reviewFocus : undefined}
              />
            </div>
          )}
          {activeTab === 'scraping' && (
            <div className="max-w-4xl mx-auto">
              <ScrapingPanel onComplete={() => setRefreshTrigger(t => t + 1)} />
            </div>
          )}
          {activeTab === 'historique' && <HistoriquePage />}
          {activeTab === 'equipe' && user?.role === 'admin' && <EquipePage />}
          {activeTab === 'reminders' && (
            <div className="max-w-6xl mx-auto">
              <RemindersPage
                onReminderChange={() => fetchReminders().then(setReminders).catch(() => {})}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Toasts ──────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm max-w-sm
              ${notif.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : ''}
              ${notif.type === 'error'   ? 'bg-red-50 border border-red-200 text-red-700' : ''}
              ${notif.type === 'info'    ? 'bg-blue-50 border border-blue-200 text-blue-700' : ''}
            `}
          >
            {notif.type === 'success' && '✅'}
            {notif.type === 'error'   && '❌'}
            {notif.type === 'info'    && 'ℹ️'}
            {notif.message}
          </div>
        ))}
      </div>
    </div>
  );
}
