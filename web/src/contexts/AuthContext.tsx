import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api';
import type { User } from '@/types';

const TOKEN_KEY = 'fd_auth_token';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const t = readStoredToken();
    if (!t) {
      setUser(null);
      setToken(null);
      return null;
    }
    setToken(t);
    const me = await apiFetch<User>('/api/auth/me/', { token: t });
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = readStoredToken();
      if (!t) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }
      setToken(t);
      try {
        const me = await apiFetch<User>('/api/auth/me/', { token: t });
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const setSession = useCallback((newToken: string, u: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
    } catch {
      /* ignore */
    }
    setToken(newToken);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ token, user, isLoading, setSession, logout, refreshUser }),
    [token, user, isLoading, setSession, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
