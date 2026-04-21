import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, MapPin, ClipboardList, User, Bell, Wallet } from 'lucide-react';

const deliveryMobileTabs = [
  { icon: Home, label: 'Home', path: '/delivery' },
  { icon: MapPin, label: 'Map', path: '/delivery/map' },
  { icon: ClipboardList, label: 'Orders', path: '/delivery/orders' },
  { icon: User, label: 'Profile', path: '/delivery/profile' },
];

const deliveryDesktopNav: {
  section?: string;
  items: { icon: typeof Home; label: string; path: string }[];
}[] = [
  {
    section: 'Operations',
    items: [
      { icon: Home, label: 'Home', path: '/delivery' },
      { icon: MapPin, label: 'Map', path: '/delivery/map' },
      { icon: ClipboardList, label: 'Orders', path: '/delivery/orders' },
    ],
  },
  {
    section: 'Partner',
    items: [
      { icon: Bell, label: 'Notifications', path: '/delivery/notifications' },
      { icon: Wallet, label: 'Earnings', path: '/delivery/earnings' },
      { icon: User, label: 'Profile', path: '/delivery/profile' },
    ],
  },
];

function isDeliveryNavActive(navPath: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  if (navPath === '/delivery') {
    return p === '/delivery';
  }
  if (navPath === '/delivery/map') {
    return p.startsWith('/delivery/map');
  }
  if (navPath === '/delivery/orders') {
    return p.startsWith('/delivery/orders') || /^\/delivery\/order\//.test(p);
  }
  if (navPath === '/delivery/profile') {
    return p.startsWith('/delivery/profile');
  }
  if (navPath === '/delivery/notifications') {
    return p.startsWith('/delivery/notifications');
  }
  if (navPath === '/delivery/earnings') {
    return p.startsWith('/delivery/earnings');
  }
  return false;
}

export default function DeliveryLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  const desktopLinkClass = (active: boolean) =>
    `mx-2 rounded-lg flex items-center gap-3 min-h-11 px-3 py-2 text-sm transition-colors border-l-4 ${
      active
        ? 'bg-amber-500/15 text-amber-400 border-amber-500'
        : 'hover:bg-white/5 border-transparent text-stone-200'
    }`;

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:z-50 md:h-screen md:w-[260px] md:bg-stone-900 md:text-stone-100 md:border-r md:border-stone-800 md:shadow-lg">
        <div className="h-[72px] flex items-center px-4 border-b border-stone-800 shrink-0">
          <span className="text-2xl">🛵</span>
          <div className="ml-3">
            <div className="font-bold text-amber-400 font-display">Delivery</div>
            <div className="text-[10px] text-stone-500 uppercase tracking-widest">Partner dashboard</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {deliveryDesktopNav.map((block, bi) => (
            <div key={bi} className="mb-4">
              {block.section ? (
                <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                  {block.section}
                </div>
              ) : null}
              {block.items.map(item => {
                const Icon = item.icon;
                const active = isDeliveryNavActive(item.path, pathname);
                return (
                  <Link key={item.path} to={item.path} className={desktopLinkClass(active)}>
                    <Icon size={18} className="shrink-0 opacity-90" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="md:pl-[260px] min-h-screen">
        <div className="mobile-container md:max-w-none md:mx-0 md:w-full md:shadow-none md:bg-transparent min-h-screen bg-card shadow-xl pb-20 md:pb-10 relative">
          <div className="md:max-w-6xl md:mx-auto md:px-8 md:py-6 md:rounded-2xl md:bg-card md:border md:border-border md:shadow-sm md:min-h-[calc(100vh-3rem)]">
            <Outlet />
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:hidden bg-card border-t border-border h-16 flex items-center justify-around z-50">
        {deliveryMobileTabs.map(tab => {
          const Icon = tab.icon;
          const active = isDeliveryNavActive(tab.path, pathname);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 min-w-[50px] ${active ? 'text-amber-500' : 'text-stone-400'}`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
