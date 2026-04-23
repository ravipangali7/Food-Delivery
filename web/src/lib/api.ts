/**
 * API client for Django REST (`/api/`). Set `VITE_API_BASE` to the server origin (e.g. http://api.shyam-sweets.com).
 */

/** Thrown for non-2xx HTTP responses so callers can distinguish 401 from network errors. */
export class ApiHttpError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, { status, data }: { status: number; data: unknown }) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.data = data;
  }
}

const base =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || 'http://api.shyam-sweets.com';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${p}`;
}

/** WebSocket URL for the same origin as `VITE_API_BASE` (http → ws, https → wss). */
export function wsUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const origin = base.replace(/\/$/, '');
  const u = new URL(origin.includes('://') ? origin : `http://${origin}`);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${u.origin}${p}`;
}

export type OrderChatWsThread = 'support' | 'delivery' | 'rider_ops' | 'customer_rider' | 'all';

export function orderChatWebSocketUrl(
  orderId: number,
  token: string | null,
  thread: OrderChatWsThread = 'delivery',
): string | null {
  if (!token) return null;
  const qs = new URLSearchParams({ token, thread });
  return wsUrl(`/ws/chat/${orderId}/?${qs.toString()}`);
}

/** Staff-only: global inbox feed for toast-style new message notifications. */
export function staffInboxWebSocketUrl(token: string | null): string | null {
  if (!token) return null;
  const qs = new URLSearchParams({ token });
  return wsUrl(`/ws/staff/inbox/?${qs.toString()}`);
}

export type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const h = new Headers(headers);
  // Production (OpenResty) returns 415 unless the client asks for JSON; browser fetch defaults to Accept: */*.
  if (!h.has('Accept')) {
    h.set('Accept', 'application/json');
  }
  if (!h.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    h.set('Content-Type', 'application/json');
  }
  if (token) {
    h.set('Authorization', `Token ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...rest, headers: h });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    let detail = res.statusText;
    if (typeof data === 'object' && data !== null) {
      const o = data as Record<string, unknown>;
      if ('detail' in o && o.detail !== undefined) {
        detail = String(o.detail);
      } else if ('non_field_errors' in o && o.non_field_errors !== undefined) {
        detail = String(o.non_field_errors);
      } else {
        const first = Object.values(o).find(
          v => typeof v === 'string' || (Array.isArray(v) && v.length > 0),
        );
        if (typeof first === 'string') detail = first;
        else if (Array.isArray(first) && typeof first[0] === 'string') detail = first[0];
      }
    } else if (typeof data === 'string' && data) {
      detail = data;
    }
    throw new ApiHttpError(detail || `HTTP ${res.status}`, { status: res.status, data });
  }
  return data as T;
}

export async function getJson<T>(path: string, token: string | null): Promise<T> {
  return apiFetch<T>(path, { method: 'GET', token });
}

/** GET without auth (e.g. public config endpoints). */
export async function getPublicJson<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export async function postJson<T, B = unknown>(path: string, body: B, token: string | null): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
}

export async function patchJson<T, B = unknown>(path: string, body: B, token: string | null): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
}

export async function deleteJson<T>(path: string, token: string | null): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE', token });
}

export async function postFormData<T>(path: string, body: FormData, token: string | null): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body, token });
}

export async function patchFormData<T>(path: string, body: FormData, token: string | null): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body, token });
}

/** PATCH multipart with upload progress (0–100) for large app package uploads. */
export function patchFormDataWithProgress<T>(
  path: string,
  body: FormData,
  token: string | null,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', apiUrl(path));
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Token ${token}`);
    }
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)));
      }
    };
    xhr.onload = () => {
      onProgress(100);
      const text = xhr.responseText;
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = text;
        }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let detail = xhr.statusText;
        if (typeof data === 'object' && data !== null) {
          const o = data as Record<string, unknown>;
          if ('detail' in o && o.detail !== undefined) detail = String(o.detail);
          else {
            const first = Object.values(o).find(
              v => typeof v === 'string' || (Array.isArray(v) && v.length > 0),
            );
            if (typeof first === 'string') detail = first;
            else if (Array.isArray(first) && typeof first[0] === 'string') detail = first[0];
          }
        } else if (typeof data === 'string' && data) {
          detail = data;
        }
        reject(new Error(detail || `HTTP ${xhr.status}`));
        return;
      }
      resolve(data as T);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body);
  });
}
