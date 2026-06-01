import CustomerPasswordAuth from '@/components/auth/CustomerPasswordAuth';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homeForUser } from './authPaths';

export default function RegisterPage() {
  const { token, user, isLoading } = useAuth();
  if (!isLoading && token && user) {
    return <Navigate to={homeForUser(user)} replace />;
  }
  return (
    <CustomerPasswordAuth
      mode="register"
      title="Create your account"
      subtitle="Enter your details and choose a password."
      alternateHint="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
    />
  );
}
