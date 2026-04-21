import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Eye, Folder, Pencil, Trash2, X } from 'lucide-react';
import { deleteJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Category, ParentCategory } from '@/types';
import { CollectionViewToggle } from '@/components/shared/CollectionViewToggle';
import { useCollectionViewMode } from '@/hooks/useCollectionViewMode';
type TreeNode = ParentCategory & { children?: Category[] };

const LIST_INDENT_PX = 18;
const VIEW_STORAGE_KEY = 'admin.categories.view';

function subtreeProductCount(c: TreeNode): number {
  const fromApi = (c as ParentCategory).products_count;
  if (fromApi != null) {
    return fromApi;
  }
  return (c.children ?? []).reduce((acc, ch) => acc + (ch.products_count ?? 0), 0);
}

export default function AdminCategoriesList() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useCollectionViewMode(VIEW_STORAGE_KEY, 'grid');
  const { pathname } = useLocation();
  const variant = pathname.endsWith('/parents') ? 'parents' : 'all';

  const { data: categoryRoots = [], isLoading } = useQuery({
    queryKey: ['admin-categories', token],
    queryFn: () => getJson<TreeNode[]>('/api/admin/categories/', token),
    enabled: !!token,
  });

  const rows = useMemo(() => {
    if (variant === 'parents') {
      return categoryRoots.map(c => ({
        node: c,
        depth: 0,
        parentLabel: null as string | null,
        rowKind: 'parent' as const,
      }));
    }
    const out: Array<{
      node: TreeNode | Category;
      depth: number;
      parentLabel: string | null;
      rowKind: 'parent' | 'sub';
    }> = [];
    for (const parent of categoryRoots) {
      out.push({ node: parent, depth: 0, parentLabel: null, rowKind: 'parent' });
      for (const sub of parent.children ?? []) {
        out.push({ node: sub, depth: 1, parentLabel: parent.name, rowKind: 'sub' });
      }
    }
    return out;
  }, [categoryRoots, variant]);

  const hasParentCategories = categoryRoots.length > 0;

  const deleteMut = useMutation({
    mutationFn: async ({ id, kind }: { id: number; kind: 'parent' | 'sub' }) => {
      const path =
        kind === 'parent' ? `/api/admin/parent-categories/${id}/` : `/api/admin/categories/${id}/`;
      return deleteJson(path, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-categories-flat'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parent-categories-flat'] });
      toast.success('Deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not delete');
    },
  });

  const handleDelete = (c: TreeNode | Category, kind: 'parent' | 'sub') => {
    const label = kind === 'parent' ? 'parent category' : 'subcategory';
    if (!window.confirm(`Delete ${label} “${c.name}”?`)) {
      return;
    }
    deleteMut.mutate({ id: c.id, kind });
  };

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
          {variant === 'parents' ? 'Parent Categories' : 'All Categories'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <CollectionViewToggle value={viewMode} onChange={setViewMode} />
          {variant === 'parents' ? (
            <Link
              to="/admin/parent-categories/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
            >
              + Add parent category
            </Link>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Link
                to={hasParentCategories ? '/admin/sub-categories/new' : '#'}
                aria-disabled={!hasParentCategories}
                onClick={e => {
                  if (!hasParentCategories) {
                    e.preventDefault();
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-opacity ${
                  hasParentCategories
                    ? 'bg-primary text-primary-foreground hover:opacity-95'
                    : 'cursor-not-allowed bg-muted text-muted-foreground opacity-70'
                }`}
                title={
                  hasParentCategories
                    ? undefined
                    : 'Add at least one parent category under Parent Categories first'
                }
              >
                + Add subcategory
              </Link>
              {!hasParentCategories ? (
                <span className="max-w-xs text-right text-xs text-muted-foreground">
                  Add a parent category first, then you can add subcategories here.
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {variant === 'parents'
            ? 'No parent categories yet. Add a top-level category to get started.'
            : 'No categories in the tree yet. Create parent categories first, then subcategories will appear here.'}
        </div>
      )}

      {!isLoading && rows.length > 0 && viewMode === 'list' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-3">Type</th>
                <th className="whitespace-nowrap px-3 py-3">ID</th>
                <th className="whitespace-nowrap px-3 py-3">Image</th>
                <th className="min-w-[140px] px-3 py-3">Name</th>
                <th className="whitespace-nowrap px-3 py-3">Slug</th>
                <th className="min-w-[100px] px-3 py-3">Parent</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Products</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Sort</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">Active</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node: c, depth, parentLabel, rowKind }) => {
                const isRoot = depth === 0;
                const isParent = rowKind === 'parent';
                const productCount = isParent
                  ? subtreeProductCount(c as TreeNode)
                  : (c as Category).products_count ?? 0;
                const storefrontHref = isParent
                  ? `/customer/parent/${c.id}`
                  : `/customer/category/${c.id}`;

                return (
                  <tr
                    key={`${rowKind}-${c.id}`}
                    className={cn(
                      'border-b border-border last:border-b-0 hover:bg-[hsl(var(--warning-bg))]/50',
                      isParent ? 'bg-muted/20' : '',
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          isParent
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
                        )}
                      >
                        {isParent ? 'Parent' : 'Sub'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{c.id}</td>
                    <td className="px-3 py-2.5">
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt=""
                          className="h-10 w-10 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        className="flex min-w-0 items-baseline gap-1"
                        style={{ paddingLeft: depth * LIST_INDENT_PX }}
                      >
                        {depth > 0 ? (
                          <span className="shrink-0 text-muted-foreground" aria-hidden>
                            └─
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'truncate',
                            isRoot ? 'font-semibold text-foreground' : 'text-foreground',
                          )}
                        >
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      <code className="text-xs">{c.slug}</code>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {parentLabel ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {productCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.sort_order}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.is_active ? (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-[hsl(var(--success))] text-primary-foreground"
                          title="Active"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-destructive text-destructive-foreground"
                          title="Inactive"
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Link
                          to={storefrontHref}
                          className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="View on storefront"
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          to={
                            isParent
                              ? `/admin/parent-categories/${c.id}/edit`
                              : `/admin/sub-categories/${c.id}/edit`
                          }
                          className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          type="button"
                          title="Delete"
                          className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                          disabled={deleteMut.isPending}
                          onClick={() => handleDelete(c, isParent ? 'parent' : 'sub')}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view: hierarchical tree (folder rows). List view: data table below. */}
      {!isLoading && rows.length > 0 && viewMode === 'grid' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border" role="list">
            {rows.map(({ node: c, depth, rowKind }) => {
              const isParent = rowKind === 'parent';
              const productCount = isParent
                ? subtreeProductCount(c as TreeNode)
                : (c as Category).products_count ?? 0;
              const storefrontHref = isParent
                ? `/customer/parent/${c.id}`
                : `/customer/category/${c.id}`;

              return (
                <li
                  key={`${rowKind}-${c.id}`}
                  role="listitem"
                  className={cn(
                    'flex flex-wrap items-center gap-3 px-4 py-3 transition-colors sm:flex-nowrap sm:gap-4',
                    'hover:bg-[hsl(var(--warning-bg))]/50',
                    isParent ? 'bg-muted/10' : '',
                  )}
                >
                  <div
                    className="flex min-w-0 flex-1 items-center gap-2"
                    style={{ paddingLeft: depth * LIST_INDENT_PX }}
                  >
                    {depth > 0 ? (
                      <span
                        className="shrink-0 font-mono text-sm leading-none text-muted-foreground"
                        aria-hidden
                      >
                        └
                      </span>
                    ) : null}
                    <Folder
                      className="h-5 w-5 shrink-0 text-amber-500"
                      aria-hidden
                      fill="currentColor"
                      fillOpacity={0.2}
                    />
                    <span
                      className={cn(
                        'truncate',
                        isParent ? 'font-semibold text-foreground' : 'text-foreground',
                      )}
                    >
                      {c.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                    {c.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--success))]/15 px-2 py-1 text-xs font-medium text-[hsl(var(--success))]">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[hsl(var(--success))] text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}

                    <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                      Sort: {c.sort_order}
                    </span>

                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm text-muted-foreground sm:w-28">
                      {isParent ? (
                        <span className="tabular-nums text-foreground">
                          {productCount} {productCount === 1 ? 'product' : 'products'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground"> </span>
                      )}
                    </span>

                    <div className="inline-flex shrink-0 items-center justify-end gap-0.5">
                      {isParent ? (
                        <Link
                          to={storefrontHref}
                          className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="View on storefront"
                        >
                          <Eye size={16} />
                        </Link>
                      ) : (
                        <span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
                      )}
                      <Link
                        to={
                          isParent
                            ? `/admin/parent-categories/${c.id}/edit`
                            : `/admin/sub-categories/${c.id}/edit`
                        }
                        className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        title="Delete"
                        className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                        disabled={deleteMut.isPending}
                        onClick={() => handleDelete(c, isParent ? 'parent' : 'sub')}
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
