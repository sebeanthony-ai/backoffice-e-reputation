import { useEffect, useState } from 'react';
import { Check, Loader2, Mail, Pencil, Plus, Shield, Trash2, User as UserIcon, X } from 'lucide-react';
import {
  createUserApi,
  deleteUserApi,
  fetchUsers,
  updateUserApi,
  type AuthUser,
  type UserRole,
} from '../api';
import { useAuth } from '../contexts/AuthContext';

type ErrorMap = Record<number, string | undefined>;

export default function EquipePage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<ErrorMap>({});

  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'agent' as UserRole,
  });
  const [submitting, setSubmitting] = useState(false);

  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const [editFor, setEditFor] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ email: string; name: string }>({
    email: '',
    name: '',
  });

  const reload = async () => {
    setLoading(true);
    try {
      const { users } = await fetchUsers();
      setUsers(users);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createUserApi({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
      });
      setForm({ email: '', name: '', password: '', role: 'agent' });
      await reload();
    } catch (err: any) {
      setFormError(err?.message || 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const setRowError = (id: number, msg?: string) =>
    setRowErrors((prev) => ({ ...prev, [id]: msg }));

  const changeRole = async (user: AuthUser, role: UserRole) => {
    if (user.role === role) return;
    try {
      await updateUserApi(user.id, { role });
      setRowError(user.id, undefined);
      await reload();
    } catch (err: any) {
      setRowError(user.id, err?.message || 'Mise à jour impossible');
    }
  };

  const handleDelete = async (user: AuthUser) => {
    if (!confirm(`Supprimer ${user.email} ?`)) return;
    try {
      await deleteUserApi(user.id);
      setRowError(user.id, undefined);
      await reload();
    } catch (err: any) {
      setRowError(user.id, err?.message || 'Suppression impossible');
    }
  };

  const startEdit = (user: AuthUser) => {
    setEditFor(user.id);
    setEditDraft({ email: user.email, name: user.name || '' });
    setResetFor(null);
  };

  const cancelEdit = () => {
    setEditFor(null);
    setEditDraft({ email: '', name: '' });
  };

  const submitEdit = async (user: AuthUser) => {
    try {
      await updateUserApi(user.id, {
        email: editDraft.email.trim(),
        name: editDraft.name.trim(),
      });
      setEditFor(null);
      setRowError(user.id, 'Profil mis à jour ✓');
      setTimeout(() => setRowError(user.id, undefined), 3000);
      await reload();
    } catch (err: any) {
      setRowError(user.id, err?.message || 'Échec de la mise à jour');
    }
  };

  const submitReset = async (user: AuthUser) => {
    if (resetPwd.length < 6) {
      setRowError(user.id, 'Mot de passe trop court (min. 6 caractères)');
      return;
    }
    try {
      await updateUserApi(user.id, { password: resetPwd });
      setResetFor(null);
      setResetPwd('');
      setRowError(user.id, 'Mot de passe mis à jour ✓');
      setTimeout(() => setRowError(user.id, undefined), 3000);
    } catch (err: any) {
      setRowError(user.id, err?.message || 'Échec de la mise à jour');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Équipe</h1>
        <p className="text-slate-500 text-sm">
          Gérez les comptes qui peuvent accéder au back office.
        </p>
      </div>

      {/* Création */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter un membre
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="email"
            required
            placeholder="email@exemple.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <input
            type="text"
            placeholder="Prénom / nom (optionnel)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe (≥ 6 caractères)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="agent">Agent</option>
            <option value="admin">Administrateur</option>
          </select>
          {formError && (
            <div className="md:col-span-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer le compte
            </button>
          </div>
        </form>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Membres ({users.length})
          </h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        {error && (
          <div className="p-5 text-xs font-medium text-red-700 bg-red-50 border-b border-red-100">
            {error}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <li key={u.id} className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{
                      background:
                        u.role === 'admin'
                          ? 'linear-gradient(135deg, #0f172a, #475569)'
                          : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                    }}
                  >
                    {(u.name || u.email).slice(0, 2).toUpperCase()}
                  </div>
                  {editFor === u.id ? (
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Nom"
                        className="px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                      <input
                        type="email"
                        value={editDraft.email}
                        onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                        placeholder="email@exemple.com"
                        className="px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {u.name || u.email}
                        </span>
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold">
                            <UserIcon className="w-3 h-3" /> Agent
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] text-slate-400 font-medium">(vous)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {u.email}
                      </div>
                    </div>
                  )}

                  {editFor === u.id ? (
                    <>
                      <button
                        onClick={() => submitEdit(u)}
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                        title="Enregistrer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as UserRole)}
                        disabled={isSelf && u.role === 'admin'}
                        className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium bg-white disabled:opacity-50"
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>

                      <button
                        onClick={() => startEdit(u)}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                        title="Modifier email / nom"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setResetFor((x) => (x === u.id ? null : u.id));
                          setResetPwd('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        Réinit. mot de passe
                      </button>

                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isSelf}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isSelf ? 'Impossible de se supprimer soi-même' : 'Supprimer'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {resetFor === u.id && (
                  <div className="flex items-center gap-2 pl-12">
                    <input
                      type="password"
                      placeholder="Nouveau mot de passe (≥ 6)"
                      value={resetPwd}
                      onChange={(e) => setResetPwd(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    <button
                      onClick={() => submitReset(u)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => {
                        setResetFor(null);
                        setResetPwd('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {rowErrors[u.id] && (
                  <div className="pl-12 text-[11px] font-medium text-red-600">
                    {rowErrors[u.id]}
                  </div>
                )}
              </li>
            );
          })}
          {!loading && users.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              Aucun utilisateur.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
