import { useCallback, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GeolocationError, getCurrentPosition } from '@/lib/geolocation';

type UseCurrentLocationButtonProps = {
  onLocation: (lat: number, lng: number) => void;
  onError?: (message: string) => void;
  className?: string;
  disabled?: boolean;
};

export default function UseCurrentLocationButton({
  onLocation,
  onError,
  className,
  disabled = false,
}: UseCurrentLocationButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      onLocation(pos.coords.latitude, pos.coords.longitude);
    } catch (err) {
      const message =
        err instanceof GeolocationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not get your current location.';
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, onError, onLocation]);

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || disabled}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      aria-busy={busy}
    >
      <Crosshair size={18} strokeWidth={2.25} aria-hidden />
      {busy ? 'Finding your location…' : 'Use Current Location'}
    </button>
  );
}
