import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react';
import { deleteJson, getJson, patchFormData, patchJson, postFormData } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminBanner } from '@/types';

type EditorMode = { kind: 'new' } | { kind: 'edit'; banner: AdminBanner } | null;

function buildBannerFormData(url: string, isActive: boolean, imageFile: File | null): FormData {
  const fd = new FormData();
  fd.append('url', url.trim());
  fd.append('is_active', isActive ? 'true' : 'false');
  if (imageFile) {
    fd.append('image', imageFile);
  }
  return fd;
}

export default function AdminBanners() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorMode>(null);
  const [formUrl, setFormUrl] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['admin-banners', token],
    queryFn: () => getJson<AdminBanner[]>('/api/admin/banners/', token),
    enabled: !!token,
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.kind === 'new') {
      setFormUrl('');
      setFormActive(true);
      setImageFile(null);
      setPreviewUrl(null);
      return;
    }
    setFormUrl(editor.banner.url || '');
    setFormActive(editor.banner.is_active);
    setImageFile(null);
    setPreviewUrl(editor.banner.image_url);
  }, [editor]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onPickImage = (file: File | null) => {
    setImageFile(file);
    setPreviewUrl(prev => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      if (file) {
        return URL.createObjectURL(file);
      }
      if (editor?.kind === 'edit') {
        return editor.banner.image_url;
      }
      return null;
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    queryClient.invalidateQueries({ queryKey: ['banners'] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not signed in');
      if (editor?.kind === 'new') {
        if (!imageFile) {
          throw new Error('Choose an image for the new banner.');
        }
        const fd = buildBannerFormData(formUrl, formActive, imageFile);
        return postFormData<AdminBanner>('/api/admin/banners/', fd, token);
      }
      if (editor?.kind === 'edit') {
        const id = editor.banner.id;
        if (imageFile) {
          const fd = buildBannerFormData(formUrl, formActive, imageFile);
          return patchFormData<AdminBanner>(`/api/admin/banners/${id}/`, fd, token);
        }
        return patchJson<AdminBanner, { url: string; is_active: boolean }>(
          `/api/admin/banners/${id}/`,
          { url: formUrl.trim(), is_active: formActive },
          token,
        );
      }
      throw new Error('Nothing to save');
    },
    onSuccess: () => {
      invalidate();
      toast.success(editor?.kind === 'new' ? 'Banner added' : 'Banner updated');
      setEditor(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save banner'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      patchJson<AdminBanner, { is_active: boolean }>(`/api/admin/banners/${id}/`, { is_active }, token),
    onSuccess: () => {
      invalidate();
      toast.success('Banner status updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not update banner'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/admin/banners/${id}/`, token),
    onSuccess: () => {
      invalidate();
      toast.success('Banner removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete banner'),
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Banners</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Promotional images on the customer home, explore, and sweets pages. Inactive banners stay hidden from
            the storefront but remain here for editing — same data as Django admin under Core → Banners.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          onClick={() => setEditor({ kind: 'new' })}
          disabled={!!editor}
        >
          <Plus size={18} />
          Add banner
        </button>
      </div>

      {editor && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{editor.kind === 'new' ? 'New banner' : 'Edit banner'}</h2>
            <button
              type="button"
              className="p-2 rounded-md text-muted-foreground hover:bg-muted"
              onClick={() => setEditor(null)}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Image {editor.kind === 'new' ? '(required)' : '(optional)'}</label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm"
                onChange={e => onPickImage(e.target.files?.[0] ?? null)}
              />
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="mt-2 max-h-40 rounded-md border border-border object-contain bg-muted/30"
                />
              ) : null}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="banner-url">
                  Link URL
                </label>
                <input
                  id="banner-url"
                  type="url"
                  placeholder="https://…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Optional tap target when the customer opens the banner.</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  className="rounded border-input"
                />
                Active (visible on storefront)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              Save
            </button>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted"
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f0e8] text-xs uppercase text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 font-semibold w-28">Preview</th>
                <th className="text-left px-4 py-3 font-semibold">Link</th>
                <th className="text-left px-4 py-3 font-semibold w-32">Active</th>
                <th className="text-right px-4 py-3 font-semibold w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b, i) => (
                <tr key={b.id} className={i % 2 === 1 ? 'bg-muted/25' : 'bg-card'}>
                  <td className="px-4 py-2">
                    {b.image_url ? (
                      <img
                        src={b.image_url}
                        alt=""
                        className="h-14 w-24 object-cover rounded border border-border"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 max-w-md">
                    {b.url ? (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 break-all hover:underline"
                      >
                        {b.url}
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={b.is_active}
                      onChange={e => toggleMut.mutate({ id: b.id, is_active: e.target.checked })}
                      disabled={toggleMut.isPending}
                      className="rounded border-input"
                      title="Show on storefront"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit"
                        className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        disabled={!!editor}
                        onClick={() => setEditor({ kind: 'edit', banner: b })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-destructive"
                        onClick={() => {
                          if (!window.confirm('Delete this banner?')) return;
                          deleteMut.mutate(b.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {banners.length === 0 && (
            <p className="px-4 py-8 text-center text-muted-foreground">No banners yet. Add one to show on the app.</p>
          )}
        </div>
      )}
    </div>
  );
}
