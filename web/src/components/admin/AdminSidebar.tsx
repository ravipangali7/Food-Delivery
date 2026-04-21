import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ChevronDown,
  LayoutList,
  Layers,
  Ruler,
  ClipboardList,
  Users,
  Truck,
  Bell,
  Headphones,
  Settings,
  type LucideIcon,
} from 'lucide-react';

type Summary = { orders_pending: number };

/** One nav item is active at a time: dashboard matches only `/admin/dashboard`, not deeper routes. */
function isNavActive(basePath: string, pathname: string): boolean {
  const base = basePath.replace(/\/$/, '') || '/';
  const path = pathname.replace(/\/$/, '') || '/';
  if (base === '/admin/dashboard') {
    return path === '/admin/dashboard';
  }
  return path === base || path.startsWith(`${base}/`);
}

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
};

/** Which “Categories” sub-item should show as active (lists, forms, detail). */
function isCategoriesAllActive(pathname: string): boolean {
  if (pathname === '/admin/categories/all') return true;
  if (pathname.startsWith('/admin/sub-categories')) return true;
  return false;
}

function isCategoriesParentsActive(pathname: string): boolean {
  if (pathname === '/admin/categories/parents') return true;
  if (pathname.startsWith('/admin/parent-categories')) return true;
  return false;
}

function isUnitsListActive(pathname: string): boolean {
  if (pathname === '/admin/units') return true;
  if (pathname.match(/^\/admin\/units\/\d+\/edit$/)) return true;
  return false;
}

function UnitsNavBlock({ collapsed }: { collapsed: boolean }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => pathname.startsWith('/admin/units'));

  useEffect(() => {
    if (pathname.startsWith('/admin/units')) setOpen(true);
  }, [pathname]);

  const listActive = isUnitsListActive(pathname);
  const unitsSectionActive = pathname.startsWith('/admin/units');

  const subLinkClass = (active: boolean) =>
    `mx-2 rounded-lg flex items-center min-h-9 px-3 py-2 text-sm transition-colors border-l-4 pl-4 ${
      active
        ? 'bg-amber-500/15 text-amber-400 border-amber-500'
        : 'hover:bg-white/5 border-transparent text-stone-300'
    }`;

  if (collapsed) {
    return (
      <div className="mx-2 flex flex-col gap-0.5 border-t border-stone-800 pt-2 mt-2">
        <Link
          to="/admin/units"
          title="All Units"
          className={`rounded-lg flex items-center justify-center h-10 transition-colors border-l-4 ${
            unitsSectionActive
              ? 'bg-amber-500/15 text-amber-400 border-amber-500'
              : 'hover:bg-white/5 border-transparent text-stone-200'
          }`}
        >
          <Ruler size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-1 mt-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`mx-2 w-[calc(100%-16px)] rounded-lg flex items-center h-11 px-3 transition-colors border-l-4 text-left
          ${
            unitsSectionActive && !open
              ? 'bg-amber-500/10 text-amber-400/90 border-amber-500/50'
              : 'hover:bg-white/5 border-transparent text-stone-200'
          }`}
      >
        <Ruler size={18} className="shrink-0" />
        <span className="ml-3 text-sm flex-1">Units</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5">
          <Link to="/admin/units" className={subLinkClass(listActive)}>
            <LayoutList size={16} className="shrink-0 opacity-90" />
            <span className="ml-2">All Units</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CategoriesNavBlock({ collapsed }: { collapsed: boolean }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(
    () =>
      pathname.startsWith('/admin/categories') ||
      pathname.startsWith('/admin/parent-categories') ||
      pathname.startsWith('/admin/sub-categories'),
  );

  useEffect(() => {
    if (
      pathname.startsWith('/admin/categories') ||
      pathname.startsWith('/admin/parent-categories') ||
      pathname.startsWith('/admin/sub-categories')
    ) {
      setOpen(true);
    }
  }, [pathname]);

  const allActive = isCategoriesAllActive(pathname);
  const parentsActive = isCategoriesParentsActive(pathname);
  const groupLit = allActive || parentsActive;

  const subLinkClass = (active: boolean) =>
    `mx-2 rounded-lg flex items-center min-h-9 px-3 py-2 text-sm transition-colors border-l-4 pl-4 ${
      active
        ? 'bg-amber-500/15 text-amber-400 border-amber-500'
        : 'hover:bg-white/5 border-transparent text-stone-300'
    }`;

  if (collapsed) {
    return (
      <div className="mx-2 flex flex-col gap-0.5 border-t border-stone-800 pt-2 mt-2">
        <Link
          to="/admin/categories/all"
          title="All Categories"
          className={`rounded-lg flex items-center justify-center h-10 transition-colors border-l-4 ${
            allActive
              ? 'bg-amber-500/15 text-amber-400 border-amber-500'
              : 'hover:bg-white/5 border-transparent text-stone-200'
          }`}
        >
          <LayoutList size={18} />
        </Link>
        <Link
          to="/admin/categories/parents"
          title="Parent Categories"
          className={`rounded-lg flex items-center justify-center h-10 transition-colors border-l-4 ${
            parentsActive
              ? 'bg-amber-500/15 text-amber-400 border-amber-500'
              : 'hover:bg-white/5 border-transparent text-stone-200'
          }`}
        >
          <Layers size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`mx-2 w-[calc(100%-16px)] rounded-lg flex items-center h-11 px-3 transition-colors border-l-4 text-left
          ${
            groupLit && !open
              ? 'bg-amber-500/10 text-amber-400/90 border-amber-500/50'
              : 'hover:bg-white/5 border-transparent text-stone-200'
          }`}
      >
        <FolderTree size={18} className="shrink-0" />
        <span className="ml-3 text-sm flex-1">Categories</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5">
          <Link to="/admin/categories/all" className={subLinkClass(allActive)}>
            <LayoutList size={16} className="shrink-0 opacity-90" />
            <span className="ml-2">All Categories</span>
          </Link>
          <Link to="/admin/categories/parents" className={subLinkClass(parentsActive)}>
            <Layers size={16} className="shrink-0 opacity-90" />
            <span className="ml-2">Parent Categories</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function buildSidebarSections(pending: number): { label?: string; items: NavItem[] }[] {
  return [
    {
      items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' }],
    },
    {
      label: 'CATALOG',
      items: [{ label: 'Products', icon: Package, path: '/admin/products' }],
    },
    {
      label: 'ORDERS',
      items: [
        {
          label: 'Orders',
          icon: ClipboardList,
          path: '/admin/orders',
          badge: pending > 0 ? pending : undefined,
        },
      ],
    },
    {
      label: 'USERS',
      items: [
        { label: 'Customers', icon: Users, path: '/admin/customers' },
        { label: 'Delivery Boys', icon: Truck, path: '/admin/delivery-boys' },
      ],
    },
    {
      label: 'COMMUNICATION',
      items: [
        { label: 'Customer Support', icon: Headphones, path: '/admin/customer-support' },
        { label: 'Notifications', icon: Bell, path: '/admin/notifications' },
      ],
    },
    {
      label: 'SYSTEM',
      items: [{ label: 'Store Settings', icon: Settings, path: '/admin/store-settings' }],
    },
  ];
}

export default function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const { token } = useAuth();
  const pathname = location.pathname;

  const { data: summary } = useQuery({
    queryKey: ['admin-dashboard-summary', token],
    queryFn: () => getJson<Summary>('/api/admin/dashboard/summary/', token),
    enabled: !!token,
  });

  const sidebarSections = useMemo(
    () => buildSidebarSections(summary?.orders_pending ?? 0),
    [summary?.orders_pending],
  );

  return (
    <>
      {!collapsed && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-stone-900 text-stone-100 z-50 transition-all duration-300 flex flex-col
        ${collapsed ? 'w-0 lg:w-[72px] overflow-hidden' : 'w-[260px]'}`}
      >
        <div className="h-[72px] flex items-center px-4 border-b border-stone-800 shrink-0">
          <span className="text-2xl">🍬</span>
          {!collapsed && (
            <div className="ml-3">
              <div className="font-bold text-amber-400 font-display">Shyam Sweets</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest">Admin Panel</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {sidebarSections.map((section, si) => (
            <div key={si} className="mb-2">
              {section.label && !collapsed && (
                <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                  {section.label}
                </div>
              )}
              {section.items.map(item => {
                const Icon = item.icon;
                const active = isNavActive(item.path, pathname);

                return (
                  <div key={item.label}>
                    <Link
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`mx-2 rounded-lg flex items-center h-11 px-3 transition-colors border-l-4
                      ${
                        active
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500'
                          : 'hover:bg-white/5 border-transparent text-stone-200'
                      }
                      ${collapsed ? 'justify-center' : ''}`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="ml-3 text-sm flex-1">{item.label}</span>
                          {item.badge != null ? (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full shrink-0">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Link>
                    {section.label === 'CATALOG' && item.path === '/admin/products' ? (
                      <>
                        <CategoriesNavBlock collapsed={collapsed} />
                        <UnitsNavBlock collapsed={collapsed} />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
