import PhoneOtpAuth from '@/components/auth/PhoneOtpAuth';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homeForUser } from './authPaths';

export default function RegisterPage() {
  const { token, user, isLoading } = useAuth();
  if (!isLoading && token && user) {
    return <Navigate to={homeForUser(user)} replace />;
  }
  return (
    <PhoneOtpAuth
      mode="register"
      title="Create your account"
      subtitle="Enter your details. We will verify your phone with a one-time code."
      alternateHint="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
    />
  );
}
