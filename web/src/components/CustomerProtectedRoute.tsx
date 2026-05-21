import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/** Customer-only routes that require sign-in (profile, order history, notifications). */
export default function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading, sessionRestoreFailed, retrySessionRestore } = useAuth();
  const location = useLocation();
  const [retryBusy, setRetryBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (token && !user && sessionRestoreFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center">
        <p className="text-muted-foreground max-w-sm">
          We could not verify your session. You may be offline or the connection was interrupted.
        </p>
        <Button
          disabled={retryBusy}
          onClick={async () => {
            setRetryBusy(true);
            try {
              await retrySessionRestore();
            } finally {
              setRetryBusy(false);
            }
          }}
        >
          {retryBusy ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
