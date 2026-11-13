import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import TextField from '../../components/ui/TextField';
import SelectField from '../../components/ui/SelectField';
import { Avatar, RoleBadge, StatusBadge } from '../../components/ui/Badges';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, SortHeader, Toolbar } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import useListState from '../../hooks/useListState';
import useAuth from '../../hooks/useAuth';
import { usersApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { fmtDate } from '../../utils/labels';

const ROLES = [{ value: 'candidat', label: 'Candidat' }, { value: 'recruteur', label: 'Recruteur' }, { value: 'admin', label: 'Administrateur' }];

export default function Users() {
  const { user: me } = useAuth();
  const list = useListState({ filters: { role: '', blocked: '' } });
  const { data, loading, error, reload } = useFetch((signal) => usersApi.list(list.params, signal).then((r) => r.data), [list.params]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'recruteur' });
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn) => {
    setBusy(true);
    try { const res = await fn(); toast.success(res.message); reload(); return true; } catch (err) { toast.error(errorMessage(err)); return false; } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Administration" title="Utilisateurs" actions={<Button icon={Plus} onClick={() => setCreating(true)}>Nouvel utilisateur</Button>} />
      <Toolbar search={list.q} onSearch={list.setQ} placeholder="Nom, e-mail…">
        <FilterSelect label="Rôle" value={list.filters.role} onChange={list.setFilter('role')} options={[{ value: '', label: 'Tous les rôles' }, ...ROLES]} />
        <FilterSelect label="État" value={list.filters.blocked} onChange={list.setFilter('blocked')} options={[{ value: '', label: 'Tous' }, { value: 'false', label: 'Actifs' }, { value: 'true', label: 'Bloqués' }]} />
      </Toolbar>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-80" /> : !data.items.length ? <EmptyState title="Aucun utilisateur" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-tw-line bg-tw-canvas/60"><tr>
                <SortHeader field="lastName" sort={list.sort} onSort={list.setSort}>Utilisateur</SortHeader>
                <SortHeader field="role" sort={list.sort} onSort={list.setSort}>Rôle</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">État</th>
                <SortHeader field="lastLoginAt" sort={list.sort} onSort={list.setSort}>Dernière connexion</SortHeader>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tw-muted">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-tw-line">
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar firstName={u.firstName} lastName={u.lastName} size="sm" /><div><p className="font-medium">{u.firstName} {u.lastName}</p><p className="text-xs text-tw-muted">{u.email}</p></div></div></td>
                    <td className="px-4 py-3">{u.id === me.id ? <RoleBadge role={u.role} /> : (
                      <select aria-label="Rôle" value={u.role} disabled={busy} onChange={(e) => act(() => usersApi.update(u.id, { role: e.target.value }))} className="h-8 rounded-md border border-tw-line bg-tw-surface px-1.5 text-xs">{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                    )}</td>
                    <td className="px-4 py-3"><button type="button" disabled={u.id === me.id || busy} onClick={() => act(() => usersApi.update(u.id, { isBlocked: !u.isBlocked }))} title={u.isBlocked ? 'Débloquer' : 'Bloquer'}><StatusBadge blocked={u.isBlocked} /></button></td>
                    <td className="px-4 py-3 text-xs text-tw-muted">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">{u.id !== me.id && <button type="button" onClick={() => setToDelete(u)} className="inline-grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-danger-soft hover:text-tw-danger" title="Supprimer"><Trash2 className="size-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPage={list.setPage} onLimit={list.setLimit} />
        </>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} busy={busy} title="Nouvel utilisateur"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Annuler</Button><Button loading={busy} onClick={async () => { if (await act(() => usersApi.create(form))) setCreating(false); }}>Créer</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <TextField label="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <TextField className="sm:col-span-2" label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Mot de passe" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <SelectField label="Rôle" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES} />
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} busy={busy} title="Supprimer cet utilisateur ?" confirmLabel="Supprimer"
        onConfirm={async () => { if (await act(() => usersApi.remove(toDelete.id))) setToDelete(null); }}>
        {toDelete?.firstName} {toDelete?.lastName} ({toDelete?.email}) sera supprimé définitivement.
      </ConfirmDialog>
    </div>
  );
}
