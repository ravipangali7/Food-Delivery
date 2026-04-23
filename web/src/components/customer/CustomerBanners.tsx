import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getJson } from '@/lib/api';
import type { Banner } from '@/types';

const AUTO_SLIDE_MS = 5000;

function BannerTarget({ url, children }: { url?: string | null; children: ReactNode }) {
  const u = url?.trim() ?? '';
  const cls = 'block h-full w-full';
  if (!u) {
    return <div className={cls}>{children}</div>;
  }
  if (u.startsWith('/') && !u.startsWith('//')) {
    return (
      <Link to={u} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  );
}

export default function CustomerBanners({ className = '' }: { className?: string }) {
  const { data: banners = [] } = useQuery({
    queryKey: ['banners'],
    queryFn: () => getJson<Banner[]>('/api/banners/', null),
  });

  const items = banners.filter(b => b.image);
  const n = items.length;
  const [index, setIndex] = useState(0);
  const multi = n > 1;

  useEffect(() => {
    setIndex(i => (n ? Math.min(i, n - 1) : 0));
  }, [n]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (n < 2) return;
      setIndex(i => (i + dir + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => go(1), AUTO_SLIDE_MS);
    return () => clearInterval(t);
  }, [n, go]);

  if (!n) return null;

  const basisPct = 100 / n;

  return (
    <div className={`relative w-full ${className}`}>
      <div className="overflow-hidden rounded-xl border border-border bg-amber-50 shadow-sm">
        <div
          className={`flex min-h-[120px] ${multi ? 'transition-transform duration-500 ease-out' : ''}`}
          style={{
            width: multi ? `${n * 100}%` : '100%',
            transform: multi ? `translateX(-${(index * 100) / n}%)` : undefined,
          }}
        >
          {items.map(b => (
            <div
              key={b.id}
              className="shrink-0 grow-0 overflow-hidden"
              style={{ flex: `0 0 ${basisPct}%` }}
            >
              <BannerTarget url={b.url}>
                <img
                  src={b.image!}
                  alt=""
                  className="w-full h-[120px] object-cover"
                />
              </BannerTarget>
            </div>
          ))}
        </div>
      </div>

      {multi ? (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(-1)}
            className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-[2px] transition hover:bg-black/50"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(1)}
            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-[2px] transition hover:bg-black/50"
          >
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </>
      ) : null}
    </div>
  );
}
