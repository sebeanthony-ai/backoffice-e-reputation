import { useState } from 'react';
import { SOURCE_CONFIG, SITE_CONFIG } from '../types';
import type { SourceKey, SiteKey } from '../types';

interface SourceBadgeProps {
  source: SourceKey;
  site?: SiteKey;
}

function SiteLogo({ siteCfg }: { siteCfg: (typeof SITE_CONFIG)[SiteKey] }) {
  const [err, setErr] = useState(false);
  const src = err ? siteCfg.faviconFallback : siteCfg.favicon;
  return (
    <img
      src={src}
      alt={siteCfg.label}
      width={13}
      height={13}
      className="rounded-sm flex-shrink-0 ring-1 ring-black/5"
      onError={() => setErr(true)}
    />
  );
}

export default function SourceBadge({ source, site }: SourceBadgeProps) {
  const srcCfg = SOURCE_CONFIG[source] || { label: source, icon: '🔗', color: '#94a3b8', text: '#475569', favicon: '' };
  const siteCfg = site ? SITE_CONFIG[site] : undefined;
  const [srcImgError, setSrcImgError] = useState(false);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
      style={siteCfg ? {
        background: `${siteCfg.color}12`,
        border: `1px solid ${siteCfg.color}30`,
        color: siteCfg.text,
      } : {
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        color: '#475569',
      }}
    >
      {/* Favicon du site client */}
      {siteCfg && <SiteLogo siteCfg={siteCfg} />}

      {/* Séparateur */}
      {siteCfg && <span className="w-px h-3 bg-current opacity-20 flex-shrink-0" />}

      {/* Favicon de la source (Trustpilot, etc.) */}
      {srcCfg.favicon && !srcImgError ? (
        <img
          src={srcCfg.favicon}
          alt={srcCfg.label}
          width={12}
          height={12}
          className="rounded-sm flex-shrink-0"
          onError={() => setSrcImgError(true)}
        />
      ) : (
        <span className="text-[10px] leading-none">{srcCfg.icon}</span>
      )}
      {srcCfg.label}
    </span>
  );
}
