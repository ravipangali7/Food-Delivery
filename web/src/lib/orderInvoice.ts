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

export function absoluteAssetUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) return t;
  if (t.startsWith('/')) return apiUrl(t);
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

/** Candidate URLs to fetch (same-origin /media first when the SPA can proxy it). */
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
  } catch {
    /* ignore */
  }

  return out;
}

async function fetchImageAsDataUrl(fetchUrl: string): Promise<string | null> {
  try {
    const res = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
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

/** Load remote image as data URL for PDF embedding (CORS-safe when server allows). */
export async function loadImageAsDataUrl(url: string | undefined | null): Promise<string | null> {
  const absolute = absoluteAssetUrl(url);
  if (!absolute) return null;

  if (absolute.startsWith('data:')) return absolute;

  for (const candidate of invoiceImageFetchCandidates(absolute)) {
    const fromFetch = await fetchImageAsDataUrl(candidate);
    if (fromFetch) return fromFetch;
  }

  for (const candidate of invoiceImageFetchCandidates(absolute)) {
    const fromImg = await decodeImageToDataUrl(candidate);
    if (fromImg) return fromImg;
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
): Promise<OrderInvoiceImageMap> {
  const [logo, ...itemUrls] = await Promise.all([
    loadImageAsDataUrl(store.logoUrl),
    ...items.map(it => loadImageAsDataUrl(productThumbUrl(it))),
  ]);

  const itemMap: Record<number, string | null> = {};
  items.forEach((it, i) => {
    itemMap[it.id] = itemUrls[i] ?? null;
  });

  return { logo, items: itemMap };
}

export function invoicePdfFilename(orderNumber: string): string {
  const safe = orderNumber.replace(/[^\w.-]+/g, '_');
  return `invoice-${safe}.pdf`;
}

/** Capture a rendered invoice DOM node and download as A4 PDF. */
export async function downloadInvoiceElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    onclone: doc => {
      doc.querySelectorAll('img').forEach(node => {
        const img = node as HTMLImageElement;
        if (img.src.startsWith('data:')) return;
        const raw = img.getAttribute('src');
        if (raw?.startsWith('data:')) img.src = raw;
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

/** Wait for all images inside a node to finish loading (or fail). */
export function waitForImagesInElement(root: HTMLElement, timeoutMs = 12000): Promise<void> {
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
      if (img.complete) return;
      pending += 1;
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    if (pending === 0) finish();
  });
}
