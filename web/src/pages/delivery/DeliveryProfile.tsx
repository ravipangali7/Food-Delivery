import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogOut, MapPin, Phone, User } from 'lucide-react';
import { patchJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { num, formatCurrency } from '@/lib/formatting';
import type { Order } from '@/types';
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

export default function DeliveryProfile() {
  const { token, user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAddress(user.address || '');
    }
  }, [user]);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const { data: earnings } = useQuery({
    queryKey: ['delivery-earnings', token],
    queryFn: () =>
      getJson<{ total_amount: string; total_deliveries: number }>('/api/delivery/earnings/?days=30', token),
    enabled: !!token,
  });

  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  const save = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await patchJson('/api/auth/me/', { name, address }, token);
      await refreshUser();
    },
    onSuccess: () => setEditing(false),
  });

  const stats = [
    { label: 'Assigned orders', value: String(orders.length) },
    { label: 'Delivered', value: String(deliveredCount) },
    { label: '30d earnings', value: formatCurrency(num(earnings?.total_amount)) },
    { label: '30d drops', value: String(earnings?.total_deliveries ?? 0) },
  ];

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <h1 className="font-display font-bold text-lg">My Profile</h1>
      </div>

      <div className="px-4 py-4 space-y-5">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-3xl overflow-hidden border-2 border-border">
              {user?.profile_photo?.trim() ? (
                <img src={user.profile_photo} alt="" className="h-full w-full object-cover" />
              ) : (
                '🛵'
              )}
            </div>
          </div>
          <h2 className="font-display font-bold text-lg mt-3">{user?.name}</h2>
          <p className="text-sm text-muted-foreground">Delivery Partner</p>
          <span className="mt-1 px-3 py-0.5 bg-green-50 text-green-600 text-xs rounded-full font-medium">
            Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Personal Information</h3>
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="text-xs text-primary font-medium"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User size={12} /> Full Name
              </label>
              <Input value={name} onChange={e => setName(e.target.value)} disabled={!editing} className="h-10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Phone size={12} /> Phone
              </label>
              <Input value={user?.phone ?? ''} disabled className="h-10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin size={12} /> Address
              </label>
              <Input value={address} onChange={e => setAddress(e.target.value)} disabled={!editing} className="h-10" />
            </div>
          </div>

          {editing && (
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="w-full bg-primary hover:bg-amber-600"
            >
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setLogoutDialogOpen(true)}
            className="w-full py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-600 flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access delivery tasks.
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
