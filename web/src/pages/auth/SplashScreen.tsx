import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { DEFAULT_STORE_LOGO_URL } from '@/lib/branding';
import { useAuth } from '@/contexts/AuthContext';
import { canBrowseWithoutLogin, requiresLoginGate } from '@/lib/appAccess';
import { homeForUser } from '@/pages/auth/authPaths';
import { cn } from '@/lib/utils';

const TAGLINE = 'Fresh Mithai, Delivered Fast';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { token, user, isLoading } = useAuth();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const gateToLogin = requiresLoginGate() && !canBrowseWithoutLogin(token);
    const destination = (() => {
      if (token && user) return homeForUser(user);
      if (gateToLogin) return '/login';
      return '/customer';
    })();

    if (gateToLogin) {
      navigate(destination, { replace: true });
      return;
    }

    const t1 = setTimeout(() => setFadeOut(true), 1800);
    const t2 = setTimeout(() => {
      navigate(destination, { replace: true });
    }, 2300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [navigate, token, user, isLoading]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-out',
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100',
      )}
      role="status"
      aria-live="polite"
      aria-busy={!fadeOut}
      aria-label="Loading Shyam's"
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-brand-red-dark via-brand-red to-amber-700"
        aria-hidden
      />
      <div
        className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-yellow/15 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_120%,white_0%,transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
          <div className="rounded-[1.75rem] bg-white/95 p-7 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] ring-1 ring-white/40 backdrop-blur-sm">
            <BrandLogo
              src={DEFAULT_STORE_LOGO_URL}
              size="splash"
              className="h-28 max-w-[240px] drop-shadow-sm"
            />
          </div>

          <p className="mt-8 max-w-[18rem] text-center text-sm font-medium leading-relaxed tracking-wide text-white/90">
            {TAGLINE}
          </p>
        </div>

        <div
          className="mt-12 w-full max-w-[11rem] animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300"
          aria-hidden
        >
          <div className="h-1 overflow-hidden rounded-full bg-white/25">
            <div className="splash-progress-bar h-full w-2/5 rounded-full bg-brand-yellow shadow-[0_0_12px_rgba(255,199,44,0.55)]" />
          </div>
        </div>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-white/50 animate-pulse-brand">
          Loading
        </p>
      </div>
    </div>
  );
}
