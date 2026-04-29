import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  MapPin,
  ClipboardList,
  Info,
  FileText,
  Lock,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CustomerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const termsPreview = settings?.terms_and_conditions?.trim();
  const privacyPreview = settings?.privacy_policy?.trim();

  const menuItems = [
    { icon: User, label: 'Edit Profile', desc: 'Name, email, address', path: '/customer/profile/edit' },
    { icon: MapPin, label: 'Saved Addresses', path: '/customer/profile/addresses' },
    { icon: ClipboardList, label: 'Order History', path: '/customer/orders' },
    { divider: true },
    {
      icon: Info,
      label: 'About Us',
      path: '/customer/about',
      desc: 'Store name, logo, and full story',
    },
    {
      icon: FileText,
      label: 'Terms & Conditions',
      path: '/customer/terms',
      desc: termsPreview ? 'Updated from Store Settings' : 'View store terms',
    },
    {
      icon: Lock,
      label: 'Privacy Policy',
      path: '/customer/privacy',
      desc: privacyPreview ? 'Updated from Store Settings' : 'View privacy details',
    },
    { divider: true },
    { icon: LogOut, label: 'Logout', path: '/', danger: true, action: 'logout' as const },
  ];

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  const photoUrl = user?.profile_photo?.trim();

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-amber-500 to-amber-600 px-4 pt-8 pb-6 text-white text-center">
        <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center text-3xl font-bold overflow-hidden border-2 border-white/30">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <h2 className="font-display font-bold text-lg mt-3">{user?.name ?? 'Customer'}</h2>
        <p className="text-sm opacity-90">{user?.phone ? `+${user.phone}` : ''}</p>
      </div>
      <div className="px-4 py-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {menuItems.map((item, i) => {
            if ('divider' in item) return <div key={i} className="border-t border-border" />;
            const Icon = item.icon!;
            if (item.action === 'logout') {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLogoutDialogOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 text-red-600 text-left"
                >
                  <Icon size={18} className="text-red-500" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={i}
                to={item.path!}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 ${item.danger ? 'text-red-600' : ''}`}
              >
                <Icon size={18} className={item.danger ? 'text-red-500' : 'text-muted-foreground'} />
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.desc && (
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  )}
                </div>
                {!item.danger && <ChevronRight size={16} className="text-muted-foreground" />}
              </Link>
            );
          })}
        </div>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to use your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
