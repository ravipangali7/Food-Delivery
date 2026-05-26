import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useOrderInvoice } from '@/components/admin/order-invoice/useOrderInvoice';
import { OrderInvoicePrintDialog } from '@/components/admin/order-invoice/OrderInvoicePrintDialog';
import type { Order } from '@/types';

export function OrderInvoiceActions({ order }: { order: Order }) {
  const { busy, downloadPdf, openPrintPreview, printState, closePrintPreview, store } = useOrderInvoice();

  const handleDownload = async () => {
    const toastId = toast.loading('Generating invoice PDF…');
    try {
      await downloadPdf(order);
      toast.success('Invoice downloaded', { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate invoice';
      toast.error(msg, { id: toastId });
    }
  };

  const handlePrint = async () => {
    const toastId = toast.loading('Preparing print preview…');
    try {
      await openPrintPreview(order);
      toast.dismiss(toastId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open print preview';
      toast.error(msg, { id: toastId });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDownload()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50"
        >
          <Download size={14} />
          Download
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePrint()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Printer size={14} />
          Print
        </button>
      </div>
      <OrderInvoicePrintDialog
        open={!!printState}
        onOpenChange={open => {
          if (!open) closePrintPreview();
        }}
        order={printState?.order ?? null}
        store={store}
        images={printState?.images ?? { items: {} }}
      />
    </>
  );
}
