import { useState, useEffect } from 'react';
import { SITE_CONFIG } from '../types';
import type { SiteKey } from '../types';

interface SiteFaviconProps {
  site: SiteKey;
  size?: number;
  className?: string;
}

/**
 * Affiche le logo Clearbit du site avec fallback vers Google Favicons,
 * puis masque si les deux échouent.
 */
export default function SiteFavicon({ site, size = 16, className = '' }: SiteFaviconProps) {
  const cfg = SITE_CONFIG[site];
  const [src, setSrc] = useState(cfg.favicon);
  const [failed, setFailed] = useState(false);

  // Réinitialise le logo quand on change de site
  useEffect(() => {
    setSrc(cfg.favicon);
    setFailed(false);
  }, [site, cfg.favicon]);

  if (!cfg || failed) return null;

  return (
    <img
      src={src}
      alt={cfg.label}
      width={size}
      height={size}
      className={`rounded-sm flex-shrink-0 object-contain ${className}`}
      onError={() => {
        if (src === cfg.favicon && cfg.faviconFallback) {
          setSrc(cfg.faviconFallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
