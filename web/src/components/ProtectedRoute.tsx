import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { homeForUser, isAdminUser, isDeliveryPortalUser } from '@/pages/auth/authPaths';
type Portal = 'customer' | 'admin' | 'delivery';

export default function ProtectedRoute({
  portal,
  children,
}: {
  portal: Portal;
  children: React.ReactNode;
}) {
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
          We could not verify your session. You may be offline or the connection was interrupted. Your
          login is still saved—try again when the network is available.
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

  if (portal === 'admin' && !isAdminUser(user)) {
    return <Navigate to={homeForUser(user)} replace />;
  }

  if (portal === 'delivery' && !isDeliveryPortalUser(user)) {
    return <Navigate to={homeForUser(user)} replace />;
  }

  return <>{children}</>;
}
