import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Folder } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Category, ParentCategory } from '@/types';

function selectionLabel(parents: ParentCategory[], categoryId: string): string {
  if (!categoryId) return '';
  const id = Number(categoryId);
  for (const p of parents) {
    for (const c of p.children ?? []) {
      if (c.id === id) return `${p.name} › ${c.name}`;
    }
  }
  return '';
}

/** Flatten search results: only subcategories are selectable; include path when filtering. */
function filteredSubcategories(parents: ParentCategory[], query: string): { id: number; label: string }[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const seen = new Set<number>();
  const out: { id: number; label: string }[] = [];

  for (const p of parents) {
    const pMatch = p.name.toLowerCase().includes(term);
    const children = p.children ?? [];

    for (const c of children) {
      const path = `${p.name} › ${c.name}`;
      const cMatch = c.name.toLowerCase().includes(term);
      const pathMatch = path.toLowerCase().includes(term);
      if (pMatch || cMatch || pathMatch) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          out.push({ id: c.id, label: path });
        }
      }
    }
  }

  return out;
}

type CategoryTreeSelectProps = {
  parents: ParentCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export function CategoryTreeSelect({
  parents,
  value,
  onChange,
  disabled,
  placeholder = 'Select category',
  id,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const display = useMemo(() => {
    const label = selectionLabel(parents, value);
    return label || placeholder;
  }, [parents, value, placeholder]);

  const searchMode = search.trim().length > 0;
  const searchHits = useMemo(() => filteredSubcategories(parents, search), [parents, search]);

  const pick = (id: number) => {
    onChange(String(id));
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between border-border rounded-lg p-3 h-auto min-h-10 font-normal text-left',
              !value && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{display}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-w-none rounded-lg border border-border bg-card" align="start">
          <div className="border-b border-border px-3 py-2">
            <Input
              placeholder="Search categories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 border-border"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[min(320px,50vh)]">
            {searchMode ? (
              <ul className="py-1">
                {searchHits.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">No categories match.</li>
                ) : (
                  searchHits.map(({ id: cid, label }) => (
                    <li key={cid} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => pick(cid)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/80',
                          String(cid) === value && 'bg-muted',
                        )}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {String(cid) === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <div className="py-1">
                {parents.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No categories yet.</p>
                ) : (
                  parents.map(parent => (
                    <div key={parent.id} className="border-b border-border last:border-0">
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground">
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.75} />
                        <span className="truncate">{parent.name}</span>
                      </div>
                      {(parent.children ?? []).map((c: Category) => (
                        <div key={c.id} className="flex w-full border-t border-border">
                          <div className="flex w-8 shrink-0 justify-end pt-2 pr-0.5" aria-hidden>
                            <div className="h-4 w-4 border-l-2 border-b-2 border-border rounded-bl-md" />
                          </div>
                          <button
                            type="button"
                            onClick={() => pick(c.id)}
                            className={cn(
                              'flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 pl-1 text-left text-sm hover:bg-muted/80',
                              String(c.id) === value && 'bg-muted',
                            )}
                          >
                            <Folder className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.75} />
                            <span className="min-w-0 flex-1 truncate">{c.name}</span>
                            {String(c.id) === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
