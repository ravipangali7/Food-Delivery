import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bike, Save, User } from 'lucide-react';
import { getJson, patchJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const inputClass =
  'w-full rounded-[11px] border border-[#E8E8E8] bg-[#F7F7F7] px-3 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25';

const roleBtnBase =
  'flex flex-1 items-center justify-center gap-2 rounded-[11px] border-2 px-4 py-4 text-sm font-medium transition-colors';
const roleBtnInactive = 'border-[#E5E5E5] bg-white text-foreground hover:bg-[#FAFAFA]';
const roleBtnActive =
  'border-[hsl(38_85%_48%)] bg-[hsl(33_100%_96%)] text-foreground shadow-[0_0_0_1px_hsl(38_85%_48%_/_0.08)]';

export default function AdminUserForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const deliveryPresetApplied = useRef(false);

  const { data: existing } = useQuery({
    queryKey: ['admin-user', id, token],
    queryFn: () => getJson<User>(`/api/admin/users/${id}/`, token),
    enabled: !!token && !!id,
  });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    email: '',
    address: '',
    is_active: true,
    is_staff: false,
    is_delivery_boy: false,
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      phone: existing.phone,
      password: '',
      email: existing.email || '',
      address: existing.address || '',
      is_active: existing.is_active,
      is_staff: existing.is_staff ?? false,
      is_delivery_boy: existing.is_delivery_boy,
    });
  }, [existing]);

  useEffect(() => {
    if (id || deliveryPresetApplied.current) return;
    if (searchParams.get('role') === 'delivery') {
      deliveryPresetApplied.current = true;
      setForm(f => ({ ...f, is_delivery_boy: true }));
      return;
    }
    if (pathname.includes('/delivery-boys/new')) {
      deliveryPresetApplied.current = true;
      setForm(f => ({ ...f, is_delivery_boy: true }));
    }
  }, [id, searchParams, pathname]);

  const listPath = form.is_delivery_boy ? '/admin/delivery-boys' : '/admin/customers';

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name,
        phone: form.phone,
        email: form.email || '',
        address: form.address || '',
        is_active: form.is_active,
        is_staff: form.is_staff,
        is_delivery_boy: form.is_delivery_boy,
      };
      if (form.password) body.password = form.password;
      if (isEdit && id) {
        return patchJson(`/api/admin/users/${id}/`, body, token);
      }
      if (!form.password && !isEdit) {
        throw new Error('Password required for new user');
      }
      return postJson('/api/admin/users/', body, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      navigate(form.is_delivery_boy ? '/admin/delivery-boys' : '/admin/customers');
    },
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div
      className="-mx-4 -mt-4 mb-[-1rem] min-h-[calc(100dvh-8rem)] w-[calc(100%+2rem)] bg-[#FAFAFA] px-4 pb-12 pt-6 md:-mx-6 md:-mt-6 md:mb-[-1.5rem] md:w-[calc(100%+3rem)] md:px-8 md:pb-14 md:pt-8"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <Link
            to={listPath}
            className="rounded-xl p-2 text-foreground transition-colors hover:bg-black/[0.04]"
            aria-label="Back to list"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1a1a1a]">
            {isEdit ? 'Edit User' : 'Add User'}
          </h1>
        </div>

        <section className="rounded-2xl border border-[#ECECEC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A9A]">
            Personal info
          </h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Phone *</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  disabled={isEdit}
                  className={cn(inputClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
                  autoComplete="tel"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">
                Password {isEdit ? '(leave blank to keep)' : '*'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={inputClass}
                autoComplete="email"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={3}
                className={cn(inputClass, 'min-h-[88px] resize-y')}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#ECECEC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A9A]">
            Role
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_delivery_boy: false }))}
              className={cn(roleBtnBase, !form.is_delivery_boy ? roleBtnActive : roleBtnInactive)}
            >
              <User className="h-5 w-5 shrink-0" strokeWidth={2} />
              Customer
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_delivery_boy: true }))}
              className={cn(roleBtnBase, form.is_delivery_boy ? roleBtnActive : roleBtnInactive)}
            >
              <Bike className="h-5 w-5 shrink-0" strokeWidth={2} />
              Delivery Boy
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#ECECEC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A9A]">
            Status
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="user-active"
              checked={form.is_active}
              onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
            />
            <label htmlFor="user-active" className="cursor-pointer text-sm font-medium">
              Active
            </label>
          </div>
        </section>

        {saveMut.isError && (
          <p className="text-sm text-destructive" role="alert">
            {saveMut.error instanceof Error ? saveMut.error.message : 'Could not save user.'}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Link
            to={listPath}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E5E5E5] bg-white px-6 text-sm font-medium text-foreground transition-colors hover:bg-[#FAFAFA]"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name || !form.phone}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Update User' : 'Save User'}
          </button>
        </div>
      </div>
    </div>
  );
}
