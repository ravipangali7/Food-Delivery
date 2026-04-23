import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { getJson, patchFormData, patchFormDataWithProgress, patchJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { SuperSetting } from '@/types';

const LocationMiniMap = lazy(() => import('@/components/maps/LocationMiniMap'));

type SettingsTab = 'general' | 'location' | 'seo' | 'customerPages' | 'appVersion' | 'billing' | 'account';

const BASE_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'location', label: 'Location' },
  { id: 'seo', label: 'Seo' },
  { id: 'customerPages', label: 'About & legal' },
  { id: 'appVersion', label: 'App Version' },
  { id: 'account', label: 'Account' },
];

export default function AdminSettings() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<SettingsTab>('general');

  const {
    data: s,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['settings', token],
    queryFn: () => getJson<SuperSetting>('/api/settings/', token),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    latitude: '',
    longitude: '',
    delivery_charge_per_km: '',
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formCustomerPages, setFormCustomerPages] = useState({
    about_us: '',
    terms_and_conditions: '',
    privacy_policy: '',
  });

  const [formApp, setFormApp] = useState({
    android_version: '',
    ios_version: '',
    google_playstore_link: '',
    applestore_link: '',
  });
  const [androidApkFile, setAndroidApkFile] = useState<File | null>(null);
  const [iosIpaFile, setIosIpaFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [formBilling, setFormBilling] = useState({
    sms_cost_per_message: '',
    per_transaction_fee: '',
  });

  const isSuperAdmin = !!(user?.role === 'super_admin' || user?.is_superuser);
  const tabs: { id: SettingsTab; label: string }[] = isSuperAdmin
    ? [
        ...BASE_TABS.slice(0, 5),
        { id: 'billing' as const, label: 'Billing' },
        BASE_TABS[5]!,
      ]
    : BASE_TABS;

  useEffect(() => {
    if (!s) return;
    setForm({
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      delivery_charge_per_km: String(s.delivery_charge_per_km),
      meta_title: s.meta_title || '',
      meta_description: s.meta_description || '',
      meta_keywords: s.meta_keywords || '',
    });
    setLogoFile(null);
    setLogoPreview(s.logo || null);
    setFormCustomerPages({
      about_us: s.about_us || '',
      terms_and_conditions: s.terms_and_conditions || '',
      privacy_policy: s.privacy_policy || '',
    });
    setFormApp({
      android_version: s.android_version || '',
      ios_version: s.ios_version || '',
      google_playstore_link: s.google_playstore_link || '',
      applestore_link: s.applestore_link || '',
    });
    setAndroidApkFile(null);
    setIosIpaFile(null);
    setUploadProgress(null);
    setFormBilling({
      sms_cost_per_message:
        s.sms_cost_per_message != null ? String(s.sms_cost_per_message) : '',
      per_transaction_fee: s.per_transaction_fee != null ? String(s.per_transaction_fee) : '',
    });
  }, [s]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  useEffect(() => {
    if (!isSuperAdmin && tab === 'billing') {
      setTab('general');
    }
  }, [isSuperAdmin, tab]);

  const onPickLogo = (file: File | null) => {
    setLogoFile(file);
    setLogoPreview(prev => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      if (file) {
        return URL.createObjectURL(file);
      }
      return s?.logo || null;
    });
  };

  const saveGeneral = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      if (logoFile) {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('phone', form.phone || '');
        fd.append('logo_file', logoFile);
        return patchFormData<SuperSetting>(`/api/admin/settings/${s.id}/`, fd, token);
      }
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        {
          name: form.name,
          phone: form.phone || null,
        },
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setLogoFile(null);
      toast.success('General settings saved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save settings'),
  });

  const saveLocation = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        {
          address: form.address || null,
          latitude: form.latitude.trim() ? form.latitude : null,
          longitude: form.longitude.trim() ? form.longitude : null,
          delivery_charge_per_km: form.delivery_charge_per_km,
        },
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Location settings saved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save settings'),
  });

  const saveSeo = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        {
          meta_title: form.meta_title || null,
          meta_description: form.meta_description || null,
          meta_keywords: form.meta_keywords || null,
        },
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('SEO settings saved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save settings'),
  });

  const saveCustomerPages = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        {
          about_us: formCustomerPages.about_us.trim() || null,
          terms_and_conditions: formCustomerPages.terms_and_conditions.trim() || null,
          privacy_policy: formCustomerPages.privacy_policy.trim() || null,
        },
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('About & legal pages saved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save settings'),
  });

  const saveAppVersion = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      const hasFiles = Boolean(androidApkFile || iosIpaFile);
      const payload = {
        android_version: formApp.android_version.trim() || null,
        ios_version: formApp.ios_version.trim() || null,
        google_playstore_link: formApp.google_playstore_link.trim() || null,
        applestore_link: formApp.applestore_link.trim() || null,
      };
      if (hasFiles) {
        setUploadProgress(0);
        const fd = new FormData();
        if (payload.android_version != null) fd.append('android_version', payload.android_version);
        if (payload.ios_version != null) fd.append('ios_version', payload.ios_version);
        if (payload.google_playstore_link != null) {
          fd.append('google_playstore_link', payload.google_playstore_link);
        }
        if (payload.applestore_link != null) {
          fd.append('applestore_link', payload.applestore_link);
        }
        if (androidApkFile) fd.append('android_file_upload', androidApkFile);
        if (iosIpaFile) fd.append('ios_file_upload', iosIpaFile);
        return patchFormDataWithProgress<SuperSetting>(
          `/api/admin/settings/${s.id}/`,
          fd,
          token,
          pct => setUploadProgress(pct),
        );
      }
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        payload,
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setAndroidApkFile(null);
      setIosIpaFile(null);
      setUploadProgress(null);
      toast.success('App version settings saved.');
    },
    onError: (err: Error) => {
      setUploadProgress(null);
      toast.error(err.message || 'Could not save settings');
    },
  });

  const saveBilling = useMutation({
    mutationFn: async () => {
      if (!token || !s?.id) return;
      return patchJson<SuperSetting, Record<string, unknown>>(
        `/api/admin/settings/${s.id}/`,
        {
          sms_cost_per_message: formBilling.sms_cost_per_message.trim() || '0',
          per_transaction_fee: formBilling.per_transaction_fee.trim() || '0',
        },
        token,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Billing settings saved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save billing settings'),
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  if (isError && !s) {
    const msg =
      error instanceof Error ? error.message : 'Could not load store settings. Check your connection and API base.';
    return (
      <div className="max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-display font-bold text-foreground">Store Settings</h1>
        <p className="text-sm text-destructive">{msg}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if ((isLoading || isFetching) && !s) {
    return (
      <div className="p-8 text-muted-foreground text-sm">Loading store settings…</div>
    );
  }

  if (!s) {
    return (
      <div className="p-8 text-muted-foreground text-sm">
        No store configuration found. Create a store row in the database or open the public site once to bootstrap
        settings.
      </div>
    );
  }

  const roleLabel =
    user?.role === 'super_admin' || user?.is_superuser
      ? 'Super Admin'
      : user?.is_staff
        ? 'Admin'
        : 'Staff';

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
        Store Settings
      </h1>

      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-[10px] px-5 py-2.5 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        {tab === 'general' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Store Name <span className="text-destructive">*</span>
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Store Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Logo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={e => onPickLogo(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-border bg-muted/30 px-4 py-8 transition-colors hover:bg-muted/50',
                )}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Store logo"
                    className="max-h-28 max-w-[200px] object-contain"
                  />
                ) : (
                  <>
                    <span className="text-4xl" aria-hidden>
                      🍬
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      Click to upload logo
                    </span>
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                PNG, JPG, GIF or WebP. Upload replaces the current logo URL.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => saveGeneral.mutate()}
                disabled={saveGeneral.isPending || !form.name.trim()}
                className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
              >
                <Save size={18} strokeWidth={2.25} />
                {saveGeneral.isPending ? 'Saving…' : 'Save General Settings'}
              </button>
            </div>
          </div>
        )}

        {tab === 'location' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={3}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Location on map</label>
              <Suspense
                fallback={
                  <div className="flex h-[280px] w-full items-center justify-center rounded-[10px] border border-border bg-muted/30 text-sm text-muted-foreground">
                    Loading map…
                  </div>
                }
              >
                <LocationMiniMap
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onCoordinatesChange={(latitude, longitude) =>
                    setForm(f => ({ ...f, latitude, longitude }))
                  }
                  mapHeightClassName="h-[220px] sm:h-[240px] min-h-[180px]"
                />
              </Suspense>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Latitude</label>
                <input
                  value={form.latitude}
                  onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  placeholder="e.g. 27.7172"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Longitude</label>
                <input
                  value={form.longitude}
                  onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  placeholder="e.g. 85.3240"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Delivery charge per km (NPR)
              </label>
              <input
                value={form.delivery_charge_per_km}
                onChange={e => setForm(f => ({ ...f, delivery_charge_per_km: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                inputMode="decimal"
              />
            </div>
            <button
              type="button"
              onClick={() => saveLocation.mutate()}
              disabled={saveLocation.isPending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.25} />
              {saveLocation.isPending ? 'Saving…' : 'Save Location Settings'}
            </button>
          </div>
        )}

        {tab === 'seo' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Meta title</label>
              <input
                value={form.meta_title}
                onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Meta description
              </label>
              <textarea
                value={form.meta_description}
                onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                rows={3}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Meta keywords</label>
              <input
                value={form.meta_keywords}
                onChange={e => setForm(f => ({ ...f, meta_keywords: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder="Comma-separated"
              />
            </div>
            <button
              type="button"
              onClick={() => saveSeo.mutate()}
              disabled={saveSeo.isPending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.25} />
              {saveSeo.isPending ? 'Saving…' : 'Save SEO Settings'}
            </button>
          </div>
        )}

        {tab === 'customerPages' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Terms and privacy open on their own pages. The About us body is shown only on the customer About us page
              (not on profile or listings). Plain text; blank lines make paragraphs. Wrap a heading or phrase in{' '}
              <strong>**double asterisks**</strong> to show it in bold there.
            </p>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">About</h3>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">About us</label>
              <textarea
                value={formCustomerPages.about_us}
                onChange={e =>
                  setFormCustomerPages(f => ({ ...f, about_us: e.target.value }))
                }
                rows={8}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder={'**Our story**\n\nHow we began…\n\n**Visit us**\nMon–Sat 9–8'}
              />
            </div>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-2">Legal</h3>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Terms &amp; conditions</label>
              <textarea
                value={formCustomerPages.terms_and_conditions}
                onChange={e =>
                  setFormCustomerPages(f => ({ ...f, terms_and_conditions: e.target.value }))
                }
                rows={10}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder="Ordering, payment, delivery, cancellations, liability…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Privacy policy</label>
              <textarea
                value={formCustomerPages.privacy_policy}
                onChange={e =>
                  setFormCustomerPages(f => ({ ...f, privacy_policy: e.target.value }))
                }
                rows={10}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder="What data you collect and how you use it…"
              />
            </div>
            <button
              type="button"
              onClick={() => saveCustomerPages.mutate()}
              disabled={saveCustomerPages.isPending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.25} />
              {saveCustomerPages.isPending ? 'Saving…' : 'Save About & legal'}
            </button>
          </div>
        )}

        {tab === 'billing' && isSuperAdmin && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              SMS usage is charged after each successful OTP send (login and registration). Owner accounts
              (super admins and staff marked as store owner) accrue to <strong>Owner SMS due</strong>; other staff,
              customers, and delivery partners accrue to <strong>Restaurant SMS due</strong>. The per-order platform
              fee is taken from the global rate below whenever a customer places an order (even if no per-restaurant
              override exists in the system).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">SMS cost per OTP (NPR)</label>
                <input
                  value={formBilling.sms_cost_per_message}
                  onChange={e =>
                    setFormBilling(f => ({ ...f, sms_cost_per_message: e.target.value }))
                  }
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Per-order platform fee (NPR)
                </label>
                <input
                  value={formBilling.per_transaction_fee}
                  onChange={e =>
                    setFormBilling(f => ({ ...f, per_transaction_fee: e.target.value }))
                  }
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="rounded-[10px] border border-border bg-muted/20 px-4 py-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Accumulated dues (read-only)
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Owner SMS due</div>
                  <div className="text-sm font-semibold text-foreground">
                    NPR {Number(s.owner_sms_due ?? 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Restaurant SMS due</div>
                  <div className="text-sm font-semibold text-foreground">
                    NPR {Number(s.restaurant_sms_due ?? 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Restaurant platform due</div>
                  <div className="text-sm font-semibold text-foreground">
                    NPR {Number(s.restaurant_platform_due ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveBilling.mutate()}
              disabled={saveBilling.isPending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.25} />
              {saveBilling.isPending ? 'Saving…' : 'Save billing rates'}
            </button>
          </div>
        )}

        {tab === 'appVersion' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Set the published app version for each platform. When the mobile app version is below these values, users
              are prompted to update. Upload APK/IPA here or paste store links; if a store link is set, the app opens the
              store instead of downloading the package file.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Android version</label>
                <input
                  value={formApp.android_version}
                  onChange={e => setFormApp(f => ({ ...f, android_version: e.target.value }))}
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  placeholder="e.g. 1.0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">iOS version</label>
                <input
                  value={formApp.ios_version}
                  onChange={e => setFormApp(f => ({ ...f, ios_version: e.target.value }))}
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  placeholder="e.g. 1.0.1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Google Play Store link</label>
              <input
                value={formApp.google_playstore_link}
                onChange={e => setFormApp(f => ({ ...f, google_playstore_link: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder="https://play.google.com/..."
                inputMode="url"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Apple App Store link</label>
              <input
                value={formApp.applestore_link}
                onChange={e => setFormApp(f => ({ ...f, applestore_link: e.target.value }))}
                className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                placeholder="https://apps.apple.com/..."
                inputMode="url"
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Android package (APK)</label>
                {s.android_file ? (
                  <p className="mb-2 text-xs text-muted-foreground break-all">
                    Current:{' '}
                    <a
                      href={s.android_file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {s.android_file}
                    </a>
                  </p>
                ) : null}
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-[8px] file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                  onChange={e => setAndroidApkFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">iOS package (IPA)</label>
                {s.ios_file ? (
                  <p className="mb-2 text-xs text-muted-foreground break-all">
                    Current:{' '}
                    <a href={s.ios_file} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {s.ios_file}
                    </a>
                  </p>
                ) : null}
                <input
                  type="file"
                  accept=".ipa,.ipa/*"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-[8px] file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                  onChange={e => setIosIpaFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            {saveAppVersion.isPending && uploadProgress !== null ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => saveAppVersion.mutate()}
              disabled={saveAppVersion.isPending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.25} />
              {saveAppVersion.isPending ? 'Saving…' : 'Save App Version'}
            </button>
          </div>
        )}

        {tab === 'account' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Signed-in staff profile. Store open/closed is toggled from the top bar.
            </p>
            <div className="rounded-[10px] border border-border bg-muted/20 px-4 py-4 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Name
                </div>
                <div className="text-sm font-medium text-foreground">{user?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phone
                </div>
                <div className="text-sm font-medium text-foreground">{user?.phone ?? '—'}</div>
              </div>
              {user?.email ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                  </div>
                  <div className="text-sm font-medium text-foreground">{user.email}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Role
                </div>
                <div className="text-sm font-medium text-foreground">{roleLabel}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
