import { useState, useRef, useEffect, useCallback } from 'react';
import { AGENTS } from '../types';
import type { Agent } from '../types';
import { UserPlus, X, Check } from 'lucide-react';

interface AgentSelectorProps {
  value: string;           // IDs séparés par virgule, ex: "violaine,marc"
  onChange: (value: string) => void;
  readOnly?: boolean;
}

function AgentAvatar({ agent, size = 'sm', onRemove }: {
  agent: Agent; size?: 'xs' | 'sm' | 'md'; onRemove?: () => void;
}) {
  const sizes = { xs: 'w-5 h-5 text-[9px]', sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs' };
  return (
    <div className="relative group/avatar flex-shrink-0">
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white select-none`}
        style={{ backgroundColor: agent.color }}
        title={agent.name}
      >
        {agent.initials}
      </div>
      {onRemove && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-slate-600 hover:bg-red-500 rounded-full hidden group-hover/avatar:flex items-center justify-center transition-colors"
        >
          <X className="w-2 h-2 text-white" />
        </button>
      )}
    </div>
  );
}

export { AgentAvatar };

export default function AgentSelector({ value, onChange, readOnly = false }: AgentSelectorProps) {
  // État local pour feedback immédiat sans attendre l'API
  const [localIds, setLocalIds] = useState<string[]>(() =>
    value ? value.split(',').filter(Boolean) : []
  );
  const [open, setOpen] = useState(false);
  // Position fixe du dropdown pour échapper à overflow:hidden/auto du tableau
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  // Synchronise l'état local quand la prop value change (ex: depuis le parent)
  useEffect(() => {
    setLocalIds(value ? value.split(',').filter(Boolean) : []);
  }, [value]);

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        dropRef.current    && !dropRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const openDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }, []);

  const toggle = (agentId: string) => {
    const newIds = localIds.includes(agentId)
      ? localIds.filter(id => id !== agentId)
      : [...localIds, agentId];
    setLocalIds(newIds);      // mise à jour immédiate (optimiste)
    onChange(newIds.join(',')); // envoi à l'API en arrière-plan
  };

  const remove = (agentId: string) => {
    const newIds = localIds.filter(id => id !== agentId);
    setLocalIds(newIds);
    onChange(newIds.join(','));
  };

  const selectedAgents = localIds
    .map(id => AGENTS.find(a => a.id === id))
    .filter(Boolean) as Agent[];

  if (readOnly) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {selectedAgents.length > 0
          ? selectedAgents.map(a => <AgentAvatar key={a.id} agent={a} size="sm" />)
          : <span className="text-slate-400 text-xs italic">Non assigné</span>
        }
      </div>
    );
  }

  return (
    <>
      {/* Trigger */}
      <div ref={triggerRef} className="flex items-center gap-1 flex-wrap min-h-[28px]">
        {selectedAgents.map(a => (
          <AgentAvatar key={a.id} agent={a} size="sm" onRemove={() => remove(a.id)} />
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openDropdown(); }}
          className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 hover:border-slate-500 flex items-center justify-center transition-colors flex-shrink-0"
          title="Assigner un agent"
        >
          <UserPlus className="w-3 h-3 text-slate-400" />
        </button>
        {selectedAgents.length === 0 && !open && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); openDropdown(); }}
            className="text-xs text-slate-400 italic hover:text-slate-600 transition-colors"
          >
            Assigner
          </button>
        )}
      </div>

      {/* Dropdown rendu en position:fixed pour échapper à overflow du tableau */}
      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-2xl p-2 w-52"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 pb-2">
            Assigner à…
          </p>
          <div className="space-y-0.5">
            {AGENTS.map(agent => {
              const selected = localIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(agent.id); }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                    selected
                      ? 'bg-slate-100 font-medium text-slate-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <AgentAvatar agent={agent} size="md" />
                  <span className="flex-1">{agent.name}</span>
                  {selected && (
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: agent.color }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
