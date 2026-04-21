import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homeForUser, isAdminUser, isDeliveryPortalUser } from '@/pages/auth/authPaths';
type Portal = 'customer' | 'admin' | 'delivery';

export default function ProtectedRoute({
  portal,
  children,
}: {
  portal: Portal;
  children: React.ReactNode;
}) {
  const { token, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-muted-foreground">
        Loading…
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
