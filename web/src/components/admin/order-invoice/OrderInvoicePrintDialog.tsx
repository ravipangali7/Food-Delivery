import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OrderInvoiceContent } from '@/components/admin/order-invoice/OrderInvoiceContent';
import type { OrderInvoiceImageMap, OrderInvoiceStore } from '@/lib/orderInvoice';
import type { Order } from '@/types';

function printInvoiceHtml(html: string, title: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the invoice.');
  }
  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #f5f5f4; font-family: system-ui, sans-serif; }
    @media print {
      body { padding: 0; background: white; }
    }
  </style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  win.focus();
  const runPrint = () => {
    win.print();
  };
  if (win.document.readyState === 'complete') {
    runPrint();
  } else {
    win.onload = runPrint;
  }
}

export function OrderInvoicePrintDialog({
  open,
  onOpenChange,
  order,
  store,
  images,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  store: OrderInvoiceStore;
  images: OrderInvoiceImageMap;
}) {
  const printRootRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const root = printRootRef.current?.querySelector('[data-order-invoice-root]');
    if (!root || !order) return;
    printInvoiceHtml(root.outerHTML, `Invoice ${order.order_number}`);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
          <DialogTitle>Print invoice</DialogTitle>
          <DialogDescription>
            Preview the bill for order {order.order_number}, then print or save as PDF from the print dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/40 p-4 sm:p-6">
          <div
            ref={printRootRef}
            className="mx-auto rounded-lg shadow-md border border-border bg-white overflow-hidden"
          >
            <OrderInvoiceContent order={order} store={store} images={images} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
