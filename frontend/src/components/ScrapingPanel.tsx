import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { triggerScrapingAll, triggerScraping, fetchScrapingLogs, fetchScrapingStatus } from '../api';
import { SITE_CONFIG, SOURCE_CONFIG } from '../types';
import type { SiteKey, SourceKey } from '../types';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Layers } from 'lucide-react';

const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

interface ScrapingLog {
  id: number; site: string; source: string; status: string;
  reviews_found: number; error_message: string | null; scraped_at: string;
}
interface ScrapingPanelProps { onComplete?: () => void; }

const SCRAPE_SOURCES: { site: SiteKey; source: SourceKey; label: string }[] = [
  { site: 'infonet',  source: 'trustpilot',      label: 'Infonet · Trustpilot' },
  { site: 'postmee',  source: 'trustpilot',      label: 'Postmee · Trustpilot' },
  { site: 'startdoc', source: 'trustpilot',      label: 'Startdoc · Trustpilot' },
  { site: 'wenony',   source: 'trustpilot',      label: 'Wenony · Trustpilot' },
  { site: 'legaleo',         source: 'trustpilot', label: 'Legaleo · Trustpilot' },
  { site: 'lesentreprises', source: 'trustpilot', label: 'LesEntreprises · Trustpilot' },
  { site: 'datalegal',      source: 'trustpilot', label: 'DataLegal · Trustpilot' },
  { site: 'infonet',  source: 'signal-arnaques', label: 'Infonet · Signal Arnaques' },
  { site: 'infonet',  source: '60millions',      label: 'Infonet · 60 Millions Conso' },
];

interface ProgressState {
  current: number;
  total: number;
  site?: string;
  source?: string;
  phase: 'start' | 'done' | 'error';
}

export default function ScrapingPanel({ onComplete }: ScrapingPanelProps) {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [running, setRunning] = useState(false);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  // Mode approfondi : 10 pages Trustpilot par site (~15 min) au lieu de 3 (~4 min).
  // Utile pour reconstruire l'historique après une interruption du cron, ou
  // récupérer un site qui a reçu un afflux d'avis (> 60 en une journée).
  const [deepScrape, setDeepScrape] = useState(false);

  const loadLogs = async () => {
    const data = await fetchScrapingLogs();
    setLogs(data);
    if (data.length > 0) setLastRun(data[0].scraped_at);
  };

  useEffect(() => {
    loadLogs();

    // Vérifier si un scraping est déjà en cours au montage
    fetchScrapingStatus().then((s: { inProgress: boolean }) => {
      if (s.inProgress) { setRunning(true); setRunningSource('en cours…'); }
    }).catch(() => {});

    // Écouter les événements temps réel
    socket.on('scrape_status', ({ inProgress, source }: { inProgress: boolean; source?: string }) => {
      setRunning(inProgress);
      setRunningSource(inProgress ? (source ?? 'en cours…') : null);
      if (!inProgress) {
        setProgress(null);
        loadLogs();
        onComplete?.();
      }
    });

    socket.on('scrape_progress', (p: ProgressState) => {
      setProgress(p);
      // Sur 'done' on rafraîchit les logs pour cocher les sources terminées
      // sans attendre la fin de toute la batch.
      if (p.phase === 'done') loadLogs();
    });

    socket.on('scrape_all_complete', () => {
      setRunning(false);
      setRunningSource(null);
      setProgress(null);
      loadLogs();
      onComplete?.();
    });

    socket.on('scrape_complete', () => { loadLogs(); onComplete?.(); });

    return () => {
      socket.off('scrape_status');
      socket.off('scrape_progress');
      socket.off('scrape_all_complete');
      socket.off('scrape_complete');
    };
  }, []);

  const runAll = async () => {
    setError(null);
    setRunning(true);
    setRunningSource('manual-all');
    setProgress({ current: 0, total: SCRAPE_SOURCES.length, phase: 'start' });
    try {
      // quick=false (deepScrape ON) => 10 pages Trustpilot par site (~15 min).
      // quick=true  (défaut)        => 3 pages Trustpilot par site (~4 min).
      await triggerScrapingAll({ quick: !deepScrape });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError('Une synchronisation est déjà en cours — patientez quelques minutes.');
      } else {
        setError('Erreur lors du lancement de la synchronisation.');
      }
      setRunning(false);
      setRunningSource(null);
      setProgress(null);
    }
  };

  const runSingle = async (site: SiteKey, source: SourceKey) => {
    setError(null);
    try {
      await triggerScraping(site, source, { quick: !deepScrape });
      setTimeout(() => { loadLogs(); onComplete?.(); }, 3000);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setError('Une synchronisation est déjà en cours.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Collecte des avis</h2>
          <p className="text-slate-500 text-sm mt-1">
            Importez automatiquement les nouveaux avis depuis toutes vos sources
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle "Scrape approfondi" :
              - OFF (défaut) : 3 pages Trustpilot (~60 derniers avis) ≈ 4 min
              - ON           : 10 pages Trustpilot (~200 derniers avis) ≈ 15 min */}
          <button
            type="button"
            onClick={() => setDeepScrape(v => !v)}
            disabled={running}
            title={
              deepScrape
                ? 'Mode approfondi activé : 10 pages Trustpilot par site (~15 min)'
                : 'Mode rapide : 3 pages Trustpilot par site (~4 min). Active pour un scrape complet.'
            }
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
              deepScrape
                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className={`w-4 h-4 ${deepScrape ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Approfondi</span>
            <span
              role="switch"
              aria-checked={deepScrape}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                deepScrape ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  deepScrape ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          <button
            onClick={runAll} disabled={running}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              deepScrape
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running
              ? 'Collecte en cours...'
              : deepScrape
                ? 'Scrape approfondi (~15 min)'
                : 'Tout synchroniser (~4 min)'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {lastRun && (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4" />
            Dernière sync : {new Date(lastRun).toLocaleString('fr-FR')}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Bandeau de progression — affiché pendant tout le scraping */}
      {running && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
          <div className="flex items-start gap-3 mb-3">
            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">
                {runningSource === 'cron'
                  ? 'Synchronisation automatique en cours…'
                  : 'Synchronisation manuelle en cours…'}
              </div>
              {progress && progress.total > 0 ? (
                <div className="text-xs text-slate-500 mt-0.5">
                  {progress.current > 0 ? (
                    <>
                      Étape <span className="font-medium text-slate-700">{progress.current}/{progress.total}</span>
                      {progress.site && progress.source && (
                        <>
                          {' — '}
                          <span className="font-medium text-slate-700">
                            {SITE_CONFIG[progress.site as SiteKey]?.label || progress.site}
                          </span>
                          {' · '}
                          {SOURCE_CONFIG[progress.source as SourceKey]?.label || progress.source}
                        </>
                      )}
                    </>
                  ) : (
                    <>Préparation…</>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-0.5">
                  Cela peut prendre quelques minutes — vous pouvez continuer à travailler.
                </div>
              )}
            </div>
          </div>

          {progress && progress.total > 0 && (
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Individual sources */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sources individuelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCRAPE_SOURCES.map(({ site, source, label }) => {
            const siteCfg = SITE_CONFIG[site];
            const srcCfg = SOURCE_CONFIG[source];
            const lastLog = logs.find(l => l.site === site && l.source === source);

            return (
              <div key={`${site}-${source}`} className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <img src={siteCfg.favicon} alt={siteCfg.label} width={14} height={14}
                          className="rounded-sm flex-shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                        <img src={srcCfg.favicon} alt={srcCfg.label} width={14} height={14}
                          className="rounded-sm flex-shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <span className="text-slate-800 text-sm font-medium">{label}</span>
                    </div>
                    {lastLog && (
                      <div className={`text-xs mt-1 ${lastLog.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {lastLog.status === 'success'
                          ? `${lastLog.reviews_found} nouveaux avis`
                          : `Erreur: ${lastLog.error_message}`}
                      </div>
                    )}
                  </div>
                  {lastLog?.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  {lastLog?.status === 'error'   && <AlertCircle className="w-4 h-4 text-red-500   flex-shrink-0" />}
                </div>
                <button
                  onClick={() => runSingle(site, source)}
                  className="w-full text-xs px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Synchroniser
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs table */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Historique des synchronisations</h3>
          <div className="overflow-x-auto rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-slate-500 font-medium text-xs">Date</th>
                  <th className="px-4 py-3 text-left text-slate-500 font-medium text-xs">Site</th>
                  <th className="px-4 py-3 text-left text-slate-500 font-medium text-xs">Source</th>
                  <th className="px-4 py-3 text-left text-slate-500 font-medium text-xs">Nouveaux avis</th>
                  <th className="px-4 py-3 text-left text-slate-500 font-medium text-xs">Statut</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.scraped_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-slate-800 text-xs">
                      {SITE_CONFIG[log.site as SiteKey]?.label || log.site}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {SOURCE_CONFIG[log.source as SourceKey]?.icon} {SOURCE_CONFIG[log.source as SourceKey]?.label || log.source}
                    </td>
                    <td className="px-4 py-3 text-slate-800 text-xs font-medium">{log.reviews_found ?? '-'}</td>
                    <td className="px-4 py-3">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Succès
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full" title={log.error_message || ''}>
                          <AlertCircle className="w-3 h-3" /> Erreur
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
