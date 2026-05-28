import { Loader2, TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  pendingLabel = 'Processing…',
  isPending = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-b border-border bg-destructive/5 px-6 py-5">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-5 w-5" aria-hidden />
          </div>
          <AlertDialogHeader className="space-y-1.5 text-center sm:text-center">
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="gap-2 px-6 py-4 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isPending} className="mt-0">
            Cancel
          </AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
