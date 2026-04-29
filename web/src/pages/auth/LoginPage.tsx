import PhoneOtpAuth from '@/components/auth/PhoneOtpAuth';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homeForUser } from './authPaths';

export default function LoginPage() {
  const { token, user, isLoading } = useAuth();
  if (!isLoading && token && user) {
    return <Navigate to={homeForUser(user)} replace />;
  }
  return (
    <PhoneOtpAuth
      mode="login"
      title="Welcome back"
      subtitle="Sign in with your phone. We will send a one-time code."
      alternateHint="New here?"
      alternateLabel="Create an account"
      alternateTo="/register"
    />
  );
}
