import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, Search, Candy, ClipboardList, User } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import NotificationBellLink from '@/components/NotificationBellLink';
import CustomerCartLink from '@/components/customer/CustomerCartLink';
import type { SuperSetting } from '@/types';

function isCustomerTabActive(tabPath: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  if (tabPath === '/customer') {
    return p === '/customer';
  }
  if (tabPath === '/customer/explore') {
    return (
      p.startsWith('/customer/explore') ||
      /^\/customer\/product\/\d+/.test(p) ||
      /^\/customer\/parent\/\d+/.test(p) ||
      /^\/customer\/category\/\d+/.test(p)
    );
  }
  if (tabPath === '/customer/sweets') {
    return p.startsWith('/customer/sweets');
  }
  if (tabPath === '/customer/orders') {
    return p.startsWith('/customer/orders') || /^\/customer\/order\//.test(p);
  }
  if (tabPath === '/customer/profile') {
    return (
      p.startsWith('/customer/profile') ||
      p === '/customer/about' ||
      p === '/customer/terms' ||
      p === '/customer/privacy' ||
      p === '/customer/support' ||
      p === '/customer/notifications'
    );
  }
  return false;
}

export default function CustomerLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const menusOpen = useStoreMenusOpen();
  const storeName = settings?.name ?? 'Shop';

  const customerTabs = [
    { icon: Home, label: 'Home', path: '/customer' },
    { icon: Search, label: 'Explore', path: '/customer/explore' },
    { icon: Candy, label: 'Sweets', path: '/customer/sweets' },
    { icon: ClipboardList, label: 'Orders', path: '/customer/orders' },
    { icon: User, label: 'Profile', path: '/customer/profile' },
  ];

  const desktopLinkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors border ${
      active
        ? 'bg-amber-500/15 text-amber-800 border-amber-200/90'
        : 'text-stone-600 hover:bg-stone-50 border-transparent'
    }`;

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:z-50 md:h-screen md:w-[260px] md:border-r md:border-border md:bg-card md:shadow-sm">
        <div className="p-5 border-b border-border">
          <Link to="/customer" className="flex items-center gap-2.5">
            <span className="text-2xl">{settings?.logo?.startsWith('http') ? '' : '🍬'}</span>
            <div>
              <span className="font-display font-bold text-lg text-foreground leading-tight block">{storeName}</span>
              <span className="text-[11px] text-muted-foreground">
                {menusOpen ? 'Browse & order' : 'Store closed'}
              </span>
            </div>
          </Link>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-end gap-0.5">
            <CustomerCartLink />
            <NotificationBellLink to="/customer/notifications" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {customerTabs.map(tab => {
            const Icon = tab.icon;
            const active = isCustomerTabActive(tab.path, pathname);
            const exploreLocked =
              (tab.path === '/customer/explore' || tab.path === '/customer/sweets') && !menusOpen;
            if (exploreLocked) {
              return (
                <div
                  key={tab.path}
                  className={`${desktopLinkClass(false)} opacity-50 cursor-not-allowed select-none`}
                  aria-disabled={true}
                  title="Store is closed"
                >
                  <div className="relative shrink-0">
                    <Icon size={20} className="text-stone-500" />
                  </div>
                  {tab.label}
                </div>
              );
            }
            return (
              <Link key={tab.path} to={tab.path} className={desktopLinkClass(active)}>
                <div className="relative shrink-0">
                  <Icon size={20} className={active ? 'text-amber-600' : 'text-stone-500'} />
                </div>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="md:pl-[260px] min-h-screen">
        <div className="mobile-container md:max-w-none md:mx-0 md:w-full md:shadow-none md:bg-transparent min-h-screen bg-card shadow-xl pb-20 md:pb-10 relative">
          <div className="md:hidden sticky top-0 z-50 flex justify-end items-center gap-0.5 bg-card border-b border-border px-2">
            <CustomerCartLink />
            <NotificationBellLink to="/customer/notifications" />
          </div>
          <div className="md:max-w-6xl md:mx-auto md:px-8 md:py-6 md:rounded-2xl md:bg-card md:border md:border-border md:shadow-sm md:min-h-[calc(100vh-3rem)]">
            <Outlet />
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:hidden bg-card border-t border-border h-16 flex items-center justify-around z-50">
        {customerTabs.map(tab => {
          const Icon = tab.icon;
          const active = isCustomerTabActive(tab.path, pathname);
          const exploreLocked =
            (tab.path === '/customer/explore' || tab.path === '/customer/sweets') && !menusOpen;
          if (exploreLocked) {
            return (
              <div
                key={tab.path}
                className="flex flex-col items-center gap-0.5 min-w-[50px] text-stone-400 opacity-50 cursor-not-allowed select-none"
                aria-disabled={true}
                title="Store is closed"
              >
                <div className="relative">
                  <Icon size={22} />
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </div>
            );
          }
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 min-w-[50px] ${active ? 'text-amber-500' : 'text-stone-400'}`}
            >
              <div className="relative">
                <Icon size={22} />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
