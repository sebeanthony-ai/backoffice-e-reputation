import { STATUS_CONFIG } from '../types';
import type { ReviewStatus } from '../types';

interface StatusBadgeProps {
  status: ReviewStatus;
  onClick?: () => void;
}

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border cursor-pointer transition-all hover:opacity-80
        ${cfg.bg} ${cfg.color}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}
