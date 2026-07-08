import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { apiUrl, getApiBase } from '@/lib/api';
import { resolveStoreLogoUrl } from '@/lib/branding';
import type { Order, OrderItem, SuperSetting } from '@/types';

export interface OrderInvoiceStore {
  name: string;
  logoUrl: string;
  address?: string | null;
  phone?: string | null;
}

export interface OrderInvoiceImageMap {
  logo?: string | null;
  items: Record<number, string | null>;
}

export function storeFromSettings(settings: SuperSetting | undefined): OrderInvoiceStore {
  return {
    name: settings?.name?.trim() || 'Store',
    logoUrl: resolveStoreLogoUrl(settings?.logo),
    address: settings?.address,
    phone: settings?.phone,
  };
}

/** URL वा सापेक्ष string बाट ``/media/...`` path निकाल्नुहोस्। */
export function mediaPathFromUrl(url: string): string | null {
  const t = url.trim();
  if (t.startsWith('/media/')) return t;
  try {
    const p = new URL(t).pathname;
    return p.startsWith('/media/') ? p : null;
  } catch {
    return null;
  }
}

export function absoluteAssetUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) return t;
  if (t.startsWith('/')) {
    if (typeof window !== 'undefined') {
      // upload फाइल API मा; bundle SPA asset (जस्तै /logo.png) storefront host मा।
      if (t.startsWith('/media/') || t.startsWith('/api/')) {
        return apiUrl(t);
      }
      return `${window.location.origin}${t}`;
    }
    if (t.startsWith('/media/')) {
      return apiUrl(t);
    }
    return t;
  }
  return apiUrl(`/${t}`);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** fetch गर्ने उम्मेदवार URL (SPA ले proxy गर्न सक्दा same-origin /media पहिले)। */
export function invoiceImageFetchCandidates(url: string): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };

  add(url);

  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/media/')) return out;

    if (typeof window !== 'undefined') {
      const onPage = `${window.location.origin}${parsed.pathname}${parsed.search}`;
      add(onPage);
    }

    const base = getApiBase();
    if (base) {
      const apiOrigin = new URL(base.includes('://') ? base : `http://${base}`).origin;
      add(`${apiOrigin}${parsed.pathname}${parsed.search}`);
    }

    if (!base) {
      add(`${parsed.pathname}${parsed.search}`);
    }

    add(`${parsed.pathname}${parsed.search}`);

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      add(`https://${parsed.host}${parsed.pathname}${parsed.search}`);
    }
  } catch {
    /* बेवास्ता */
  }

  return out;
}

/** स्टाफ API proxy — कच्चा ``/media/`` static मा CORS नभएको अवस्था टाल्छ। */
async function fetchMediaViaAdminProxy(
  mediaPath: string,
  authToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(apiUrl(`/api/admin/media/?path=${encodeURIComponent(mediaPath)}`), {
      headers: {
        Authorization: `Token ${authToken}`,
        Accept: 'image/*,*/*',
      },
    });
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(fetchUrl: string, authToken?: string | null): Promise<string | null> {
  try {
    const headers = authToken ? { Authorization: `Token ${authToken}` } : undefined;
    const res = await fetch(fetchUrl, {
      credentials: 'include',
      headers,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && blob.size < 32) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function decodeImageToDataUrl(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 64;
        canvas.height = img.naturalHeight || 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** PDF embed का लागि टाढाको छवि data URL को रूपमा लोड गर्नुहोस्। */
export async function loadImageAsDataUrl(
  url: string | undefined | null,
  options?: { authToken?: string | null },
): Promise<string | null> {
  const absolute = absoluteAssetUrl(url);
  if (!absolute) return null;

  if (absolute.startsWith('data:')) return absolute;

  const mediaPath = mediaPathFromUrl(absolute);
  if (mediaPath && options?.authToken) {
    const viaProxy = await fetchMediaViaAdminProxy(mediaPath, options.authToken);
    if (viaProxy) return viaProxy;
  }

  for (const candidate of invoiceImageFetchCandidates(absolute)) {
    const fromFetch = await fetchImageAsDataUrl(candidate, options?.authToken);
    if (fromFetch) return fromFetch;
  }

  for (const candidate of invoiceImageFetchCandidates(absolute)) {
    const fromImg = await decodeImageToDataUrl(candidate);
    if (fromImg) return fromImg;
  }

  if (mediaPath && options?.authToken) {
    return fetchMediaViaAdminProxy(mediaPath, options.authToken);
  }

  return null;
}

export function productThumbUrl(item: OrderItem): string | null {
  const p = item.product;
  if (!p) return null;
  return p.thumbnail_url || p.images?.[0]?.image_url || null;
}

export async function preloadOrderInvoiceImages(
  store: OrderInvoiceStore,
  items: OrderItem[],
  options?: { authToken?: string | null },
): Promise<OrderInvoiceImageMap> {
  const [logo, ...itemUrls] = await Promise.all([
    loadImageAsDataUrl(store.logoUrl, options),
    ...items.map(it => loadImageAsDataUrl(productThumbUrl(it), options)),
  ]);

  const itemMap: Record<number, string | null> = {};
  items.forEach((it, i) => {
    itemMap[it.id] = itemUrls[i] ?? null;
  });

  return { logo, items: itemMap };
}

/** capture अघि invoice का सबै ``<img>`` लाई inline data URL प्रयोग गर्न बाध्य पार्नुहोस्। */
export async function embedInvoiceImagesInElement(
  root: HTMLElement,
  options?: { authToken?: string | null },
): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async img => {
      const raw = img.getAttribute('src') || img.src || '';
      if (raw.startsWith('data:')) {
        img.src = raw;
        img.removeAttribute('crossorigin');
        return;
      }
      if (!raw) return;
      const data = await loadImageAsDataUrl(raw, options);
      if (data) {
        img.src = data;
        img.removeAttribute('crossorigin');
      }
    }),
  );
}

export function invoicePdfFilename(orderNumber: string): string {
  const safe = orderNumber.replace(/[^\w.-]+/g, '_');
  return `invoice-${safe}.pdf`;
}

/** render भएको invoice DOM node capture गरी A4 PDF डाउनलोड गर्नुहोस्। */
export async function downloadInvoiceElementAsPdf(
  element: HTMLElement,
  filename: string,
  options?: { authToken?: string | null },
): Promise<void> {
  await embedInvoiceImagesInElement(element, options);
  await waitForImagesInElement(element);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 20000,
    onclone: doc => {
      doc.querySelectorAll('img').forEach(node => {
        const img = node as HTMLImageElement;
        const raw = img.getAttribute('src') || '';
        if (raw.startsWith('data:')) {
          img.src = raw;
          img.removeAttribute('crossorigin');
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(filename);
}

/** node भित्रका सबै छवि लोड (वा असफल) सम्म पर्खनुहोस्। */
export function waitForImagesInElement(root: HTMLElement, timeoutMs = 15000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();

  return new Promise(resolve => {
    let pending = 0;
    const finish = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const done = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    imgs.forEach(img => {
      if (img.complete && img.naturalWidth > 0) return;
      pending += 1;
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    if (pending === 0) finish();
  });
}
