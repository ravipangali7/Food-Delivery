import { useCallback, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { OrderInvoiceContent } from '@/components/admin/order-invoice/OrderInvoiceContent';
import {
  downloadInvoiceElementAsPdf,
  embedInvoiceImagesInElement,
  invoicePdfFilename,
  preloadOrderInvoiceImages,
  storeFromSettings,
  waitForImagesInElement,
  type OrderInvoiceImageMap,
  type OrderInvoiceStore,
} from '@/lib/orderInvoice';
import type { Order, SuperSetting } from '@/types';

function orderNeedsDetailFetch(order: Order): boolean {
  const items = order.items ?? [];
  if (items.length === 0) return true;
  return items.some(it => !it.product);
}

async function resolveOrderForInvoice(order: Order, token: string | null): Promise<Order> {
  if (!token || !orderNeedsDetailFetch(order)) return order;
  return getJson<Order>(`/api/orders/${order.id}/`, token);
}

export function useOrderInvoice() {
  const { token } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ['settings', token],
    queryFn: () => getJson<SuperSetting>('/api/settings/', token),
    enabled: !!token,
  });

  const store = useMemo(() => storeFromSettings(settings), [settings]);
  const renderHostRef = useRef<HTMLDivElement | null>(null);
  const reactRootRef = useRef<Root | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const [printState, setPrintState] = useState<{
    order: Order;
    images: OrderInvoiceImageMap;
  } | null>(null);

  const ensureRenderHost = () => {
    if (!renderHostRef.current) {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:-10000px;top:0;width:794px;pointer-events:none;z-index:-1;overflow:hidden;';
      document.body.appendChild(el);
      renderHostRef.current = el;
      reactRootRef.current = createRoot(el);
    }
    return renderHostRef.current;
  };

  const renderOffscreen = (order: Order, images: OrderInvoiceImageMap): Promise<HTMLElement> => {
    const host = ensureRenderHost();
    const root = reactRootRef.current!;

    return new Promise(resolve => {
      root.render(<OrderInvoiceContent order={order} store={store} images={images} />);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const invoice = host.querySelector('[data-order-invoice-root]') as HTMLElement | null;
          resolve(invoice ?? host);
        });
      });
    });
  };

  const prepareImages = useCallback(
    async (order: Order) => {
      const items = order.items ?? [];
      return preloadOrderInvoiceImages(store, items, { authToken: token });
    },
    [store, token],
  );

  const downloadPdf = useCallback(
    async (order: Order) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const fullOrder = await resolveOrderForInvoice(order, token);
        const images = await prepareImages(fullOrder);
        const element = await renderOffscreen(fullOrder, images);
        await embedInvoiceImagesInElement(element, { authToken: token });
        await waitForImagesInElement(element);
        await downloadInvoiceElementAsPdf(
          element,
          invoicePdfFilename(fullOrder.order_number),
          { authToken: token },
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
        reactRootRef.current?.render(null);
      }
    },
    [prepareImages, token],
  );

  const openPrintPreview = useCallback(
    async (order: Order) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const fullOrder = await resolveOrderForInvoice(order, token);
        const images = await prepareImages(fullOrder);
        setPrintState({ order: fullOrder, images });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [prepareImages, token],
  );

  const closePrintPreview = useCallback(() => setPrintState(null), []);

  return {
    store,
    busy,
    downloadPdf,
    openPrintPreview,
    printState,
    closePrintPreview,
  };
}
