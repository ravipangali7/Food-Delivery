import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Category } from '@/types';

export default function AdminSubCategoryView() {
  const { id } = useParams();
  const { token } = useAuth();

  const { data: category, isLoading } = useQuery({
    queryKey: ['admin-sub-category', id, token],
    queryFn: () => getJson<Category>(`/api/admin/categories/${id}/`, token),
    enabled: !!token && !!id,
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  if (isLoading || !category) {
    return <div className="p-8 text-muted-foreground">{isLoading ? 'Loading…' : 'Not found'}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/categories/all" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subcategory</p>
          <h1 className="text-2xl font-display font-bold">{category.name}</h1>
        </div>
      </div>

      {category.image_url ? (
        <img src={category.image_url} alt="" className="w-full max-h-64 object-cover rounded-xl border" />
      ) : (
        <div className="w-full h-40 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
          No image
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Parent ID</p>
          <p className="font-mono">{category.parent_id}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Slug</p>
          <p className="font-mono">{category.slug}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Active</p>
          <p>{category.is_active ? 'Yes' : 'No'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Updated</p>
          <p>{formatDate(category.updated_at)}</p>
        </div>
      </div>

      {category.description && (
        <div>
          <h3 className="font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{category.description}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          to={`/admin/sub-categories/${id}/edit`}
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
        >
          Edit
        </Link>
        <Link to="/admin/categories/all" className="inline-block px-6 py-2 border border-border rounded-lg text-sm">
          Back to list
        </Link>
      </div>
    </div>
  );
}
