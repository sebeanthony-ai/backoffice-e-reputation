import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { triggerScrapingAll, triggerScraping, fetchScrapingLogs, fetchScrapingStatus } from '../api';
import { SITE_CONFIG, SOURCE_CONFIG } from '../types';
import type { SiteKey, SourceKey } from '../types';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

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

export default function ScrapingPanel({ onComplete }: ScrapingPanelProps) {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [running, setRunning] = useState(false);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!inProgress) { loadLogs(); onComplete?.(); }
    });

    socket.on('scrape_all_complete', () => {
      setRunning(false);
      setRunningSource(null);
      loadLogs();
      onComplete?.();
    });

    socket.on('scrape_complete', () => { loadLogs(); onComplete?.(); });

    return () => {
      socket.off('scrape_status');
      socket.off('scrape_all_complete');
      socket.off('scrape_complete');
    };
  }, []);

  const runAll = async () => {
    setError(null);
    setRunning(true);
    setRunningSource('manual-all');
    try {
      await triggerScrapingAll();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError('Une synchronisation est déjà en cours — patientez quelques minutes.');
      } else {
        setError('Erreur lors du lancement de la synchronisation.');
      }
      setRunning(false);
      setRunningSource(null);
    }
  };

  const runSingle = async (site: SiteKey, source: SourceKey) => {
    setError(null);
    try {
      await triggerScraping(site, source);
      setTimeout(() => { loadLogs(); onComplete?.(); }, 3000);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setError('Une synchronisation est déjà en cours.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Collecte des avis</h2>
          <p className="text-slate-500 text-sm mt-1">
            Importez automatiquement les nouveaux avis depuis toutes vos sources
          </p>
        </div>
        <button
          onClick={runAll} disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Collecte en cours...' : 'Tout synchroniser'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {lastRun && (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4" />
            Dernière sync : {new Date(lastRun).toLocaleString('fr-FR')}
          </div>
        )}
        {running && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            {runningSource === 'cron' ? 'Synchronisation automatique en cours…' : 'Synchronisation manuelle en cours…'}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

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
