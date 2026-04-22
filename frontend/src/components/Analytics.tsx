import { useEffect, useState } from 'react';
import { fetchAnalytics } from '../api';
import { SITE_CONFIG, SOURCE_CONFIG } from '../types';
import type { SiteKey, SourceKey } from '../types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, MessageCircle, Clock,
  CheckCircle, AlertCircle, RefreshCw, Star, Zap,
} from 'lucide-react';

// ── Couleurs cohérentes avec les sites ───────────────────────────────────────
const RATING_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'];
const STATUS_COLORS = { todo: '#ef4444', in_progress: '#f59e0b', resolved: '#22c55e' };

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(mo) - 1]} ${y.slice(2)}`;
}
function formatWeek(w: string) { return w.replace('-W', ' S'); }

// ── Tooltip personnalisé ──────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name} :</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');

  const load = async () => {
    setLoading(true);
    try { setData(await fetchAnalytics()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Chargement des analytiques…</p>
      </div>
    </div>
  );
  if (!data) return null;

  const { kpis, weeklyEvolution, monthlyEvolution, ratingDistribution, bySource, bySite, statusDistribution, urgentReviews, resolutionRate } = data;
  const evolutionData = (period === 'monthly' ? monthlyEvolution : weeklyEvolution).map((d: any) => ({
    ...d,
    label: period === 'monthly' ? formatMonth(d.month) : formatWeek(d.week),
  }));

  // Pie data pour la répartition des notes
  const ratingPieData = [1,2,3,4,5].map(r => ({
    name: `${r} ★`,
    value: ratingDistribution.find((d: any) => d.rating === r)?.count || 0,
    color: RATING_COLORS[r - 1],
  })).reverse();

  // Pie data pour les statuts
  const statusPieData = [
    { name: 'À traiter',  value: statusDistribution.find((d: any) => d.status === 'todo')?.count || 0,        color: STATUS_COLORS.todo },
    { name: 'En cours',   value: statusDistribution.find((d: any) => d.status === 'in_progress')?.count || 0, color: STATUS_COLORS.in_progress },
    { name: 'Résolus',    value: statusDistribution.find((d: any) => d.status === 'resolved')?.count || 0,    color: STATUS_COLORS.resolved },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Analytiques</h1>
          <p className="text-slate-400 text-sm mt-0.5">Performances et tendances de votre e-réputation</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {/* ── KPIs avancés ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NPS */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-blue-50/80 text-blue-600"><Star className="w-4 h-4" /></div>
            <span className="text-slate-500 text-[13px] font-medium">Score NPS</span>
          </div>
          <div className={`text-4xl font-extrabold tracking-tight ${kpis.nps >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
            {kpis.nps > 0 ? '+' : ''}{kpis.nps}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">
            {kpis.nps >= 50 ? '🏆 Excellent' : kpis.nps >= 0 ? '👍 Bon' : '⚠️ À améliorer'}
          </div>
        </div>

        {/* Taux de réponse */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-violet-50/80 text-violet-600"><MessageCircle className="w-4 h-4" /></div>
            <span className="text-slate-500 text-[13px] font-medium">Taux de réponse</span>
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-violet-600">{kpis.responseRate}%</div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(kpis.responseRate, 100)}%` }} />
          </div>
        </div>

        {/* Délai de résolution */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-amber-50/80 text-amber-600"><Clock className="w-4 h-4" /></div>
            <span className="text-slate-500 text-[13px] font-medium">Délai résolution</span>
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-amber-500">
            {kpis.avgResolutionDays > 0 ? `${kpis.avgResolutionDays}j` : '—'}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">Moyenne pour les résolus</div>
        </div>

        {/* Avis ce mois */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-emerald-50/80 text-emerald-600"><Zap className="w-4 h-4" /></div>
            <span className="text-slate-500 text-[13px] font-medium">Ce mois-ci</span>
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-emerald-500">{kpis.thisMonth}</div>
          {kpis.monthGrowth !== null && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold mt-2 ${kpis.monthGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {kpis.monthGrowth >= 0
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />}
              {kpis.monthGrowth > 0 ? '+' : ''}{kpis.monthGrowth}% vs mois dernier
            </div>
          )}
        </div>
      </div>

      {/* ── Évolution des avis ───────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Évolution des avis</h2>
          <div className="flex gap-1 bg-slate-100/80 rounded-lg p-1 border border-slate-200/60">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${period === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >Mensuel</button>
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${period === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >Hebdo</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={evolutionData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="total"    name="Total"    stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="positive" name="Positifs" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="negative" name="Négatifs" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Répartition notes + Statuts ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Répartition des notes */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Répartition des notes</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={ratingPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {ratingPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} avis`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {ratingPieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-sm text-slate-600 flex-1">{d.name}</span>
                  <span className="text-sm font-semibold text-slate-800">{d.value}</span>
                  <span className="text-xs text-slate-400">
                    ({kpis.totalReviews > 0 ? Math.round((d.value / kpis.totalReviews) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Répartition des statuts */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Statuts de traitement</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} avis`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {statusPieData.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm text-slate-600">{d.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{d.value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ background: d.color, width: `${kpis.totalReviews > 0 ? (d.value / kpis.totalReviews) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Avis par source ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Avis par source</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bySource.map((s: any) => ({
            name: SOURCE_CONFIG[s.source as SourceKey]?.label || s.source,
            Total: s.total,
            Négatifs: s.negative,
            'Note moy.': parseFloat(s.avg_rating) || 0,
          }))} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis yAxisId="right" orientation="right" domain={[0,5]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Total"    fill="#3b82f6" radius={[4,4,0,0]} />
            <Bar yAxisId="left" dataKey="Négatifs" fill="#ef4444" radius={[4,4,0,0]} />
            <Line yAxisId="right" type="monotone" dataKey="Note moy." stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Comparaison par site ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Comparaison par site</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bySite.map((s: any) => ({
            name: SITE_CONFIG[s.site as SiteKey]?.label || s.site,
            'À traiter':  s.todo,
            'En cours':   s.in_progress,
            'Résolus':    s.resolved,
          }))} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="À traiter" stackId="a" fill={STATUS_COLORS.todo}        radius={[0,0,0,0]} />
            <Bar dataKey="En cours"  stackId="a" fill={STATUS_COLORS.in_progress} radius={[0,0,0,0]} />
            <Bar dataKey="Résolus"   stackId="a" fill={STATUS_COLORS.resolved}    radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Taux de résolution + Avis urgents ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Taux de résolution par site */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Taux de résolution
          </h2>
          <div className="space-y-3">
            {resolutionRate.map((s: any) => {
              const cfg = SITE_CONFIG[s.site as SiteKey];
              if (!cfg) return null;
              return (
                <div key={s.site}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <img src={cfg.favicon} alt={cfg.label} width={14} height={14} className="rounded-sm"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      <span className="text-sm text-slate-700">{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.resolved}/{s.total}</span>
                      <span className="text-sm font-bold" style={{ color: cfg.text }}>{s.rate}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.rate}%`, background: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Avis négatifs urgents */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" /> Avis négatifs non traités
          </h2>
          {urgentReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
              <CheckCircle className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-sm">Aucun avis négatif en attente !</p>
            </div>
          ) : (
            <div className="space-y-3">
              {urgentReviews.map((r: any) => {
                const cfg = SITE_CONFIG[r.site as SiteKey];
                return (
                  <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-red-600 text-sm font-bold">{'★'.repeat(r.rating)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-800">{r.author}</span>
                        {cfg && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: `${cfg.color}15`, color: cfg.text, border: `1px solid ${cfg.color}30` }}>
                            {cfg.label}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">{r.published_at}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{r.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Tableau récapitulatif ────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Récapitulatif par site</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Site</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Note moy.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">À traiter</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">En cours</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Résolus</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Taux résol.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">% Positifs</th>
              </tr>
            </thead>
            <tbody>
              {bySite.map((s: any, i: number) => {
                const cfg = SITE_CONFIG[s.site as SiteKey];
                if (!cfg) return null;
                const resol = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
                const posit = s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0;
                return (
                  <tr key={s.site} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <img src={cfg.favicon} alt={cfg.label} width={16} height={16} className="rounded-sm"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        <span className="font-medium text-slate-800">{cfg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{s.total}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-amber-700">{s.avg_rating || '—'} ★</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">{s.todo}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{s.in_progress}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{s.resolved}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${resol >= 50 ? 'text-emerald-700' : 'text-red-700'}`}>{resol}%</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${posit >= 60 ? 'text-emerald-700' : posit >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{posit}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
