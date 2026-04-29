import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiHttpError, apiFetch } from '@/lib/api';
import type { User } from '@/types';

const TOKEN_KEY = 'fd_auth_token';
const PHONE_KEY = 'fd_auth_phone';

const FLUTTER_AUTH_HANDLER = 'fdAuthTokenPersist';

function getFlutterInAppBridge(): {
  callHandler: (name: string, ...args: unknown[]) => unknown;
} | null {
  try {
    const w = window as unknown as {
      flutter_inappwebview?: { callHandler?: (name: string, ...args: unknown[]) => unknown };
    };
    const fn = w.flutter_inappwebview?.callHandler;
    return typeof fn === 'function' ? { callHandler: fn.bind(w.flutter_inappwebview) as typeof fn } : null;
  } catch {
    return null;
  }
}

/** Must match [AuthTokenStorage] / WebView `fdAuthTokenPersist` handler. */
function callFlutterAuthPersist(payload: string): boolean {
  const bridge = getFlutterInAppBridge();
  if (!bridge) return false;
  try {
    bridge.callHandler(FLUTTER_AUTH_HANDLER, payload);
    return true;
  } catch {
    return false;
  }
}

let mirrorRetryId: ReturnType<typeof setInterval> | null = null;
/** Latest payload for `fdAuthTokenPersist` retries; `undefined` until first mirror call. */
let mirrorLatestPayload: string | undefined;

function stopMirrorRetry(): void {
  if (mirrorRetryId !== null) {
    clearInterval(mirrorRetryId);
    mirrorRetryId = null;
  }
}

function startMirrorRetryIfNeeded(): void {
  if (typeof window === 'undefined' || mirrorRetryId !== null) return;
  mirrorRetryId = window.setInterval(() => {
    if (mirrorLatestPayload === undefined) {
      stopMirrorRetry();
      return;
    }
    if (callFlutterAuthPersist(mirrorLatestPayload)) {
      stopMirrorRetry();
    }
  }, 100);
  window.setTimeout(stopMirrorRetry, 15_000);
}

let flutterBridgeHooksInstalled = false;

function installFlutterAuthBridgeHooks(): void {
  if (typeof window === 'undefined' || flutterBridgeHooksInstalled) return;
  flutterBridgeHooksInstalled = true;

  // Official contract: callHandler is only safe after this event (flutter_inappwebview docs).
  window.addEventListener('flutterInAppWebViewPlatformReady', () => {
    // Never push '' from localStorage alone — it may be empty before native inject runs.
    const fromLs = readStoredToken();
    if (fromLs) {
      void callFlutterAuthPersist(fromLs);
    }
    if (mirrorLatestPayload !== undefined) {
      void callFlutterAuthPersist(mirrorLatestPayload);
    }
    stopMirrorRetry();
  });
}

/**
 * Mirrors `fd_auth_token` into Flutter storage. Retries until the InAppWebView JS bridge exists
 * (cold start often runs React restore before `flutter_inappwebview` is callable).
 */
function mirrorAuthTokenToFlutterHost(token: string | null): void {
  installFlutterAuthBridgeHooks();
  mirrorLatestPayload = token ?? '';
  if (callFlutterAuthPersist(mirrorLatestPayload)) {
    stopMirrorRetry();
    return;
  }
  startMirrorRetryIfNeeded();
}

const ME_RETRIES = 5;
const FLUTTER_BOOTSTRAP_WAIT_MS = 2500;

async function fetchMeWithRetries(token: string): Promise<User> {
  let lastError: unknown;
  for (let attempt = 0; attempt < ME_RETRIES; attempt++) {
    try {
      return await apiFetch<User>('/api/auth/me/', { token });
    } catch (e) {
      lastError = e;
      if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
        throw e;
      }
      if (attempt < ME_RETRIES - 1) {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 350 * 2 ** attempt);
        });
      }
    }
  }
  throw lastError;
}

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  /** True when a stored token exists but /api/auth/me/ could not be reached (e.g. flaky WebView/network). */
  sessionRestoreFailed: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  /** Re-validates a stored token after a failed initial restore (does not throw). */
  retrySessionRestore: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function isLikelyFlutterWebView(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const w = window as unknown as { flutter_inappwebview?: unknown };
    if (w.flutter_inappwebview) return true;
    return /\bwv\b|Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');
  } catch {
    return false;
  }
}

async function waitForFlutterBootstrapSignal(maxWaitMs: number): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isLikelyFlutterWebView()) return;
  await new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('flutterInAppWebViewPlatformReady', onReady);
      resolve();
    };
    const onReady = () => finish();
    window.addEventListener('flutterInAppWebViewPlatformReady', onReady, { once: true });
    window.setTimeout(finish, maxWaitMs);
  });
}

function writeStoredPhone(phone: string | null): void {
  try {
    if (!phone || !phone.trim()) {
      localStorage.removeItem(PHONE_KEY);
      return;
    }
    localStorage.setItem(PHONE_KEY, phone.trim());
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionRestoreFailed, setSessionRestoreFailed] = useState(false);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PHONE_KEY);
      mirrorAuthTokenToFlutterHost(null);
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
    setSessionRestoreFailed(false);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const t = readStoredToken();
    if (!t) {
      setUser(null);
      setToken(null);
      setSessionRestoreFailed(false);
      return null;
    }
    setToken(t);
    try {
      const me = await fetchMeWithRetries(t);
      setUser(me);
      setSessionRestoreFailed(false);
      writeStoredPhone(me.phone ?? null);
      mirrorAuthTokenToFlutterHost(t);
      return me;
    } catch (e) {
      if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
        logout();
        return null;
      }
      throw e;
    }
  }, [logout]);

  const retrySessionRestore = useCallback(async () => {
    const t = readStoredToken();
    if (!t) {
      // Do not call logout() here: it clears the native mirror in SharedPreferences and can strand
      // a valid session when localStorage is briefly unreadable in the WebView.
      setToken(null);
      setUser(null);
      setSessionRestoreFailed(false);
      return;
    }
    setToken(t);
    try {
      const me = await fetchMeWithRetries(t);
      setUser(me);
      setSessionRestoreFailed(false);
      writeStoredPhone(me.phone ?? null);
      mirrorAuthTokenToFlutterHost(t);
    } catch (e) {
      if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
        logout();
      }
    }
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t = readStoredToken();
      if (!t) {
        await waitForFlutterBootstrapSignal(FLUTTER_BOOTSTRAP_WAIT_MS);
        t = readStoredToken();
      }
      if (!t) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }
      setToken(t);
      try {
        const me = await fetchMeWithRetries(t);
        if (!cancelled) {
          setUser(me);
          setSessionRestoreFailed(false);
          writeStoredPhone(me.phone ?? null);
          // Keep the Flutter mirror in sync even if setSession() never ran (e.g. cold restore only).
          mirrorAuthTokenToFlutterHost(t);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
            logout();
          } else {
            setSessionRestoreFailed(true);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const setSession = useCallback((newToken: string, u: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
      writeStoredPhone(u.phone ?? null);
      mirrorAuthTokenToFlutterHost(newToken);
    } catch {
      /* ignore */
    }
    setToken(newToken);
    setUser(u);
    setSessionRestoreFailed(false);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      sessionRestoreFailed,
      setSession,
      logout,
      refreshUser,
      retrySessionRestore,
    }),
    [token, user, isLoading, sessionRestoreFailed, setSession, logout, refreshUser, retrySessionRestore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
