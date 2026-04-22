import { useEffect, useState } from 'react';
import { fetchStats } from '../api';
import type { GlobalStats, SiteKey } from '../types';
import { SITE_CONFIG } from '../types';
import StarRating from './StarRating';
import StatusBadge from './StatusBadge';
import { TrendingUp, MessageSquare, AlertCircle, CheckCircle, Clock, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';

interface DashboardProps {
  onNavigate: (site: string) => void;
}

function ScoreRing({ value, max = 5 }: { value: number; max?: number; color?: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((value || 0) / max, 1);
  const dash = pct * circ;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle
        cx="32" cy="32" r={r} fill="none"
        stroke="#94a3b8" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#475569">
        {value ?? '—'}
      </text>
    </svg>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function SiteAvatar({ site, size = 28 }: { site: SiteKey; size?: number }) {
  const cfg = SITE_CONFIG[site];
  const [src, setSrc] = useState(cfg.favicon);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(cfg.favicon);
    setFailed(false);
  }, [site, cfg.favicon]);

  if (failed) {
    return (
      <div
        className="rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold"
        style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)` }}
      >
        {cfg.label.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={cfg.label}
      width={size}
      height={size}
      className="rounded-lg border border-slate-100 shadow-sm flex-shrink-0 object-contain"
      onError={() => {
        if (src === cfg.favicon && cfg.faviconFallback && cfg.faviconFallback !== cfg.favicon) {
          setSrc(cfg.faviconFallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(iso));
  } catch { return iso; }
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (soft = false) => {
    if (soft) setRefreshing(true); else setLoading(true);
    try { setStats(await fetchStats()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
        <p className="text-sm text-slate-400">Chargement du tableau de bord…</p>
      </div>
    </div>
  );
  if (!stats) return null;

  const { totals, siteStats, recent } = stats;
  const resolvedPct = totals.total > 0 ? Math.round((totals.resolved / totals.total) * 100) : 0;

  return (
    <div className="space-y-7">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tableau de bord</h1>
          <p className="text-slate-400 text-sm mt-0.5">Vue globale de tous vos avis clients</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm text-slate-600 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label="Total avis"  value={totals.total}       sub={`${resolvedPct}% traités`} />
        <KPICard icon={<AlertCircle  className="w-4 h-4" />} label="À traiter"   value={totals.todo}        sub={totals.todo > 0 ? 'Action requise' : 'Tout est à jour'} />
        <KPICard icon={<Clock        className="w-4 h-4" />} label="En cours"    value={totals.in_progress} sub="En traitement" />
        <KPICard icon={<CheckCircle  className="w-4 h-4" />} label="Résolus"     value={totals.resolved}    sub={`sur ${totals.total} avis`} />
      </div>

      {/* ── Bannière note globale ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
        <div className="flex items-center gap-8 flex-wrap">

          {/* note */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Note moyenne globale</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-slate-800">{totals.avg_rating ?? '—'}</span>
              <span className="text-slate-400 text-lg">/&nbsp;5</span>
            </div>
            <div className="mt-2">
              <StarRating rating={Math.round(totals.avg_rating || 0)} size="lg" />
            </div>
          </div>

          <div className="hidden sm:block w-px h-16 bg-slate-100" />

          {/* résolution */}
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Résolution</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold text-slate-800">{resolvedPct}</span>
              <span className="text-slate-400 text-lg">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{totals.resolved} avis résolus</p>
          </div>

          <div className="hidden lg:block w-px h-16 bg-slate-100" />

          {/* mini barres */}
          <div className="hidden lg:block flex-1 max-w-[180px]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Répartition</p>
            <div className="space-y-2.5">
              <MiniBar label="Résolus"  value={totals.resolved}    total={totals.total} color="bg-slate-500" />
              <MiniBar label="En cours" value={totals.in_progress} total={totals.total} color="bg-slate-300" />
              <MiniBar label="À traiter" value={totals.todo}       total={totals.total} color="bg-slate-200" />
            </div>
          </div>

          <div className="ml-auto hidden sm:block">
            <TrendingUp className="w-10 h-10 text-slate-100" />
          </div>
        </div>
      </div>

      {/* ── Site cards ──────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Par site</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {siteStats.map(site => {
            const cfg = SITE_CONFIG[site.site];
            if (!cfg) return null;
            const positifPct = site.total > 0 ? Math.round((site.positive / site.total) * 100) : 0;
            const negatifPct = site.total > 0 ? Math.round((site.negative / site.total) * 100) : 0;
            const resolvedSitePct = site.total > 0 ? (site.resolved / site.total) * 100 : 0;
            const inProgSitePct  = site.total > 0 ? (site.in_progress / site.total) * 100 : 0;
            const todoSitePct    = site.total > 0 ? (site.todo / site.total) * 100 : 0;

            return (
              <div
                key={site.site}
                onClick={() => onNavigate(site.site)}
                className="group bg-white rounded-3xl overflow-hidden cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300"
                style={{ '--site-color': cfg.color } as React.CSSProperties}
              >
                {/* subtle top border */}
                <div className="h-px w-full bg-slate-100" />

                <div className="p-5">
                  {/* header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <SiteAvatar site={site.site} size={28} />
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight">{cfg.label}</h3>
                        <span className="text-xs text-slate-400">{site.total} avis</span>
                      </div>
                    </div>
                    <ScoreRing value={site.avg_rating} />
                  </div>

                  {/* stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <StatPill value={site.todo}        label="À traiter" dot="bg-slate-300" />
                    <StatPill value={site.in_progress} label="En cours"  dot="bg-slate-400" />
                    <StatPill value={site.resolved}    label="Résolus"   dot="bg-slate-600" />
                  </div>

                  {/* progress bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                    {resolvedSitePct > 0 && <div className="h-full bg-slate-600 transition-all" style={{ width: `${resolvedSitePct}%` }} />}
                    {inProgSitePct > 0  && <div className="h-full bg-slate-400 transition-all" style={{ width: `${inProgSitePct}%`  }} />}
                    {todoSitePct > 0    && <div className="h-full bg-slate-200 transition-all" style={{ width: `${todoSitePct}%`    }} />}
                  </div>

                  {/* footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-xs">
                      <span className="text-slate-500 font-semibold">↑ {positifPct}%</span>
                      <span className="text-slate-400 font-semibold">↓ {negatifPct}%</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                      Voir <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent reviews ──────────────────────────────────── */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
            Derniers avis à traiter
          </h2>
          <div className="space-y-2.5">
            {recent.map(review => {
              const siteCfg = SITE_CONFIG[review.site];
              return (
                <div
                  key={review.id}
                  className="group bg-white rounded-3xl p-5 flex items-start gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300"
                >
                  {/* avatar initiales */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 text-xs font-bold flex-shrink-0 bg-slate-100 border border-slate-200">
                    {getInitials(review.author)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{review.author}</span>
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border border-slate-200 bg-slate-50 text-slate-500">
                        {siteCfg?.label}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">{formatDate(review.published_at)}</span>
                    </div>
                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{review.content}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={review.status} />
                    {review.review_url && (
                      <a
                        href={review.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Voir l'avis sur Trustpilot"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.07)] transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className="p-1.5 rounded-lg bg-slate-50 text-slate-400">
          {icon}
        </span>
      </div>
      <div className="text-4xl font-extrabold tracking-tight text-slate-800">
        {value}
      </div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span><span className="font-semibold text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatPill({ value, label, dot }: { value: number; label: string; dot: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-50 rounded-xl py-2 px-1">
      <span className="text-lg font-bold text-slate-900">{value}</span>
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] text-slate-400 leading-none">{label}</span>
      </div>
    </div>
  );
}
