const GUEST_ACCESS_KEY = 'fd_guest_access';

export function isLikelyFlutterWebView(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const w = window as unknown as { flutter_inappwebview?: unknown };
    if (w.flutter_inappwebview) return true;
    return /\bwv\b|Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');
  } catch {
    return false;
  }
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/** Mobile web or Flutter app — login gate applies before guest browsing. */
export function requiresLoginGate(): boolean {
  return isLikelyFlutterWebView() || isMobileViewport();
}

export function hasGuestAccess(): boolean {
  try {
    return localStorage.getItem(GUEST_ACCESS_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableGuestAccess(): void {
  try {
    localStorage.setItem(GUEST_ACCESS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function canBrowseWithoutLogin(token: string | null): boolean {
  if (token) return true;
  if (!requiresLoginGate()) return true;
  return hasGuestAccess();
}
