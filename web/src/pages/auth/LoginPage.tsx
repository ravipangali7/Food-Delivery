import PhoneOtpAuth from '@/components/auth/PhoneOtpAuth';

export default function LoginPage() {
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
