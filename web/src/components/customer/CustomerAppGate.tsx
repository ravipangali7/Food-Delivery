import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canBrowseWithoutLogin, requiresLoginGate } from '@/lib/appAccess';

/** मोबाइल / Flutter मा अतिथि browse का लागि पहिले Skip Login ट्याप गर्नुपर्छ। */
export default function CustomerAppGate({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();

  if (!requiresLoginGate()) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!canBrowseWithoutLogin(token)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
