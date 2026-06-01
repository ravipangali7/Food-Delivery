import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Phone, User as UserIcon } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { SuperSetting, User } from '@/types';
import { resolveStoreLogoUrl } from '@/lib/branding';
import { homeForUser } from '@/pages/auth/authPaths';
import { enableGuestAccess, requiresLoginGate } from '@/lib/appAccess';

type TokenResponse = { token: string; user: User };

type Props = {
  mode: 'login' | 'register';
  title: string;
  subtitle: string;
  alternateHint: string;
  alternateLabel: string;
  alternateTo: string;
};

export default function CustomerPasswordAuth({
  mode,
  title,
  subtitle,
  alternateHint,
  alternateLabel,
  alternateTo,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const showSkipLogin = requiresLoginGate();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });
  const storeName = settings?.name?.trim() || 'Store';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '').slice(0, 15);
  const canSubmitLogin = phoneDigits.length >= 7 && password.length >= 6;
  const canSubmitRegister =
    name.trim().length >= 2 &&
    phoneDigits.length >= 7 &&
    password.length >= 6 &&
    password === confirmPassword;
  const canSubmit = mode === 'login' ? canSubmitLogin : canSubmitRegister;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      let res: TokenResponse;
      if (mode === 'login') {
        res = await postJson<TokenResponse, { phone: string; password: string }>(
          '/api/auth/customer/login/',
          { phone: phoneDigits, password },
          null,
        );
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        res = await postJson<TokenResponse, { phone: string; name: string; password: string }>(
          '/api/auth/customer/register/',
          { phone: phoneDigits, name: name.trim(), password },
          null,
        );
      }
      setSession(res.token, res.user);
      navigate(from && from !== '/login' && from !== '/register' ? from : homeForUser(res.user), {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? 'Sign in failed' : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLogin = () => {
    enableGuestAccess();
    navigate('/customer', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-background px-4 py-8">
      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto h-[4.5rem] w-[4.5rem] flex items-center justify-center">
            <img
              src={resolveStoreLogoUrl(settings?.logo)}
              alt={storeName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mt-3">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="register-name">
                Full name
              </label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="pl-10 h-12 text-base"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="auth-phone">
              Phone
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-phone"
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
            <label className="text-sm font-medium text-foreground" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-password"
                type="password"
                placeholder={mode === 'register' ? 'Create a password (min 6 characters)' : 'Your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 h-12 text-base"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="auth-confirm-password">
                Confirm password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-confirm-password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-10 h-12 text-base"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : mode === 'login' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {alternateHint}{' '}
          <Link to={alternateTo} className="text-primary font-medium hover:underline">
            {alternateLabel}
          </Link>
        </p>

        {showSkipLogin && (
          <div className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkipLogin}
              className="w-full h-11 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Skip Login
            </Button>
            <p className="text-center text-[11px] text-muted-foreground mt-2 px-2">
              Browse and place orders without signing in. Order history and profile require an account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
