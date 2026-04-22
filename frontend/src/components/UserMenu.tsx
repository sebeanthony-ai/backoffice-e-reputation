import { useEffect, useRef, useState } from 'react';
import { LogOut, Shield, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 transition"
        title={user.email}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{
            background:
              user.role === 'admin'
                ? 'linear-gradient(135deg, #0f172a, #475569)'
                : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
          }}
        >
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {user.name || user.email}
              </span>
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 truncate block">{user.email}</span>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
          {user.role !== 'admin' && (
            <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
              <UserIcon className="w-3 h-3" />
              Agent
            </div>
          )}
        </div>
      )}
    </div>
  );
}
