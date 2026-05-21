import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Phone } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { SuperSetting, User } from '@/types';
import { resolveStoreLogoUrl } from '@/lib/branding';
import { homeForUser, isAdminUser } from './authPaths';

type TokenResponse = { token: string; user: User };

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, isLoading, setSession } = useAuth();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });
  const storeName = settings?.name?.trim() || 'Store';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isLoading && token && user) {
    if (isAdminUser(user)) {
      const dest =
        from && from.startsWith('/admin') && from !== '/admin/login' ? from : homeForUser(user);
      return <Navigate to={dest} replace />;
    }
    return <Navigate to={homeForUser(user)} replace />;
  }

  const phoneDigits = phone.replace(/\D/g, '').slice(0, 15);
  const canSubmit = phoneDigits.length >= 7 && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await postJson<TokenResponse, { phone: string; password: string }>(
        '/api/auth/admin/login/',
        { phone: phoneDigits, password },
        null,
      );
      if (!isAdminUser(res.user)) {
        setError('This account is not authorized for admin access.');
        return;
      }
      setSession(res.token, res.user);
      const dest =
        from && from.startsWith('/admin') && from !== '/admin/login'
          ? from
          : homeForUser(res.user);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 px-4">
      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto h-[4.5rem] w-[4.5rem] flex items-center justify-center">
            <img
              src={resolveStoreLogoUrl(settings?.logo)}
              alt={storeName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mt-3">Admin sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use your staff phone number and password.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="admin-phone">
              Phone
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-phone"
                type="tel"
                placeholder="98XXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                className="pl-10 h-12 text-base"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="admin-password">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 h-12 text-base"
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full h-12 text-base font-semibold bg-slate-800 hover:bg-slate-900"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Customer or delivery login?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Phone OTP sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
