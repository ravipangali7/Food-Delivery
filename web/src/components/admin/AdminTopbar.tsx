import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, patchJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AdminTopbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [storeToggleDialogOpen, setStoreToggleDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const toggleOpen = useMutation({
    mutationFn: async () => {
      if (!token || !settings?.id) return;
      await patchJson(`/api/admin/settings/${settings.id}/`, { is_open: !settings.is_open }, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const storeOpen = settings?.is_open ?? true;

  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-4 gap-4 shrink-0">
      <button type="button" onClick={onToggleSidebar} className="p-2 hover:bg-muted rounded-lg">
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-lg">🍬</span>
        <span className="font-display font-bold text-foreground hidden sm:block">
          {settings?.name ?? 'Admin'}
        </span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setStoreToggleDialogOpen(true)}
        disabled={!settings?.id || toggleOpen.isPending}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          storeOpen ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${storeOpen ? 'bg-green-500' : 'bg-red-500'}`} />
        {storeOpen ? 'Store Open' : 'Store Closed'}
      </button>

      <Link to="/admin/notifications" className="relative p-2 hover:bg-muted rounded-lg">
        <Bell size={20} />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 pl-2 border-l border-border rounded-lg py-1 pr-1 -mr-1 hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <User size={16} className="text-amber-700" />
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold">{user?.name ?? 'Admin'}</div>
              <div className="text-[10px] text-muted-foreground">
                {user?.role === 'super_admin' || user?.is_superuser
                  ? 'Super Admin'
                  : user?.is_staff
                    ? 'Admin'
                    : 'Staff'}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
            onSelect={() => {
              window.setTimeout(() => setLogoutDialogOpen(true), 0);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={storeToggleDialogOpen} onOpenChange={setStoreToggleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{storeOpen ? 'Close the store?' : 'Open the store?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {storeOpen
                ? 'Customers will not see product menus or be able to browse items until you open the store again.'
                : 'Customers will be able to browse the menu and place orders again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                storeOpen
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-600'
              }
              disabled={toggleOpen.isPending}
              onClick={() => {
                toggleOpen.mutate(undefined, {
                  onSettled: () => setStoreToggleDialogOpen(false),
                });
              }}
            >
              {storeOpen ? 'Close store' : 'Open store'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the admin panel.
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
    </header>
  );
}
